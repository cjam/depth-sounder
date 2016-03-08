from flask import Flask, render_template
from flask_socketio import SocketIO, emit

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app)


class Channel:
    def __init__(self, channelName):
        self.name = channelName
        self.gain = 25


jazzChannel = Channel("Jazz")
classChannel = Channel("Classical")

channels = [jazzChannel, classChannel]


@app.route('/')
def index():
    return render_template('index.html', channels=channels)


@socketio.on('adjust gain', namespace='/test')
def adjust_gain(message):
    if message.channel == "Jazz":
        channelToChange = jazzChannel
    else:
        channelToChange = classChannel

    if channelToChange.gain != message.value:
        channelToChange.gain = message.value
        emit('gain adjusted', message, broadcast=True, include_self=False)


@socketio.on('my event', namespace='/test')
def test_message(message):
    emit('my response', {'data': message['data']})


@socketio.on('my broadcast event', namespace='/test')
def test_message(message):
    emit('my response', {'data': message['data']}, broadcast=True)


@socketio.on('connect', namespace='/test')
def test_connect():
    emit('my response', {'data': 'Connected'})
    print('Client Connected')


@socketio.on('disconnect', namespace='/test')
def test_disconnect():
    emit('my response', {'data': 'Connected'})
    print('Client disconnected')


if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', debug=True)
