import processing.Config as Config
from audiolazy.lazy_wav import WavStream
from flask import Flask, render_template
from flask_socketio import SocketIO, emit
from processing.Models import Channel, Mixer
import socket

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app)

global mixer
mixer = None

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

@socketio.on('changed',"/device")
def device_motion_updated(device_info):
    print device_info
    # print "Device "+ device_info["id"] +"  moved" + device_info.__str__()

# @socketio.on('update_channel')
# def update_channel(channel_json):
#     global mixer
#     ch = Channel(**channel_json)
#     mixer.set_channel_state(ch)
#     mixer.push()

@socketio.on('update_mixer')
def mixer_updated(mixer_json):
    global mixer;
    print mixer_json
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

@socketio.on('connect')
def on_connect():
    global mixer
    mixer.push(True)
    print('Client Connected')

@socketio.on('disconnect')
def on_disconnect():
    print('Client disconnected')

if __name__ == '__main__':
    global mixer
    mixer = Mixer()
    ch1 = Channel(WavStream(Config.SongDir + "amy_winehouse/02 - You Know I'm No Good.wav"),name="I'm no good")
    ch2 = Channel(WavStream(Config.SongDir + "amy_winehouse/05 - Back To Black.wav"),name="Back to Black")
    mixer.add_channel(ch1)
    mixer.add_channel(ch2)

    # Start our Web app
    print "Current IP Addresses:"
    print([l for l in ([ip for ip in socket.gethostbyname_ex(socket.gethostname())[2] if not ip.startswith("127.")][:1], [[(s.connect(('8.8.8.8', 53)), s.getsockname()[0], s.close()) for s in [socket.socket(socket.AF_INET, socket.SOCK_DGRAM)]][0][1]]) if l][0][0])
    socketio.run(app, host='0.0.0.0', debug=True)

    mixer.close()



