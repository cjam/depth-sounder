import json
import logging
import threading
from collections import Iterable
import time
from audiolazy.lazy_analysis import maverage
from audiolazy.lazy_io import AudioIO, chunks
from audiolazy.lazy_misc import rint, sHz
from audiolazy.lazy_stream import ControlStream, Stream, Streamix
from flask.ext.socketio import emit
import random
from processing.Log import get_logger
from processing.NeuralNet import Model

logger = get_logger(__name__)

KEYNOTFOUND = '<KEYNOTFOUND>'  # KeyNotFound for dictDiff


def dict_diff(first, second):
    """ Return a dict of keys that differ with another config object.  If a value is
        not found in one fo the configs, it will be represented by KEYNOTFOUND.
        @param first:   Fist dictionary to diff.
        @param second:  Second dicationary to diff.
        @return diff:   Dict of Key => (first.val, second.val)
    """
    diff = {}
    # Check all keys in first dict
    for key in first.keys():
        if (not second.has_key(key)):
            diff[key] = (first[key], KEYNOTFOUND)
        elif (first[key] != second[key]):
            diff[key] = (first[key], second[key])
    # Check all keys in second dict to find missing
    for key in second.keys():
        if (not first.has_key(key)):
            diff[key] = (KEYNOTFOUND, second[key])
    return diff


def to_bool(val):
    return val in ['true', 'True', '1', 1, 'y', 'yes', 'Y']


# TODO: MAKE ALL OF THE JSON STUFF MORE GENRIC WITH DECORATORS?

rate = 44100
s, Hz = sHz(rate)
inertia_dur = 1 * s
inertia_filter = maverage(rint(inertia_dur))

chunks.size = 8192

PALLETTE = [
    "#5bc0eb",
    "#fde74c",
    "#9bc53d",
    "#e55934",
    "#fa7921"
]


def randomColor(pallette=PALLETTE):
    return random.choice(pallette)


class ModelBase(object):
    def __init__(self, **kwargs):
        self.id = id(self)
        self.set_state(kwargs)

    def set_state(self, kwargs):
        if kwargs.has_key("id"):
            self.id = kwargs["id"]

    def as_dict(self):
        return {"id": self.id}


class Channel(ModelBase):
    def __init__(self, stream=Stream(0), **kwargs):
        # Properties
        self.name = "channel"
        self.color = randomColor()

        self._gainControl = ControlStream(1.0)
        self._enabledControl = ControlStream(1)
        self._stream = stream

        # Control Streams
        self._x = ControlStream(0.0);
        self._y = ControlStream(0.0);
        self._gamma = ControlStream(0.0);
        self._beta = ControlStream(0.0);
        self._alpha = ControlStream(0.0);

        self.inject_control_streams(self._stream)

        self.channelStream = self._stream * inertia_filter(self._gainControl) * inertia_filter(self._enabledControl)

        # Calling super here will call the base model class
        # and ultimately call set_state
        super(Channel, self).__init__(**kwargs)

    def get_stream(self):
        return self.channelStream

    def inject_control_streams(self, stream):
        if self._stream_has_attr("__control_x__"):
            stream.__control_x__ = self._x
        if self._stream_has_attr("__control_y__"):
            stream.__control_y__ = self._y
        if self._stream_has_attr("__control_y__"):
            stream.__control_y__ = self._y
        if self._stream_has_attr("__control_y__"):
            stream.__control_y__ = self._y
        if self._stream_has_attr("__control_y__"):
            stream.__control_y__ = self._y
            # todo: add in device motion here?

    def _stream_has_attr(self, name):
        return name in self._stream.__dict__

    # TODO: NEED INFRASTRUCTURE FOR BELOW (not sustainable, decorators?)

    @property
    def Gamma(self):
        return self._gamma.value;

    @Gamma.setter
    def Gamma(self, val):
        current = self.Gamma
        if current != val:
            self._gamma.value = val

    @property
    def Beta(self):
        return self._beta.value;

    @Beta.setter
    def Beta(self, val):
        current = self.Beta
        if current != val:
            self._beta.value = val

    @property
    def Alpha(self):
        return self._alpha.value;

    @Alpha.setter
    def Alpha(self, val):
        current = self.Alpha
        if current != val:
            self._alpha.value = val

    @property
    def X(self):
        return self._x.value;

    @X.setter
    def X(self, val):
        # todo: determine whether we want int or float
        current = self.X
        if current != val:
            self._x.value = val
            # logger.info("'%s' Channel control x set to %s", self.name, val)

    @property
    def Y(self):
        return self._y.value;

    @Y.setter
    def Y(self, val):
        # todo: determine whether we want int or float
        current = self.Y
        if current != val:
            self._y.value = val
            # logger.info("Channel %s control x set to %s", self.name, val.__str__)

    @property
    def Gain(self):
        return self._gainControl.value

    @Gain.setter
    def Gain(self, val):
        # todo: determine whether we want int or float
        cur_gain = self.Gain
        if cur_gain != val:
            # todo: limit gain to certain range
            self._gainControl.value = val
            # logger.info("'%s' channel gain set to %s", self.name, val.__str__)

    @property
    def Enabled(self):
        return self._enabledControl.value == 1

    @Enabled.setter
    def Enabled(self, val):
        enabled = self.Enabled
        if enabled != val:
            self._enabledControl.value = 1 if val else 0
            # logger.info("Set Channel '%s' to %s ", self.name, "Enabled" if self.Enabled else "Disabled")

    def set_state(self, kwargs):
        super(Channel, self).set_state(kwargs)
        if kwargs.has_key("name"):
            self.name = kwargs["name"]

        if kwargs.has_key("gain"):
            self.Gain = kwargs["gain"]

        if kwargs.has_key("enabled"):
            self.Enabled = to_bool(kwargs["enabled"])

        if kwargs.has_key("x"):
            self.X = kwargs["x"]

        if kwargs.has_key("y"):
            self.Y = kwargs["y"]

        if kwargs.has_key("gamma"):
            self.Gamma = kwargs["gamma"]

        if kwargs.has_key("beta"):
            self.Beta = kwargs["beta"]

        if kwargs.has_key("alpha"):
            self.Alpha = kwargs["alpha"]

    def as_dict(self):
        state = super(Channel, self).as_dict()
        state["name"] = self.name
        state["gain"] = self.Gain
        state["enabled"] = self.Enabled
        state["x"] = self.X
        state["y"] = self.Y
        state["gamma"] = self.Gamma
        state["beta"] = self.Beta
        state["alpha"] = self.Alpha
        state["color"] = self.color
        return state


