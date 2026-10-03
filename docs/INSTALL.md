# Installation and Configuration

## From a clean checkout

Live Agent currently targets Windows for desktop capture and the protected overlay. Install Node.js 20 or newer, then run:

```powershell
git clone https://github.com/Homelandio/live-agent.git
Set-Location live-agent
npm ci
npm run doctor
npm start
```

`npm start` opens the Electron application. No personal data is downloaded by the repository and no API key is required to launch the shell.

## Answer model connection

Configure the answer model in the settings panel. Supported paths include:

- an OpenAI-compatible HTTPS base URL;
- OpenAI through a key entered in the UI or `OPENAI_API_KEY` in the process environment;
- a local Ollama service;
- a compatible external provider configured by the user.

The value must be an API endpoint, not a provider's browser key-management page. Do not put a real key in `.env.example`, JSON files, source code, screenshots, or GitHub issues.

## Local speech providers

Speech resources are optional and are not stored in Git because they are large third-party assets.

- FunASR Paraformer uses the Python sidecar described by `transcriber/provider.json`.
- SenseVoiceSmall INT8 uses the Node sidecar described by `transcriber/providers.json` and the `sherpa-onnx-node` runtime.
- An external HTTP provider can implement `GET /health` and `POST /transcribe` as documented in `transcriber/README.md`.

Place local resources below the repository's `transcriber/` directory only on the machine that will run them. Verify the files with the upstream checksums and license terms, then run `npm run doctor`. Do not commit the resources or copy them into an issue.

## Packaging

The Windows installer command is:

```powershell
npm run dist
```

The build includes local speech resources only when they exist on the build machine. A clean public checkout can still build the application shell and use an external speech provider, but a local model must be installed separately.

## Data location and backup

The application stores its vault, conversations, memories, provider selection, and other settings under the OS application-data directory. The exact path is intentionally discovered through the UI and is not hard-coded in this repository. Use the application's export/backup controls rather than copying private files into the project directory.
