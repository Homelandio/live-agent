const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadVaultFile, saveVaultFile } = require('../src/vault-store');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'live-agent-vault-'));
const vaultPath = path.join(root, 'vault.json');
try {
  saveVaultFile(vaultPath, { version: 1, files: [{ id: 'one' }], memories: [], conversations: [] });
  saveVaultFile(vaultPath, { version: 1, files: [{ id: 'two' }], memories: [{ text: 'fact' }], conversations: [] });
  assert.equal(JSON.parse(fs.readFileSync(`${vaultPath}.bak`, 'utf8')).files[0].id, 'one');
  fs.writeFileSync(vaultPath, '{broken', 'utf8');
  const recovered = loadVaultFile(vaultPath);
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.vault.files[0].id, 'one');
  assert.equal(JSON.parse(fs.readFileSync(vaultPath, 'utf8')).files[0].id, 'one');
  console.log('vault persistence tests passed');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
