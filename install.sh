#!/usr/bin/env bash

ENV_BIN="env/bin"
package="$@"

"$ENV_BIN/pip" install $package

source ./bundle.sh
