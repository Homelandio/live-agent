# Agent Operating Guide

This file is the machine-readable entry point for coding agents working with Live Agent. Read it before changing code or helping a user install the project.

## Privacy boundary

- Treat the repository as public. Never commit API keys, access tokens, private keys, chat exports, resumes, knowledge-base files, screenshots, audio, or files from the application's user-data directory.
- Never inspect, print, or upload a user's `vault.json`, conversation history, memories, provider override, shortcut configuration, or local model cache unless the user explicitly provides a copy for a narrowly scoped debugging task.
- Ask the user to configure credentials in the application UI or through `OPENAI_API_KEY` in the process environment. Use placeholders in documentation and tests.
- Do not add absolute paths, usernames, machine names, or personal URLs to source code, tests, screenshots, logs, or examples. Use `%APPDATA%`, `%USERPROFILE%`, `$HOME`, or a temporary fixture.
- Before publishing or pushing, run `npm test`. A failure from `audit:public` or `audit:history` is a release blocker.

## Clean checkout workflow

```powershell
git clone https://github.com/Homelandio/live-agent.git
Set-Location live-agent
npm ci
npm run doctor
npm test
npm start
```

The application can run without bundled speech weights. Paraformer and SenseVoice assets are optional local runtime resources and are intentionally excluded from Git. Follow [docs/INSTALL.md](docs/INSTALL.md) before enabling a local provider.

## Configuration workflow

1. Start the application and open the settings panel.
2. Choose an OpenAI-compatible endpoint, local Ollama, or another supported provider.
3. Enter a key only in the UI, or set `OPENAI_API_KEY` before starting the process. Never put a real key in `.env`, source, an issue, or a pull request.
4. Import knowledge-base files through the application UI. They stay in the OS application-data directory and are not part of the repository.
5. Run a harmless test question and confirm that the selected model and local transcription provider report healthy status.

## Engineering workflow

- Read `AGENT_GUIDE.md` and the relevant local skill before changing behavior.
- Prefer the existing Electron main/preload/renderer boundaries and provider contract.
- Keep local data paths outside the repository. Use `fs.mkdtempSync()` fixtures in tests.
- Run targeted tests while iterating, then run the full `npm test` suite.
- Keep third-party code and model assets out of the repository. Add attribution and license information to `THIRD_PARTY_NOTICES.md` when a dependency or model changes.
- Do not claim that Windows content protection is absolute DRM; preserve the documented limitations.

## Release checklist

1. `npm ci` succeeds from a clean checkout.
2. `npm run doctor` reports required dependencies.
3. `npm test` passes, including both public and history audits.
4. `git status --short` contains only intended source changes.
5. `git ls-files` contains no user-data files, model weights, runtimes, build output, credentials, or absolute personal paths.
6. Review the final diff and commit before pushing. If a credential has ever been committed, revoke it first and rewrite the reachable history before publishing.
