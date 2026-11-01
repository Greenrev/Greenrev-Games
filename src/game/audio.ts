/**
 * WebAudio sound: engine, a real two-tone car horn, effects, and the car radio.
 *
 * Volumes are split into effects (engine, horn, thuds) and music, each with its own level.
 *
 * Radio stations
 * - "GreenRev FM" and "Highlife Hour" are built in: grooves generated live, so there are no music
 *   files to download or license.
 * - Real songs: list licensed MP3s in public/music/playlist.json and they appear as "Naija Hits".
 *   Only add tracks you have the rights to stream (your own, royalty-free, or a deal with the
 *   artist or label).
 * - Live radio: real FM stations' internet streams, listed in CONFIG.radio.live
 *   ([{ name, url }]). Add a station only with its permission (see README, "Live radio").
 */
interface Station {
  id: string;
  name: string;
  live?: boolean;
  url?: string;
  bpm?: number;
  style?: "afro" | "highlife";
  tracks?: boolean;
}

const STATIONS: Station[] = [
  { id: "greenrev", name: "GreenRev FM", bpm: 104, style: "afro" },
  { id: "highlife", name: "Highlife Hour", bpm: 122, style: "highlife" },
];

export class Audio {
  sirenNodes: any;
  onError: any;
  live: any;
  _clip: any;
  ctx: any;
  el: any;
  enabled: any;
  engineFilter: any;
  engineGain: any;
  groove: any;
  master: any;
  music: any;
  musicLevel: any;
  nextNote: any;
  noiseBuf: any;
  onStation: any;
  osc: any;
  seqTimer: any;
  sfx: any;
  sfxLevel: any;
  stationIndex: any;
  step: any;
  trackIndex: any;
  tracks: any;

  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.sfxLevel = 0.8;
    this.musicLevel = 0.5;
    this.stationIndex = -1; // -1 = radio off
    this.tracks = [];       // licensed songs from playlist.json: [{ title, artist, src }]
    this.live = [];         // live FM streams: [{ name, url }]
    this.onError = null;    // callback(message) when a stream can't play
    this.trackIndex = 0;
    this.el = null;         // <audio> for real songs
    this.onStation = null;  // callback(label) when the station changes
  }

  start() {
    if (this.ctx || !this.enabled) return;
    const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 1;
    this.master.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = this.sfxLevel * 0.6;
    this.sfx.connect(this.master);
    this.music = this.ctx.createGain();
    this.music.gain.value = this.musicLevel * 0.5;
    this.music.connect(this.master);
    // engine: two detuned saws through a lowpass
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 600;
    this.engineFilter = lp;
    this.osc = [this.ctx.createOscillator(), this.ctx.createOscillator()];
    this.osc.forEach((o, i) => {
      o.type = "sawtooth";
      o.frequency.value = 50 + i * 3;
      o.connect(lp);
      o.start();
    });
    lp.connect(this.engineGain).connect(this.sfx);
    this.noiseBuf = this.makeNoise();
  }

  async loadPlaylist(url) {
    if (!url) return;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      this.tracks = (data.tracks ?? []).filter((t) => t && t.src);
    } catch {
      /* no playlist: built-in stations only */
    }
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? 1 : 0;
    if (this.el) this.el.muted = !on;
    if (on) this.start();
  }

  setSfxLevel(v) {
    this.sfxLevel = v;
    if (this.sfx) this.sfx.gain.value = v * 0.6;
  }

  setMusicLevel(v) {
    this.musicLevel = v;
    if (this.music) this.music.gain.value = v * 0.5;
    if (this.el) this.el.volume = v;
  }

  engine(speed, throttle) {
    if (!this.ctx) return;
    const f = 45 + speed * 3.2 + throttle * 25;
    const t = this.ctx.currentTime;
    this.osc[0].frequency.setTargetAtTime(f, t, 0.08);
    this.osc[1].frequency.setTargetAtTime(f * 1.51, t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(400 + speed * 30, t, 0.1);
    this.engineGain.gain.setTargetAtTime(0.06 + throttle * 0.05, t, 0.1);
  }

  tone(freq: number, dur: number, type: OscillatorType = "square", vol = 0.2, when = 0, bus?: AudioNode) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(bus ?? this.sfx);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /**
   * A real car horn: two horns a third apart (about 420 and 510 Hz), each a buzzy square wave pushed
   * through a resonant filter and soft clipping, with a fast attack and a flat sustain. Not a piano.
   */
  horn(duration = 0.5) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const out = this.ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.32, t + 0.015);
    out.gain.setValueAtTime(0.32, t + duration);
    out.gain.exponentialRampToValueAtTime(0.0001, t + duration + 0.06);
    const shaper = this.ctx.createWaveShaper();
    shaper.curve = this.clipCurve();
    const body = this.ctx.createBiquadFilter();
    body.type = "bandpass";
    body.frequency.value = 1700;
    body.Q.value = 1.1;
    shaper.connect(body).connect(out).connect(this.sfx);
    for (const f of [420, 508]) {
      const o = this.ctx.createOscillator();
      o.type = "square";
      o.frequency.setValueAtTime(f * 0.97, t);
      o.frequency.linearRampToValueAtTime(f, t + 0.03); // horns "bend" up as they sound
      const lfo = this.ctx.createOscillator();
      const depth = this.ctx.createGain();
      lfo.frequency.value = 28;
      depth.gain.value = 3;
      lfo.connect(depth).connect(o.frequency);
      const g = this.ctx.createGain();
      g.gain.value = 0.5;
      o.connect(g).connect(shaper);
      o.start(t);
      lfo.start(t);
      o.stop(t + duration + 0.1);
      lfo.stop(t + duration + 0.1);
    }
  }

  clipCurve() {
    if (this._clip) return this._clip;
    const n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      c[i] = Math.tanh(x * 2.5);
    }
    return (this._clip = c);
  }

  makeNoise() {
    const len = this.ctx.sampleRate * 0.5;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  coin() {
    [880, 1175, 1568].forEach((f, i) => this.tone(f, 0.14, "triangle", 0.15, i * 0.07));
  }

  thud(strength = 1) {
    if (!this.ctx || !this.enabled) return;
    const len = 0.25;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 220 + strength * 300;
    const g = this.ctx.createGain();
    g.gain.value = Math.min(1, 0.3 + strength * 0.5);
    src.connect(lp).connect(g).connect(this.sfx);
    src.start();
  }

  splash() {
    if (!this.ctx || !this.enabled) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 900;
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    src.connect(bp).connect(g).connect(this.sfx);
    src.start(t);
  }

  /** Police siren: a rising and falling wail. siren(true) starts it, siren(false) stops it. */
  siren(on: boolean) {
    if (!this.ctx || !this.enabled) on = false;
    if (!on) {
      if (this.sirenNodes) {
        const t = this.ctx.currentTime;
        this.sirenNodes.gain.gain.setTargetAtTime(0, t, 0.1);
        const nodes = this.sirenNodes;
        setTimeout(() => nodes.osc.forEach((o) => o.stop()), 400);
        this.sirenNodes = null;
      }
      return;
    }
    if (this.sirenNodes) return;
    const t = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.16, t + 0.3);
    const osc = this.ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 900;
    const lfo = this.ctx.createOscillator();
    lfo.type = "triangle";
    lfo.frequency.value = 0.55; // one wail every ~2 seconds
    const depth = this.ctx.createGain();
    depth.gain.value = 320; // 580 → 1220 Hz
    lfo.connect(depth).connect(osc.frequency);
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2400;
    osc.connect(lp).connect(gain).connect(this.sfx);
    osc.start(t);
    lfo.start(t);
    this.sirenNodes = { gain, osc: [osc, lfo] };
  }

  whistle() {
    this.tone(2200, 0.18, "sine", 0.12);
    this.tone(2400, 0.3, "sine", 0.12, 0.2);
  }

  // ---------------------------------------------------------------- radio

  /** All stations: built-in grooves, plus "Naija Hits" when a playlist is configured. */
  stations(): Station[] {
    const live: Station[] = this.live.map((s, i) => ({ id: `live-${i}`, name: s.name, live: true, url: s.url }));
    return [...live, ...STATIONS, ...(this.tracks.length ? [{ id: "hits", name: "Naija Hits", tracks: true }] : [])];
  }

  /** Live FM stations' internet streams (only ones you have permission to carry). */
  setLiveStations(list: { name: string; url: string }[] = []) {
    this.live = list.filter((s) => s && s.name && String(s.url).startsWith("https://"));
  }

  stationLabel() {
    const st = this.stations()[this.stationIndex];
    if (!st) return "Radio off";
    if (st.live) return `${st.name} · LIVE`;
    if (st.tracks) {
      const t = this.tracks[this.trackIndex];
      return `${st.name}: ${t.title}${t.artist ? ` · ${t.artist}` : ""}`;
    }
    return st.name;
  }

  /** Next station (wraps through "off"). */
  nextStation() {
    const n = this.stations().length;
    this.stationIndex = this.stationIndex + 1 >= n ? -1 : this.stationIndex + 1;
    this.playStation();
    return this.stationLabel();
  }

  radioOff() {
    this.stationIndex = -1;
    this.playStation();
  }

  /** Next song on Naija Hits, or the next station otherwise. */
  skip() {
    const st = this.stations()[this.stationIndex];
    if (st?.tracks) {
      this.trackIndex = (this.trackIndex + 1) % this.tracks.length;
      this.playTrack();
      this.onStation?.(this.stationLabel());
      return this.stationLabel();
    }
    return this.nextStation();
  }

  playStation() {
    clearInterval(this.seqTimer);
    this.seqTimer = null;
    this.el?.pause();
    const st = this.stations()[this.stationIndex];
    this.onStation?.(this.stationLabel());
    if (!st || !this.ctx) return;
    if (st.tracks) return this.playTrack();
    if (st.live) return this.playStream(st);
    this.groove = st;
    this.step = 0;
    this.nextNote = this.ctx.currentTime + 0.1;
    this.seqTimer = setInterval(() => this.schedule(), 50);
  }

  /** A live internet radio stream through a plain <audio> element. */
  playStream(st: Station) {
    this.ensureElement();
    this.el.src = st.url;
    this.el.volume = this.musicLevel;
    this.el.muted = !this.enabled;
    this.el.play().catch(() => this.onError?.(`${st.name} isn't reachable right now. Try the next station.`));
  }

  ensureElement() {
    if (this.el) return;
    this.el = new globalThis.Audio();
    this.el.addEventListener("ended", () => {
      if (this.stations()[this.stationIndex]?.tracks) this.skip();
    });
    this.el.addEventListener("error", () => {
      const st = this.stations()[this.stationIndex];
      if (st?.live) this.onError?.(`${st.name} isn't reachable right now. Try the next station.`);
    });
  }

  playTrack() {
    const t = this.tracks[this.trackIndex];
    if (!t) return;
    this.ensureElement();
    this.el.src = t.src;
    this.el.volume = this.musicLevel;
    this.el.muted = !this.enabled;
    this.el.play().catch(() => {});
  }

  /** Lookahead scheduler for the built-in grooves (16th-note steps). */
  schedule() {
    if (!this.ctx || !this.groove) return;
    const stepDur = 60 / this.groove.bpm / 4;
    while (this.nextNote < this.ctx.currentTime + 0.2) {
      this.playStep(this.step, this.nextNote, stepDur);
      this.nextNote += stepDur;
      this.step = (this.step + 1) % 64;
    }
  }

  playStep(step, t, dur) {
    const s = step % 16;
    const bar = Math.floor(step / 16) % 4;
    const m = this.music;
    const hit = (freq, len, type, vol, when = t) => {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, when);
      g.gain.setValueAtTime(vol, when);
      g.gain.exponentialRampToValueAtTime(0.0008, when + len);
      o.connect(g).connect(m);
      o.start(when);
      o.stop(when + len + 0.02);
      return o;
    };
    const noise = (len, freq, vol) => {
      const src = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
      src.buffer = this.noiseBuf;
      f.type = "highpass";
      f.frequency.value = freq;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + len);
      src.connect(f).connect(g).connect(m);
      src.start(t, Math.random() * 0.3);
      src.stop(t + len + 0.02);
    };
    if (this.groove.style === "afro") {
      // Afrobeats-style: kick, offbeat snare, shaker 16ths, log-drum bass, bell
      if (s === 0 || s === 7 || s === 10) {
        const k = hit(110, 0.25, "sine", 0.9);
        k.frequency.exponentialRampToValueAtTime(42, t + 0.2);
      }
      if (s === 4 || s === 12) noise(0.12, 1800, 0.35);
      noise(0.04, 7000, s % 2 ? 0.08 : 0.14);
      const roots = [55, 55, 49, 61.7][bar];
      if ([0, 3, 6, 8, 11, 14].includes(s)) hit(roots * (s === 11 ? 1.5 : 1), dur * 2.2, "triangle", 0.55);
      if ([2, 5, 9, 13].includes(s)) hit(880 * (bar === 2 ? 0.89 : 1), 0.08, "square", 0.05);
      if (s === 0 && bar % 2 === 0) for (const f of [220, 277, 330]) hit(f * (roots / 55), dur * 6, "sawtooth", 0.03);
    } else {
      // highlife: bright guitar-like plucks in thirds over a walking bass and clave
      const prog = [[196, 247], [175, 220], [131, 165], [147, 185]][bar];
      if ([0, 3, 6, 10, 12].includes(s)) hit(2000, 0.03, "square", 0.08); // clave
      if (s % 4 === 0) {
        const k = hit(95, 0.2, "sine", 0.7);
        k.frequency.exponentialRampToValueAtTime(45, t + 0.15);
      }
      if (s % 2 === 0) hit(prog[0] / 2 * (s % 8 === 4 ? 1.5 : 1), dur * 1.8, "triangle", 0.45);
      if ([1, 3, 5, 7, 9, 11, 13, 15].includes(s)) {
        const n = prog[s % 4 === 1 ? 0 : 1] * 2;
        hit(n, 0.18, "triangle", 0.09);
        hit(n * 1.26, 0.18, "triangle", 0.06);
      }
      noise(0.03, 8000, 0.05);
    }
  }
}
