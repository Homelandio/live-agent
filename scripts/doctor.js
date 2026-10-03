const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const major = Number(process.versions.node.split('.')[0]);
const required = [
  ['package.json', fs.existsSync(path.join(root, 'package.json'))],
  ['node_modules/electron', fs.existsSync(path.join(root, 'node_modules', 'electron'))],
  ['node_modules/mammoth', fs.existsSync(path.join(root, 'node_modules', 'mammoth'))],
  ['node_modules/pdf-parse', fs.existsSync(path.join(root, 'node_modules', 'pdf-parse'))]
];
const optional = [
  ['FunASR runtime', fs.existsSync(path.join(root, 'transcriber', 'runtime', 'python.exe'))],
  ['SenseVoice Node runtime', fs.existsSync(path.join(root, 'transcriber', 'runtime-node', 'node.exe'))],
  ['SenseVoice model', fs.existsSync(path.join(root, 'transcriber', 'models', 'sensevoice-int8', 'model.int8.onnx'))],
  ['SenseVoice VAD', fs.existsSync(path.join(root, 'transcriber', 'models', 'sensevoice-int8', 'silero_vad.onnx'))]
];

console.log(`Node.js: ${process.version} ${major >= 20 ? 'OK' : 'upgrade to Node 20 or newer'}`);
required.forEach(([name, present]) => console.log(`${present ? 'OK' : 'MISSING'} required: ${name}`));
optional.forEach(([name, present]) => console.log(`${present ? 'OK' : 'optional'} ${name}`));
if (major < 20 || required.some(([, present]) => !present)) process.exitCode = 1;
