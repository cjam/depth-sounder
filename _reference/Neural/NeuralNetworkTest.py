'''
March 8, 2016
DJC
Maybe create an RBM/DBM/GBM class. Maybe import theano and start with that, who knows?

'''

import theano #why not
import numpy #sure

class RBM:



    def __init__(self, numVisible, numHidden, learningRate):


        raise NotImplementedError("TODO: implement this function.")


    def train(self, training_sample):

	
        raise NotImplementedError("TODO: implement this function.")


    def _logistic(self, x):
        try:
            1.0 / (1 + np.exp(-x))
        except OverflowError:
            return 1.0
        return 1.0 / (1 + np.exp(-x))


    def generateTrainingSample():

        raise NotImplementedError("TODO: implement this function.")



if __name__ == "__main__":

    num_visible = 1000
    num_hidden = 1000
    learn = 0.01
    AudioRBM = RBM(num_visible, num_hidden, learn)
