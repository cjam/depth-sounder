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

#
# class AudioSourcePlayer(object):
#
#     def __init__(self):
#         self.isRunning = False
#         self.samplingRate = 44100
#         self.sources = list()
#
#     def __exit__(self, exc_type, exc_val, exc_tb):
#         self.stop()
#
#     def __enter__(self):
#         print("__enter__")
#         self._mixer = Streamix(zero=0)
#         self._thread = threading.Thread(target=self.renderAudio, args=())
#
#     def add(self,audioSource):
#         if isinstance(audioSource,AudioSource):
#             self.sources.append(audioSource)
#             # todo: add to mixer
#
#     def remove(self, audioSource):
#         if isinstance(audioSource, AudioSource) and audioSource in self.sources:
#             self.sources.remove(audioSource)
#             # todo: remove from mixer
#
#     def stop(self):
#         # do things
#         if self.isRunning:
#             self.isRunning = False
#
#     def start(self):
#         # do things
#         if not self.isRunning:
#             self.isRunning = True
#             self.thread.daemon = True
#             self.thread.start()
#
#     def renderAudio(self):
#         # s, Hz = sHz(self.samplingRate)
#         # inertia_dur = .5 * s
#         # inertia_filter = maverage(rint(inertia_dur))
#         with AudioIO(True) as player:
#             player.play(self.mixer)
#
# class AudioMixer(object):
#     def __init__(self):
#         print("AudioMixer")
#
#
# class AudioChannel(object):
#     def __init__(self):
#         print("AudioChannel")
#
# class BlockProcessor(Stream):
#     def __init__(self, input_stream):
#         print("AudioMixer")
#
#     # def process(self,block):
#     #     # todo: process block


# class AudioSource:
#     def __init__(self):
#         self.thread = threading.Thread(target=self.renderAudio, args=())
#         self.isRunning = False
#         self.samplingRate = 44100
#         chunks.size = 16
#
#     def stop(self):
#         # do things
#         if self.isRunning:
#             self.isRunning = False
#
#     def start(self):
#         # do things
#         if not self.isRunning:
#             self.isRunning = True
#             self.thread.daemon = True
#             self.thread.start()
#
#     def renderAudio(self):
#         s, Hz = sHz(self.samplingRate)
#         inertia_dur = .5 * s
#         inertia_filter = maverage(rint(inertia_dur))
#         with AudioIO() as player:
#             first_coeffs = formants[vowels[0]]
#
#             # These are signals to be changed during the synthesis
#             f1 = ControlStream(first_coeffs[0] * Hz)
#             f2 = ControlStream(first_coeffs[1] * Hz)
#             gain = ControlStream(0)  # For fading in
#
#             # Creates the playing signal
#             filt = CascadeFilter([
#                 resonator.z_exp(inertia_filter(f1).skip(inertia_dur), 400 * Hz),
#                 resonator.z_exp(inertia_filter(f2).skip(inertia_dur), 2000 * Hz),
#             ])
#             sig = filt((saw_table)(100 * Hz)) * inertia_filter(gain)
#
#             th = player.play(sig)
#             for vowel in vowels:
#                 coeffs = formants[vowel]
#                 print("Now playing: ", vowel)
#                 f1.value = coeffs[0] * Hz
#                 f2.value = coeffs[1] * Hz
#                 gain.value = 1  # Fade in the first vowel, changes nothing afterwards
#                 sleep(2)
#
#             # Fade out
#             gain.value = 0
#             sleep(inertia_dur / s + .2)  # Divide by s because here it's already
#             # expecting a value in seconds, and we don't
#             # want ot give a value in a time-squaed unit
#             # like s ** 2
