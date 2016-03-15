from audiolazy import Stream, AudioIO
from audiolazy.lazy_analysis import maverage, stft, window
from audiolazy.lazy_misc import sHz, rint
from nose import with_setup
from processing.Audio import StreamCollection, LabeledStream
from processing.Files import get_labeled_wav_stream, get_labeled_wav_streams_iter
import unittest
import numpy as np


def test_LabeledWavStream_labels_work():
    lstream = get_labeled_wav_stream("../_data/audio/vio/148__[vio][nod][cla]2177__1.wav")
    assert lstream.labels == ['vio', 'nod', 'cla']


class TestStreamCollection(unittest.TestCase):
    def test_StreamCollection(self):
        a = Stream([0, 1, 2, 3])
        b = Stream([5, 6, 7, 8])
        c = Stream([-1, -2, -3])
        coll = StreamCollection([a, b, c])
        self.assertEquals(a.peek(4), coll.take(4))
        self.assertEquals(b.peek(4), coll.take(4))
        self.assertEquals(c.peek(3), coll.take(3))

    def test_StreamCollection_WavStream(self):
        a = get_labeled_wav_stream("../_data/audio/vio/148__[vio][nod][cla]2177__1.wav")
        collection = StreamCollection(a)
        samples = a.peek(1024)
        self.assertItemsEqual(samples, collection.take(1024))
