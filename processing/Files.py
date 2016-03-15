import os
import fnmatch
import re
from audiolazy.lazy_wav import WavStream
from processing.Audio import LabeledStream

label_re = re.compile('(?P<label>(?<=\[)[a-z]{3}(?=\]))')


def get_wav_files(dir):
    for root, dirnames, filenames in os.walk(dir):
        for filename in fnmatch.filter(filenames, "*.wav"):
            yield os.path.join(root, filename)


def get_labelled_wav_files(dir):
    for file in get_wav_files(dir):
        yield [file, get_labels(file)]


def get_labels(str):
    return  label_re.findall(str)


def get_labeled_wav_stream(path):
    return LabeledStream(WavStream(path), get_labels(path))


def get_labeled_wav_streams_iter(dir):
    for file in get_wav_files(dir):
        yield get_labeled_wav_stream(file)