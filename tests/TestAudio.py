from nose import with_setup
from processing.Audio import AudioSourcePlayer

class TestAudioSourcePlayer:

    def testAudioStartStop(self):
        with AudioSourcePlayer() as player:
            player.start()
            assert player.isRunning
            player.stop()
            assert not player.isRunning

