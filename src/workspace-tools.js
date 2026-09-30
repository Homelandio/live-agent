const fs = require('fs');
const path = require('path');

const SUPPORTED_EXTENSIONS = new Set(['.txt', '.md', '.json', '.csv', '.pdf', '.docx']);
const SKIP_DIRECTORIES = new Set(['.git', 'node_modules', 'dist', 'build', 'release', 'release-v11', 'release-skills', 'transcriber']);
const MAX_FILE_BYTES = 24 * 1024 * 1024;
const STOP_TERMS = new Set(['我们', '你们', '他们', '这个', '那个', '可以', '需要', '进行', '相关', '内容', '问题', '什么', '如何', '是否', '以及', '一个', '没有', '就是', '因为', '所以', '用于', '目前', '其中', 'about', 'after', 'also', 'from', 'have', 'that', 'this', 'with']);

function normalizeDocumentText(text) {
  return String(text || '')
    .replace(/\u0000/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitText(text, size = 1400, overlap = 160) {
  const source = normalizeDocumentText(text);
  const chunks = [];
  if (!source) return chunks;
  let start = 0;
  while (start < source.length) {
    let end = Math.min(source.length, start + size);
    if (end < source.length) {
      const window = source.slice(start + Math.floor(size * 0.62), end);
      const boundary = [...window.matchAll(/[\n。！？；.!?;](?:\s|$)/g)].pop();
      if (boundary) end = start + Math.floor(size * 0.62) + boundary.index + boundary[0].length;
    }
    const chunk = source.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= source.length) break;
    start = Math.max(start + 1, end - overlap);
  }
  return chunks;
}

function searchTerms(text) {
  const source = String(text || '').toLowerCase();
  const raw = source.match(/[a-z0-9][a-z0-9_-]{1,}|[\u4e00-\u9fff]+/g) || [];
  const terms = new Set();
  for (const token of raw) {
    if (/^[\u4e00-\u9fff]+$/.test(token)) {
      for (let i = 0; i < token.length - 1; i += 1) terms.add(token.slice(i, i + 2));
    } else if (!STOP_TERMS.has(token)) terms.add(token);
  }
  return [...terms].filter(term => !STOP_TERMS.has(term));
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
  if (['.txt', '.md', '.json', '.csv'].includes(ext)) return normalizeDocumentText(fs.readFileSync(filePath, 'utf8'));
  if (ext === '.pdf') {
    const { PDFParse } = require('pdf-parse');
    const parser = new PDFParse({ data: fs.readFileSync(filePath) });
    const result = await parser.getText();
    await parser.destroy();
    return normalizeDocumentText(result.text);
  }
  if (ext === '.docx') return normalizeDocumentText((await require('mammoth').extractRawText({ path: filePath })).value);
  return '';
}

function countTerms(text) {
  const counts = new Map();
  const source = String(text || '').toLowerCase();
  const raw = source.match(/[a-z0-9][a-z0-9_-]{1,}|[\u4e00-\u9fff]+/g) || [];
  for (const token of raw) {
    if (/^[\u4e00-\u9fff]+$/.test(token)) {
      for (let i = 0; i < token.length - 1; i += 1) {
        const term = token.slice(i, i + 2);
        if (!STOP_TERMS.has(term)) counts.set(term, (counts.get(term) || 0) + 1);
      }
    } else if (!STOP_TERMS.has(token)) counts.set(token, (counts.get(token) || 0) + 1);
  }
  return counts;
}

function chunkSimilarity(left, right) {
  const a = new Set(searchTerms(left));
  const b = new Set(searchTerms(right));
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const term of a) if (b.has(term)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

function rankDocumentChunks(documents, query, maxChunks = 10) {
  const terms = searchTerms(query);
  const phrase = normalizeDocumentText(query).toLowerCase();
  if (!terms.length && !phrase) return { chunks: [], hasRelevant: false, candidates: 0, retrieval: 'hybrid-bm25-tfidf' };
  const allChunks = [];
  for (const document of documents || []) for (const chunk of document.chunks || []) {
    const content = normalizeDocumentText(chunk.content);
    if (!content) continue;
    allChunks.push({ document, chunk, content, lower: content.toLowerCase(), termCounts: countTerms(content) });
  }
  const documentFrequency = new Map();
  for (const row of allChunks) for (const term of terms) if (row.termCounts.has(term)) documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
  const averageLength = allChunks.reduce((sum, row) => sum + Math.max(1, [...row.termCounts.values()].reduce((a, b) => a + b, 0)), 0) / Math.max(1, allChunks.length);
  const total = Math.max(1, allChunks.length);
  const rows = [];
  for (const row of allChunks) {
    const { document, chunk, lower, termCounts } = row;
    const length = Math.max(1, [...termCounts.values()].reduce((a, b) => a + b, 0));
    let score = 0;
    let matchedTerms = 0;
    for (const term of terms) {
      const tf = termCounts.get(term) || 0;
      if (!tf) continue;
      matchedTerms += 1;
      const df = documentFrequency.get(term) || 0;
      const idf = Math.log(1 + (total - df + 0.5) / (df + 0.5));
      const saturation = (tf * 2.2) / (tf + 1.2 * (0.35 + 0.65 * length / averageLength));
      score += idf * saturation;
    }
    const coverage = matchedTerms / Math.max(1, terms.length);
    const phraseScore = phrase && lower.includes(phrase) ? Math.min(12, 4 + phrase.length / 20) : 0;
    const fileName = String(document.name || '').toLowerCase();
    const nameScore = terms.reduce((sum, term) => sum + (fileName.includes(term) ? 1.75 : 0), 0);
    const coverageScore = coverage >= 0.5 ? coverage * 2.5 : coverage;
    score += phraseScore + nameScore + coverageScore;
    if (score > 0) rows.push({
      source: document.name,
      fileId: document.path || document.id,
      index: chunk.index,
      score,
      coverage,
      matchedTerms,
      retrieval: 'hybrid-bm25-tfidf',
      content: row.content
    });
  }
  rows.sort((a, b) => b.score - a.score || b.coverage - a.coverage || a.index - b.index);
  const selected = [];
  const perSource = new Map();
  const remaining = rows.slice();
  while (remaining.length && selected.length < maxChunks) {
    let bestIndex = -1;
    let bestValue = -Infinity;
    for (let i = 0; i < remaining.length; i += 1) {
      const row = remaining[i];
      if ((perSource.get(row.source) || 0) >= 3) continue;
      const redundancy = selected.reduce((max, item) => Math.max(max, chunkSimilarity(item.content, row.content)), 0);
      const value = row.score * (1 - Math.min(0.45, redundancy * 0.45));
      if (value > bestValue) { bestValue = value; bestIndex = i; }
    }
    if (bestIndex < 0) break;
    const row = remaining.splice(bestIndex, 1)[0];
    selected.push(row);
    perSource.set(row.source, (perSource.get(row.source) || 0) + 1);
  }
  return { chunks: selected, hasRelevant: rows.length > 0, candidates: rows.length, retrieval: 'hybrid-bm25-tfidf' };
}

module.exports = {
  MAX_FILE_BYTES,
  SUPPORTED_EXTENSIONS,
  isPathWithinRoot,
  listWorkspaceFiles,
  normalizeDocumentText,
  normalizeRoots,
  parseDocument,
  rankDocumentChunks,
  searchTerms,
  splitText
};
