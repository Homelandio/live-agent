# Agent-Assisted Setup Contract

This document lets another coding agent guide a user through a safe setup without accessing the user's private files.

## Inputs the agent may request

- operating system and Node.js version;
- whether the user wants a local answer model, an OpenAI-compatible service, or Ollama;
- whether local speech transcription is needed;
- non-secret error messages and the output of `npm run doctor`.

## Inputs the agent must not request by default

- API keys, refresh tokens, cookies, browser profiles, or desktop-app sessions;
- the contents of `vault.json`, chat history, memories, resumes, private knowledge-base documents, screenshots, or recorded audio;
- a complete home-directory listing or a screenshot that exposes credentials.

## Deterministic procedure

1. Clone the repository and run `npm ci`.
2. Run `npm run doctor`; repair only missing required dependencies.
3. Run `npm test`. Stop on a public or history audit failure.
4. Start with `npm start`.
5. Guide the user to enter the endpoint and key in the application UI. If environment configuration is preferred, ask the user to set `OPENAI_API_KEY` locally and restart the application; never ask them to paste the value into chat.
6. Import personal files through the application's knowledge-base controls. Do not move them into the clone.
7. If local speech is needed, install the upstream assets separately, verify their license/checksum, run `npm run doctor`, and select the provider in the UI.
8. Re-run the relevant health check and record only non-sensitive status text.

## Troubleshooting rules

- A JSON parsing error usually means a web page URL was entered instead of an API endpoint. Ask for the endpoint shape, not the key.
- A missing local model is not a reason to disable the privacy audit; use an external provider or install the optional asset separately.
- Never solve a connection problem by copying a user's application-data directory into the repository.
- Before proposing a commit, run `npm test`, inspect `git diff --stat`, and confirm `git status --short` contains no private files.

## Expected final report

Report the commands run, pass/fail status, selected provider name, and next non-sensitive action. Do not include keys, personal paths, document contents, or raw request headers.
