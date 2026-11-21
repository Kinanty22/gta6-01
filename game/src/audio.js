// Sound, synthesised with WebAudio only: no audio files, no network. The engine
// hum follows the driven car's speed, the siren wails while the police are after
// you, and every action has a short blip. Everything is a no-op until the first
// user gesture creates the audio context, and M mutes it all.
export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let muted = false;
  let sirenOn = false;

  function ensure() {
    if (context) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      context = new AC();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineOsc2 = context.createOscillator();
      engineOsc2.type = 'square';
      engineOsc2.frequency.value = 28;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineOsc2.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      engineOsc2.start();
      sirenOsc = context.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = context.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      context = null;
      return false;
    }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    try {
      const t = context.currentTime;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  function noise(dur, vol, cutoff) {
    if (!ensure() || muted) return;
    try {
      const t = context.currentTime;
      const len = Math.max(1, Math.floor(context.sampleRate * dur));
      const buffer = context.createBuffer(1, len, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const source = context.createBufferSource();
      source.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      const gain = context.createGain();
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start(t);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  return {
    /** Call on the first gesture so the browser allows sound. */
    unlock() {
      ensure();
      if (context && context.state === 'suspended') context.resume().catch(() => {});
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = value ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    /** Engine hum follows speed 0..1; silent on foot. */
    engine(speed01, on) {
      if (!context || muted) return;
      try {
        const target = on ? 0.05 + speed01 * 0.075 : 0;
        engineGain.gain.setTargetAtTime(target, context.currentTime, 0.08);
        engineOsc.frequency.setTargetAtTime(52 + speed01 * 130, context.currentTime, 0.08);
        engineOsc2.frequency.setTargetAtTime(26 + speed01 * 62, context.currentTime, 0.08);
      } catch {
        // Sound is garnish.
      }
    },
    /** Siren wails while any cop is chasing; call every frame with the wanted stars. */
    siren(stars, dt) {
      if (!context) return;
      const want = stars > 0 && !muted;
      if (want && !sirenOn) {
        sirenOn = true;
        sirenTimer = 0;
      } else if (!want && sirenOn) {
        sirenOn = false;
        try {
          sirenGain.gain.setTargetAtTime(0, context.currentTime, 0.1);
        } catch {
          // Sound is garnish.
        }
      }
      if (!sirenOn) return;
      sirenTimer += dt;
      try {
        const phase = sirenTimer % 1.1;
        sirenOsc.frequency.setTargetAtTime(phase < 0.55 ? 740 : 540, context.currentTime, 0.05);
        sirenGain.gain.setTargetAtTime(0.045, context.currentTime, 0.1);
      } catch {
        // Sound is garnish.
      }
    },
    punch() {
      noise(0.12, 0.5, 900);
      blip(120, 0.1, 'sine', 0.4, 60);
    },
    pickup() {
      blip(660, 0.09, 'sine', 0.35);
      setTimeout(() => blip(990, 0.12, 'sine', 0.35), 70);
    },
    crash(strength) {
      noise(0.25, Math.min(0.7, 0.25 + strength * 0.4), 500);
    },
    mission() {
      blip(523, 0.12, 'triangle', 0.4);
      setTimeout(() => blip(659, 0.12, 'triangle', 0.4), 110);
      setTimeout(() => blip(784, 0.2, 'triangle', 0.45), 220);
    },
    busted() {
      blip(392, 0.25, 'triangle', 0.4, 196);
      setTimeout(() => blip(196, 0.4, 'triangle', 0.4, 98), 240);
    },
  };
}
