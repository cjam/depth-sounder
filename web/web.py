import logging

import processing.Config as Config
from audiolazy.lazy_wav import WavStream
from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit, send
from processing.Audio import SinStream
from processing.Log import get_logger
from processing.Models import Channel, Mixer
import socket
import threading

from processing.SynthStream import SynthStream

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app)

logger = get_logger(__name__)

# this is the level of the root logger that other libraries would use
logging.basicConfig(level=logging.WARN)

global mixer
mixer = None

push_lock = threading.Lock()


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


# @socketio.on('update_channel')
# def update_channel(channel_json):
#     global mixer
#     ch = Channel(**channel_json)
#     mixer.set_channel_state(ch)
#     mixer.push()

@socketio.on('update_mixer')
def mixer_updated(mixer_json):
    global mixer;
    logger.debug("Mixer JSON: %s", mixer_json)
    mixer.set_state(mixer_json)
    mixer.push()


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


@socketio.on('move')
def move(message):
    emit("moved", message, broadcast=True, include_self=False)


@socketio.on('connect', '/device')
def on_device_connect():
    logger.info("Device Connected %s", request.sid)
    global mixer
    id = request.sid
    ch = Channel(SynthStream(), id=id, name="Client Synth: " + id.__str__(), enabled=True, gain=0.0)
    mixer.add_channel(ch)
    mixer.push()
    emit("channel_added", ch.as_dict(), namespace="/device")


@socketio.on('update_channel', '/device')
def on_device_channel_update(channel_state):
    global mixer
    try:
        mixer.set_channel_state(channel_state)
        mixer.push()
    except Exception, e:
        logger.error("Error occured while trying to set channel state", e)


@socketio.on('disconnect', '/device')
def on_device_disconnect():
    global mixer
    id = request.sid
    logger.info("Device Disconnected %s", id)
    mixer.remove_channel(id)
    mixer.push()

@socketio.on('connect')
def on_connect():
    global mixer
    logger.info('Client Connected')
    mixer.push()

@socketio.on('disconnect')
def on_disconnect():
    print('Client disconnected')


if __name__ == '__main__':
    global mixer
    mixer = Mixer()
    # channels = [
    #     Channel(SynthStream(), name="Synth wave", x=0.2, enabled=False)
    #     , Channel(SynthStream(), name="Synth wave", x=0.3, enabled=False)
    #     # , Channel(SynthStream(), name="Synth wave", x=0.1)
    #     # ,Channel(WavStream(Config.SongDir + "amy_winehouse/02 - You Know I'm No Good.wav"),name="I'm no good", enabled=False)
    #     # ,Channel(WavStream(Config.SongDir + "amy_winehouse/05 - Back To Black.wav"),name="Back to Black", enabled=False)
    # ]

    # give each channel an id
    # for i, ch in enumerate(channels):
    #     ch.id = i
    #     mixer.add_channel(ch)

    mixer.IsPlaying = True

    # Start our Web app
    print "Current IP Addresses:", [l for l in (
        [ip for ip in socket.gethostbyname_ex(socket.gethostname())[2] if not ip.startswith("127.")][:1], [
            [(s.connect(('8.8.8.8', 53)), s.getsockname()[0], s.close()) for s in
             [socket.socket(socket.AF_INET, socket.SOCK_DGRAM)]][0][1]]) if l][0][0]
    socketio.run(app, host='0.0.0.0', debug=True)

    mixer.close()
