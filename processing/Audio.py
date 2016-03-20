from __future__ import unicode_literals, print_function

import threading
from collections import Iterable

from audiolazy import Stream


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
