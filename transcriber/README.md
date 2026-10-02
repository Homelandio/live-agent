# Transcription provider interface

The desktop app talks to a transcription provider through a small local HTTP contract:

- `GET /health` returns JSON and a successful 2xx status.
- `POST /transcribe` receives a `16 kHz`, mono or multi-channel, `16-bit PCM WAV` body and returns JSON such as `{"text":"..."}`. The bundled adapter also returns `rawText`, `punctuatedText`, and `punctuationApplied`; consumers must treat `rawText` as the recognition record and use punctuation only for display.
- The provider must bind only to loopback when it is a local sidecar.

`provider.json` describes the bundled provider. Optional `--punc-model` and `--hotword-file` arguments are ignored safely when their assets are absent, so the base ASR can start without downloading extra weights. It can be replaced by a compatible local model without changing the renderer. A user-only override may be placed at the application data path as `transcriber-provider.json`; it is intentionally outside the Git repository and may use an external `http` provider. External credentials must be supplied through the configured environment variable (`apiKeyEnv`), never committed to the manifest.

The default implementation uses FunASR Paraformer. The optional SenseVoice provider uses the CPU-only SenseVoiceSmall INT8 ONNX model through `sherpa-onnx-node`; its sidecar is started with the portable Node runtime under `runtime-node/`. Only one local provider is started at a time. FunASR, SenseVoice, sherpa-onnx, and their model assets are third-party components; see `THIRD_PARTY_NOTICES.md` and the upstream licenses. This repository contains the adapters and launch contract; downloaded runtime and model assets are machine/build resources and are ignored by Git. A future provider can be an external ASR API or another local model as long as it implements the same contract.

## Accuracy roadmap

The current bundled model is the FunASR Paraformer Chinese streaming model. The renderer supports both manually delimited intervals and a VAD-based near-real-time mode. The provider can optionally load a local CT-Punc model through `--punc-model`; if that directory is absent, the service returns the raw Paraformer text without delaying startup. The answer model may reason about likely homophones or missing punctuation, but it must not overwrite the raw transcript.

Candidate providers checked for future experiments:

- [FunASR](https://github.com/modelscope/FunASR) (MIT): keep the current adapter, and optionally add `fsmn-vad` plus `ct-punc-c` when their model assets are bundled. This is the lowest-risk Chinese upgrade path, but it needs additional model weights.
- [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) (Apache-2.0): strong offline/streaming packaging, VAD, hotwords and multiple runtime targets. It is a good long-term embedded provider, but requires a new ONNX model bundle and adapter.
- [SenseVoice](https://github.com/QwenAudio/SenseVoice) (MIT): Chinese, Cantonese, English, Japanese and Korean recognition with language/event signals. It is useful for noisy conversational audio, but should be benchmarked on the user's actual system-audio samples before replacing Paraformer.
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper) (MIT) with [Silero VAD](https://github.com/snakers4/silero-vad) (MIT): a high-quality fallback for finalized intervals. It generally costs more CPU/RAM and latency than the bundled model, so it is not the default live provider.
- [whisper.cpp](https://github.com/ggml-org/whisper.cpp) (MIT): a compact C/C++ fallback with CPU-friendly quantized models, but Chinese accuracy and latency depend heavily on the selected model.

Projects marketed as interview copilots were reviewed only for workflow ideas. They commonly combine rolling audio buffers and floating prompts, but they do not improve recognition quality by themselves and are not bundled as code. New providers should implement `/health` and `/transcribe` rather than changing the renderer.
