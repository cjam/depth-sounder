#!/usr/bin/env bash

ENV_BIN="env/bin"

echo "Freezing requirements and removing PyAudio as it is handled special"
"$ENV_BIN/pip" freeze | sed -n '/^PyAudio/ !p' > requirements.txt
