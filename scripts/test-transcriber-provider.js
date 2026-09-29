const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadTranscriberProvider, normalizeProvider } = require('../src/transcriber-config');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'live-agent-provider-'));
try {
  const bundled = loadTranscriberProvider(root);
  assert.equal(bundled.id, 'funasr-paraformer-zh-streaming');
  const configPath = path.join(root, 'provider.json');
  fs.writeFileSync(configPath, JSON.stringify({ schemaVersion: 1, id: 'remote-test', name: 'Remote test', type: 'http', endpoint: 'https://example.test/asr', apiKeyEnv: 'TEST_ASR_KEY' }), 'utf8');
  const remote = loadTranscriberProvider(root);
  assert.equal(remote.type, 'http');
  assert.equal(remote.endpoint, 'https://example.test/asr');
  assert.throws(() => normalizeProvider({ schemaVersion: 1, id: 'bad', name: 'Bad', type: 'http', endpoint: 'file:///tmp/asr' }));
  console.log('transcriber provider tests passed');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
