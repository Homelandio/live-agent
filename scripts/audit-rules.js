const TEXT_RULES = [
  {
    name: 'secret-like API token',
    pattern: /\b(?:sk-[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{20,}|AKIA[0-9A-Z]{16})\b/i
  },
  {
    name: 'bearer token literal',
    pattern: /\bBearer[ \t]+[A-Za-z0-9._-]{24,}\b/i
  },
  {
    name: 'private key block',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/i
  },
  {
    name: 'credential in URL',
    pattern: /\bhttps?:\/\/[^\s/'"`<>:]+:[^\s/'"`<>@]+@/i
  },
  {
    name: 'absolute user path',
    pattern: /(?:[A-Za-z]:[\\/]Users[\\/]+[^\s'"`<>]+|\/(?:Users|home)\/[^\s'"`<>]+)/i
  }
];

const TRACKED_PATH_RULES = [
  { name: 'environment file', pattern: /(?:^|\/)\.env(?:\.[^/]+)?$/i, allow: file => file === '.env.example' },
  { name: 'application data file', pattern: /(?:^|\/)(?:vault\.json(?:\.bak)?|transcriber-provider\.json|transcriber-selection\.json|live-shortcuts\.json)$/i },
  { name: 'private key file', pattern: /\.(?:pem|key|p12|pfx)$/i }
];

module.exports = { TEXT_RULES, TRACKED_PATH_RULES };
