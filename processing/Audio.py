#!/usr/bin/env python
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
# Created on Tue Sep 10 18:02:32 2013
# danilo [dot] bellini [at] gmail [dot] com
"""
Voiced "ah-eh-ee-oh-oo" based on resonators at formant frequencies
"""
from __future__ import unicode_literals, print_function
#import threading
#from audiolazy import sHz, maverage, rint, AudioIO, ControlStream, CascadeFilter, resonator, saw_table, chunks
#from time import sleep
#import sys
from audiolazy.lazy_io import AudioIO
from audiolazy.lazy_stream import Streamix
import threading

class AudioSourcePlayer:
    def __init__(self):
        self._mixer = Streamix(zero=0)
        self._thread = threading.Thread(target=self.renderAudio, args=())
        self.isRunning = False
        self.samplingRate = 44100
        self.sources = list()

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.stop()

    def add(self,audioSource):
        if isinstance(audioSource,AudioSource):
            self.sources.append(audioSource)

    def remove(self, audioSource):
        if isinstance(audioSource, AudioSource) and audioSource in self.sources:
            self.sources.remove(audioSource)

    def stop(self):
        # do things
        if self.isRunning:
            self.isRunning = False

    def start(self):
        # do things
        if not self.isRunning:
            self.isRunning = True
            self.thread.daemon = True
            self.thread.start()

    def renderAudio(self):
        # s, Hz = sHz(self.samplingRate)
        # inertia_dur = .5 * s
        # inertia_filter = maverage(rint(inertia_dur))
        with AudioIO() as player:
            player.play(self.mixer)

class AudioSource:
    def __init__(self):
        print("Audio source created")






# # Script input, change this with symbols from the table below
# vowels = "aɛiɒu"
#
# # Formant table from in http://en.wikipedia.org/wiki/Formant
# formants = {
#     "i": [240, 2400],
#     "y": [235, 2100],
#     "e": [390, 2300],
#     "ø": [370, 1900],
#     "ɛ": [610, 1900],
#     "œ": [585, 1710],
#     "a": [850, 1610],
#     "æ": [820, 1530],
#     "ɑ": [750, 940],
#     "ɒ": [700, 760],
#     "ʌ": [600, 1170],
#     "ɔ": [500, 700],
#     "ɤ": [460, 1310],
#     "o": [360, 640],
#     "ɯ": [300, 1390],
#     "u": [250, 595],
# }
#
#
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
