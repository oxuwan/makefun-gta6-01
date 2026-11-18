// Sound: everything is synthesized with WebAudio — no audio files.
// Engine hum, police siren, gunshots, crashes, pickups and a small
// bass-and-hat music loop. The context is created on the first user
// gesture; screenshot and self-test runs stay silent.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let musicTimer = null;
  let musicStep = 0;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      // Engine: a low sawtooth whose pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 40;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      startMusic();
    } catch {
      return false;
    }
    return true;
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    gain.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  function noise(dur, vol, lowpass) {
    if (!ctx || muted) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass || 1200;
    const gain = ctx.createGain();
    gain.gain.value = vol || 0.3;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
  }

  // A lazy bass line (A minor) with a hat tick, one bar every 1.6 s.
  const BASS = [55, 0, 55, 0, 65.41, 0, 49, 0, 55, 0, 55, 0, 82.41, 0, 73.42, 0];
  function startMusic() {
    if (musicTimer) return;
    musicTimer = window.setInterval(() => {
      if (muted || !ctx) return;
      const note = BASS[musicStep % BASS.length];
      musicStep += 1;
      if (note) blip(note, 0.22, 'triangle', 0.16);
      if (musicStep % 2 === 0) noise(0.03, 0.05, 6000);
    }, 100);
  }

  return {
    unlock() { ensure(); },
    setMuted(value) { muted = value; if (master) master.gain.value = value ? 0 : 0.35; },
    setEngine(speed01, driving) {
      if (!ctx || !engineOsc) return;
      const target = driving ? 0.05 + speed01 * 0.1 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(45 + speed01 * 130, ctx.currentTime, 0.1);
    },
    siren(on) {
      if (!ctx || muted) return;
      // Two-tone wail, one short call per police update tick.
      blip(on ? 720 : 540, 0.18, 'sine', 0.05);
    },
    shoot() { noise(0.12, 0.35, 3000); blip(180, 0.08, 'square', 0.12, 60); },
    enemyShoot() { noise(0.1, 0.18, 2400); },
    crash() { noise(0.25, 0.4, 900); },
    door() { blip(140, 0.08, 'square', 0.15, 90); },
    horn() { blip(370, 0.28, 'sawtooth', 0.16, 340); blip(466, 0.28, 'sawtooth', 0.1, 440); },
    carjack() { blip(220, 0.15, 'sawtooth', 0.18, 110); },
    punch() { noise(0.08, 0.25, 700); },
    pickup() { blip(660, 0.1, 'sine', 0.2, 990); },
    mission() { blip(523, 0.12, 'sine', 0.2); window.setTimeout(() => blip(784, 0.18, 'sine', 0.2), 130); },
    reward() {
      blip(523, 0.1, 'sine', 0.2);
      window.setTimeout(() => blip(659, 0.1, 'sine', 0.2), 110);
      window.setTimeout(() => blip(784, 0.2, 'sine', 0.2), 220);
    },
    busted() { blip(392, 0.3, 'sawtooth', 0.2, 196); },
  };
}
