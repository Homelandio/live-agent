const fs = require('fs');
const { execFileSync } = require('child_process');
const { TEXT_RULES, TRACKED_PATH_RULES } = require('./audit-rules');

function trackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
}

function scanFile(file) {
  if (!fs.existsSync(file)) return [];
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size > 12 * 1024 * 1024) return [];
  const text = fs.readFileSync(file, 'utf8');
  return TEXT_RULES.filter(rule => rule.pattern.test(text)).map(rule => `${rule.name}: ${file}`);
}

function scanPath(file) {
  return TRACKED_PATH_RULES
    .filter(rule => rule.pattern.test(file) && !(rule.allow && rule.allow(file)))
    .map(rule => `${rule.name}: ${file}`);
}

let files;
try {
  files = trackedFiles();
} catch (error) {
  console.error(`Public release audit could not read Git index: ${error.message}`);
  process.exit(1);
}

const findings = [...new Set(files.flatMap(file => [...scanPath(file), ...scanFile(file)]))];
if (findings.length) {
  console.error('Public release audit failed. Remove the reported category before publishing:');
  findings.forEach(finding => console.error(`- ${finding}`));
  process.exitCode = 1;
} else {
  console.log(`Public release audit passed (${files.length} tracked files scanned)`);
}
