(function attachAudioSegmentation(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.LiveAudioSegmentation = api;
})(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const DEFAULTS = {
    startRms: 0.011,
    endRms: 0.007,
    noiseStartMultiplier: 3.2,
    noiseEndMultiplier: 2.0,
    confirmMs: 120,
    endSilenceMs: 1200,
    minSpeechMs: 280,
    maxSpeechMs: 15000,
    maxIdleMs: 3500
  };

  function createVoiceSegmenter(options = {}) {
    const config = { ...DEFAULTS, ...options };
    let state;

    function reset(now = null) {
      state = {
        startedAt: now,
        candidateAt: null,
        speechStartedAt: null,
        lastVoiceAt: null,
        hasVoice: false,
        noiseFloor: 0.003
      };
      return state;
    }

    function threshold(kind) {
      const minimum = kind === 'start' ? config.startRms : config.endRms;
      const multiplier = kind === 'start' ? config.noiseStartMultiplier : config.noiseEndMultiplier;
      return Math.max(minimum, state.noiseFloor * multiplier + minimum * 0.35);
    }

    function observe(rms, now) {
      const time = Number.isFinite(now) ? now : Date.now();
      const level = Math.max(0, Number(rms) || 0);
      if (state.startedAt === null) state.startedAt = time;

      if (!state.hasVoice) {
        const isCandidate = level >= threshold('start');
        if (isCandidate) {
          state.candidateAt ??= time;
          if (time - state.candidateAt >= config.confirmMs) {
            state.hasVoice = true;
            state.speechStartedAt = state.candidateAt;
            state.lastVoiceAt = time;
            return { action: 'voice-start', hasVoice: true, level };
          }
        } else {
          state.candidateAt = null;
          state.noiseFloor = state.noiseFloor * 0.92 + level * 0.08;
        }
        if (time - state.startedAt >= config.maxIdleMs) return { action: 'flush', reason: 'idle', hasVoice: false, level };
        return { action: 'continue', hasVoice: false, level };
      }

      const speechDuration = time - state.speechStartedAt;
      if (speechDuration >= config.maxSpeechMs) return { action: 'flush', reason: 'max-duration', hasVoice: true, level };

      if (level >= threshold('end')) {
        state.lastVoiceAt = time;
        return { action: 'continue', hasVoice: true, level };
      }

      const silenceDuration = time - state.lastVoiceAt;
      if (speechDuration >= config.minSpeechMs && silenceDuration >= config.endSilenceMs) {
        return { action: 'flush', reason: 'silence', hasVoice: true, level };
      }
      return { action: 'continue', hasVoice: true, level };
    }

    reset();
    return {
      reset,
      observe,
      get hasVoice() { return state.hasVoice; },
      get startedAt() { return state.startedAt; },
      get speechStartedAt() { return state.speechStartedAt; }
    };
  }

  return { DEFAULTS, createVoiceSegmenter };
});
