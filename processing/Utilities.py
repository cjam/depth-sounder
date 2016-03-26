from collections import Iterable


class LinearScale(object):
    def __init__(self, domain, range, clamped=False):
        if not isinstance(domain, Iterable):
            raise TypeError("domain must be an array of numbers")
        self.domain = domain
        if not isinstance(range, Iterable):
            raise TypeError("range must be an array of numbers")
        self.range = range
        self.clamped = clamped

    def __call__(self, *args, **kwargs):
        pass
