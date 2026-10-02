/*
 * Local SenseVoiceSmall INT8 sidecar.
 * The Electron main process starts this file with ELECTRON_RUN_AS_NODE=1,
 * keeping model inference outside the renderer and the answer-model API.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const SAMPLE_RATE = 16000;
const LANGUAGE_VALUES = new Set(['auto', 'zh', 'en', 'yue', 'ja', 'ko']);

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith('--')) continue;
    const name = item.slice(2);
    result[name] = argv[index + 1]?.startsWith('--') ? true : argv[++index];
  }
  return result;
}

function requiredPath(value, label) {
  const target = path.resolve(process.cwd(), String(value || ''));
  if (!fs.existsSync(target)) throw new Error(`${label}不存在：${target}`);
  return target;
}

function readWav(payload) {
  if (payload.length < 44 || payload.toString('ascii', 0, 4) !== 'RIFF' || payload.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('输入不是有效的 WAV 音频');
  }
  let format;
  let dataStart = -1;
  let dataLength = 0;
  let offset = 12;
  while (offset + 8 <= payload.length) {
    const chunkId = payload.toString('ascii', offset, offset + 4);
    const chunkLength = payload.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    if (chunkId === 'fmt ' && chunkLength >= 16 && chunkStart + 16 <= payload.length) {
      format = {
        audioFormat: payload.readUInt16LE(chunkStart),
        channels: payload.readUInt16LE(chunkStart + 2),
        sampleRate: payload.readUInt32LE(chunkStart + 4),
        bitsPerSample: payload.readUInt16LE(chunkStart + 14)
      };
    }
    if (chunkId === 'data') {
      dataStart = chunkStart;
      dataLength = Math.min(chunkLength, payload.length - chunkStart);
      break;
    }
    offset = chunkStart + chunkLength + (chunkLength % 2);
  }
  if (!format || dataStart < 0) throw new Error('WAV 缺少音频格式或数据块');
  if (format.audioFormat !== 1 || format.sampleRate !== SAMPLE_RATE || format.bitsPerSample !== 16) {
    throw new Error('SenseVoice 只接受 16 kHz 16-bit PCM WAV 音频');
  }
  if (![1, 2].includes(format.channels)) throw new Error('SenseVoice 只接受单声道或双声道 WAV 音频');
  const frameCount = Math.floor(dataLength / 2 / format.channels);
  const samples = new Float32Array(frameCount);
  for (let frame = 0; frame < frameCount; frame += 1) {
    let total = 0;
    for (let channel = 0; channel < format.channels; channel += 1) {
      total += payload.readInt16LE(dataStart + (frame * format.channels + channel) * 2) / 32768;
    }
    samples[frame] = total / format.channels;
  }
  return { samples, audioSeconds: frameCount / SAMPLE_RATE };
}

function cleanText(value) {
  return String(value || '')
    .replace(/<\|[^|>]+\|>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function createRecognizer(modelPath, tokensPath, vadPath, threads = 2) {
  const sherpa = require('sherpa-onnx-node');
  const modelConfig = {
    featConfig: { sampleRate: SAMPLE_RATE, featureDim: 80 },
    modelConfig: {
      senseVoice: { model: modelPath, language: 'auto', useInverseTextNormalization: 1 },
      tokens: tokensPath,
      numThreads: threads,
      provider: 'cpu',
      debug: 0
    }
  };
  const recognizer = new sherpa.OfflineRecognizer(modelConfig);
  const vad = new sherpa.Vad({
    sileroVad: {
      model: vadPath,
      threshold: 0.5,
      minSilenceDuration: 0.5,
      minSpeechDuration: 0.25,
      maxSpeechDuration: 30,
      windowSize: 512
    },
    sampleRate: SAMPLE_RATE,
    numThreads: threads,
    provider: 'cpu',
    debug: 0
  }, 32);
  return (samples, language) => {
    modelConfig.modelConfig.senseVoice.language = language;
    if (typeof recognizer.setConfig === 'function') recognizer.setConfig(modelConfig);
    vad.reset();
    const texts = [];
    const drain = () => {
      while (!vad.isEmpty()) {
        const segment = vad.front(false);
        const stream = recognizer.createStream();
        stream.acceptWaveform({ sampleRate: SAMPLE_RATE, samples: segment.samples });
        recognizer.decode(stream);
        texts.push(cleanText(recognizer.getResult(stream).text));
        vad.pop();
      }
    };
    for (let offset = 0; offset < samples.length; offset += 512) {
      vad.acceptWaveform(samples.subarray(offset, offset + 512));
      drain();
    }
    vad.flush();
    drain();
    const text = texts.filter(Boolean).join(' ').trim();
    return { text, rawText: text, punctuatedText: text, punctuationApplied: true };
  };
}

function startServer(port, transcribe) {
  const server = http.createServer((request, response) => {
    const reply = (status, value) => {
      const body = Buffer.from(JSON.stringify(value), 'utf8');
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': body.length });
      response.end(body);
    };
    if (request.method === 'GET' && request.url === '/health') {
      reply(200, { ok: true, model: 'SenseVoiceSmall INT8', provider: 'sherpa-onnx-node', language: ['auto', 'zh', 'en', 'yue', 'ja', 'ko'] });
      return;
    }
    if (request.method !== 'POST' || !request.url?.startsWith('/transcribe')) {
      reply(404, { error: 'not found' });
      return;
    }
    const chunks = [];
    let size = 0;
    request.on('data', chunk => {
      size += chunk.length;
      if (size <= 20 * 1024 * 1024) chunks.push(chunk);
    });
    request.on('end', () => {
      if (size <= 0 || size > 20 * 1024 * 1024) {
        reply(413, { error: '音频请求大小无效' });
        return;
      }
      try {
        const url = new URL(request.url, 'http://127.0.0.1');
        const language = String(url.searchParams.get('language') || 'zh');
        if (!LANGUAGE_VALUES.has(language)) throw new Error('不支持的 SenseVoice 语言设置');
        const wav = readWav(Buffer.concat(chunks));
        if (wav.samples.length < SAMPLE_RATE / 100) {
          reply(200, { text: '', rawText: '', punctuatedText: '', punctuationApplied: false, audioSeconds: wav.audioSeconds });
          return;
        }
        reply(200, { ...transcribe(wav.samples, language), audioSeconds: wav.audioSeconds });
      } catch (error) {
        reply(400, { error: error.message || String(error) });
      }
    });
  });
  server.listen(Number(port) || 0, '127.0.0.1', () => {
    process.stdout.write(`READY ${server.address().port}\n`);
  });
  const close = () => server.close(() => process.exit(0));
  process.once('SIGTERM', close);
  process.once('SIGINT', close);
}

try {
  const args = parseArgs(process.argv.slice(2));
  const modelPath = requiredPath(args.model, 'SenseVoice 模型');
  const tokensPath = requiredPath(args.tokens, 'SenseVoice 词表');
  const vadPath = requiredPath(args.vad, 'Silero VAD 模型');
  const threads = Math.max(1, Number(args.threads) || 2);
  startServer(args.port, createRecognizer(modelPath, tokensPath, vadPath, threads));
} catch (error) {
  process.stderr.write(`ERROR ${error.message || String(error)}\n`);
  process.exitCode = 1;
}
