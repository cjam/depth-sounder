# -------------------
# Experimental stuff
# -------------------
from audiolazy.lazy_analysis import maverage, stft, window
from audiolazy.lazy_io import AudioIO
from audiolazy.lazy_math import pi
from audiolazy.lazy_misc import rint, sHz
from audiolazy.lazy_stream import tostream, Stream
from audiolazy.lazy_synth import line
from audiolazy.lazy_wav import WavStream
from numpy.fft import ifftshift
from processing import Config
from processing.Audio import StreamCollection
from processing.Files import get_labeled_wav_streams_iter
import numpy as np

# dir_stream = StreamCollection(get_labeled_wav_streams_iter("../_data/audio/songs/"))
#
# rate = 44100
# s, Hz = sHz(rate)
# inertia_dur = 1 * s
# inertia_filter = maverage(rint(inertia_dur))
#
#
# @stft(size=1024, hop=512, wnd=window.hann, ola_wnd=window.hann)
# def roll_mag(spectrum):
#     mag = abs(spectrum)
#     phases = np.angle(spectrum)
#     return np.roll(mag, 16) * np.exp(1j * phases)
#
#
# with AudioIO(True) as player:
#     player.play(dir_stream, rate=rate, channels=2)



# construct model & theano functions:
# from processing.NeuralNet import Model, vocab, numerical_lines, numerical_lengths
# from theano_lstm import LSTM

# model = Model(
#     input_size=10,
#     hidden_size=10,
#     vocab_size=len(vocab),
#     stack_size=1,  # make this bigger, but makes compilation slow
#     celltype=LSTM  # use RNN or LSTM
# )
# model.stop_on(vocab.word2index["."])
#
#
# # train:
# for i in range(10000):
#     error = model.update_fun(numerical_lines, numerical_lengths)
#     if i % 100 == 0:
#         print("epoch %(epoch)d, error=%(error).2f" % ({"epoch": i, "error": error}))
#     if i % 500 == 0:
#         print(vocab(model.greedy_fun(vocab.word2index["the"])))



# import numpy
# import theano
# import theano.tensor as T
# rng = numpy.random
#
# N = 400                                   # training sample size
# feats = 784                               # number of input variables
#
# # generate a dataset: D = (input_values, target_class)
# D = (rng.randn(N, feats), rng.randint(size=N, low=0, high=2))
# training_steps = 10000
#
# # Declare Theano symbolic variables
# x = T.matrix("x")
# y = T.vector("y")
#
# # initialize the weight vector w randomly
# #
# # this and the following bias variable b
# # are shared so they keep their values
# # between training iterations (updates)
# w = theano.shared(rng.randn(feats), name="w")
#
# # initialize the bias term
# b = theano.shared(0., name="b")
#
# print("Initial model:")
# print(w.get_value())
# print(b.get_value())
#
# # Construct Theano expression graph
# p_1 = 1 / (1 + T.exp(-T.dot(x, w) - b))   # Probability that target = 1
# prediction = p_1 > 0.5                    # The prediction thresholded
# xent = -y * T.log(p_1) - (1-y) * T.log(1-p_1) # Cross-entropy loss function
# cost = xent.mean() + 0.01 * (w ** 2).sum()# The cost to minimize
# gw, gb = T.grad(cost, [w, b])             # Compute the gradient of the cost
#                                           # w.r.t weight vector w and
#                                           # bias term b
#                                           # (we shall return to this in a
#                                           # following section of this tutorial)
#
# # Compile
# train = theano.function(
#           inputs=[x,y],
#           outputs=[prediction, xent],
#           updates=((w, w - 0.1 * gw), (b, b - 0.1 * gb)))
# predict = theano.function(inputs=[x], outputs=prediction)
#
# # Train
# for i in range(training_steps):
#     pred, err = train(D[0], D[1])
#
# print("Final model:")
# print(w.get_value())
# print(b.get_value())
# print("target values for D:")
# print(D[1])
# print("prediction on D:")
# print(predict(D[0]))

import matplotlib.pyplot as plt
import numpy as np
import wave
import sys

# AudioLazy init
rate = 44100
s, Hz = sHz(rate)
ms = 1e-3 * s

@tostream
def to_mono(sig):
    for blk in sig.blocks(size=2):
        yield blk[0]

inputstream = to_mono(WavStream(Config.SongDir + "amy_winehouse/02 - You Know I'm No Good.wav"))

window_length = 1024

analyzer = stft(ifftshift, ola=None, size=window_length,hop=window_length/2)
input_freqs = analyzer(inputstream)

length = window_length


signal = np.array(inputstream.peek(length))


Time=np.linspace(0, len(signal), num=len(signal))

plt.figure()
fig = plt.figure(frameon=False)
ax = fig.add_axes([0, 0, 1, 1])
ax.axis('off')

plt.axis('off')
line = plt.plot(Time,signal , 'w')
plt.setp(line, linewidth=10)

plt.show()