const assert = require('assert');
const {
  isPathWithinRoot,
  listWorkspaceFiles,
  parseDocument,
  rankDocumentChunks,
  splitText
} = require('../src/workspace-tools');

async function main() {
  const roots = ['C:\\Users\\94320\\Desktop\\简历\\01_事实与证据', 'C:\\Users\\94320\\Desktop\\dx'];
  const scan = listWorkspaceFiles(roots);
  assert(scan.files.length > 0, 'workspace scan should find supported files');
  assert(isPathWithinRoot(scan.files[0].path, roots[0]) || isPathWithinRoot(scan.files[0].path, roots[1]), 'file must stay inside a root');
  assert(!isPathWithinRoot('C:\\Windows\\win.ini', roots[0]), 'path escape must be rejected');
  const document = scan.files.find(file => file.name === '说明书.docx');
  assert(document, 'course document should be discoverable');
  const text = await parseDocument(document.path);
  const result = rankDocumentChunks([{ ...document, chunks: splitText(text).map((content, index) => ({ content, index })) }], '机械设计课程设计');
  assert(result.hasRelevant && result.chunks.length, 'course query should return a relevant chunk');
  console.log(JSON.stringify({ files: scan.files.length, skipped: scan.skipped.length, source: result.chunks[0].source }));
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
