// SOLARA HEAT — every sound is synthesized live with WebAudio: no audio
// files, no network, nothing borrowed. Engine hum, police siren, gunshots,
// pickups, mission jingles and a laid-back original bassline that plays
// while driving. Audio starts on the first user gesture (browsers demand
// it) and M toggles mute.
'use strict';

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let musicStep = 0;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch {
      return false;
    }
    return true;
  }

  function unlock() {
    if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = null) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise(dur, vol, filterFreq, when = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(filter).connect(g).connect(master);
    src.start(t0);
  }

  // A short original bassline in A minor, one bar looping: root, root,
  // fifth, octave walk. Scheduled a bar ahead so it never stutters.
  const BASS = [55, 0, 55, 0, 65.41, 0, 55, 0, 82.41, 0, 65.41, 0, 49, 0, 55, 0];
  const HAT = [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1];

  function scheduleMusic() {
    if (!ctx || muted) return;
    const stepDur = 60 / 112 / 2; // 112 BPM, eighth notes
    const now = ctx.currentTime;
    for (let i = 0; i < 8; i++) {
      const idx = (musicStep + i) % 16;
      const t = now + i * stepDur;
      const freq = BASS[idx];
      if (freq > 0) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0.16, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 0.95);
        osc.connect(g).connect(master);
        osc.start(t);
        osc.stop(t + stepDur);
      }
      if (HAT[idx]) {
        const len = Math.floor(ctx.sampleRate * 0.03);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let j = 0; j < len; j++) d[j] = (Math.random() * 2 - 1) * (1 - j / len);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 6000;
        const g = ctx.createGain();
        g.gain.value = 0.05;
        src.connect(hp).connect(g).connect(master);
        src.start(t);
      }
    }
    musicStep = (musicStep + 8) % 16;
    musicTimer = setTimeout(scheduleMusic, 8 * stepDur * 1000 * 0.9);
  }

  return {
    unlock,
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    musicStart() {
      if (!ensure() || musicTimer !== null) return;
      scheduleMusic();
    },
    musicStop() {
      if (musicTimer !== null) { clearTimeout(musicTimer); musicTimer = null; }
    },
    // Engine: one sawtooth whose pitch follows speed; call every frame.
    engine(speedNorm, driving) {
      if (!ctx || muted) return;
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineGain = ctx.createGain();
        engineGain.gain.value = 0;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 900;
        engineOsc.connect(lp).connect(engineGain).connect(master);
        engineOsc.start();
      }
      const target = driving ? 0.05 + speedNorm * 0.06 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(55 + speedNorm * 130, ctx.currentTime, 0.08);
    },
    // Police siren: two-tone wail while wanted. Call every frame.
    siren(on) {
      if (!ctx) return;
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'sine';
        sirenGain = ctx.createGain();
        sirenGain.gain.value = 0;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.55;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 180;
        lfo.connect(lfoGain).connect(sirenOsc.frequency);
        sirenOsc.frequency.value = 780;
        sirenGain.gain.setTargetAtTime(muted ? 0 : 0.045, ctx.currentTime, 0.2);
        sirenOsc.connect(sirenGain).connect(master);
        sirenOsc.start();
        lfo.start();
        sirenOsc._lfo = lfo;
      } else if (!on && sirenOsc) {
        const osc = sirenOsc;
        const lfo = osc._lfo;
        sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
        setTimeout(() => { try { osc.stop(); lfo.stop(); } catch {} }, 400);
        sirenOsc = null;
        sirenGain = null;
      }
    },
    shot() { noise(0.12, 0.5, 1800); tone(180, 0.08, 'square', 0.2, 0, 60); },
    enemyShot() { noise(0.1, 0.22, 1200); },
    punch() { noise(0.08, 0.35, 500); },
    crash() { noise(0.25, 0.5, 700); tone(90, 0.2, 'sine', 0.3, 0, 40); },
    pickup() { tone(880, 0.09, 'sine', 0.25); tone(1318, 0.14, 'sine', 0.22, 0.08); },
    cash() { tone(1046, 0.08, 'triangle', 0.25); tone(1318, 0.08, 'triangle', 0.25, 0.07); tone(1568, 0.16, 'triangle', 0.25, 0.14); },
    denied() { tone(220, 0.16, 'square', 0.2, 0, 160); },
    missionStart() { [523, 659, 784].forEach((f, i) => tone(f, 0.16, 'triangle', 0.25, i * 0.09)); },
    missionComplete() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.22, 'triangle', 0.28, i * 0.1)); },
    busted() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.18, i * 0.16)); },
    click() { tone(660, 0.05, 'square', 0.15); },
  };
}
