[![Build Status](https://travis-ci.org/cjam/depth-sounder.svg?branch=master)](https://travis-ci.org/cjam/depth-sounder)
# depth-sounder
Neural-Network-Based Audio Synthesis

# Getting started

My Setup:
    - OSX    
    - Python 2.7.10 installed
    - Pycharm as IDE (got an education license, but I don't think its very expensive)


Prerequisites:

    sudo pip install virtualenv
      
For sake of simplicity I'm going to commit the Virtual Python Environment without its dependencies installed.
Hopefully this will help speed up co-development as all you will have to do to get up to speed is:
 
    cd project_dir
    sh setup.sh

the `setup.sh` file has all of the weird steps included for setting up your python environment

After running `setup.sh` you should now have an environment that can be used for the project.

The `web.py` is a simple web application built on `Flask` + `Flask-socketio` which will facilitate real time configuration of the underlying neural net processing.

### Web Clients

I've typescript-ified our web clients and placed the code in `/web/clients/`

There are a few pre-reqs to getting this to work:

- Install npm
- `npm install -g tsd`

In order for typescript to properly compile these, you must run the following command in this directory:

`tsd install`

I'll get around to adding it to the setup scripts.

# Scripts

#### `setup.sh`

Sets up your environment initially to be able to run the python scripts

#### `install.sh`

Installs a package into the environment and exports the list of dependencies to requirements.txt in the root directory

#### `uninstall.sh` 

Uninstalls a package from the environment and exports the list of dependencies to requirements.txt in the root directory

#### `bundle.sh`

Exports the list of dependencies (excluding pyAudio, see [Appendix T](#AppendixT))


### Appendix T*(roubleshooting)* <a name="AppendixT"></a>

#### I Can't use matplot lib!

if your on OSX you'll get an error talking about python being installed as a framework.  To get around this, run your script using `sh frameworkpython.sh myscript.py`

This will run the python shipped with OSX but set the home directory to that of our virtual environment.

#### PortAudio on install

There was an issue with installing PyAudio (`missing PortAudio.h`) since we're using our own virtual env:

Here's how it was solved:

    brew install portaudio
    pip install --global-option='build_ext' --global-option='-I/usr/local/include' --global-option='-L/usr/local/lib' pyaudio
    
The rationale behind this is that we're using our own `virtualenv` for our project but `portaudio` gets installed into the `/usr/local/lib` so we need to link to the machine folders when building it on install
    
    
    