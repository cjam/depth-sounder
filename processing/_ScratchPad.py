# -------------------
# Experimental stuff
# -------------------
from audiolazy.lazy_analysis import maverage, stft, window
from audiolazy.lazy_io import AudioIO
from audiolazy.lazy_misc import rint, sHz
from processing.Audio import StreamCollection
from processing.Files import get_labeled_wav_streams_iter
import numpy as np

dir_stream = StreamCollection(get_labeled_wav_streams_iter("../_data/audio/songs/"))

rate = 44100
s, Hz = sHz(rate)
inertia_dur = 1 * s
inertia_filter = maverage(rint(inertia_dur))


@stft(size=1024, hop=512, wnd=window.hann, ola_wnd=window.hann)
def roll_mag(spectrum):
    mag = abs(spectrum)
    phases = np.angle(spectrum)
    return np.roll(mag, 16) * np.exp(1j * phases)


with AudioIO(True) as player:
    player.play(dir_stream, rate=rate, channels=2)
