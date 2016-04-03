#!/usr/bin/env bash

# what real Python executable to use
PYVER=2.7
PATHTOPYTHON="./env/bin/"
PYTHON=${PATHTOPYTHON}python${PYVER}
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

exec redis-server

# find the root of the virtualenv, it should be the parent of the dir this script is in
ENV=`$PYTHON -c "import os; print os.path.abspath(os.path.join(os.path.dirname(\"$0\"), 'env'))"`
FILE_DIR=`$PYTHON -c "import os; print os.path.dirname(os.path.abspath(\"$@\"))"`
FILE=`$PYTHON -c "import os; print os.path.basename(\"$@\")"`
# todo: iterate through "$ENV/src/ directory to so we don't have to hard code i.e. .../audiolazy/
export PYTHONPATH=${PYTHONPATH}:${DIR}:"$ENV/lib/python$PYVER/site-packages/":"$ENV/src/audiolazy/":"$ENV/src/theano-lstm/"
exec $PYTHON "web/web.py"