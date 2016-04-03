"""
This program sends 10 random values between 0.0 and 1.0 to the /filter address,
waiting for 1 seconds between each value.
"""
import argparse
import random
import time

from OSC import OSCClient, OSCServer, OSCMessage

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--ip", default="127.0.0.1", help="The ip of the OSC server")
    parser.add_argument("--port", type=int, default=8989, help="The port the OSC server is listening on")
    args = parser.parse_args()

    client = OSCClient()
    client.connect(("127.0.0.1", 7402))

    for x in range(10):
        msg = OSCMessage("/number")
        msg.append(random.random(), 'f')
        print "Sending message{}", x
        client.send(msg)
        time.sleep(1)
