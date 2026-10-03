# Privacy and Data Flow

Live Agent is designed as a local-first desktop application, but an external answer model or web search can receive data when the user enables those features.

## Local data

The following remain in the operating-system application-data directory:

- imported knowledge-base documents and extracted chunks;
- long-term memories and recent conversations;
- API settings and the selected transcription provider;
- user skills, workspace authorization, and shortcut preferences.

They are not part of the Git repository, the npm package source, or the public release audit input. The application provides its own export and deletion controls.

## Network data

- Answer requests send the current prompt and the selected context to the configured compatible API.
- Optional public web supplementation sends the current query to the configured search service and returns attributed public results.
- Local transcription providers process audio on the same machine and expose a loopback-only HTTP contract.
- No browser login session or desktop-app session is silently reused as an API credential.

Review the selected provider's terms before sending private context to it. Disable web supplementation when a question contains confidential material.

## Public repository boundary

The repository excludes `.env` files, provider overrides, vault backups, model weights, local runtimes, build output, and application-data exports. Run `npm test` before publishing. If a secret is ever committed, revoke it immediately and rewrite all reachable history before pushing.

## Screen capture limitation

The overlay uses Electron/Windows content-protection hints and hides itself during supported screenshot flows. These are best-effort OS signals, not absolute protection against a driver-level capture device or a camera pointed at the display.
