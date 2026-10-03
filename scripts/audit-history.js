const { execFileSync } = require('child_process');

const RULES = [
  { name: 'secret-like API token', pattern: '(^|[^[:alnum:]_-])(sk-[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{20,}|AKIA[0-9A-Z]{16})([^[:alnum:]_-]|$)' },
  { name: 'bearer token literal', pattern: '(^|[^[:alpha:]])Bearer[[:space:]]+[A-Za-z0-9._-]{24,}([^[:alnum:]_-]|$)' },
  { name: 'private key block', pattern: '-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----' },
  { name: 'credential in URL', pattern: 'https?://[^[:space:]/"<>:]+:[^[:space:]/"<>@]+@' },
  { name: 'absolute user path', pattern: '[A-Za-z]:[\\\\/]Users[\\\\/]+[^[:space:]"`<>]+' },
  { name: 'absolute Unix user path', pattern: '(^|/)(Users|home)/[^[:space:]"`<>]+' }
];

function commits() {
  return execFileSync('git', ['rev-list', '--all'], { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
}

let revisions;
try {
  revisions = commits();
} catch (error) {
  console.log(`History audit skipped outside a Git checkout: ${error.message}`);
  process.exit(0);
}

const findings = [];
let inspectionFailed = false;
outer:
for (const revision of revisions) {
  for (const rule of RULES) {
    try {
      const output = execFileSync('git', ['grep', '-I', '-n', '-E', '-e', rule.pattern, revision, '--'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
      const files = [...new Set(output.trim().split(/\r?\n/).map(line => line.replace(`${revision}:`, '').split(':')[0]).filter(Boolean))];
      files.forEach(file => findings.push(`${rule.name}: ${revision.slice(0, 12)} ${file}`));
    } catch (error) {
      if (error.status !== 1) {
        console.error(`History audit could not inspect ${revision.slice(0, 12)}: ${error.message}`);
        inspectionFailed = true;
        break outer;
      }
    }
  }
}

if (inspectionFailed) {
  process.exitCode = 1;
} else {
  const unique = [...new Set(findings)];
  if (unique.length) {
    console.error('Git history audit failed. Revoke exposed credentials and rewrite the affected history:');
    unique.forEach(finding => console.error(`- ${finding}`));
    process.exitCode = 1;
  } else {
    console.log(`Git history audit passed (${revisions.length} reachable commits scanned)`);
  }
}
