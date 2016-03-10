#!/usr/bin/env bash

# what real Python executable to use
PYVER=2.7
PATHTOPYTHON=/usr/bin/
PYTHON=${PATHTOPYTHON}python${PYVER}

# find the root of the virtualenv, it should be the parent of the dir this script is in
ENV=`$PYTHON -c "import os; print os.path.abspath(os.path.join(os.path.dirname(\"$0\"), 'env'))"`
FILE_DIR=`$PYTHON -c "import os; print os.path.dirname(os.path.abspath(\"$@\"))"`
FILE=`$PYTHON -c "import os; print os.path.basename(\"$@\")"`
# now run Python with the virtualenv set as Python's HOME
export PYTHONHOME=$ENV
cd "$FILE_DIR"
exec $PYTHON "$FILE"