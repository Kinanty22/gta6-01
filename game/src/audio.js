// SOLMARA — audio: all sound is synthesized with WebAudio, no audio files.
// Engine hum, siren, punch, pickup, crash and mission jingles.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;
  let sirenOn = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
    } catch {
      return false;
    }
    return true;
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      gain.gain.setValueAtTime(vol || 0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {
      // Sound is garnish; never break the game.
    }
  }

  function noise(dur, vol, freq) {
    if (!ensure() || muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = freq || 900;
      const gain = ctx.createGain();
      gain.gain.value = vol || 0.2;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
    } catch {
      // ignore
    }
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() {
      return muted;
    },
    // Called every frame: engine pitch follows speed, siren wails with wanted level.
    update(speed01, wanted) {
      if (!ctx || muted) return;
      try {
        if (engineOsc) engineOsc.frequency.value = 52 + speed01 * 165;
        if (engineGain) engineGain.gain.value = 0.02 + speed01 * 0.05;
        const want = wanted > 0;
        if (want !== sirenOn) {
          sirenOn = want;
          if (sirenGain) sirenGain.gain.value = want ? 0.035 : 0;
        }
        if (want && sirenOsc) {
          sirenOsc.frequency.value = 660 + 160 * Math.sin(performance.now() / 260);
        }
      } catch {
        // ignore
      }
    },
    punch() {
      noise(0.09, 0.25, 1400);
    },
    pickup() {
      blip(880, 0.12, 'sine', 0.14, 1320);
    },
    cash() {
      blip(660, 0.1, 'sine', 0.14);
      setTimeout(() => blip(990, 0.14, 'sine', 0.14), 70);
    },
    crash() {
      noise(0.22, 0.3, 500);
    },
    sirenBlip() {
      blip(720, 0.18, 'triangle', 0.1, 940);
    },
    missionGood() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.15), i * 110));
    },
    missionBad() {
      [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.25, 'sawtooth', 0.1), i * 140));
    },
    busted() {
      [330, 262, 196].forEach((f, i) => setTimeout(() => blip(f, 0.3, 'sawtooth', 0.12), i * 160));
    },
  };
}
