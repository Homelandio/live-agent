const fs = require('fs');
const path = require('path');

const DEFAULT_PROVIDER = {
  schemaVersion: 1,
  id: 'funasr-paraformer-zh-streaming',
  name: 'FunASR Paraformer 中文流式',
  type: 'local-sidecar',
  license: 'Apache-2.0',
  repository: 'https://github.com/alibaba-damo-academy/FunASR',
  healthPath: '/health',
  transcribePath: '/transcribe',
  command: 'runtime/python.exe',
  args: ['server.py', '--model-dir', 'models/paraformer-zh-streaming', '--punc-model', 'models/ct-punc', '--hotword-file', 'models/hotwords.txt', '--port', '0']
};

function readJson(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return null; }
}

function normalizeProvider(value = {}) {
  const provider = { ...DEFAULT_PROVIDER, ...(value && typeof value === 'object' ? value : {}) };
  if (Number(provider.schemaVersion) !== 1) throw new Error('转录提供者配置版本不受支持');
  if (!['local-sidecar', 'http'].includes(provider.type)) throw new Error('转录提供者类型不受支持');
  if (!String(provider.id || '').trim() || !String(provider.name || '').trim()) throw new Error('转录提供者缺少 id 或 name');
  provider.healthPath = String(provider.healthPath || '/health');
  provider.transcribePath = String(provider.transcribePath || '/transcribe');
  provider.args = Array.isArray(provider.args) ? provider.args.map(item => String(item)) : DEFAULT_PROVIDER.args.slice();
  if (provider.type === 'local-sidecar' && !String(provider.command || '').trim()) throw new Error('本地转录提供者缺少 command');
  if (provider.type === 'http') {
    const endpoint = new URL(String(provider.endpoint || ''));
    if (!['http:', 'https:'].includes(endpoint.protocol)) throw new Error('外接转录 endpoint 必须使用 HTTP 或 HTTPS');
    provider.endpoint = endpoint.toString().replace(/\/$/, '');
    provider.apiKeyEnv = String(provider.apiKeyEnv || '').trim();
  }
  return provider;
}

function loadTranscriberProvider(root, overridePath = '') {
  const override = overridePath && readJson(overridePath);
  const bundled = readJson(path.join(root, 'provider.json'));
  return normalizeProvider(override || bundled || DEFAULT_PROVIDER);
}

function resolveProviderCommand(root, command) {
  const value = String(command || '').trim();
  return path.isAbsolute(value) ? value : path.resolve(root, value);
}

module.exports = { DEFAULT_PROVIDER, loadTranscriberProvider, normalizeProvider, resolveProviderCommand };
