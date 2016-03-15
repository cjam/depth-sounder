import json
import threading
from collections import Iterable

from audiolazy.lazy_io import AudioIO
from audiolazy.lazy_stream import ControlStream, Stream, Streamix
from flask.ext.socketio import emit

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
        self._gainControl = ControlStream(1.0)
        self._enabledControl = ControlStream(1)
        self.name = "channel"
        self.channelStream = stream * self._gainControl * self._enabledControl

        # Calling super here will call the base model class
        # and ultimately call set_state
        super(Channel, self).__init__(**kwargs)

    def get_stream(self):
        return self.channelStream

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
            print("Channel " + self.name + " gain set to " + val.__str__())

    @property
    def Enabled(self):
        return self._enabledControl.value == 1

    @Enabled.setter
    def Enabled(self, val):
        enabled = self.Enabled
        if enabled != val:
            self._enabledControl.value = 1 if val else 0
            print(("Enabled" if self.Enabled else "Disabled") + " Channel: " + self.name)

    def set_state(self, kwargs):
        super(Channel, self).set_state(kwargs)
        if kwargs.has_key("name"):
            self.name = kwargs["name"]

        if kwargs.has_key("gain"):
            self.Gain = kwargs["gain"]

        if kwargs.has_key("enabled"):
            self.Enabled = to_bool(kwargs["enabled"])

    def as_dict(self):
        state = super(Channel, self).as_dict()
        state["name"] = self.name
        state["gain"] = self.Gain
        state["enabled"] = self.Enabled
        return state


class Mixer(ModelBase):
    def __init__(self, **kwargs):
        self.__lock = threading.Lock()
        self.channels = {}
        self._smix = Streamix(zero=0)
        self.__player = None
        super(Mixer, self).__init__(**kwargs)

    @property
    def IsPlaying(self):
        return self.__player is not None

    @IsPlaying.setter
    def IsPlaying(self,val):
        should_play = to_bool(val)
        if self.IsPlaying != should_play:
            if should_play:
                self.__player = AudioIO()
                # todo: either figure rate and channels out from stream or make it configurable
                self.__player.play(self._smix,rate=44100,channels=2)
            else:
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
        ch = self._get_channel(ch_state)
        if ch is not None:
            print "Changed channel state ('" + ch.name + "'): " + dict_diff(ch.as_dict(), ch_state).__str__()
            ch.set_state(ch_state)

    def _get_channel(self, model):
        ch_id = model.get("id", -1) if isinstance(model, dict) else model.id if isinstance(model, ModelBase) else -1
        return self.channels.get(ch_id)

    def as_dict(self):
        state = super(Mixer, self).as_dict()
        state["channels"] = map(lambda c: c.as_dict(), self.channels.itervalues())
        state["isPlaying"] = self.IsPlaying
        return state

    def push(self, include_self=False):
        emit("model_changed", self.as_dict(), broadcast=True, include_self=include_self)

    def get_stream(self):
        return self._smix
