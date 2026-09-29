const assert = require('node:assert/strict');
const { createVoiceSegmenter } = require('../src/audio-segmentation');

function feed(segmenter, points) {
  return points.map(([rms, time]) => segmenter.observe(rms, time));
}

const shortPause = createVoiceSegmenter({ endSilenceMs: 1200, maxSpeechMs: 15000 });
const shortPauseResults = feed(shortPause, [
  [0.02, 0], [0.02, 160], [0.02, 500],
  [0.001, 900], [0.001, 1400],
  [0.02, 1500], [0.02, 1800]
]);
assert.equal(shortPauseResults.some(result => result.action === 'voice-start'), true, 'speech should be confirmed');
assert.equal(shortPauseResults.some(result => result.action === 'flush'), false, 'a short pause must not end the utterance');

const naturalEnd = createVoiceSegmenter({ endSilenceMs: 1200, maxSpeechMs: 15000 });
const naturalEndResults = feed(naturalEnd, [
  [0.02, 0], [0.02, 160], [0.02, 500],
  [0.001, 900], [0.001, 1600], [0.001, 1800]
]);
assert.equal(naturalEndResults.at(-1).action, 'flush', 'a natural pause must end the utterance');
assert.equal(naturalEndResults.at(-1).reason, 'silence');

const longSpeech = createVoiceSegmenter({ maxSpeechMs: 15000 });
const longSpeechResults = feed(longSpeech, [[0.02, 0], [0.02, 160], [0.02, 15160]]);
assert.equal(longSpeechResults.at(-1).action, 'flush', 'a long utterance must be bounded');
assert.equal(longSpeechResults.at(-1).reason, 'max-duration');

const backgroundNoise = createVoiceSegmenter({ maxIdleMs: 1000 });
const noiseResults = feed(backgroundNoise, [[0.002, 0], [0.003, 400], [0.002, 1000]]);
assert.equal(noiseResults.at(-1).action, 'flush');
assert.equal(noiseResults.at(-1).hasVoice, false, 'background noise must not become speech');

console.log('audio segmentation tests passed');
