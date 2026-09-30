const fs = require('fs');
const path = require('path');

const SUPPORTED_EXTENSIONS = new Set(['.txt', '.md', '.json', '.csv', '.pdf', '.docx']);
const SKIP_DIRECTORIES = new Set(['.git', 'node_modules', 'dist', 'build', 'release', 'release-v11', 'release-skills', 'transcriber']);
const MAX_FILE_BYTES = 24 * 1024 * 1024;

function splitText(text, size = 1400, overlap = 160) {
  const chunks = [];
  for (let i = 0; i < text.length; i += Math.max(1, size - overlap)) chunks.push(text.slice(i, i + size));
  return chunks;
}

function searchTerms(text) {
  const source = String(text || '').toLowerCase();
  const raw = source.match(/[a-z0-9][a-z0-9_-]{1,}|[\u4e00-\u9fff]+/g) || [];
  const terms = new Set();
  for (const token of raw) {
    if (/^[\u4e00-\u9fff]+$/.test(token)) {
      if (token.length === 1) terms.add(token);
      for (let i = 0; i < token.length - 1; i++) terms.add(token.slice(i, i + 2));
    } else terms.add(token);
  }
  return [...terms];
}

function normalizeRoots(roots) {
  return [...new Set((Array.isArray(roots) ? roots : []).map(item => path.resolve(String(item || '').trim())).filter(item => {
    try { return fs.statSync(item).isDirectory(); } catch { return false; }
  }))];
}

function isPathWithinRoot(filePath, root) {
  const candidate = path.resolve(String(filePath || ''));
  const base = path.resolve(String(root || ''));
  const relative = path.relative(base, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function listWorkspaceFiles(roots, { maxFiles = 600 } = {}) {
  const files = [];
  const skipped = [];
  const visited = new Set();
  const visit = directory => {
    if (files.length >= maxFiles) return;
    let entries;
    try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (files.length >= maxFiles) break;
      if (entry.name.startsWith('.') || SKIP_DIRECTORIES.has(entry.name)) continue;
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) { visit(filePath); continue; }
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.has(ext)) { skipped.push(filePath); continue; }
      try {
        const stat = fs.statSync(filePath);
        if (stat.size > MAX_FILE_BYTES) { skipped.push(filePath); continue; }
        const key = `${filePath.toLowerCase()}|${stat.size}|${stat.mtimeMs}`;
        if (visited.has(key)) continue;
        visited.add(key);
        files.push({ path: filePath, name: entry.name, ext, size: stat.size, mtimeMs: stat.mtimeMs });
      } catch { /* Files can disappear while a workspace is being scanned. */ }
    }
  };
  normalizeRoots(roots).forEach(visit);
  return { files, skipped, truncated: files.length >= maxFiles };
}

async function parseDocument(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (['.txt', '.md', '.json', '.csv'].includes(ext)) return fs.readFileSync(filePath, 'utf8');
  if (ext === '.pdf') {
    const { PDFParse } = require('pdf-parse');
    const parser = new PDFParse({ data: fs.readFileSync(filePath) });
    const result = await parser.getText();
    await parser.destroy();
    return result.text;
  }
  if (ext === '.docx') return (await require('mammoth').extractRawText({ path: filePath })).value;
  return '';
}

function rankDocumentChunks(documents, query, maxChunks = 10) {
  const terms = searchTerms(query);
  const phrase = String(query || '').trim().toLowerCase();
  if (!terms.length && !phrase) return { chunks: [], hasRelevant: false };
  const rows = [];
  for (const document of documents) for (const chunk of document.chunks || []) {
    const lower = chunk.content.toLowerCase();
    const termScore = terms.reduce((score, term) => score + (lower.includes(term) ? 1 : 0), 0);
    const phraseScore = phrase && lower.includes(phrase) ? Math.min(8, phrase.length) : 0;
    const nameScore = terms.reduce((score, term) => score + (document.name.toLowerCase().includes(term) ? 2 : 0), 0);
    const score = termScore + phraseScore + nameScore;
    if (score > 0) rows.push({ source: document.name, fileId: document.path, index: chunk.index, score, content: chunk.content });
  }
  rows.sort((a, b) => b.score - a.score || a.index - b.index);
  const selected = [];
  const perSource = new Map();
  for (const row of rows) {
    const count = perSource.get(row.source) || 0;
    if (count >= 3) continue;
    selected.push(row); perSource.set(row.source, count + 1);
    if (selected.length >= maxChunks) break;
  }
  return { chunks: selected, hasRelevant: rows.length > 0 };
}

module.exports = {
  MAX_FILE_BYTES,
  SUPPORTED_EXTENSIONS,
  isPathWithinRoot,
  listWorkspaceFiles,
  normalizeRoots,
  parseDocument,
  rankDocumentChunks,
  searchTerms,
  splitText
};
