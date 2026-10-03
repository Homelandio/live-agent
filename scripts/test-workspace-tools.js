const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  isPathWithinRoot,
  listWorkspaceFiles,
  parseDocument,
  rankDocumentChunks,
  splitText
} = require('../src/workspace-tools');

async function main() {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'live-agent-workspace-'));
  const fixtureFile = path.join(fixtureRoot, 'course-notes.txt');
  fs.writeFileSync(fixtureFile, '机械设计课程设计包括机构分析、传动方案和结构校核。', 'utf8');
  try {
    const roots = [fixtureRoot];
    const scan = listWorkspaceFiles(roots);
    assert(scan.files.length > 0, 'workspace scan should find supported files');
    assert(isPathWithinRoot(scan.files[0].path, fixtureRoot), 'file must stay inside a root');
    assert(!isPathWithinRoot(path.join(fixtureRoot, '..', 'outside.txt'), fixtureRoot), 'path escape must be rejected');
    const document = scan.files.find(file => file.name === 'course-notes.txt');
    assert(document, 'fixture document should be discoverable');
    const text = await parseDocument(document.path);
    const result = rankDocumentChunks([{ ...document, chunks: splitText(text).map((content, index) => ({ content, index })) }], '机械设计课程设计');
    assert(result.hasRelevant && result.chunks.length, 'course query should return a relevant chunk');
    console.log(JSON.stringify({ files: scan.files.length, skipped: scan.skipped.length, source: result.chunks[0].source }));
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
