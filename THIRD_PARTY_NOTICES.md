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
