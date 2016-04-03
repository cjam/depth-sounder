import logging

level = logging.WARN


def get_logger(name):
    logger = logging.getLogger(name)
    logger.setLevel(level)
    # Default configuration for logger here

    handler = logging.StreamHandler()
    handler.setLevel(level)

    handler.setFormatter(logging.Formatter('%(levelname)s::%(name)s(%(lineno)d) %(message)s'))

    logger.addHandler(handler)
    return logger
