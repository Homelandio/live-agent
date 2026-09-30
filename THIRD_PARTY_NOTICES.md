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

## JavaScript dependencies

Electron, `pdf-parse`, `mammoth`, and their transitive dependencies retain their respective upstream licenses. The dependency packages and license files are installed by `npm install`; this project does not relicense those dependencies.

## Architecture inspirations

The following open-source projects were reviewed for workflow and architecture ideas. No source code from these repositories is bundled in this project:

- `he-yufeng/FindJobs-Agent` — MIT — https://github.com/he-yufeng/FindJobs-Agent
- `noamseg/interview-coach-skill` — MIT — https://github.com/noamseg/interview-coach-skill
- `penacristian/interview-agents` — MIT — https://github.com/penacristian/interview-agents
- `ggozad/haiku.rag` — MIT — https://github.com/ggozad/haiku.rag
- `chatchat-space/Langchain-Chatchat` — Apache-2.0 — https://github.com/chatchat-space/Langchain-Chatchat
- `swarmclawai/swarmvault` — MIT — https://github.com/swarmclawai/swarmvault

The local `interview-coach` and `role-fit` files are original project-local adaptations, not copied repository files. Projects whose license could not be confirmed were not used as code or skill sources.
