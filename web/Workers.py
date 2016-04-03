from Queue import Queue
from threading import Thread

from Log import get_logger
from OSC import OSCClient, OSCMessage, OSCBundle

logger = get_logger(__name__)


class OSCWorker(object):
    def __init__(self, **kwargs):
        self._host = kwargs.get("host", "localhost")
        self._port = kwargs.get("port", 7402)
        self._num_worker_threads = kwargs.get("threads", 2)
        self._oscClient = OSCClient()
        self._oscClient.connect((self._host, self._port))
        self._queue = Queue()

        # start our threads working
        for i in range(self._num_worker_threads):
            t = Thread(target=self.worker)
            t.daemon = True
            t.start()

    def send_json(self, dict, address):
        logger.info("Sending json through OSC %s", dict)
        bundle = OSCBundle()
        for key, value in dict.iteritems():
            encoded_value = value if not isinstance(value, bool) else 1 if value else 0
            bundle.append({"addr": "{}/{}".format(address, key), "args": encoded_value})
        self.send(bundle)

    def worker(self):
        while True:
            item = self._queue.get()
            self._oscClient.send(item)
            self._queue.task_done()

    def join(self):
        self._queue.join()

    def send(self, msg):
        if isinstance(msg, OSCMessage) or isinstance(msg, dict):
            self._queue.put(msg)
        else:
            raise TypeError("can only send OSCMessage or dictionary types")
