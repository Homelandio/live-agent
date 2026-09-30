const assert = require('node:assert/strict');
const { rankDocumentChunks, splitText } = require('../src/workspace-tools');

const documents = [
  {
    name: '简历.md',
    path: 'resume',
    chunks: splitText('RoboMaster 机器人项目中负责机械结构设计、装配和测试验证。掌握机械制图与基础制造流程。').map((content, index) => ({ content, index }))
  },
  {
    name: '机设说明书.docx',
    path: 'course',
    chunks: splitText('课程设计主题：机械臂末端执行器。完成方案比较、结构设计、尺寸校核和装配说明。').map((content, index) => ({ content, index }))
  },
  {
    name: '无关资料.md',
    path: 'other',
    chunks: splitText('校园活动安排与社团通知。').map((content, index) => ({ content, index }))
  }
];

const result = rankDocumentChunks(documents, '机械结构设计与装配验证', 6);
assert.equal(result.retrieval, 'hybrid-bm25-tfidf');
assert(result.hasRelevant && result.chunks.length >= 2, 'hybrid retrieval should find multiple relevant files');
assert(result.chunks.some(item => item.source === '简历.md'), 'resume evidence should be retrieved');
assert(result.chunks.some(item => item.source === '机设说明书.docx'), 'course evidence should be retrieved');
assert(!result.chunks.some(item => item.source === '无关资料.md'), 'irrelevant file should not outrank evidence');
assert(result.chunks.every(item => item.coverage > 0), 'retrieval rows should expose coverage');
console.log('hybrid retrieval tests passed');
