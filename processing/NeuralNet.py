import threading

import time

import theano, theano.tensor as T
import numpy as np
from theano_lstm import Embedding, LSTM, RNN, StackedCells, Layer, create_optimization_updates, masked_loss

# SHOULD BE IN ITS OWN FILE
from audiolazy.lazy_analysis import stft
from audiolazy.lazy_wav import WavStream
from numpy.fft import ifftshift
from processing import Config


def softmax(x):
    """
    Wrapper for softmax, helps with
    pickling, and removing one extra
    dimension that Theano adds during
    its exponential normalization.
    """
    return T.nnet.softmax(x.T)


def has_hidden(layer):
    """
    Whether a layer has a trainable
    initial hidden state.
    """
    return hasattr(layer, 'initial_hidden_state')


def matrixify(vector, n):
    return T.repeat(T.shape_padleft(vector), n, axis=0)


def initial_state(layer, dimensions=None):
    """
    Initalizes the recurrence relation with an initial hidden state
    if needed, else replaces with a "None" to tell Theano that
    the network **will** return something, but it does not need
    to send it to the next step of the recurrence
    """
    if dimensions is None:
        return layer.initial_hidden_state if has_hidden(layer) else None
    else:
        return matrixify(layer.initial_hidden_state, dimensions) if has_hidden(layer) else None


def initial_state_with_taps(layer, dimensions=None):
    """Optionally wrap tensor variable into a dict with taps=[-1]"""
    state = initial_state(layer, dimensions)
    if state is not None:
        return dict(initial=state, taps=[-1])
    else:
        return None


# class SpectrumLoss(theano.gof.Op):
#     def make_node(self):
#
#
class Model:
    """
    Simple predictive model for forecasting spectral content
    from sequence using LSTMs. Choose how many LSTMs to stack
    and what size their memory should be.
    """

    def __init__(self, hidden_size, input_size, stack_size=2, celltype=LSTM):
        self.input_size = input_size
        # Modelling
        self.model = StackedCells(input_size, celltype=celltype, activation=T.tanh, layers=[hidden_size] * stack_size)

        # disable modulation of the input layer
        self.model.layers[0].in_gate2.activation = lambda x: x

        # add an output layer
        self.model.layers.append(Layer(hidden_size, input_size, activation=softmax))

        # Setup symbolic tensor variables that will be used in computation

        # inputs are windows of spectrum data
        self.input = T.fvector("input")
        self.prev_input = T.fvector("prev_input")

        # create symbolic variables for prediction:
        self.prediction = self.create_prediction()

        # create gradient training functions:
        self.create_cost_fun()
        self.create_training_function()
        self.create_predict_function()

    @property
    def params(self):
        return self.model.params

    def create_prediction(self):
        result = self.model.forward(self.input)
        # softmaxes are the last layer of our network,
        # and are at the end of our results list:
        # we reorder the predictions to be:
        # 1. what row / example
        # 2. what timestep
        # 3. softmax dimension
        return result[-1]

    def create_cost_fun(self):
        # our cost function is the squared difference
        # between the input and the prediction
        diff = self.prediction - self.input
        squared_diff = diff ** 2
        self.cost = squared_diff.sum()

    def create_predict_function(self):
        self.pred_fun = theano.function(
            inputs=[self.input],
            outputs=self.prediction,
            allow_input_downcast=True
        )

    def create_training_function(self):
        updates, _, _, _, _ = create_optimization_updates(self.cost, self.params, method="adadelta")
        self.update_fun = theano.function(
            inputs=[self.input],
            outputs=self.cost,
            updates=updates,
            allow_input_downcast=True)

    def __call__(self, x):
        return self.pred_fun(x)

