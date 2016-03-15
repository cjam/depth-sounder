#!/usr/bin/env bash

ENV_BIN="env/bin"
package="$@"

"$ENV_BIN/pip" uninstall $package

source ./bundle.sh
