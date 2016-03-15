import processing.Config as Config
from audiolazy import Stream
from processing.Audio import StreamCollection
from processing.Files import get_labeled_wav_stream
import unittest

class TestUtilityFunctions(unittest.TestCase):
    def test_get_labeled_wav_stream(self):
        lstream = get_labeled_wav_stream(Config.ViolinDir + "148__[vio][nod][cla]2177__1.wav")
        self.assertSequenceEqual(['vio', 'nod', 'cla'],lstream.labels, "Labels should be extracted from file name")

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
        a = get_labeled_wav_stream(Config.ViolinDir + "148__[vio][nod][cla]2177__1.wav")
        collection = StreamCollection(a)
        samples = a.peek(1024)
        self.assertItemsEqual(samples, collection.take(1024))
