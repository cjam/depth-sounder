# !/usr/bin/env python
# -*- coding: utf-8 -*-
# This file is part of AudioLazy, the signal processing Python package.
# Copyright (C) 2012-2014 Danilo de Jesus da Silva Bellini
#
# AudioLazy is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, version 3 of the License.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program. If not, see <http://www.gnu.org/licenses/>.
#
# Created on Tue Oct 29 04:33:45 2013
# danilo [dot] bellini [at] gmail [dot] com
"""
Random synthesis with saving and memoization
"""

from __future__ import division
from random import choice
from functools import wraps, reduce

import operator

#
# Helper functions
#
from audiolazy.lazy_filters import lowpass
from audiolazy.lazy_io import AudioIO
from audiolazy.lazy_itertools import chain
from audiolazy.lazy_math import inf
from audiolazy.lazy_midi import octaves
from audiolazy.lazy_misc import sHz, rint
from audiolazy.lazy_stream import ControlStream, Stream, Streamix, thub
from audiolazy.lazy_synth import adsr, TableLookup, line


def memoize(func):
    """
    Decorator for unerasable memoization based on function arguments, for
    functions without keyword arguments.
    """

    class Memoizer(dict):
        def __missing__(self, args):
            val = func(*args)
            self[args] = val
            return val

    memory = Memoizer()

    @wraps(func)
    def wrapper(*args):
        return memory[args]

    return wrapper


#
# AudioLazy Initialization
#
rate = 44100
s, Hz = sHz(rate)
ms = 1e-3 * s
dur_note = 600 * ms

# Frequencies (always in Hz here)

concat = lambda iterables: reduce(operator.concat, iterables, [])


# oct_partial = lambda freq: octaves(freq, fmin=freq_min, fmax=freq_max)

class SynthStream(Stream):
    def __init__(self):
        # (always in Hz here)
        self._freq_base = 440
        self._freq_min = 10
        self._freq_max = 1000
        self._ratios = [1, 3 / 2]  # 2/1 is the next octave
        self.__control_x__ = ControlStream(1);
        self.__control_y__ = ControlStream(1);

        def oct_partial(freq):
            return octaves(freq, fmin=self._freq_min, fmax=self._freq_max)

        def freq_gen():
            """
            Endless frequency generator (in rad/sample).
            """
            while True:
                yield choice(self._freqs) * Hz

        self._freqs = concat(oct_partial(self._freq_base * ratio) for ratio in self._ratios)

        self.freq_range = range(self._freq_min, self._freq_max, 1)

        table = TableLookup(line(100, -1, 1).append(line(100, 1, -1)).take(inf))

        super(SynthStream, self).__init__(chain.from_iterable(self.window_gen(table)))

    def window_gen(self, synth):
        while True:
            freq = rint((self.__control_x__.value + 1) / 2 * (self._freq_max - self._freq_min) + self._freq_min) * Hz
            env_asdr = adsr(dur_note, a=20 * ms, d=10 * ms, s=.8, r=(self.__control_y__.value + 1) * 100 * ms) / 1.7
            yield synth(freq) * list(env_asdr)


def geometric_delay(sig, dur, copies, pamp=.5):
    """
    Delay effect by copying data (with Streamix).
    Parameters
    ----------
    sig:
      Input signal (an iterable).
    dur:
      Duration, in samples.
    copies:
      Number of times the signal will be replayed in the given duration. The
      signal is played copies + 1 times.
    pamp:
      The relative remaining amplitude fraction for the next played Stream,
      based on the idea that total amplitude should sum to 1. Defaults to 0.5.
    """
    out = Streamix()
    sig = thub(sig, copies + 1)
    out.add(0, sig * pamp)  # Original
    remain = 1 - pamp
    for unused in xrange(copies):
        gain = remain * pamp
        out.add(dur / copies, sig * gain)
        remain -= gain
    return out

# #
# # Audio mixture
# #
# tracks = 2  # besides unpitched track
# dur_note = 300 * ms
# smix = Streamix()
#
# # Pitched tracks based on a 1:2 triangular wave
# table = TableLookup(line(100, -1, 1).append(line(100, 1, -1)).take(inf))
# for track in xrange(tracks):
#     env = adsr(dur_note, a=20 * ms, d=10 * ms, s=.8, r=30 * ms) / 1.7 / tracks
#     smix.add(0, geometric_delay(new_note_track(env, table), 80 * ms, 2))
#
# # Unpitched tracks
# # pfuncs = [unpitched_low] * 4 + [unpitched_high]
# # snd = chain.from_iterable(choice(pfuncs)(dur_perc, randint(0, 1))
# #                           for unused in zeros())
# # smix.add(0, geometric_delay(snd * (1 - 1 / 1.7), 20 * ms, 1))
#
# #
# # Finishes (save in a wave file)
# #
# data = lowpass(5000 * Hz)(smix).limit(10 * s)
#
# with AudioIO(True) as player:
#     player.play(data)
