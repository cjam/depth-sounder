import logging
import time
import traceback
from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit, send
from processing.Log import get_logger
from processing.Models import Channel, Mixer
import socket
from processing.SynthStream import SynthStream


def norecurse(f):
    def func(*args, **kwargs):
        if len([l[2] for l in traceback.extract_stack() if l[2] == f.func_name]) > 0:
            raise Exception, 'Recursed'
        return f(*args, **kwargs)

    return func


app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app)

logger = get_logger(__name__)

# this is the level of the root logger that other libraries would use
logging.basicConfig(level=logging.WARN)

global mixer
mixer = None
global device_num
device_num = 0


@app.route('/')
def index():
    global mixer
    return render_template('index.html', mixer=mixer.as_dict())


@app.route('/ui')
def ui():
    global mixer
    return render_template('ui.html', mixer=mixer.as_dict())


@app.route('/visual')
def visual():
    global mixer
    return render_template('visual.html', mixer=mixer.as_dict())


@app.route('/motion')
def motion():
    global mixer
    return render_template('motion.html', mixer=mixer.as_dict())


@app.route('/tests')
def tests():
    return render_template('test_runner.html');


# SOCKET IO

@socketio.on_error_default  # handles all namespaces without an explicit error handler
def default_error_handler(e):
    logger.error("SocketIO_Error: %s", e.message)


# MODELS

@socketio.on('update_channel')
def update_channel(ch_json):
    global mixer
    ch = mixer.get_channel(ch_json)
    ch.set_state(ch_json)
    mixer.push()


@socketio.on('update_channel', '/device')
def on_device_channel_update(channel_state):
    global mixer
    try:
        mixer.set_channel_state(channel_state)
        mixer.push()
    except Exception, e:
        logger.error("Error occured while trying to set channel state", e)


@socketio.on('update_mixer')
def mixer_updated(mixer_json):
    global mixer;
    logger.debug("Mixer JSON: %s", mixer_json)
    mixer.set_state(mixer_json)
    mixer.push()


# CONTROLS
@socketio.on('start_audio')
def start_audio(message):
    global mixer
    mixer.IsPlaying = True
    mixer.push()

@socketio.on('stop_audio')
def stop_audio(message):
    global mixer
    mixer.IsPlaying = False
    mixer.push()


# CONNECTIONS

@socketio.on('connect', '/device')
def on_device_connect():
    logger.info("Device Connected %s", request.sid)
    global mixer
    global device_num
    id = request.sid
    ch = Channel(SynthStream(), id=id, name="Device: " + (++device_num).__str__(), enabled=True, gain=0.0)
    mixer.add_channel(ch)
    mixer.push()
    emit("channel_added", ch.as_dict(), namespace="/device")


@norecurse
@socketio.on('disconnect', '/device')
def on_device_disconnect():
    global mixer
    id = request.sid
    logger.info("Device Disconnected %s", id)
    mixer.remove_channel(id)
    # have been running into issues with sockets recursive calls, trying
    # to sleep so that this socket may be removed from socket io before
    # we do a push. Only doing it on device disconnect since a delay
    # here isn't a huge deal
    time.sleep(0.5)
    mixer.push()


@socketio.on('connect')
def on_connect():
    global mixer
    print("Client Connected:  " + request.sid.__str__())
    logger.info('Client Connected')
    try:
        mixer.push()
    except Exception, e:
        logger.error(e)


@socketio.on('disconnect')
def on_disconnect():
    print("Client Connected:  " + request.sid.__str__())

if __name__ == '__main__':
    global mixer
    mixer = Mixer()
    channels = [
        # Channel(SynthStream(), name="Synth wave 1", x=0.2, enabled=True)
        # , Channel(SynthStream(), name="Synth wave 2", x=0.7, enabled=True)
        # , Channel(SynthStream(), name="Synth wave 3", x=0.1)
        # ,Channel(WavStream(Config.SongDir + "amy_winehouse/02 - You Know I'm No Good.wav"),name="I'm no good", enabled=True)
        # ,Channel(WavStream(Config.SongDir + "amy_winehouse/05 - Back To Black.wav"),name="Back to Black", enabled=False)
    ]

    # give each channel an id
    for ch in channels:
        global device_num
        device_num += 1
        ch.id = device_num
        print("adding " + ch.id.__str__())
        mixer.add_channel(ch)

    mixer.IsPlaying = False

    # Start our Web app
    print "Current IP Addresses:", [l for l in (
        [ip for ip in socket.gethostbyname_ex(socket.gethostname())[2] if not ip.startswith("127.")][:1], [
            [(s.connect(('8.8.8.8', 53)), s.getsockname()[0], s.close()) for s in
             [socket.socket(socket.AF_INET, socket.SOCK_DGRAM)]][0][1]]) if l][0][0]
    socketio.run(app, host='0.0.0.0', debug=True)

    mixer.close()
