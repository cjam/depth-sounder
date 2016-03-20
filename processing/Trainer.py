import threading
import time
import matplotlib.pyplot as plt
from processing.NeuralNet import Model
import numpy as np


def Train(model, song, num_iterations = 1000):
    if not isinstance(model,Model):
        raise TypeError

    num_windows = len(song)
    window_length = model.input_size

    test_win_num = num_windows/2

    global prediction, plot_title
    prediction = np.zeros(window_length)

    print "Creating plot..."
    fig = plt.figure()
    t = range(0,window_length)
    ax = fig.add_subplot(111)
    line1, = ax.plot(t,song[test_win_num],'b-')
    line2, = ax.plot(t,prediction,'r-')
    plot_title = "Prediction # 0 vs actual"

    def trainer():
        global prediction
        global plot_title
        for j in range(0,num_iterations):
            for i in range(0,len(song)):
                error = model.update_fun(song[i])
            print "Iteration {} \t Error: {}".format(j, error)
            # Make prediction on the window before our test window and copy it into the prediction array
            prediction = model.pred_fun(song[test_win_num-1])
            plot_title = 'Prediction # ' + j.__str__() + ' vs actual'


    print "Training Neural Network..."
    thread = threading.Thread(target=trainer)
    thread.daemon = True
    thread.start()

    plt.xlabel('bin (#)')
    plt.ylabel('value')
    plt.title('Training Neural Net...')
    plt.grid(True)
    plt.ion()
    plt.show()

    while True:
        time.sleep(5)
        plt.pause(0.1)
        line2.set_ydata(prediction)
        plt.title(plot_title)
        plt.draw()


print "Constructing Model..."
model = Model(input_size=1024, hidden_size=10)

print "Building test data..."
song = np.random.random((100, model.input_size))

Train(model,song, 100000)