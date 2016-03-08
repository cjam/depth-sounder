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


# Appendix T*(roubleshooting)*

There was an issue with installing PyAudio (`missing PortAudio.h`) since we're using our own virtual env:

Here's how it was solved:

    brew install portaudio
    pip install --global-option='build_ext' --global-option='-I/usr/local/include' --global-option='-L/usr/local/lib' pyaudio
    
The rationale behind this is that we're using our own `virtualenv` for our project but `portaudio` gets installed into the `/usr/local/lib` so we need to link to the machine folders when building it on install
    
    
    