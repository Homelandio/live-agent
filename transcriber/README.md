# Transcription provider interface

The desktop app talks to a transcription provider through a small local HTTP contract:

- `GET /health` returns JSON and a successful 2xx status.
- `POST /transcribe` receives a `16 kHz`, mono or multi-channel, `16-bit PCM WAV` body and returns JSON such as `{"text":"..."}`.
- The provider must bind only to loopback when it is a local sidecar.

`provider.json` describes the bundled provider. It can be replaced by a compatible local model without changing the renderer. A user-only override may be placed at the application data path as `transcriber-provider.json`; it is intentionally outside the Git repository and may use an external `http` provider. External credentials must be supplied through the configured environment variable (`apiKeyEnv`), never committed to the manifest.

The default implementation uses FunASR Paraformer. FunASR and the Paraformer model are third-party components; see `THIRD_PARTY_NOTICES.md` and the upstream license. This repository contains the adapter and launch contract, not the downloaded runtime or model weights. A future provider can be an external ASR API or another local model as long as it implements the same contract.
