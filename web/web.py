import argparse
import logging
import random
import time
import traceback
from OSC import OSCBundle, OSCMessage
from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit, send
from processing.Log import get_logger
from processing.Models import Channel, Mixer
import socket
from processing.SynthStream import SynthStream
from Workers import OSCWorker


def norecurse(f):
    def func(*args, **kwargs):
        if len([l[2] for l in traceback.extract_stack() if l[2] == f.func_name]) > 0:
            raise Exception, 'Recursed'
        return f(*args, **kwargs)

    return func


app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, async_mode="eventlet")

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
    logger.error("SocketIO_Error: %s", str(e))


# MODELS

@socketio.on("create_channel")
def create_channel():
    logger.info("Channel requested for %s", request.sid)
    global mixer
    global device_num
    id = request.sid
    ch = Channel(SynthStream(), id=id, name="Device: " + (++device_num).__str__(), enabled=True, gain=0.0)

    # send the message via osc to add a channel
    msg = OSCMessage("/channels/add")
    msg.append(ch.id)
    oscWorker.send(msg);

    mixer.add_channel(ch)
    mixer.push()

    # Return the new channel back to the requester
    return ch.as_dict()


@socketio.on('update_channel')
def update_channel(ch_json):
    global mixer
    global oscWorker
    try:
        chAddress = "/channel/" + ch_json["id"]
        mixer.set_channel_state(ch_json)
        oscWorker.send_json(ch_json, chAddress)
        # mixer_json = mixer.as_dict()
        # logger.debug("emitting mixer_json %s",mixer_json)
        # emit("mixer_changed", mixer.as_dict(), broadcast=True, namespace="/")
    except Exception, e:
        logger.error("Error occured while trying to set channel state %s", e)

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
    clientId = request.sid.__str__()
    print("Client Disconnected:  " + clientId)
    global mixer
    logger.info("Device Disconnected %s", clientId)
    mixer.remove_channel(clientId)

    # send the message via osc to add a channel
    msg = OSCMessage("/channels/remove")
    msg.append(clientId)
    oscWorker.send(msg);
    # have been running into issues with sockets recursive calls, trying
    # to sleep so that this socket may be removed from socket io before
    # we do a push. Only doing it on device disconnect since a delay
    # here isn't a huge deal
    time.sleep(0.5)
    mixer.push()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument("--osc_ip", default="127.0.0.1", help="The ip of the OSC server")
    parser.add_argument("--osc_port", type=int, default=7402, help="The port the OSC server is listening on")
    args = parser.parse_args()

    global oscWorker;
    oscWorker = OSCWorker(num_threads=4)

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

    # Start our Web app
    print "Current IP Addresses:", [l for l in (
        [ip for ip in socket.gethostbyname_ex(socket.gethostname())[2] if not ip.startswith("127.")][:1], [
            [(s.connect(('8.8.8.8', 53)), s.getsockname()[0], s.close()) for s in
             [socket.socket(socket.AF_INET, socket.SOCK_DGRAM)]][0][1]]) if l][0][0]
    socketio.run(app, host='0.0.0.0', debug=False)
