# Third-Party Notices

## FunASR

The default local transcription adapter is designed for the open-source FunASR project:

- Project: https://github.com/alibaba-damo-academy/FunASR
- License: Apache License 2.0, as published by the upstream project.

This repository contains only the provider adapter, launch manifest, and HTTP contract. It does not commit the FunASR Python runtime or model weights.

## Paraformer model

The default model is the FunASR/ModelScope Paraformer Chinese streaming model used by the local provider. The model metadata identifies the model as Apache License 2.0. Model weights are excluded from Git and must be obtained and redistributed according to the upstream model terms:

- Upstream model documentation: https://www.funasr.com/
- FunASR model zoo: https://github.com/alibaba-damo-academy/FunASR/tree/main/model_zoo

## SenseVoiceSmall INT8 model

The optional local provider uses the CPU-friendly SenseVoiceSmall INT8 ONNX model and Silero VAD assets published by the sherpa-onnx model maintainers:

- SenseVoice source project: https://github.com/QwenAudio/SenseVoice — MIT License.
- SenseVoiceSmall INT8 ONNX model: https://huggingface.co/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17 — Apache License 2.0 as identified by the upstream model card.
- Silero VAD asset: https://huggingface.co/csukuangfj/vad — see the upstream model card for its license terms.
- Native runtime: `sherpa-onnx-node` — Apache License 2.0.

The model assets are ignored by Git and are included in a local build only when present under `transcriber/models/sensevoice-int8`. The application does not copy DSH application files or its private configuration. The public DeepSeek Harness speech packages were reviewed for the provider lifecycle and resource-verification design; no DeepSeek Harness source code is bundled here.

## JavaScript dependencies

The direct runtime dependencies retain their respective upstream licenses:

- Electron 32.x — MIT — https://github.com/electron/electron
- `mammoth` — BSD-2-Clause — https://github.com/mwilliamson/mammoth.js
- `pdf-parse` — Apache-2.0 — https://github.com/mehmet-kozan/pdf-parse
- `sherpa-onnx-node` and its Windows native package — Apache-2.0 — https://github.com/k2-fsa/sherpa-onnx

The dependency packages and license files are installed by `npm ci`; this project does not relicense those dependencies. Transitive dependencies remain governed by their own notices.

## Architecture inspirations

The following open-source projects were reviewed for workflow and architecture ideas. No source code from these repositories is bundled in this project:

- `he-yufeng/FindJobs-Agent` — MIT — https://github.com/he-yufeng/FindJobs-Agent
- `noamseg/interview-coach-skill` — MIT — https://github.com/noamseg/interview-coach-skill
- `penacristian/interview-agents` — MIT — https://github.com/penacristian/interview-agents
- `ggozad/haiku.rag` — MIT — https://github.com/ggozad/haiku.rag
- `chatchat-space/Langchain-Chatchat` — Apache-2.0 — https://github.com/chatchat-space/Langchain-Chatchat
- `swarmclawai/swarmvault` — MIT — https://github.com/swarmclawai/swarmvault

The local `interview-coach` and `role-fit` files are original project-local adaptations, not copied repository files. Projects whose license could not be confirmed were not used as code or skill sources.
