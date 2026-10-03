# Contributing

Thanks for helping improve Live Agent.

## Before opening a pull request

```powershell
npm ci
npm run doctor
npm test
```

Use temporary fixtures for tests. Do not use personal resumes, screenshots, audio, application-data files, absolute machine paths, or real credentials in examples or test data.

## Code and documentation expectations

- Keep changes focused and preserve the main/preload/renderer security boundary.
- Keep API credentials in the UI, environment, or an external secret manager; never in source or configuration committed to Git.
- Keep local transcription resources optional and document their upstream license.
- Add or update a focused test for behavior changes.
- Update `README.md`, `AGENT_GUIDE.md`, or the relevant document when a user-facing workflow changes.
- Run `npm run audit:public` and `npm run audit:history` before pushing.

Pull requests should explain the user-visible change, testing performed, and any third-party dependency or model attribution change.
