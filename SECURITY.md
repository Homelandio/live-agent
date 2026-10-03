# Security Policy

## Supported versions

The `master` branch is the actively maintained public version. This project is a personal, local-first desktop application and does not operate a hosted service.

## Reporting a vulnerability

Please do not open a public issue for an undisclosed credential, private-data exposure, or exploitable bug. Contact the repository maintainer through the private contact method configured on the GitHub profile, and include:

- affected commit or version;
- a minimal reproduction that contains no personal files or live credentials;
- impact and suggested mitigation.

Immediately revoke any API key or token that may have appeared in a log, screenshot, issue, commit, or chat. Do not send the secret again in the report.

## Data handling

- API keys, conversations, memories, imported documents, and user skills are stored in the operating-system application-data directory, not in this repository.
- The repository intentionally excludes model weights, local runtimes, provider overrides, and build output.
- Network requests are made only when the user configures an external answer provider or enables public web supplementation. Local speech providers listen on loopback.
- Windows content protection is a best-effort OS feature, not a guarantee against every driver-level capture method.

See [docs/PRIVACY.md](docs/PRIVACY.md) for the detailed data-flow description.
