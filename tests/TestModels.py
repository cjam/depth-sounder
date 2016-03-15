import json
import unittest

from audiolazy.lazy_stream import Stream
from processing.Models import Mixer, Channel, ModelBase

#
# class TestSerialization(unittest.TestCase):
#     def test_model_base_serialize_deserialize(self):
#         self.assertTrue(False,"todo: better abstraction of serializable models")


class TestChannel(unittest.TestCase):
    def test_channel_stream_and_gain_work(self):
        c1 = Channel(Stream(1))
        c1.Gain = 1
        self.assertSequenceEqual([1,1,1],c1.get_stream().take(3))
        c1.Gain = 3.1
        self.assertSequenceEqual([3.1,3.1,3.1],c1.get_stream().take(3))

    def test_channel_get_stream_same_reference(self):
        s = Stream(1)
        ch = Channel(s)
        self.assertTrue(ch.get_stream() is ch.channelStream)
        self.assertTrue(ch.get_stream() is not s)


class TestMixer(unittest.TestCase):
    def test_mixer_set_state(self):
        c1 = Channel(name="test1")
        c2 = Channel(name="test2")

        mixer = Mixer()
        mixer.add_channel(c1)
        mixer.add_channel(c2)

        chs_before = mixer.channels.copy()
        mixer_json = mixer.as_dict()

        mixer.set_state(mixer_json)

        self.assertDictEqual(chs_before,mixer.channels)

    def test_mixer_add_channel_with_Existing_Channel_Should_Update(self):
        mixer = Mixer()
        c1 = Channel(name="Test")
        mixer.add_channel(c1)

        c1_json = c1.as_dict()
        c1_json["gain"] = 12
        c2 = Channel(**c1_json)
        mixer.add_channel(c2)
        self.assertEquals(1,len(mixer.channels))
        self.assertEquals(12,c1.Gain)

    def test_mixer_stream_is_channel_streams_added_together(self):
        mixer = Mixer()
        c1 = Channel(Stream(1))
        c2 = Channel(Stream(3))
        mixer.add_channel(c1)
        mixer.add_channel(c2)
        mix = mixer.get_stream().take(2)
        self.assertSequenceEqual([4,4],mixer.get_stream().take(2))

    def test_mixer_set_channel_state(self):
        c = Channel(Stream(1),name="Test")
        m = Mixer()
        m.add_channel(c)

        ch_state = c.as_dict();
        ch_state["gain"] = 23
        m.set_channel_state(ch_state)

        self.assertDictEqual(ch_state,c.as_dict())
        self.assertEquals(1,len(m.channels))