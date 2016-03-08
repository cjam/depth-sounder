#!/usr/bin/env bash

# create a virtual environment from the default interpreter
virtualenv ./env

ENV_BIN="env/bin"

# Activate our virtual environment
source "$ENV_BIN/activate"

echo "Using environment bin directory " $ENV_BIN

# Install Port Audio & pyAudio as we need to do it specially
brew install portaudio
"$ENV_BIN/pip" install --global-option='build_ext' --global-option='-I/usr/local/include' --global-option='-L/usr/local/lib' pyaudio==0.2.9

# Install the rest of our requirements
"$ENV_BIN/pip" install -r requirements.txt

