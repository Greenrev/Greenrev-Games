/**
 * Spoken game moments. Each line plays a recorded clip from public/voice/<key>.mp3 if it exists
 * (record them in your own voice, see public/voice/README.md). Until a clip exists, the phone's
 * built-in text-to-speech reads the line, so every moment already talks.
 *
 * Lines never pile up: one at a time, and lower-priority lines are dropped while one is playing.
 */
export const VOICE_LINES = {
  // hype men (brand-free)
  hype_1: "This luxury don land! Who get am?!",
  hype_2: "Ehn ehn! See money!",
  hype_3: "Clear road! Big man dey pass!",
  hype_4: "This one na correct whip o!",
  hype_5: "Who get this ride? E too clean!",
  hype_6: "Oga, bless us small!",
  // police and checkpoints
  police_slow: "Oya, slow down! Wait, wait!",
  police_stop: "How far? Where your people pass?",
  police_explain: "Okay, I be policeman. Slow down. Wait till they pass. You understand?",
  police_go: "Oya, move!",
  military_stop: "Everybody come down! Open your boot!",
  // road scenes
  clear_road: "Hey! Come off the road now!",
  first_scene: "You need to be the first at the scene. Everyone get back!",
  rear_end: "Haba! Who jam me from back?!",
};

export class Voice {
  base: any;
  busyUntil: any;
  clips: any;
  current: any;
  enabled: any;
  preloaded: any;
  tts: any;

  constructor(baseUrl = "./voice/") {
    this.base = baseUrl;
    this.enabled = true;
    // The phone's robot voice reads lines that have no recording yet. Off by default: players found
    // it jarring, and speech bubbles already show the words. Turn on in Settings to preview lines.
    this.tts = false;
    this.clips = new Map(); // key -> HTMLAudioElement once it has loaded
    this.busyUntil = 0;
    this.current = null;
    this.preloaded = false;
  }

  /** Start loading recordings (call after the first user tap so mobile browsers allow audio). */
  preload() {
    if (this.preloaded || typeof globalThis.Audio !== "function") return;
    this.preloaded = true;
    for (const key of Object.keys(VOICE_LINES)) {
      const a = new globalThis.Audio();
      a.preload = "auto";
      a.addEventListener("canplaythrough", () => this.clips.set(key, a), { once: true });
      a.addEventListener("error", () => this.clips.delete(key), { once: true });
      a.src = `${this.base}${key}.mp3`;
    }
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) this.stop();
  }

  stop() {
    this.current?.pause?.();
    this.current = null;
    globalThis.speechSynthesis?.cancel?.();
    this.busyUntil = 0;
  }

  /**
   * Say a line. `priority: true` interrupts whatever is playing (checkpoints); otherwise the line is
   * skipped if something is already being said.
   */
  say(key, { priority = false } = {}) {
    if (!this.enabled) return false;
    const now = performance.now();
    if (!priority && now < this.busyUntil) return false;
    if (priority) this.stop();
    const clip = this.clips.get(key);
    if (clip) {
      clip.currentTime = 0;
      clip.play().catch(() => {});
      this.current = clip;
      this.busyUntil = now + (Number.isFinite(clip.duration) ? clip.duration * 1000 : 2000) + 250;
      return true;
    }
    return this.speak(VOICE_LINES[key] ?? key, now);
  }

  speak(text, now = performance.now()) {
    const synth = globalThis.speechSynthesis;
    if (!this.tts || !synth || typeof globalThis.SpeechSynthesisUtterance !== "function") return false;
    const u = new globalThis.SpeechSynthesisUtterance(text);
    const voices = synth.getVoices();
    // Prefer a Nigerian English voice, then any British/African English voice, then the default.
    u.voice = voices.find((v) => v.lang === "en-NG") ?? voices.find((v) => /en-(GB|ZA|KE|GH)/.test(v.lang)) ?? null;
    u.rate = 1.05;
    u.pitch = 1;
    synth.cancel();
    synth.speak(u);
    this.busyUntil = now + 600 + text.length * 70;
    return true;
  }
}
