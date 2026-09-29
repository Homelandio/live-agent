const fs = require('fs');
const path = require('path');

function emptyVault() {
  return { version: 1, files: [], memories: [], conversations: [] };
}

function normalizeVault(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('知识库文件格式无效');
  return {
    ...value,
    version: Number.isFinite(Number(value.version)) ? Number(value.version) : 1,
    files: Array.isArray(value.files) ? value.files : [],
    memories: Array.isArray(value.memories) ? value.memories : [],
    conversations: Array.isArray(value.conversations) ? value.conversations : []
  };
}

function parseVault(filePath) {
  return normalizeVault(JSON.parse(fs.readFileSync(filePath, 'utf8')));
}

function saveVaultFile(vaultPath, value, { createBackup = true } = {}) {
  const normalized = normalizeVault(value);
  const directory = path.dirname(vaultPath);
  const backupPath = `${vaultPath}.bak`;
  const tempPath = `${vaultPath}.tmp`;
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(tempPath, JSON.stringify(normalized, null, 2), 'utf8');
  if (createBackup && fs.existsSync(vaultPath)) {
    try { fs.copyFileSync(vaultPath, backupPath); } catch { /* Keep the newest valid file even if backup storage fails. */ }
  }
  try {
    fs.renameSync(tempPath, vaultPath);
  } catch {
    fs.copyFileSync(tempPath, vaultPath);
    try { fs.unlinkSync(tempPath); } catch {}
  }
  return normalized;
}

function loadVaultFile(vaultPath) {
  const backupPath = `${vaultPath}.bak`;
  const candidates = [
    { filePath: vaultPath, source: 'primary' },
    { filePath: backupPath, source: 'backup' }
  ];
  const errors = [];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate.filePath)) continue;
    try {
      const vault = parseVault(candidate.filePath);
      if (candidate.source === 'backup') saveVaultFile(vaultPath, vault, { createBackup: false });
      return { vault, recovered: candidate.source === 'backup', source: candidate.source, errors };
    } catch (error) {
      errors.push(`${candidate.source}: ${error.message}`);
    }
  }
  return { vault: emptyVault(), recovered: false, source: 'empty', errors };
}

module.exports = { emptyVault, loadVaultFile, normalizeVault, saveVaultFile };