class NeuralNetChannel(Channel):
    def __init__(self, model):
        if not isinstance(model, Model):
            raise TypeError("model should be a processing.NeuralNet.Model")

        self._x = 0.0

    @property
    def X(self):
        return self._x

    @X.setter
    def X(self, value):
        self._x = value

    def set_state(self, kwargs):
        state = super(NeuralNetChannel, self).set_state(kwargs)
        if kwargs.has_key("x"):
            self.X = kwargs["x"]

    def as_dict(self):
        state = super(NeuralNetChannel, self).as_dict()
        state["x"] = self.X


class Mixer(ModelBase):
    def __init__(self, **kwargs):
        self.__lock = threading.Lock()
        self.channels = {}
        self._enabled = ControlStream(1.0)
        self._smix = Streamix(zero=0)
        # add a continuous stream of 0's to prevent our output stream from ending
        self._smix.add(0, Stream(0))
        self._outStream = self._smix
        self.__player = None
        super(Mixer, self).__init__(**kwargs)

    @property
    def IsPlaying(self):
        return self.__player is not None

    @IsPlaying.setter
    def IsPlaying(self, val):
        should_play = to_bool(val)
        if self.IsPlaying != should_play:
            if should_play:
                self._enabled.value = 1.0
                self.__player = AudioIO()
                # todo: either figure rate and channels out from stream or make it configurable
                self.__player.play(self.get_stream(), rate=44100, channels=2)
            else:
                self._enabled.value = 0.0
                time.sleep(inertia_dur / s)
                self.__player.close()
                self.__player = None

    def close(self):
        if self.__player is not None:
            self.__player.close()

    def add_channel(self, ch):
        if isinstance(ch, Channel):
            with self.__lock:
                if self.channels.has_key(ch.id):
                    self.channels[ch.id].set_state(ch.as_dict())
                else:
                    self.channels[ch.id] = ch
                    self._smix.add(0, ch.channelStream)

    def remove_channel(self, chId):
        ch = self.channels.get(chId)
        if ch is not None:
            with self.__lock:
                ch.Enabled = False
                # todo: might need to call finish on channel or something in order to end the stream
                del self.channels[chId]

    def set_state(self, kwargs):
        if kwargs.has_key("isPlaying"):
            self.IsPlaying = kwargs["isPlaying"]
        if kwargs.has_key("channels") and isinstance(kwargs["channels"], Iterable):
            for ch_state in kwargs["channels"]:
                self.set_channel_state(ch_state)

    def set_channel_state(self, ch_state):
        # normalize channel state as dictionary
        ch_state = ch_state if isinstance(ch_state, dict) else ch_state.as_dict() if isinstance(ch_state,
                                                                                                Channel) else {}
        ch = self.get_channel(ch_state)
        if ch is not None:
            changes = dict_diff(ch.as_dict(), ch_state)
            if len(changes) > 0:
                logger.info("Changed channel state ('%s'): %s", ch.name, changes.__str__())
            ch.set_state(ch_state)
            emit("channel_changed", ch.as_dict(), broadcast=True, include_self=False)

    def get_channel(self, model):
        ch_id = model.get("id", -1) if isinstance(model, dict) else model.id if isinstance(model, ModelBase) else -1
        return self.channels.get(ch_id)

    def as_dict(self):
        state = super(Mixer, self).as_dict()
        state["channels"] = map(lambda c: c.as_dict(), self.channels.itervalues())
        state["isPlaying"] = self.IsPlaying
        return state

    def push(self, include_self=False):
        mixer_json = self.as_dict()
        logger.debug("Pushing Mixer State %s", mixer_json)
        emit("mixer_changed", mixer_json, broadcast=True, include_self=include_self, namespace="/")

    def get_stream(self):
        return self._outStream
