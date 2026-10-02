const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadTranscriberProvider, loadTranscriberProviders, normalizeProvider } = require('../src/transcriber-config');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'live-agent-provider-'));
try {
  const bundled = loadTranscriberProvider(root);
  assert.equal(bundled.id, 'funasr-paraformer-zh-streaming');
  const manifestRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'live-agent-provider-manifest-'));
  try {
    fs.writeFileSync(path.join(manifestRoot, 'providers.json'), JSON.stringify({
      schemaVersion: 1,
      providers: [
        bundled,
        { schemaVersion: 1, id: 'sensevoice-small-int8', name: 'SenseVoiceSmall INT8', type: 'local-sidecar', runtime: 'node', command: 'runtime-node/node.exe', entry: 'sensevoice-server.js', args: [] }
      ]
    }), 'utf8');
    const providers = loadTranscriberProviders(manifestRoot);
    assert.deepEqual(providers.map(item => item.id), ['funasr-paraformer-zh-streaming', 'sensevoice-small-int8']);
    assert.equal(loadTranscriberProvider(manifestRoot, '', 'sensevoice-small-int8').runtime, 'node');
  } finally {
    fs.rmSync(manifestRoot, { recursive: true, force: true });
  }
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
