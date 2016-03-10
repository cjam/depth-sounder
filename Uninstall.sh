#!/usr/bin/env bash

ENV_BIN="env/bin"
package="$1"

"$ENV_BIN/pip" uninstall $package

source ./bundle.sh
