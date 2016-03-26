from __future__ import unicode_literals, print_function
import threading
from collections import Iterable
from math import sin

from audiolazy import Stream
from audiolazy.lazy_math import pi
from audiolazy.lazy_misc import sHz
from audiolazy.lazy_stream import ControlStream
from audiolazy.lazy_synth import karplus_strong, sinusoid
from processing.Log import get_logger

logger = get_logger(__name__)


class threadsafe_iter:
    """Takes an iterator/generator and makes it thread-safe by
    serializing call to the `next` method of given iterator/generator.
    """

    def __init__(self, it):
        self.it = it
        self.lock = threading.Lock()

    def __iter__(self):
        return self

    def next(self):
        with self.lock:
            return self.it.next()


def threadsafe_generator(f):
    """A decorator that takes a generator function and makes it thread-safe.
    """

    def g(*a, **kw):
        return threadsafe_iter(f(*a, **kw))

    return g


class StreamCollection(Stream):
    def __init__(self, streams):
        if not isinstance(streams, Iterable):
            raise Exception("iter not an iterable")
        if isinstance(streams, Stream):
            self._streamCollection = [streams]
        else:
            self._streamCollection = streams

        # todo: add labels control stream

        def generator():
            for stream in self._streamCollection:
                if isinstance(stream, LabeledStream):
                    print("Stream labels:")
                    print(stream.labels)
                    # todo: set value of label control stream
                for item in stream:
                    yield item

        super(StreamCollection, self).__init__(generator())


class LabeledStream(Stream):
    def __init__(self, stream, labels):
        self.labels = labels
        super(LabeledStream, self).__init__(stream)


rate = 44100
s, Hz = sHz(rate)
ms = 1e-3 * s


class SinStream(Stream):
    def __init__(self):
        self.__control_x__ = ControlStream(200)
        self.__control_y__ = ControlStream(1.0)
        self.prev_x = None;
        self.sin = None
        self.update_waveform()
        self._t = 0

        def generator():
            while True:
                self._t += Hz
                val = sin(2 * pi * 2000 * self._t)
                yield val

        super(SinStream, self).__init__(generator());

    def update_waveform(self):
        if self.prev_x != self.__control_x__.value:
            # todo: need to handle phase in here
            phase = 0.
            self.sin = sinusoid(self.__control_x__.value * 1000 * Hz, phase)
            self.prev_x = self.__control_x__.value
            logger.info("Updated waveform to %f Hz", self.__control_x__.value)




            # def __iter__(self):
            #     while True:
            #         # if self.prev_x != self.x.value:
            #         #     self.createSin()
            #         yield self.sin.take(1)[0]
