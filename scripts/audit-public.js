const fs = require('fs');
const { execFileSync } = require('child_process');

const patterns = [
  { name: 'OpenAI-style secret', pattern: /\bsk-[A-Za-z0-9]{20,}\b/g },
  { name: 'bearer token literal', pattern: /Bearer\s+[A-Za-z0-9._-]{24,}/gi },
  { name: 'Windows user path', pattern: /[A-Z]:\\Users\\[^\s`"']+/gi },
  { name: 'known private endpoint', pattern: /2btocken\.xyz/gi }
];

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const findings = [];
for (const file of files) {
  if (!fs.existsSync(file)) continue;
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size > 12 * 1024 * 1024) continue;
  const text = fs.readFileSync(file, 'utf8');
  for (const item of patterns) if (item.pattern.test(text)) findings.push(`${item.name}: ${file}`);
  for (const item of patterns) item.pattern.lastIndex = 0;
}
if (findings.length) {
  console.error('Public release audit failed:\n' + findings.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Public release audit passed (${files.length} tracked files scanned)`);
}
