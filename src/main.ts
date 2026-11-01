import * as THREE from "three";
import { CITIES, getRoute, ROUTES } from "./data/routes.ts";
import { carPhysics, getCar, SAFETY_KIT } from "./data/cars.ts";
import { CONFIG, openExternal, openGreenRev, openGreenRevUrl, requestPurchase, track } from "./config.ts";
import { Audio } from "./game/audio.ts";
import { Voice } from "./game/voice.ts";
import { activeFeatured, HYPE_LINES, hypeScore, listingTarget, loadFeatured, saveDream } from "./game/featured.ts";
import { Input } from "./game/input.ts";
import { planLeg } from "./game/director.ts";
import { activeCampaigns, loadCampaigns } from "./game/ads.ts";
import { GREETINGS, MENUS } from "./data/food.ts";
import { BIOME_HILLS, crashDamage, curveHeading, hillY, LANE_WIDTH, laneX, lateralX, MEDIAN_HALF, overlaps, ROAD_EDGE, setHillProfile, setRoadFeatures, SHOULDER } from "./game/physics.ts";
import { rng } from "./game/rng.ts";
import * as S from "./game/state.ts";
import { acceptInvite, ensureReferral, inviteUrl, parseInvite, settleChallenge } from "./game/referral.ts";
import * as E from "./game/economy.ts";
import { awardPoints, newerCloudSave, queueCloudSave } from "./game/cloud.ts";
import { contractOffers, settleContract, targetSeconds } from "./game/contracts.ts";
import * as UI from "./game/ui.ts";
import { Actors, SNACKS } from "./world/actors.ts";
import { animateFeatures, buildFeature } from "./world/features.ts";
import * as M from "./world/models.ts";
import { Traffic } from "./world/traffic.ts";
import { BIOMES, toWorld, World } from "./world/world.ts";

const $ = (id) => document.getElementById(id);
const naira = UI.naira;
const KMH = 3.6;

/** Camera views, in the order the 🎥 button cycles through them. */
const CAMERAS = {
  chase: { label: "Chase", back: 8.5, up: 3.4, side: 0, look: 14, lookUp: 1.2 },
  bonnet: { label: "Bonnet", back: -1.6, up: 1.75, side: 0, look: 30, lookUp: 1.0, locked: true },
  cockpit: { label: "Driver", back: -0.2, up: 1.25, side: -0.35, look: 30, lookUp: 1.1, locked: true, hideCar: true },
  front: { label: "Front view", back: -9, up: 2.4, side: 0.4, look: -4, lookUp: 1.1 },
  aerial: { label: "Aerial", back: 20, up: 18, side: 0, look: 22, lookUp: 0 },
  top: { label: "Top-down", back: 3, up: 34, side: 0, look: 8, lookUp: 0 },
  cinematic: { label: "Cinematic", back: 10, up: 3, side: 6, look: 6, lookUp: 1, swing: true },
};
const CAMERA_ORDER = Object.keys(CAMERAS);

class Game {
  prevPlayerZ: any;
  chase: any;
  patrol: any;
  nextPatrolAt: any;
  raf: any;
  destroyed: any;
  abort: any;
  active: any;
  actors: any;
  adRotation: any;
  attract: any;
  audio: any;
  brokenDown: any;
  camera: any;
  cameraMode: any;
  campaigns: any;
  clock: any;
  condWarned: any;
  debtWarned: any;
  diff: any;
  energyLow: any;
  energyWarned: any;
  eventIdx: any;
  featureFx: any;
  featureIdx: any;
  featuredList: any;
  gateSpawned: any;
  hype: any;
  hypeAction: any;
  input: any;
  invite: any;
  lastHardBrake: any;
  lastHorn: any;
  leg: any;
  legEndZ: any;
  legFeatures: any;
  legHyped: any;
  legIndex: any;
  legStartZ: any;
  legStats: any;
  mode: any;
  nextFeaturedAt: any;
  outOfFuel: any;
  parTime: any;
  paused: any;
  plan: any;
  player: any;
  playerMesh: any;
  potholeIdx: any;
  potholeMeshes: any;
  prevSpeed: any;
  raycaster: any;
  renderer: any;
  roadFeatures: any;
  route: any;
  scene: any;
  shake: any;
  state: any;
  t: any;
  timeOfDay: any;
  traffic: any;
  voice: any;
  world: any;

  constructor() {
    this.abort = new AbortController(); // removes every window listener on destroy()
    this.state = S.load();
    this.audio = new Audio();
    this.audio.enabled = this.state.settings.sound;
    this.voice = new Voice(CONFIG.voiceUrl);
    this.voice.setEnabled(this.state.settings.sound && this.state.settings.voice !== false);
    this.featuredList = [];
    this.audio.setSfxLevel(this.state.settings.sfx ?? 0.8);
    this.audio.setMusicLevel(this.state.settings.music ?? 0.5);
    this.audio.onStation = (label) => this.updateRadioButton(label);
    this.audio.loadPlaylist(CONFIG.musicUrl);
    this.audio.setLiveStations(CONFIG.radio.live);
    this.audio.onError = (msg) => UI.toast(`📻 ${msg}`, { kind: "bad" });
    this.voice.tts = !!this.state.settings.robotVoice;
    ensureReferral(this.state);
    S.onSave((st) => queueCloudSave(CONFIG.cloud.saveUrl, st));
    newerCloudSave(CONFIG.cloud.saveUrl, this.state).then((remote) => {
      if (!remote || this.mode === "drive") return;
      this.state = S.load({ getItem: () => JSON.stringify(remote) });
      UI.renderMenu(this.state, { onStart: (id) => this.startRoute(id) });
      UI.toast("Progress synced from your GreenRev account.", { kind: "gold" });
    });
    // Hosts that verify purchases themselves can confirm them directly (off unless trusted in config).
    globalThis.addEventListener?.("message", (ev: MessageEvent) => {
      const m = ev.data;
      if (!CONFIG.credits.trustHostMessages || m?.type !== "greenrev:credits") return;
      const r = E.grantCredits(this.state, m.pack, m.receipt);
      if (r.ok) {
        UI.toast(`💳 ${naira(r.coins)} added to your wallet. Thank you!`, { kind: "gold" });
        S.save(this.state);
      }
    }, { signal: this.abort.signal });
    this.invite = parseInvite(location.hash, location.search) ?? (globalThis.GREENREV_CONFIG?.invite ? parseInvite(`#${globalThis.GREENREV_CONFIG.invite}`) : null);
    loadFeatured(CONFIG.featured.url).then((list) => (this.featuredList = list));
    this.input = new Input(this.abort.signal);
    this.mode = "menu";
    this.paused = false;
    this.clock = new THREE.Clock();
    this.t = 0;
    this.shake = 0;
    this.cameraMode = CAMERAS[this.state.settings.camera] ? this.state.settings.camera : "chase";
    this.campaigns = [];
    this.adRotation = 0;
    loadCampaigns(CONFIG.advertise.adsUrl).then((c) => (this.campaigns = c));
    this.initRenderer();
    this.input.bindTouch($("touch"));
    UI.setCtaHandler((target, context) => this.cta(target, context));
    this.bindUi();
    this.idleAttract();
    this.loop();
    this.showMenu(true);
    track("session_start", { streak: this.state.streak.count });
    addEventListener("visibilitychange", () => document.hidden && this.mode === "drive" && this.pause());
  }

  // ---------------------------------------------------------------- setup

  quality() {
    const q = this.state.settings.quality;
    if (q !== "auto") return q;
    return matchMedia("(pointer: coarse)").matches || devicePixelRatio > 2.5 ? "low" : "medium";
  }

  initRenderer() {
    const canvas = $("scene");
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.quality() !== "low", powerPreference: "high-performance" });
    } catch {
      $("webgl-error").classList.remove("hidden");
      throw new Error("WebGL unavailable");
    }
    const q = this.quality();
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, q === "low" ? 1 : q === "medium" ? 1.5 : 2));
    this.renderer.shadowMap.enabled = q === "high";
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.3, 2400);
    this.world = new World(this.scene, q);
    this.traffic = new Traffic(this.scene);
    this.actors = new Actors(this.scene);
    this.raycaster = new THREE.Raycaster();
    const resize = () => {
      this.renderer.setSize(innerWidth, innerHeight, false);
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.fov = innerWidth < innerHeight ? 74 : 62;
      this.camera.updateProjectionMatrix();
    };
    addEventListener("resize", resize, { signal: this.abort.signal });
    resize();
    canvas.addEventListener("pointerup", (e) => this.tapScene(e));
  }

  bindUi() {
    document.querySelectorAll<HTMLElement>("[data-cta]").forEach((b) => (b.onclick = () => this.cta(b.dataset.cta, { reason: "menu" })));
    document.querySelectorAll<HTMLElement>("[data-open]").forEach((b) => (b.onclick = () => this.openPanel(b.dataset.open)));
    $("btn-pause").onclick = () => this.pause();
    $("btn-cam").onclick = () => this.cycleCamera();
    $("btn-radio").onclick = () => {
      this.audio.start();
      UI.toast(`📻 ${this.audio.nextStation()}`, { ttl: 2500 });
    };
    $("btn-sound").onclick = () => this.toggleSoundPanel();
    this.updateCamButton();
    UI.applyLogo(CONFIG.logoUrl);
  }

  cta(target, context) {
    if (target === "advertise") return this.openAdvertise(context?.reason ?? "cta");
    S.addStat(this.state, "ctaClicks");
    this.checkProgress();
    S.save(this.state);
    openGreenRev(target, context);
  }

  async openPanel(name) {
    if (name === "garage") await UI.openGarage(this.state);
    if (name === "passport") await UI.openPassport(this.state);
    if (name === "advertise") await this.openAdvertise("menu");
    if (name === "settings") await UI.openSettings(this.state, this.audio, () => UI.toast("Graphics change applies after reload"), this.voice);
    if (name === "dream") await this.openDreamGarage();
    if (name === "invite") await this.openInvite();
    if (name === "bank") await this.openBank();
    if (name === "topup") await this.openTopUp("menu");
    this.showMenu();
  }

  // ---------------------------------------------------------------- menu & attract mode

  /** Behind the menu, the camera cruises a scenic road so the game looks alive from the first frame. */
  idleAttract() {
    this.route = getRoute(this.state.trip?.routeId ?? "lagos-abuja");
    this.legIndex = this.state.trip?.legIndex ?? 0;
    this.legStartZ = 0;
    this.leg = this.route.legs[this.legIndex];
    this.setupLegEnvironment();
    this.player = this.makePlayer();
    this.player.z = 40;
    this.player.speed = 20;
    this.attract = true;
  }

  async showMenu(first = false) {
    this.mode = "menu";
    $("hud").classList.add("hidden");
    $("menu").classList.remove("hidden");
    UI.renderMenu(this.state, { onStart: (id) => this.startRoute(id) });
    if (first) {
      const reward = S.checkIn(this.state);
      S.dailyMissions(this.state);
      S.save(this.state);
      if (reward) {
        track("daily_checkin", { day: reward.day });
        await UI.modal({
          art: "🔥",
          title: `Day ${reward.day} streak!`,
          body: `<p>Welcome back. Your daily fuel money is in: <b>${naira(reward.reward)}</b>.</p><p>Come back tomorrow for <b>${naira(reward.nextReward)}</b>. Miss a day and the streak resets.</p><p>Today's roads are freshly generated: new potholes, new checkpoints, new go-slows.</p>`,
          actions: [{ id: "ok", label: "Oya, let's drive!", style: "primary" }],
        });
        UI.renderMenu(this.state, { onStart: (id) => this.startRoute(id) });
      }
      await this.handleInvite();
      this.claimReferralRewards();
      UI.renderMenu(this.state, { onStart: (id) => this.startRoute(id) });
    }
  }

  // ---------------------------------------------------------------- money

  /** Pay through the economy (see economy.ts for "must" / "overdraft" / "cash"). */
  pay(amount, category, kind = "cash") {
    const r = E.charge(this.state, amount, category, kind);
    if (r.intoDebt && !this.debtWarned) {
      this.debtWarned = true;
      UI.toast(`Your wallet is in the red (${naira(this.state.coins)}). Trip pay clears it first, or visit the bank.`, { kind: "bad", ttl: 7000 });
    }
    if (this.state.coins >= 0) this.debtWarned = false;
    return r.ok;
  }

  /** A pay function for S.refuel / S.repair / S.renewPapers. */
  payer(kind) {
    return (state, cost, category) => this.pay(cost, category, kind);
  }

  /** Fines scale with difficulty, and count against VIP contracts. */
  fine(amount) {
    if (this.state.trip?.tally) this.state.trip.tally.fines++;
    return Math.round((amount * (this.diff?.fines ?? 1)) / 500) * 500;
  }

  earn(amount, category) {
    return E.earn(this.state, amount, category);
  }

  /** Not enough money: the bank or a credit top-up. */
  async offerLoan(what) {
    const offers = E.loanOffers(this.state).filter((o) => o.available);
    const id = await UI.modal({
      art: "🏦",
      title: "Money no reach",
      body: `<p>You don't have enough for ${UI.esc(what)}. Wallet: <b>${naira(this.state.coins)}</b>.</p>
        <p>${E.BANK_NAME} can lend you money. Interest is charged after each leg, and a quarter of your trip pay goes to repaying it automatically.</p>`,
      actions: [
        ...offers.map((o) => ({ id: `loan:${o.id}`, label: `${o.label}: ${naira(o.amount)}`, hint: `${(o.rate * 100).toFixed(1)}% per leg` })),
        { id: "topup", label: "Top up with GreenRev credits", style: "hype" },
        { id: "no", label: "No thanks", style: "ghost" },
      ],
    });
    if (id?.startsWith("loan:")) {
      const r = E.takeLoan(this.state, id.slice(5));
      if (r.ok) {
        this.audio.coin();
        track("loan_taken", { amount: r.amount });
        UI.toast(`${naira(r.amount)} added to your wallet. Pay it back as you drive.`, { kind: "gold" });
      } else UI.toast(r.reason, { kind: "bad" });
    }
    if (id === "topup") await this.openTopUp("short_of_money");
    S.save(this.state);
    UI.renderMenu(this.state, { onStart: (rid) => this.startRoute(rid) });
  }

  async openBank() {
    for (;;) {
      const s = this.state;
      const bal = E.loanBalance(s);
      const offers = E.loanOffers(s);
      const id = await UI.modal({
        art: "🏦",
        title: E.BANK_NAME,
        body: `<div class="kv"><span>Wallet</span><b class="${s.coins < 0 ? "neg" : ""}">${naira(s.coins)}</b>
            <span>Loan balance</span><b class="${bal ? "neg" : ""}">${naira(bal)}</b>
            ${s.loan ? `<span>Interest</span><b>${(s.loan.rate * 100).toFixed(1)}% per leg</b>` : ""}
            <span>Credit limit</span><b>${naira(E.creditLimit(s))}</b><span>Overdraft limit</span><b>${naira(E.overdraftLimit(s))}</b></div>
          <p class="hint">Fines, tolls and roadside repairs are always paid, even into the red. A negative wallet costs 5% per leg and locks cars and upgrades. Finish legs without crashing to raise your limits.</p>`,
        actions: [
          ...offers.map((o) => ({ id: `loan:${o.id}`, label: `${o.label}: ${naira(o.amount)}`, hint: `${(o.rate * 100).toFixed(1)}% per leg`, disabled: !o.available })),
          ...(bal ? [{ id: "repay", label: `Repay ${naira(Math.min(bal, Math.max(0, s.coins)))}`, style: "primary", disabled: s.coins <= 0 }] : []),
          { id: "topup", label: "Top up with GreenRev credits", style: "hype" },
          { id: "close", label: "Back", style: "ghost" },
        ],
      });
      if (!id || id === "close") return;
      if (id.startsWith("loan:")) {
        const r = E.takeLoan(s, id.slice(5));
        UI.toast(r.ok ? `${naira(r.amount)} added to your wallet.` : r.reason, { kind: r.ok ? "gold" : "bad" });
        if (r.ok) track("loan_taken", { amount: r.amount });
      }
      if (id === "repay") {
        const paid = E.repayLoan(s, bal);
        if (!s.loan) {
          S.addStat(s, "loansRepaid");
          UI.toast("Loan fully repaid. The bank manager is smiling. 🙌🏾", { kind: "gold" });
        } else UI.toast(`Repaid ${naira(paid)}.`);
        this.checkProgress();
      }
      if (id === "topup") await this.openTopUp("bank");
      S.save(s);
    }
  }

  /**
   * GreenRev credit packs (real money). The purchase runs in the host app or website, which confirms
   * it with the GreenRev backend; the game then claims it (see CONFIG.credits).
   */
  async openTopUp(source) {
    track("topup_open", { source });
    const id = await UI.modal({
      art: "💳",
      title: "Top up your wallet",
      body: `<p>Buy GreenRev credits to add game money. Credits are for the game only and can't be cashed out.</p>
        <div class="packs">${E.CREDIT_PACKS.map((k) => `<div class="pack"><b>${naira(k.coins)}</b><span>${k.label}${k.tag ? ` · <em>${k.tag}</em>` : ""}</span></div>`).join("")}</div>`,
      actions: [
        ...E.CREDIT_PACKS.map((k) => ({ id: k.id, label: `${k.label}: ${naira(k.coins)} game money`, hint: `₦${k.price.toLocaleString("en-NG")}`, style: k.tag === "Popular" ? "primary" : "" })),
        { id: "close", label: "Maybe later", style: "ghost" },
      ],
    });
    const pack = E.CREDIT_PACKS.find((k) => k.id === id);
    if (!pack) return;
    track("topup_select", { pack: pack.id, price: pack.price, source });
    requestPurchase(pack, this.state.referral?.code, () => this.claimCredits());
  }

  /** Ask the backend for confirmed purchases and grant them once each. */
  async claimCredits() {
    const url = CONFIG.credits.claimUrl;
    if (!url) return;
    try {
      const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}player=${encodeURIComponent(this.state.referral.code)}`, { cache: "no-store", credentials: "include" });
      if (!res.ok) return;
      const { purchases = [] } = await res.json();
      for (const pu of purchases) {
        const r = E.grantCredits(this.state, pu.pack, pu.receipt);
        if (r.ok) {
          this.audio.coin();
          UI.toast(`💳 ${naira(r.coins)} added to your wallet. Thank you!`, { kind: "gold", ttl: 6000 });
          track("topup_granted", { pack: pu.pack });
        }
      }
      S.save(this.state);
      UI.renderMenu(this.state, { onStart: (rid) => this.startRoute(rid) });
    } catch {
      /* try again next launch */
    }
  }

  // ---------------------------------------------------------------- contracts

  /** Pick the job for this journey (or just drive). Returns the contract, null, or undefined to cancel. */
  async chooseContract(route) {
    const diff = E.difficulty(this.state);
    const offers = contractOffers(route, S.dayKey(), diff);
    const par = targetSeconds(route, diff.speed);
    const id = await UI.modal({
      art: "📋",
      title: `Jobs for ${route.name}`,
      body: `<p>Take a job and race for the money. Par time for this journey: <b>${UI.fmtTime(par)}</b> · Level: <b>${diff.label}</b></p>
        ${offers.map((o) => `<div class="job"><span class="job-icon">${o.icon}</span><div><b>${UI.esc(o.title)} · ${naira(o.pay)}${o.bonus ? ` + ${naira(o.bonus)} bonus` : ""}</b><p>${UI.esc(o.blurb)}</p><small>Target time ${UI.fmtTime(o.target)}</small></div></div>`).join("")}`,
      actions: [
        ...offers.map((o) => ({ id: o.id, label: `${o.icon} Take: ${o.title}`, hint: naira(o.pay), style: "primary" })),
        { id: "free", label: "Just drive (no job)" },
        { id: "level", label: `Change level (now ${diff.label})`, style: "ghost" },
        { id: "back", label: "Back", style: "ghost" },
      ],
    });
    if (id === "back" || !id) return undefined;
    if (id === "level") {
      const order = ["easy", "normal", "hard"];
      this.state.settings.difficulty = order[(order.indexOf(diff.id) + 1) % 3];
      S.save(this.state);
      return this.chooseContract(route);
    }
    if (id === "free") return null;
    const c = offers.find((o) => o.id === id);
    track("contract_take", { routeId: route.id, type: c.type, pay: c.pay });
    return c;
  }

  trackHardBrake(dt) {
    const p = this.player;
    const prev = this.prevSpeed ?? p.speed;
    this.prevSpeed = p.speed;
    if (dt <= 0 || !this.state.trip?.tally) return;
    if (prev > 12 && (prev - p.speed) / dt > 11 && this.t - (this.lastHardBrake ?? -9) > 1.5) {
      this.lastHardBrake = this.t;
      this.state.trip.tally.hardBrakes++;
      if (this.state.trip.contract?.type === "passengers" && Math.random() < 0.5) UI.toast(`"Driver, take am easy o! We no be bag of cement!"`, { ttl: 2500 });
    }
  }

  // ---------------------------------------------------------------- police & FRSC patrols

  /**
   * Patrol pickups cruise the highway (and pass on the other side). Overtake one above 100 km/h and
   * its siren comes on: slow down and stop, or it catches you anyway and the fine doubles.
   */
  updatePatrols(jam) {
    const p = this.player;
    const sec = this.leg.security ?? {};
    const weight = (sec.police ?? 0) + (sec.frsc ?? 0);
    if (this.patrol && !this.traffic.cars.includes(this.patrol)) this.patrol = null;
    if (this.t >= this.nextPatrolAt) {
      this.nextPatrolAt = this.t + 45 + Math.random() * 45;
      if (weight > 0 && !jam && !this.chase) {
        const kind = Math.random() < (sec.police ?? 0) / weight ? "police" : "frsc";
        const oncoming = !!this.patrol || Math.random() < 0.35;
        const car = this.traffic.spawnPatrol(kind, p, oncoming);
        if (car && !oncoming) this.patrol = car;
        else if (!car) this.nextPatrolAt = this.t + 8; // lane busy, try again soon
      }
    }
    const c = this.patrol;
    if (c && !this.chase && !c.done && this.prevPlayerZ !== undefined && this.prevPlayerZ < c.z && p.z >= c.z) {
      c.done = true; // one chance per patrol
      const kmh = p.speed * KMH;
      if (kmh > 100) {
        c.chasing = true;
        this.chase = { car: c, kind: c.patrol, kmh, started: this.t };
        this.audio.siren(true);
        this.voice.say("police_slow", { priority: true });
        UI.alertBanner(`🚨 ${c.patrol === "police" ? "Police" : "FRSC"} patrol: ${Math.round(kmh)} km/h! Slow down and stop`, "info");
        track("patrol_chase", { kind: c.patrol, kmh: Math.round(kmh) });
      }
    }
    this.prevPlayerZ = p.z;
    const ch = this.chase;
    if (!ch) return;
    if (!this.traffic.cars.includes(ch.car)) {
      this.chase = null;
      this.audio.siren(false);
      return;
    }
    // stopped for the siren: pulled over (even if traffic is holding the patrol back a little)
    ch.stoppedFor = p.speed < 3 ? (ch.stoppedFor ?? 0) + (this.t - (ch.lastT ?? this.t)) : 0;
    ch.lastT = this.t;
    const close = ch.car.z > p.z - 35;
    if ((p.speed < 3 && close) || ch.stoppedFor > 3) this.pullOver(ch, false);
    else if (this.t - ch.started > 25 && !ch.stoppedFor) this.pullOver(ch, true);
  }

  async pullOver(ch, ignored: boolean) {
    this.chase = null;
    this.audio.siren(false);
    ch.car.chasing = false;
    const police = ch.kind === "police";
    const base = Math.round(Math.min(60_000, Math.max(10_000, (ch.kmh - 100) * 900)) / 1000) * 1000;
    const amount = Math.round((base * (ignored ? 2 : 1) * (this.diff?.fines ?? 1)) / 500) * 500;
    const id = await this.dialog({
      art: police ? "👮🏾‍♂️" : "🦺",
      title: police ? "Pulled over by a police patrol" : "Pulled over by FRSC",
      body: ignored
        ? `<p class="quote">"You no hear siren? You dey run from us?"</p><p>You ignored the siren, so the fine is doubled: <b>${naira(amount)}</b>.</p>`
        : `<p class="quote">"Oga, ${Math.round(ch.kmh)} km/h for 100 zone? Where you dey rush go?"</p><p>Speeding fine: <b>${naira(amount)}</b>. You stopped when asked, so they're listening.</p>`,
      actions: [
        { id: "pay", label: `Pay the fine · ${naira(amount)}`, style: "primary" },
        ...(ignored ? [] : [{ id: "explain", label: `"Sorry officer, I go take am easy"` }]),
      ],
    });
    if (id === "explain" && Math.random() < 0.4) {
      UI.toast(`"Oya go. Next time I go book you o."`, { kind: "gold" });
    } else {
      this.pay(this.fine(amount / (this.diff?.fines ?? 1)), "fines", "must");
      UI.toast(`Paid a ${naira(amount)} speeding fine.${ignored ? " Never run from a siren." : ""}`, { kind: "bad" });
    }
    track("patrol_stop", { kind: ch.kind, ignored, kmh: Math.round(ch.kmh) });
    S.save(this.state);
  }

  // ---------------------------------------------------------------- road challenges

  payToll(e) {
    if (e.state.paid) return;
    e.state.paid = true;
    this.pay(Math.round(e.price * (this.diff?.fines ?? 1)), "tolls", "must");
    S.addStat(this.state, "tolls");
    this.audio.coin();
    const arm = e.state.plaza?.userData.arm;
    if (arm) arm.rotation.z = -1.3; // barrier lifts
    UI.toast(`Toll paid: ${naira(e.price)}. The barrier lifts.`);
  }

  async agberoDialog(e) {
    const s = this.state;
    const levy = Math.round(e.levy * (this.diff?.fines ?? 1));
    const id = await this.dialog({
      art: "🧢",
      title: "Agberos block your way",
      body: `<p class="quote">"Oga! Owo ita! Na ${naira(levy)} for the boys. Shey you no go settle us?"</p>`,
      actions: [
        { id: "pay", label: `Settle them · ${naira(levy)}`, style: "primary" },
        { id: "argue", label: `"I no get money today, abeg"` },
        { id: "police", label: "Shout for the traffic warden" },
      ],
    });
    if (id === "pay") {
      this.pay(levy, "levies", "must");
      UI.toast(`"Correct person! Safe journey, chairman!"`);
    } else if (id === "argue") {
      if (Math.random() < 0.55) UI.toast(`"Oya go, but next time you go pay double o!"`);
      else {
        s.condition = Math.max(0, s.condition - 3);
        this.pay(Math.round(levy * 0.5), "levies", "must");
        UI.toast(`They banged your bonnet and collected ${naira(Math.round(levy * 0.5))} anyway. −3% condition`, { kind: "bad" });
      }
    } else {
      if (Math.random() < 0.5) UI.toast("The warden chased them off. 👮🏾 Respect.", { kind: "gold" });
      else {
        this.pay(levy, "levies", "must");
        UI.toast(`The warden was nowhere. You paid ${naira(levy)} and lost time.`, { kind: "bad" });
      }
    }
  }

  blackMarketFuel() {
    const cost = Math.round(S.servicePrices(this.state).refuel * 1.6);
    if (!this.pay(cost, "fuel", "overdraft")) return this.offerLoan("black-market fuel");
    this.state.fuel = 100;
    this.audio.coin();
    UI.toast(`Jerrycan fuel: ${naira(cost)}. Expensive, but you're moving.`);
  }

  // ---------------------------------------------------------------- sound & radio

  updateRadioButton(label?: string) {
    const el = $("btn-radio");
    if (el) el.textContent = this.audio.stationIndex < 0 ? "📻" : "📻 ON";
    const lbl = $("snd-station");
    if (lbl) lbl.textContent = label ?? this.audio.stationLabel();
  }

  /** Quick sound panel on the HUD: works while driving, no pause needed. */
  toggleSoundPanel() {
    const el = $("sound-panel");
    const open = el.classList.toggle("hidden") === false;
    if (!open) return;
    this.audio.start();
    const st = this.state.settings;
    ($("snd-sfx") as HTMLInputElement).value = String(Math.round((st.sfx ?? 0.8) * 100));
    ($("snd-music") as HTMLInputElement).value = String(Math.round((st.music ?? 0.5) * 100));
    $("snd-mute").textContent = st.sound ? "🔊 Sound on" : "🔇 Muted";
    $("snd-voice").textContent = st.voice !== false ? "🗣 Voices on" : "🗣 Voices off";
    this.updateRadioButton();
    $("snd-sfx").oninput = (ev) => {
      st.sfx = Number((ev.target as HTMLInputElement).value) / 100;
      this.audio.setSfxLevel(st.sfx);
      this.audio.horn(0.15);
      S.save(this.state);
    };
    $("snd-music").oninput = (ev) => {
      st.music = Number((ev.target as HTMLInputElement).value) / 100;
      this.audio.setMusicLevel(st.music);
      S.save(this.state);
    };
    $("snd-mute").onclick = () => {
      st.sound = !st.sound;
      this.audio.setEnabled(st.sound);
      this.voice.setEnabled(st.sound && st.voice !== false);
      $("snd-mute").textContent = st.sound ? "🔊 Sound on" : "🔇 Muted";
      S.save(this.state);
    };
    $("snd-voice").onclick = () => {
      st.voice = st.voice === false;
      this.voice.setEnabled(st.sound && st.voice !== false);
      $("snd-voice").textContent = st.voice !== false ? "🗣 Voices on" : "🗣 Voices off";
      S.save(this.state);
    };
    $("snd-next").onclick = () => this.audio.nextStation();
    $("snd-skip").onclick = () => this.audio.skip();
    $("snd-test").onclick = () => this.audio.horn(0.5);
    $("snd-close").onclick = () => el.classList.add("hidden");
  }

  // ---------------------------------------------------------------- invites & referrals

  playBase() {
    return CONFIG.playUrl || location.href.split("#")[0].split("?")[0];
  }

  /** Someone opened the game from a friend's invite or challenge link. */
  async handleInvite() {
    const inv = this.invite;
    this.invite = null;
    if (!inv) return;
    const bonus = CONFIG.referral.welcomeBonus;
    const res = acceptInvite(this.state, inv, bonus);
    S.save(this.state);
    if (res.own) return;
    track("referral_open", { ref: inv.ref, welcomed: res.welcomed, challenge: res.challenge?.routeId ?? null });
    if (res.welcomed) {
      track("referral_join", { ref: inv.ref });
      if (CONFIG.referral.joinUrl) {
        fetch(CONFIG.referral.joinUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: inv.ref, player: this.state.referral.code }) }).catch(() => {});
      }
    }
    const route = res.challenge ? ROUTES.find((x) => x.id === res.challenge.routeId) ?? null : null; // ignore unknown routes from old or edited links
    if (!res.welcomed && !route) return;
    const id = await UI.modal({
      art: route ? "🏁" : "🤝",
      title: route ? "You've been challenged!" : "Your friend invited you!",
      body: `${res.welcomed ? `<p>Welcome to GreenRev Roadtrip. Here's <b>${naira(bonus)}</b> fuel money from your friend's invite.</p>` : ""}
        ${route ? `<p>Your friend drove <b>${UI.esc(route.name)}</b> in <b>${UI.fmtTime(res.challenge.seconds)}</b>. Can you beat it?</p>` : "<p>Pick a journey and hit the road.</p>"}`,
      actions: [
        ...(route && S.isRouteUnlocked(this.state, route) ? [{ id: "go", label: `Drive ${route.name} now`, style: "primary" }] : []),
        { id: "ok", label: route ? "Maybe later" : "Oya, let's drive!", style: route ? "ghost" : "primary" },
      ],
    });
    if (id === "go") return this.startRoute(route.id);
  }

  /** Optional: ask the GreenRev backend for rewards from friends who joined with this player's code. */
  async claimReferralRewards() {
    const url = CONFIG.referral.claimUrl;
    if (!url) return;
    try {
      const r = this.state.referral;
      const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}code=${encodeURIComponent(r.code)}`, { cache: "no-store" });
      if (!res.ok) return;
      const { reward = 0, joins = 0 } = await res.json();
      if (reward > 0) {
        this.state.coins += reward;
        r.earned = (r.earned ?? 0) + reward;
        S.save(this.state);
        UI.toast(`🤝 ${joins} friend${joins === 1 ? "" : "s"} joined with your code. +${naira(reward)}`, { kind: "gold", ttl: 7000 });
        track("referral_reward", { code: r.code, reward, joins });
      }
    } catch {
      /* offline: try again next session */
    }
  }

  async shareLink(url, text, kind) {
    const r = this.state.referral;
    r.invitesSent = (r.invitesSent ?? 0) + 1;
    S.save(this.state);
    this.checkProgress();
    track("invite_share", { code: r.code, kind });
    try {
      if (navigator.share) return void (await navigator.share({ title: "GreenRev Roadtrip", text, url }));
      await navigator.clipboard.writeText(`${text} ${url}`);
      UI.toast("Invite link copied. Paste it to your people.", { kind: "gold" });
    } catch {
      /* cancelled */
    }
  }

  async openInvite() {
    for (;;) {
      const r = this.state.referral;
      const url = inviteUrl(this.playBase(), r.code);
      const text = `Drive Naija with me on GreenRev Roadtrip! Potholes, checkpoints, go-slow and luxury cars to hype. Use my code ${r.code} and get ${naira(CONFIG.referral.welcomeBonus)} fuel money to start.`;
      const id = await UI.modal({
        art: "🤝",
        title: "Invite your people",
        body: `<p>Friends who open your link get <b>${naira(CONFIG.referral.welcomeBonus)}</b> fuel money to start.</p>
          <div class="invite-code">${UI.esc(r.code)}</div><p class="invite-link">${UI.esc(url)}</p>
          <p class="hint">Invites sent: ${r.invitesSent ?? 0}${r.earned ? ` · Earned from invites: ${naira(r.earned)}` : ""}</p>
          <p class="hint">Finish a journey to send a challenge: your friends see your time and try to beat it.</p>`,
        actions: [
          { id: "share", label: "Share invite link", style: "primary" },
          { id: "whatsapp", label: "Send on WhatsApp" },
          { id: "copy", label: "Copy link" },
          { id: "close", label: "Back", style: "ghost" },
        ],
      });
      if (id === "close" || !id) return;
      if (id === "share") await this.shareLink(url, text, "invite");
      if (id === "whatsapp") {
        r.invitesSent = (r.invitesSent ?? 0) + 1;
        track("invite_share", { code: r.code, kind: "whatsapp" });
        S.save(this.state);
        openExternal(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "WhatsApp");
      }
      if (id === "copy") {
        try {
          await navigator.clipboard.writeText(url);
          UI.toast("Link copied!", { kind: "gold" });
        } catch {
          UI.toast(url);
        }
      }
    }
  }

  // ---------------------------------------------------------------- trips

  async startRoute(routeId) {
    this.audio.start();
    this.audio.setEnabled(this.state.settings.sound);
    this.voice.preload();
    const resuming = this.state.trip?.routeId === routeId;
    if (!resuming) {
      const contract = await this.chooseContract(getRoute(routeId));
      if (contract === undefined) return; // backed out
      this.state.trip = { routeId, legIndex: 0, elapsed: 0, contract, diff: E.difficulty(this.state).id, tally: { potholes: 0, crashes: 0, hardBrakes: 0, fines: 0 } };
      E.startLedger(this.state, routeId);
    }
    this.state.trip.tally ??= { potholes: 0, crashes: 0, hardBrakes: 0, fines: 0 };
    if (!this.state.ledger) E.startLedger(this.state, routeId);
    if (this.state.fuel < 15) {
      const cost = S.servicePrices(this.state).refuel;
      if (S.refuel(this.state, this.payer("overdraft"))) UI.toast(`Tank was nearly empty. Filled up for ${naira(cost)}.`);
    }
    this.route = getRoute(routeId);
    this.parTime = null;
    this.legIndex = this.state.trip.legIndex;
    this.legStartZ = 0;
    this.timeOfDay = 7.5;
    this.attract = false;
    this.resetWorld();
    this.player = this.makePlayer();
    $("menu").classList.add("hidden");
    $("hud").classList.remove("hidden");
    this.mode = "drive";
    track("route_start", { routeId, leg: this.legIndex, resuming });
    this.beginLeg();
  }

  makePlayer() {
    if (this.playerMesh) this.scene.remove(this.playerMesh);
    const car = getCar(this.state.carId);
    this.playerMesh = M.playerCar(car.body, this.state.paint?.[car.id] ?? car.color);
    this.scene.add(this.playerMesh);
    const size = this.playerMesh.userData.size;
    return { z: 0, x: laneX(1), speed: 0, length: size.length, width: size.width, dir: 1, steerVis: 0, crashCooldown: 0 };
  }

  resetWorld() {
    this.world.reset();
    this.traffic.clear();
    this.actors.clear();
    this.potholeMeshes = new Map();
    this.roadFeatures = [];
    this.legFeatures = [];
    this.featureFx = [];
    setRoadFeatures([]);
  }

  setupLegEnvironment() {
    const route = this.route;
    const legs = route.legs;
    // biome and hills for any z, looking ahead into the next leg so the horizon matches
    const starts = [this.legStartZ];
    this.diff = E.difficulty(this.state);
    this.plan = planLeg(this.leg, `${route.id}-${this.legIndex}-${S.dayKey()}`, this.diff);
    const endZ = this.legStartZ + this.plan.length;
    // bridges, flyovers and roundabouts in route z; keep the previous leg's so the road behind stays intact
    const routed = this.plan.features.map((f) => ({ ...f, from: f.from + this.legStartZ, to: f.to + this.legStartZ }));
    for (const e of this.plan.events) if (e.type === "feature") e.feature = routed[this.plan.features.indexOf(e.feature)];
    this.roadFeatures = [...(this.roadFeatures ?? []).filter((f) => f.to > this.legStartZ - 400), ...routed];
    this.legFeatures = routed;
    this.featureIdx = 0;
    setRoadFeatures(this.roadFeatures);
    const nextLeg = legs[this.legIndex + 1];
    this.legEndZ = endZ;
    this.world.setBiomeResolver((z) => (z < endZ || !nextLeg ? this.leg.biome : nextLeg.biome));
    const ampA = BIOME_HILLS[this.leg.biome];
    const ampB = nextLeg ? BIOME_HILLS[nextLeg.biome] : ampA;
    const prev = legs[this.legIndex - 1];
    const ampP = prev ? BIOME_HILLS[prev.biome] : ampA;
    setHillProfile((z) => {
      const s = THREE.MathUtils.smoothstep(z, endZ - 300, endZ);
      const p = THREE.MathUtils.smoothstep(z, starts[0], starts[0] + 300);
      return THREE.MathUtils.lerp(ampP, THREE.MathUtils.lerp(ampA, ampB, s), p);
    });
    const region = route.id.startsWith("lagos") && this.legIndex === 0 ? "lagos" : ["sahel", "savanna"].includes(this.leg.biome) && !route.id.startsWith("lagos") ? "north" : "south";
    this.traffic.setRegion(region, Math.min(1, this.leg.traffic * (this.diff?.traffic ?? 1)));
    this.traffic.closures = [];
    this.traffic.slowZones = [];
    const r = rng(`${route.id}-${this.legIndex}-weather-${S.dayKey()}`);
    this.world.setRain(r.chance(BIOMES[this.leg.biome].rain));
    this.eventIdx = 0;
    this.potholeIdx = 0;
    this.active = [];
    this.legStats = { crashes: 0, checkpointsCleared: 0, potholesHit: 0, startedAt: this.t, km: 0 };
    this.hype = null;
    this.hypeAction = null;
    this.legHyped = [];
    this.nextFeaturedAt = this.t + 18;
    this.nextPatrolAt = this.t + 20;
    this.patrol = null;
    this.chase = null;
    this.prevPlayerZ = undefined;
    this.audio.siren(false);
  }

  beginLeg() {
    this.gateSpawned = false;
    this.leg = this.route.legs[this.legIndex];
    this.setupLegEnvironment();
    this.player.z = Math.max(this.player.z, this.legStartZ);
    const from = CITIES[this.leg.from].name, to = CITIES[this.leg.to].name;
    $("hud-leg").textContent = `${from} → ${to}`;
    $("hud-road").textContent = this.leg.road + (this.world.raining ? " · 🌧 rain" : this.leg.biome === "sahel" ? " · 🌫 harmattan" : "");
    $("hud-next").textContent = to;
    UI.alertBanner(`${from} → ${to} · ${this.leg.km} km`, "info");
    if (this.leg.quality < 0.4) setTimeout(() => UI.toast("Travellers report a very bad road ahead. Watch for potholes!", { kind: "bad" }), 2500);
    if (this.world.raining) setTimeout(() => UI.toast("Rain! Potholes fill with water and are harder to see.", { kind: "gold" }), 4500);
  }

  // ---------------------------------------------------------------- the frame

  loop() {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(() => this.loop());
    const dt = Math.min(0.05, this.clock.getDelta());
    this.t += dt;
    if (this.mode === "drive" && !this.paused) this.updateDrive(dt);
    else if (this.attract) this.updateAttract(dt);
    this.updateCamera(dt);
    const biome = this.world.biomeAt(this.player.z);
    const light = this.world.applyAtmosphere(biome, this.timeOfDay ?? 8, this.camera);
    this.playerMesh.userData.head.intensity = light < 0.35 ? 60 : 0;
    this.spawnFeaturesAhead();
    for (const fx of this.featureFx ?? []) animateFeatures(fx, dt, this.t);
    this.cullBehind();
    this.world.update(this.player.z, dt, this.camera);
    this.renderer.render(this.scene, this.camera);
    this.renderBubbles();
    this.input.endFrame();
  }

  updateAttract(dt) {
    const p = this.player;
    p.z += p.speed * dt;
    p.x = laneX(1) + Math.sin(this.t * 0.4) * 1.2;
    this.traffic.maintain(p.z, false);
    this.traffic.update(dt, p.z, this.leg.biome, p);
    this.actors.maintainWalkers(p.z, false);
    this.actors.update(dt, this.t, p.z, p.x, this.leg.biome);
    this.placePlayer(dt);
    this.timeOfDay = 8 + Math.sin(this.t / 30) * 1.5;
  }

  updateDrive(dt) {
    const s = this.state;
    const p = this.player;
    const car = getCar(s.carId);
    const phys = carPhysics(car, s.upgrades[s.carId]);
    const inp = this.input;

    // ---- one-shot actions
    if (inp.took("KeyH", "horn")) {
      this.audio.horn();
      if (this.hype?.stage === "window") this.doHype(); // honk to hype, Lagos style
      const ahead = this.traffic.cars.find((c) => c.dir > 0 && c.z > p.z && c.z - p.z < 30 && Math.abs(c.x - p.x) < 2.5);
      if (ahead && ahead.lane === 0 && this.t - (this.lastHorn ?? 0) > 2) ahead.lane = 1; // slow car moves over
      this.lastHorn = this.t;
    }
    if (inp.took("KeyC", "camera")) this.cycleCamera();
    if (inp.took("Escape", "KeyP")) return this.pause();

    // ---- driving model
    let top = phys.topSpeed;
    if (s.condition < 20) top *= 0.55;
    if (s.fuel <= 0) top = 0;
    const offRoad = p.x > ROAD_EDGE + 0.3;
    if (offRoad) top = Math.min(top, 14);
    const throttle = inp.gas ? 1 : 0;
    if (inp.brake) p.speed -= phys.brake * dt;
    else if (throttle) p.speed += phys.accel * Math.max(0, 1 - p.speed / top) * dt;
    else p.speed -= (1.2 + p.speed * 0.03) * dt;
    if (p.speed > top) p.speed -= 6 * dt;
    p.speed = Math.max(0, p.speed);

    const grip = this.world.raining ? 0.8 : 1;
    let steer = inp.steer * phys.steer * grip * THREE.MathUtils.clamp(p.speed / 8, 0.2, 1);
    // Drowsy drift: when you're tired the car slowly wanders, gently at first and more as energy runs
    // out. Only while moving (a parked car doesn't slide), and steering against it corrects it.
    if (this.energyLow && p.speed > 3) {
      const tired = THREE.MathUtils.clamp((22 - (s.energy ?? 100)) / 22, 0, 1);
      steer += Math.sin(this.t * 0.9) * (0.12 + 0.33 * tired) * THREE.MathUtils.clamp(p.speed / 15, 0, 1);
    }
    p.x += steer * dt;
    p.steerVis = THREE.MathUtils.lerp(p.steerVis, inp.steer, 8 * dt);
    const minX = MEDIAN_HALF + p.width / 2 + 0.1;
    const maxX = ROAD_EDGE + SHOULDER - p.width / 2;
    if (p.x < minX) {
      p.x = minX;
      if (p.speed > 15) this.scrape("median");
    }
    if (p.x > maxX) {
      p.x = maxX;
      p.speed *= 0.97;
    }
    if (offRoad && p.speed > 6) this.shake = Math.max(this.shake, 0.08);
    p.z += p.speed * dt;
    p.crashCooldown -= dt;

    // ---- consumables
    const dist = p.speed * dt;
    s.fuel = Math.max(0, s.fuel - dist * phys.fuelUse * (1 + throttle * 0.4));
    s.energy = Math.max(0, (s.energy ?? 100) - dt * 0.3); // about 4½ minutes of driving to get tired
    this.energyLow = s.energy < 22;
    this.legStats.km += dist / 1000 * (this.leg.km / (this.plan.length / 1000)); // real-world km equivalent
    this.timeOfDay = ((this.timeOfDay ?? 7.5) + dt / 45) % 24;
    if (s.fuel <= 0 && p.speed < 0.5 && !this.outOfFuel) this.outOfFuelEvent();
    if (s.condition <= 0 && !this.brokenDown) this.breakdownEvent("engine");
    if (this.energyLow && !this.energyWarned) {
      this.energyWarned = true;
      UI.alertBanner("😴 You're tired: the car will start drifting", "info");
      UI.toast("Buy a snack from a hawker (B), or eat and rest at the next rest stop or town.", { kind: "gold", ttl: 7000 });
    }
    $("bar-energy").parentElement.classList.toggle("tired", this.energyLow);

    // ---- world
    const jam = this.traffic.slowLimit(p.z + 30) < 8;
    this.traffic.maintain(p.z, jam);
    // people and animals on the road: traffic stops for them (goats, cows, herders, agberos)
    this.traffic.obstacles = this.actors.list.filter((a) => a.role === "crossing").map((a) => ({ z: a.z, x: a.x }));
    this.traffic.update(dt, p.z, this.leg.biome, p);
    this.handleRearHits();
    this.updatePatrols(jam);
    this.trackHardBrake(dt);
    if ((p.stallUntil ?? 0) > this.t) p.speed = Math.max(0, p.speed - 25 * dt); // engine drank water
    this.updateHype(jam);
    this.actors.maintainWalkers(p.z, jam);
    this.actors.update(dt, this.t, p.z, p.x, this.leg.biome);
    this.updatePotholes(phys);
    this.updateEvents(dt);
    this.checkCollisions(car);
    this.peopleDodge();
    this.placePlayer(dt);

    this.audio.engine(p.speed, throttle);
    this.updateHud(phys);

    if (p.z >= this.legEndZ) this.arrive();
  }

  placePlayer(dt) {
    const p = this.player;
    const m = this.playerMesh;
    toWorld(p.z, p.x, 0, this.leg.biome, m.position);
    m.rotation.y = curveHeading(p.z, p.x) - p.steerVis * 0.12;
    const shell = m.userData.shell;
    shell.rotation.z = p.steerVis * 0.03 * Math.min(1, p.speed / 20);
    shell.rotation.x = THREE.MathUtils.lerp(shell.rotation.x, this.input.brake ? 0.025 : this.input.gas ? -0.012 : 0, 6 * dt);
    shell.position.y = this.shake > 0.05 ? Math.sin(this.t * 60) * this.shake * 0.12 : 0;
    for (const w of m.userData.wheels) w.rotation.x += (p.speed * dt) / 0.38;
    m.userData.wheels[1].rotation.y = m.userData.wheels[3].rotation.y = -p.steerVis * 0.35;
  }

  cycleCamera() {
    this.cameraMode = CAMERA_ORDER[(CAMERA_ORDER.indexOf(this.cameraMode) + 1) % CAMERA_ORDER.length];
    this.state.settings.camera = this.cameraMode;
    this.updateCamButton();
    if (this.mode === "drive") UI.alertBanner(`🎥 ${CAMERAS[this.cameraMode].label}`, "info");
  }

  updateCamButton() {
    const el = $("btn-cam");
    if (el) el.textContent = `🎥 ${CAMERAS[this.cameraMode].label}`;
  }

  updateCamera(dt) {
    const p = this.player;
    const cam = CAMERAS[this.cameraMode];
    const o = this.attract
      ? { back: 11, up: 4 + Math.sin(this.t * 0.25) * 1.5, side: Math.sin(this.t * 0.15) * 5, look: 18, lookUp: 1 }
      : { ...cam, side: cam.swing ? 6 + Math.sin(this.t * 0.2) * 3 : cam.side };
    // the camera rides at deck height, so it stays above the river on bridges and on flyovers
    const deck = (z, x, y) => new THREE.Vector3(lateralX(z, x), hillY(z) + y, z);
    const target = deck(p.z - o.back, p.x + o.side, o.up);
    const look = deck(p.z + o.look, o.back < 0 && o.look < 0 ? p.x : p.x * 0.7, o.lookUp);
    const k = o.locked && !this.attract ? 1 : 1 - Math.exp(-6 * dt);
    this.camera.position.lerp(target, k);
    if (this.shake > 0.01) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
      this.shake *= Math.exp(-6 * dt);
    }
    this.camera.lookAt(look);
    this.playerMesh.visible = !(o.hideCar && !this.attract);
    // Hide vehicles that would sit between the camera and the player (behind for chase, ahead for front view).
    for (const c of this.traffic.cars) {
      const rel = o.back > 0 ? p.z - c.z : c.z - p.z;
      const dist = Math.abs(o.back);
      c.mesh.visible = !(c.dir > 0 && dist > 2 && rel > 1 && rel < dist + c.length / 2 + 1 && Math.abs(c.x - (p.x + o.side)) < 2.8 && o.up < 6);
    }
  }

  // ---------------------------------------------------------------- potholes

  updatePotholes(phys) {
    const p = this.player;
    const base = this.legStartZ;
    const plan = this.plan;
    // spawn visuals ahead
    while (this.potholeIdx < plan.potholes.length && base + plan.potholes[this.potholeIdx].z < p.z + 400) {
      const h = plan.potholes[this.potholeIdx];
      const mesh = M.potholeMesh(Math.round(h.radius * 10) / 10, h.deep);
      const x = laneX(0) + h.lane * 3.6 - 0;
      h.wx = Math.min(ROAD_EDGE - 0.5, Math.max(MEDIAN_HALF + 0.6, x));
      h.wz = base + h.z;
      toWorld(h.wz, h.wx, 0, this.leg.biome, mesh.position);
      mesh.rotation.y = curveHeading(h.wz, h.wx);
      if (this.world.raining) mesh.scale.set(1.15, 1, 1.15);
      this.scene.add(mesh);
      this.potholeMeshes.set(h, mesh);
      this.potholeIdx++;
    }
    for (const [h, mesh] of this.potholeMeshes) {
      if (!h.passed && p.z > h.wz) {
        h.passed = true;
        const dx = Math.abs(p.x - h.wx);
        // either wheel track (±0.8 m) dropping into the hole counts
        if (dx < h.radius + 0.55) this.hitPothole(h, phys);
        else if (dx < 3.2) {
          S.addStat(this.state, "potholesDodged");
          if (this.state.stats.potholesDodged % 10 === 0) UI.toast(`Pothole ninja! ${this.state.stats.potholesDodged} dodged`, { kind: "gold" });
        }
      }
      if (p.z > h.wz + 40) {
        this.scene.remove(mesh);
        this.potholeMeshes.delete(h);
      }
    }
  }

  hitPothole(h, phys) {
    const p = this.player;
    const s = this.state;
    const sev = p.speed < 6 ? 0.15 : (p.speed / 30) * (h.deep ? 1.7 : 1);
    const dmg = Math.round(sev * 9 * phys.potholeDamage * 10) / 10;
    s.condition = Math.max(0, s.condition - dmg);
    p.speed *= h.deep ? 0.75 : 0.9;
    this.shake = Math.min(1.2, 0.25 + sev);
    this.audio.thud(sev);
    S.addStat(s, "potholesHit");
    this.legStats.potholesHit++;
    if (s.trip?.tally && sev > 0.3) s.trip.tally.potholes++;
    if (sev > 0.6) UI.alertBanner(h.deep ? "GBAM! Deep pothole!" : "Pothole!");
    const tyreLvl = s.upgrades[s.carId]?.tyres ?? 0;
    if (h.deep && p.speed > 18 && Math.random() < 0.35 - tyreLvl * 0.08) this.tyreBurst();
  }

  // ---------------------------------------------------------------- collisions & people

  /**
   * Cars that ran into you from behind. The traffic stops them at your bumper; here you feel the knock.
   * Not your fault: a small dent, no crash on your record, no game over.
   */
  handleRearHits() {
    const p = this.player;
    const hits = this.traffic.rearHits;
    if (!hits.length || (p.rearCooldown ?? 0) > this.t) return;
    const worst = hits.reduce((a, b) => (b.closing > a.closing ? b : a));
    p.rearCooldown = this.t + 2;
    const dmg = Math.min(5, Math.max(1, Math.round(worst.closing * 0.4)));
    this.state.condition = Math.max(0, this.state.condition - dmg);
    S.addStat(this.state, "rearEnded");
    p.speed = Math.max(p.speed, worst.car.speed * 0.5 + worst.closing * 0.3); // the knock shoves you forward
    this.shake = Math.max(this.shake, 0.6);
    this.audio.thud(0.7);
    this.voice.say("rear_end");
    const who = { danfo: "A danfo", okada: "An okada", keke: "A keke", truck: "A trailer", tanker: "A tanker", bus: "A bus" }[worst.car.body] ?? "A car";
    UI.toast(`${who} jammed you from behind! Not your fault. −${dmg}% condition`, { kind: "bad" });
  }

  checkCollisions(car) {
    const p = this.player;
    if (p.crashCooldown > 0) return;
    for (const c of this.traffic.cars) {
      if (c.dir < 0 || !overlaps(p, c)) continue;
      if (c.z < p.z - (c.length + p.length) * 0.25) continue; // behind you: handled by handleRearHits
      const closing = Math.abs(p.speed - c.speed);
      p.crashCooldown = 1.2;
      if (closing < 2.5) {
        // a tap: nudge apart
        p.speed = Math.min(p.speed, c.speed);
        p.z = c.z < p.z ? c.z + (c.length + p.length) / 2 + 0.3 : c.z - (c.length + p.length) / 2 - 0.3;
        UI.toast("Small bump. The other driver is shouting from his window…", { kind: "bad" });
        continue;
      }
      const dmg = Math.round(crashDamage(closing) * (1.25 - car.toughness * 0.5) * (this.diff?.damage ?? 1));
      this.state.condition = Math.max(0, this.state.condition - dmg);
      if (c.wrongWay) {
        // head-on with a one-way driver: real damage, but it isn't on your record
        c.wrongWayHit = true;
        p.speed *= 0.2;
        c.speed = 4;
        c.z = p.z + (c.length + p.length) / 2 + 0.8; // separate, then it limps round you in the other lane
        c.lane = c.lane < 0.5 ? 1 : 0;
        this.shake = 1.6;
        this.audio.thud(1.6);
        UI.toast(`One-way driver hit you head-on! −${dmg}% condition. "Na wa for this country!"`, { kind: "bad", ttl: 6000 });
        return;
      }
      this.state.stats.crashes++;
      this.legStats.crashes++;
      if (this.state.trip?.tally) this.state.trip.tally.crashes++;
      if (c.z > p.z) {
        p.z = c.z - (c.length + p.length) / 2 - 0.5;
        c.speed += closing * 0.4;
      } else {
        p.z = c.z + (c.length + p.length) / 2 + 0.5;
      }
      p.speed *= 0.3;
      this.shake = 1.4;
      this.audio.thud(1.5);
      this.crashEvent(c, dmg);
      return;
    }
    // animals crossing
    for (const a of this.actors.list) {
      if (a.role !== "crossing" || (a.kind !== "cow" && a.kind !== "goat")) continue;
      if (Math.abs(a.z - p.z) < p.length / 2 + 0.7 && Math.abs(a.x - p.x) < p.width / 2 + 0.6 && p.speed > 3) {
        p.crashCooldown = 2;
        const dmg = a.kind === "cow" ? 18 : 6;
        this.state.condition = Math.max(0, this.state.condition - dmg);
        p.speed *= 0.2;
        this.shake = 1;
        this.audio.thud(1.2);
        a.vx *= 3; // it bolts
        this.animalEvent(a.kind);
        return;
      }
    }
  }

  /** People on the road jump clear of a fast car; nobody gets hurt in this game. */
  peopleDodge() {
    const p = this.player;
    for (const a of this.actors.list) {
      if (!a.mesh.userData.legs || a.role === "officer") continue;
      const dz = a.z - p.z;
      if (dz > 0 && dz < 18 + p.speed * 0.6 && Math.abs(a.x - p.x) < 2 && p.speed > 4) {
        a.x += (a.x > p.x ? 1 : -1) * 0.25;
        if (!a.dodged) {
          a.dodged = true;
          this.actors.say(a, ["Ah! Slow down!", "Oga, easy o!", "This one wan kill person?", "Jesus!", "Haba!"][Math.floor(Math.random() * 5)]);
        }
      }
    }
  }

  scrape(_where?: string) {
    if (this.player.crashCooldown > 0) return;
    this.player.crashCooldown = 0.8;
    this.state.condition = Math.max(0, this.state.condition - 2);
    this.player.speed *= 0.85;
    this.shake = 0.5;
    UI.toast("You scraped the median kerb!", { kind: "bad" });
  }

  // ---------------------------------------------------------------- hype: featured dealer cars

  /**
   * Every minute or so a featured dealer car overtakes you. A hype man by the road shouts it out;
   * tap HYPE (or honk) while it passes for hype points, then view the real listing on GreenRev.
   */
  updateHype(jam) {
    const p = this.player;
    this.hypeAction = null;
    if (!this.hype && this.t >= this.nextFeaturedAt) {
      const { minGapSeconds: lo, maxGapSeconds: hi } = CONFIG.featured;
      this.nextFeaturedAt = this.t + lo + Math.random() * (hi - lo);
      if (!jam && p.speed > 10 && !this.paused) {
        const list = activeFeatured(this.featuredList, S.dayKey());
        const entry = list[Math.floor(Math.random() * list.length)];
        const car = this.traffic.spawnFeatured(entry, p);
        if (car) this.hype = { car, entry, stage: "approach", spawnedAt: this.t };
        else this.nextFeaturedAt = this.t + 6; // lane busy, try again soon
      }
    }
    const h = this.hype;
    if (!h) return;
    if (!this.traffic.cars.includes(h.car)) return (this.hype = null);
    const dz = h.car.z - p.z;
    // keep the featured car a little slower than you, so you always catch up with it
    if (h.stage !== "hyped") h.car.cruise = Math.max(8, Math.min(28, p.speed * 0.75));
    if (h.stage === "approach" && dz < 50 && dz > -4) {
      // close ahead and in view: the hype man by the road shouts it out
      h.stage = "window";
      h.openedAt = this.t;
      const line = HYPE_LINES[Math.floor(Math.random() * HYPE_LINES.length)];
      h.man = this.actors.add("civilian", h.car.z + 15, ROAD_EDGE + 2.6, { role: "scene", face: -Math.PI / 2 });
      this.actors.say(h.man, line.text, 4);
      this.voice.say(line.key);
      UI.alertBanner("🔥 Luxury car ahead! Tap HYPE or honk", "info");
    }
    if (h.stage === "approach" && this.t - (h.spawnedAt ?? this.t) > 40) return (this.hype = null); // never caught up (long jam)
    if (h.stage === "window") {
      if (this.t - h.openedAt > 10 || dz < -25) {
        h.stage = "missed";
        this.hype = null;
        return;
      }
      this.hypeAction = { text: "🔥 HYPE IT!", run: () => this.doHype(), hype: true };
    }
    if (h.stage === "hyped" && dz < -80) this.hype = null;
  }

  doHype() {
    const h = this.hype;
    if (!h || h.stage !== "window") return;
    h.stage = "hyped";
    const s = this.state;
    const pts = hypeScore(h.car.body, this.t - h.openedAt);
    s.hype = (s.hype ?? 0) + pts;
    s.coins += pts * 500;
    S.addStat(s, "hypes");
    this.legHyped.push(h.entry);
    this.audio.coin();
    if (h.man) this.actors.say(h.man, ["Yesss! 🔥", "E choke!", "Na correct hype be that!"][Math.floor(Math.random() * 3)], 2.5);
    track("hype_car", { car: h.entry.id, dealer: h.entry.dealer, points: pts, routeId: this.route.id });
    awardPoints(CONFIG.cloud.pointsUrl, 2, "roadtrip_hype");
    UI.toast(`🔥 +${pts} hype (+${naira(pts * 500)}). ${h.entry.dealer} brought this one.`, {
      kind: "hype",
      cta: { label: "View this car", onClick: () => this.openFeaturedCard(h.entry, "hype_toast") },
      ttl: 8000,
    });
    this.checkProgress();
    S.save(s);
  }

  /** Listing card for a featured car (the game pauses while it is open). */
  async openFeaturedCard(entry, reason = "hype_card") {
    const saved = (this.state.dreamGarage ?? []).some((d) => d.id === entry.id);
    track("hype_card_open", { car: entry.id, dealer: entry.dealer, reason });
    const opts = {
      art: "🔥",
      title: entry.title ?? "Featured car",
      body: `<div class="feature-card"><p class="dealer"><b>${UI.esc(entry.dealer)}</b>${entry.city ? ` · ${UI.esc(entry.city)}` : ""}</p>
        ${entry.price ? `<p class="price">${naira(entry.price)}</p>` : ""}
        <p>You hyped it on the road. This car is listed by a verified dealer on GreenRev.</p>
        ${entry.sample ? `<p class="hint">Sample listing. Real dealer cars show here once they're added to featured.json.</p>` : ""}</div>`,
      actions: [
        { id: "view", label: "View this car on GreenRev", style: "primary" },
        { id: "save", label: saved ? "✓ In your dream garage" : "Save to dream garage", disabled: saved },
        { id: "close", label: this.mode === "drive" ? "Keep driving" : "Back", style: "ghost" },
      ],
    };
    const id = this.mode === "drive" ? await this.dialog(opts) : await UI.modal(opts);
    if (id === "view") this.viewListing(entry, reason);
    if (id === "save") {
      if (saveDream(this.state, entry)) {
        track("hype_save", { car: entry.id, dealer: entry.dealer });
        UI.toast("Saved to your dream garage. Find it in the menu.", { kind: "gold" });
        this.checkProgress();
      }
      S.save(this.state);
    }
  }

  viewListing(entry, reason) {
    const s = this.state;
    S.addStat(s, "listingViews");
    S.addStat(s, "ctaClicks");
    this.checkProgress();
    S.save(s);
    const t = listingTarget(entry);
    const context = { reason, car: entry.id, dealer: entry.dealer, label: entry.title };
    if (t.url) openGreenRevUrl(t.url, context);
    else openGreenRev("marketplace", { ...context, query: t.query });
  }

  async openDreamGarage() {
    for (;;) {
      const list = this.state.dreamGarage ?? [];
      const id = await UI.modal({
        art: "🏁",
        title: `Dream garage · 🔥 ${this.state.hype ?? 0} hype`,
        body: list.length
          ? `<p>Cars you hyped and saved. Tap one to see the real listing.</p>`
          : `<p>No cars yet. When a luxury car passes, tap <b>HYPE</b> (or honk), then save it here.</p>`,
        actions: [
          ...list.map((d) => ({ id: `car:${d.id}`, label: d.title ?? "Featured car", hint: `${d.dealer}${d.price ? ` · ${naira(d.price)}` : ""}` })),
          { id: "close", label: "Back", style: "primary" },
        ],
      });
      if (!id?.startsWith("car:")) return;
      const d = list.find((x) => `car:${x.id}` === id);
      if (d) this.viewListing(d, "dream_garage");
    }
  }

  // ---------------------------------------------------------------- planned events

  updateEvents(dt) {
    const p = this.player;
    const base = this.legStartZ;
    const ev = this.plan.events;
    while (this.eventIdx < ev.length && base + ev[this.eventIdx].z < p.z + 450) {
      const e = { ...ev[this.eventIdx], wz: base + ev[this.eventIdx].z, state: {} };
      this.spawnEvent(e);
      this.active.push(e);
      this.eventIdx++;
    }
    if (!this.gateSpawned && this.legEndZ - p.z < 450) {
      this.gateSpawned = true;
      const city = CITIES[this.leg.to];
      const gate = M.cityGate(city.name, city.state, 17);
      toWorld(this.legEndZ, 0.8, 0, this.leg.biome, gate.position);
      gate.rotation.y = curveHeading(this.legEndZ);
      gate.userData.z = this.legEndZ;
      this.world.dynamic.add(gate);
    }
    let action = null;
    for (const e of this.active) {
      const d = e.wz - p.z;
      switch (e.type) {
        case "goslow": {
          const inside = p.z > e.wz - 40 && p.z < e.wz + e.length;
          if (inside && !e.state.announced) {
            e.state.announced = true;
            UI.alertBanner(e.cause ? `Go-slow: ${e.cause}` : "Go-slow! Hawkers dey come…", "info");
            this.audio.horn();
          }
          if (inside && p.speed < 4) {
            const h = this.actors.nearest("hawker", p.z, p.x, 5);
            if (h) {
              const snack = SNACKS[h.data.goods];
              action = { text: `Buy ${snack.name} · ${naira(snack.price)}  (B)`, run: () => this.buySnack(h) };
            }
          }
          break;
        }
        case "checkpoint":
          action = this.updateCheckpoint(e, d) ?? action;
          break;
        case "speedtrap":
          if (!e.state.done && d < 0) {
            e.state.done = true;
            const kmh = p.speed * KMH;
            if (kmh > e.limit + 5) {
              const fine = Math.round(Math.min(50_000, (kmh - e.limit) * 600) / 1000) * 1000;
              this.pay(this.fine(fine), "fines", "must");
              this.audio.whistle();
              this.dialog({
                art: "📸",
                title: "FRSC speed check",
                body: `<p class="quote">"You were doing ${Math.round(kmh)} km/h in a ${e.limit} zone. Speed thrills but kills."</p><p>Official fine: <b>${naira(fine)}</b>. A receipt was issued.</p>`,
                actions: [{ id: "ok", label: "I'll slow down", style: "primary" }],
              });
            } else UI.toast(`FRSC radar: ${Math.round(kmh)} km/h. Within the limit. 👍`);
          }
          break;
        case "animals":
          if (!e.state.spawned && d < 170) {
            e.state.spawned = true;
            this.actors.spawnCrossing(e.wz, e.kind);
            UI.alertBanner(e.kind === "cattle" ? "🐄 Cattle crossing! Slow down" : "🐐 Goats on the road!", "info");
          }
          break;
        case "toll": {
          const st = e.state;
          if (st.paid || st.ran) break;
          if (d < 60 && d > -2 && p.speed < 3) action = { text: `Pay toll · ${naira(e.price)}  (F)`, run: () => this.payToll(e) };
          if (d < -2) {
            st.ran = true;
            const fine = this.fine(25_000);
            this.pay(fine, "fines", "must");
            this.state.condition = Math.max(0, this.state.condition - 4);
            if (this.state.trip?.tally) this.state.trip.tally.fines++;
            this.audio.thud(1);
            this.shake = 0.8;
            UI.toast(`You broke the toll barrier! Fine ${naira(fine)}, −4% condition.`, { kind: "bad" });
          }
          break;
        }
        case "agbero":
          if (!e.state.done && d < 30 && d > -5) {
            e.state.done = true;
            if (e.state.man) this.actors.say(e.state.man, "Owo ita! Drop something!", 3);
            if (p.speed < 6) this.agberoDialog(e);
            else if (Math.random() < 0.4) {
              this.state.condition = Math.max(0, this.state.condition - 2);
              UI.toast("The agberos threw something at your boot as you passed. −2% condition", { kind: "bad" });
            }
          }
          break;
        case "diversion": {
          if (!e.state.warned && d < 320 && d > 0) {
            e.state.warned = true;
            UI.alertBanner(`🚧 Road works: ${e.lane === 0 ? "fast" : "slow"} lane closed ahead. Merge!`, "info");
          }
          const inside = p.z > e.wz - 25 && p.z < e.wz + e.length;
          if (inside && Math.abs(p.x - laneX(e.lane)) < 1.4 && this.t - (e.state.lastHit ?? -9) > 2) {
            e.state.lastHit = this.t;
            this.state.condition = Math.max(0, this.state.condition - 1.5);
            this.audio.thud(0.5);
            UI.toast("You're knocking cones down! Get out of the closed lane.", { kind: "bad" });
          }
          break;
        }
        case "flood": {
          const st = e.state;
          if (!st.warned && d < 230 && d > 0) {
            st.warned = true;
            UI.alertBanner("🌊 Flooded road ahead! Under 30 km/h", "info");
          }
          const inside = p.z > e.wz && p.z < e.wz + e.length;
          if (inside && !st.splashed && p.speed * KMH > 30) {
            st.splashed = true;
            this.audio.splash();
            const dmg = Math.round(6 * (this.diff?.damage ?? 1));
            this.state.condition = Math.max(0, this.state.condition - dmg);
            if (Math.random() < 0.4 * (this.diff?.events ?? 1)) {
              st.stalled = true;
              p.stallUntil = this.t + 4;
              UI.toast(`SPLASH! Engine drank water and stalled. −${dmg}% condition. Wait for it to restart…`, { kind: "bad", ttl: 5000 });
            } else UI.toast(`SPLASH! Too fast through the flood. −${dmg}% condition`, { kind: "bad" });
          } else if (inside && !st.splashed && !st.slowSplash) {
            st.slowSplash = true;
            this.audio.splash();
          }
          if (!st.crossed && p.z > e.wz + e.length) {
            st.crossed = true;
            if (!st.splashed) {
              S.addStat(this.state, "floodsCrossed");
              this.earn(15_000, "challenges");
              UI.toast(`Crossed the flood like a pro. +${naira(15_000)}`, { kind: "gold" });
              this.checkProgress();
            }
          }
          break;
        }
        case "wrongway": {
          const st = e.state;
          if (!st.spawned && d < 320 && d > -150) {
            st.car = this.traffic.spawnWrongWay(p); // keeps trying until its spot is clear
            st.spawned = !!st.car;
            if (st.car) {
              UI.alertBanner("⚠️ One-way driver coming at you! Change lanes!", "info");
              this.audio.horn(0.9);
            }
          }
          if (st.car && !st.done && st.car.z < p.z - 8) {
            st.done = true;
            if (!st.car.wrongWayHit) {
              S.addStat(this.state, "wrongWayDodged");
              this.earn(20_000, "challenges");
              UI.toast(`Sharp! You dodged the one-way driver. +${naira(20_000)}`, { kind: "gold" });
              this.checkProgress();
            }
          }
          break;
        }
        case "bumps":
          for (let i = 0; i < e.count; i++) {
            const bz = e.wz + i * 12;
            e.state.hit ??= [];
            if (!e.state.hit[i] && p.z >= bz && p.z - p.speed * 0.05 < bz + 1) {
              e.state.hit[i] = true;
              if (p.speed * KMH > 40) {
                const dmg = Math.round((p.speed * KMH - 40) / 12 + 1);
                this.state.condition = Math.max(0, this.state.condition - dmg);
                this.shake = 1;
                this.audio.thud(1.1);
                p.speed *= 0.7;
                if (!e.state.told) {
                  e.state.told = true;
                  UI.toast(`GBOSA! Hidden speed bump (gallop). −${dmg}% condition. Slow down entering towns.`, { kind: "bad" });
                }
              } else this.audio.thud(0.25);
            }
          }
          break;
        case "fuel":
          if (e.scarce) {
            if (!e.state.warned && d < 300) {
              e.state.warned = true;
              UI.toast("⛽ Filling station ahead, but word is there's no fuel. Black market boys dey around.");
            }
            if (Math.abs(d) < 25 && p.speed < 4 && this.state.fuel < 97) action = { text: `Black-market fuel · ${naira(Math.round(S.servicePrices(this.state).refuel * 1.6))}  (F)`, run: () => this.blackMarketFuel() };
            break;
          }
          if (!e.state.warned && d < 300) {
            e.state.warned = true;
            UI.toast("⛽ Filling station ahead on your right. Stop beside it to buy fuel.");
          }
          if (Math.abs(d) < 25 && p.speed < 4 && this.state.fuel < 97) action = { text: `Refuel · ${naira(S.servicePrices(this.state).refuel)}  (F)`, run: () => this.roadsideRefuel() };
          break;
        case "feature":
          this.updateFeatureEvent(e);
          break;
        case "reststop":
          if (!e.state.warned && d < 520) {
            e.state.warned = true;
            UI.alertBanner(`🛑 ${e.name} in 500 m · Fuel · Food · Rest`, "info");
          }
          if (Math.abs(d - 15) < 45 && p.speed < 4) action = { text: `Pull into ${e.name}  (R)`, run: () => this.restStopDialog(e) };
          break;
        case "breakdown-scene":
          if (!e.state.told && d < 60) {
            e.state.told = true;
            const mech = this.actors.list.find((a) => a.kind === "mechanic" && Math.abs(a.z - e.wz) < 12);
            if (mech) this.actors.say(mech, "Everyone get back!", 3);
            this.voice.say("first_scene");
            UI.toast("Somebody's car don knock by the roadside. A GreenRev mechanic is already on it.", {
              cta: { label: "Find a mechanic", onClick: () => this.cta("mechanic", { reason: "roadside_scene", city: this.leg.to }) },
            });
          }
          break;
      }
    }
    this.active = this.active.filter((e) => e.wz > p.z - 200 || (e.type === "goslow" && e.wz + e.length > p.z - 50) || (e.type === "feature" && e.feature.to > p.z - 50));
    if (!action && this.hypeAction) action = this.hypeAction;
    if (action) {
      UI.actionButton(action.text, action.run, action.hype ? "hype" : "");
      if (this.input.took("KeyB", "KeyF", "KeyR")) action.run();
    } else UI.actionButton(null);
  }

  /** Build bridge/flyover/roundabout set pieces before they come into view. */
  spawnFeaturesAhead() {
    const list = this.legFeatures ?? [];
    while (this.featureIdx < list.length && list[this.featureIdx].from < this.player.z + 900) {
      const f = list[this.featureIdx++];
      const fx: ReturnType<typeof buildFeature> & { to?: number } = buildFeature(this.world.dynamic, f, this.leg.biome);
      fx.to = f.to;
      (this.featureFx ??= []).push(fx);
      if (f.type === "roundabout") this.traffic.slowZones.push({ from: f.from - 50, to: f.to + 10, speed: 10 });
      if (f.type === "bridge" && f.style === "beam") this.traffic.slowZones.push({ from: f.from, to: f.to, speed: 20 });
    }
  }

  /** Drop props and set pieces well behind the player. */
  cullBehind() {
    const limit = this.player.z - 300;
    const kids = this.world.dynamic.children;
    for (let i = kids.length - 1; i >= 0; i--) if (kids[i].userData.z !== undefined && kids[i].userData.z < limit) this.world.dynamic.remove(kids[i]);
    if (this.featureFx?.length) this.featureFx = this.featureFx.filter((fx) => fx.to > limit);
  }

  /** What happens as you drive through a feature. */
  updateFeatureEvent(e) {
    const p = this.player;
    const f = e.feature;
    const st = e.state;
    if (!f) return;
    if (f.type === "bridge" && !st.on && p.z > f.from) {
      st.on = true;
      if (f.style === "beam") UI.toast(`🌉 ${f.name}. Narrow bridge, no overtaking.`);
      else {
        UI.alertBanner(`🌊 ${f.name} · River Niger`, "info");
        UI.toast(f.style === "cable" ? "The Second Niger Bridge: 1.6 km linking Asaba and Onitsha." : "Jebba Bridge: road and rail cross the Niger side by side.", { kind: "gold" });
        this.state.xp += 25;
      }
    }
    if (f.type === "flyover" && !st.on && p.z > f.from + 60) {
      st.on = true;
      UI.toast(`🛣 Up the ${f.name.toLowerCase()}. The junction traffic is below you.`);
    }
    if (f.type === "roundabout") {
      const mid = (f.from + f.to) / 2;
      if (!st.warned && p.z > f.from - 220) {
        st.warned = true;
        UI.alertBanner(`🔄 ${f.name} ahead. Slow down`, "info");
      }
      if (!st.done && p.z > mid) {
        st.done = true;
        const kmh = p.speed * KMH;
        if (kmh > 60) {
          const fine = 5_000;
          this.pay(this.fine(fine), "fines", "must");
          this.audio.whistle();
          const who = this.route.id.startsWith("lagos") && this.legIndex === 0 ? "LASTMA officer" : "traffic warden";
          this.dialog({
            art: "🔄",
            title: `${f.name}: too fast!`,
            body: `<p class="quote">The ${who} blows the whistle: "Oga! You wan fly the roundabout? Park there!"</p><p>You took the roundabout at ${Math.round(kmh)} km/h. Fine: <b>${naira(fine)}</b>. Under 60 km/h next time.</p>`,
            actions: [{ id: "ok", label: "Sorry, I'll slow down", style: "primary" }],
          });
        } else {
          this.state.xp += 10;
          UI.toast("Smooth roundabout. The warden nods at you. 👍");
        }
      }
    }
  }

  spawnEvent(e) {
    const biome = this.leg.biome;
    const put = (mesh, z, x, rot = 0) => {
      toWorld(z, x, 0, biome, mesh.position);
      mesh.rotation.y = curveHeading(z, x) + rot;
      mesh.userData.z = z;
      this.world.dynamic.add(mesh);
      return mesh;
    };
    switch (e.type) {
      case "goslow":
        this.traffic.slowZones.push({ from: e.wz - 30, to: e.wz + e.length, speed: 4 });
        this.actors.spawnHawkers(e.wz, Math.round(4 + e.length / 80));
        for (let i = 0; i < 5; i++) this.traffic.spawn(e.wz + i * 9, 1, i % 2);
        break;
      case "checkpoint": {
        put(M.checkpointProps(e.kind), e.wz, ROAD_EDGE + 1.2, -Math.PI / 2);
        put(M.speedBump(), e.wz - 50, ROAD_EDGE / 2 + 0.3);
        const label = { police: "POLICE CHECKPOINT", military: "MILITARY CHECKPOINT", frsc: "FRSC PATROL", vio: "VIO INSPECTION" }[e.kind];
        put(M.textSign(label, { bg: e.kind === "military" ? "#4b5320" : e.kind === "frsc" ? "#e0a100" : e.kind === "vio" ? "#9d0208" : "#0b1d3a", sub: "Slow down · Stop when asked" }), e.wz - 220, ROAD_EDGE + 3);
        this.actors.spawnCheckpointCrew(e.wz, e.kind);
        this.traffic.slowZones.push({ from: e.wz - 70, to: e.wz + 8, speed: 3 });
        break;
      }
      case "speedtrap":
        put(M.textSign("SPEED LIMIT 100", { bg: "#ffffff", fg: "#c1121f", sub: "FRSC radar in operation" }), e.wz - 300, ROAD_EDGE + 3);
        this.actors.add("frsc", e.wz, ROAD_EDGE + 2.2, { role: "officer", face: -Math.PI / 2 });
        break;
      case "fuel":
        put(M.fillingStation(), e.wz, ROAD_EDGE + 10, -Math.PI / 2);
        if (e.scarce) {
          put(M.textSign("NO FUEL", { bg: "#c1121f", sub: "Queue don pass Ogbomosho" }), e.wz - 15, ROAD_EDGE + 4);
          for (let i = 0; i < 4; i++) put(M.vehicleMesh(["sedan", "danfo", "suv", "keke"][i], "#c9ced6"), e.wz - 10 - i * 6, ROAD_EDGE + 6.5);
        }
        break;
      case "toll": {
        const mid = (MEDIAN_HALF + ROAD_EDGE) / 2;
        e.state.plaza = put(M.tollPlaza(ROAD_EDGE - MEDIAN_HALF + 1), e.wz, mid, Math.PI); // booth on the driver's right
        put(M.textSign("TOLL PLAZA 300m", { bg: "#0b6e4f", sub: `Have your change ready · ${naira(e.price)}` }), e.wz - 300, ROAD_EDGE + 3);
        this.traffic.slowZones.push({ from: e.wz - 60, to: e.wz + 6, speed: 3 });
        break;
      }
      case "agbero":
        e.state.man = this.actors.add("civilian", e.wz, ROAD_EDGE - 0.4, { role: "agbero", face: Math.PI });
        break;
      case "diversion": {
        const boundary = MEDIAN_HALF + LANE_WIDTH; // line between our two lanes
        const closedX = laneX(e.lane);
        for (let z = e.wz; z < e.wz + e.length; z += 8) put(M.trafficCone(), z, boundary + (e.lane === 0 ? -0.25 : 0.25));
        for (let i = 0; i < 5; i++) put(M.trafficCone(), e.wz - 30 + i * 6, closedX + (e.lane === 0 ? 1 : -1) * (1.6 - i * 0.8)); // taper
        put(M.worksBarrier(), e.wz + 4, closedX);
        put(M.worksBarrier(), e.wz + e.length - 4, closedX);
        put(M.textSign("ROAD WORKS AHEAD", { bg: "#f77f00", fg: "#111", sub: `${e.lane === 0 ? "Fast" : "Slow"} lane closed · Merge and slow down` }), e.wz - 260, ROAD_EDGE + 3);
        this.traffic.closures.push({ from: e.wz - 25, to: e.wz + e.length, lane: e.lane });
        this.traffic.slowZones.push({ from: e.wz - 60, to: e.wz + e.length, speed: 14 });
        this.actors.add("civilian", e.wz + e.length * 0.5, closedX, { role: "scene", face: Math.PI / 2 });
        break;
      }
      case "flood": {
        put(M.floodWater(e.length, (ROAD_EDGE + SHOULDER) * 2 + 1), e.wz + e.length / 2, 1e-6);
        put(M.textSign("FLOODED ROAD", { bg: "#1d4e89", sub: "Drive slowly or your engine go drink water" }), e.wz - 220, ROAD_EDGE + 3);
        this.traffic.slowZones.push({ from: e.wz - 30, to: e.wz + e.length, speed: 6 });
        break;
      }
      case "bumps":
        for (let i = 0; i < e.count; i++) put(M.gallop(LANE_WIDTH * 2), e.wz + i * 12, (MEDIAN_HALF + ROAD_EDGE) / 2);
        this.traffic.slowZones.push({ from: e.wz - 20, to: e.wz + e.count * 12, speed: 8 });
        break;
      case "billboard": {
        let board;
        if (e.ad === "advertise") {
          const live = activeCampaigns(this.campaigns, S.dayKey(), this.route.id);
          if (live.length) {
            const c = live[this.adRotation++ % live.length];
            board = M.sponsoredBoard(c);
            track("ad_impression", { campaign: c.id, routeId: this.route.id, leg: this.legIndex });
          } else board = M.advertiseBoard(CONFIG.advertise.packages);
        } else board = M.billboard(e.ad);
        put(board, e.wz, e.side * (ROAD_EDGE + 9), M.boardFacing(e.side));
        break;
      }
      case "reststop": {
        // forecourt, buka, rest house and parked trailers on the right, set back from the road
        put(M.fillingStation(), e.wz, ROAD_EDGE + 10, -Math.PI / 2);
        put(M.buka(), e.wz + 32, ROAD_EDGE + 13, -Math.PI / 2);
        put(M.restHouse(), e.wz + 58, ROAD_EDGE + 21, -Math.PI / 2);
        put(M.vehicleMesh("truck", "#1d4e89"), e.wz - 26, ROAD_EDGE + 17, 0.15);
        put(M.vehicleMesh("tanker", "#f1faee"), e.wz - 40, ROAD_EDGE + 21, 0.1);
        put(M.vehicleMesh("bus", "#f3f5f4"), e.wz + 78, ROAD_EDGE + 14, 0);
        put(M.textSign(`${e.name.toUpperCase()} 500m`, { bg: "#0b6e4f", sub: "⛽ Fuel  ·  🍲 Food  ·  🛏 Rest  ·  🔧 Mechanic" }), e.wz - 500, ROAD_EDGE + 3);
        put(M.textSign("REST STOP", { bg: "#0b6e4f", w: 4, h: 1.2, sub: "Turn in here" }), e.wz - 40, ROAD_EDGE + 3);
        const ad = put(M.textSign("ADVERTISE HERE", { bg: "#ffd60a", fg: "#111", sub: "Roadside ads from 3 days · Tap to book" }), e.wz + 95, ROAD_EDGE + 3.5);
        ad.userData.ad = "advertise";
        for (const [dz, dx, kind] of [[28, 11.5, "civilian"], [33, 12.2, "civilian"], [36, 11.6, "hawker"], [-4, 11, "civilian"]] as [number, number, string][]) {
          this.actors.add(kind, e.wz + dz, ROAD_EDGE + dx, { role: "scene", face: -Math.PI / 2 });
        }
        break;
      }
      case "breakdown-scene": {
        const broken = put(M.vehicleMesh("sedan", "#6c757d"), e.wz, ROAD_EDGE + 1.3);
        broken.rotation.z = 0.06;
        put(M.warningTriangle(), e.wz - 12, ROAD_EDGE - 0.4);
        this.actors.spawnMechanicScene(e.wz);
        break;
      }
    }
  }

  /** Approach → slow → stop → dialog. Running a checkpoint is a fine. */
  updateCheckpoint(e, d) {
    const p = this.player;
    const st = e.state;
    if (st.done) return null;
    const names = { police: "Police checkpoint", military: "Military checkpoint", frsc: "FRSC patrol", vio: "VIO inspection" };
    // voices only while the checkpoint is actually ahead of you (d > 0), never after you've passed it
    if (!st.warned && d < 260 && d > 30) {
      st.warned = true;
      UI.alertBanner(`${names[e.kind]} ahead. Slow down!`, "info");
      if (e.kind === "police" || e.kind === "frsc") this.voice.say("police_slow", { priority: true });
    }
    if (d < -6 && !st.silenced) {
      st.silenced = true;
      this.voice.stop(); // nothing left talking once you're past
    }
    if (!st.explained && d < 110 && d > 25 && p.speed > 14 && e.kind !== "military") {
      st.explained = true;
      this.voice.say("police_explain", { priority: true });
    }
    if (d < 45 && d > -6) {
      st.maxSpeed = Math.max(st.maxSpeed ?? 0, p.speed);
      if (p.speed < 5.5) {
        st.done = true;
        this.checkpointDialog(e.kind);
        return null;
      }
    }
    if (d < -6) {
      st.done = true;
      if ((st.maxSpeed ?? p.speed) > 14) this.ranCheckpoint(e.kind);
      else {
        UI.toast(`The ${e.kind === "military" ? "soldier" : "officer"} waved you through. "Oya, move!"`);
        this.voice.say("police_go", { priority: true });
        this.audio.whistle();
      }
    }
    return d < 60 && d > 0 && p.speed > 8 ? { text: "Slow down for the checkpoint ↓", run: () => {} } : null;
  }

  // ---------------------------------------------------------------- dialogs (game pauses while open)

  async dialog(opts) {
    this.paused = true;
    UI.actionButton(null);
    const id = await UI.modal(opts);
    this.paused = false;
    this.clock.getDelta();
    return id;
  }

  async checkpointDialog(kind) {
    const s = this.state;
    this.audio.whistle();
    this.player.speed = 0;
    const papersOk = s.papersValidTrips > 0;
    this.voice.say(kind === "military" ? "military_stop" : "police_stop", { priority: true });
    if (kind === "police") {
      const choice = await this.dialog({
        art: "👮🏾‍♂️",
        title: "Police checkpoint",
        body: `<p class="quote">"Good afternoon, oga. Where una dey go? Show me your vehicle particulars."</p><p>Papers: <b>${papersOk ? `valid (${s.papersValidTrips} more trips)` : "EXPIRED"}</b></p>`,
        actions: [
          { id: "papers", label: "Hand over vehicle papers", style: "primary" },
          { id: "greet", label: `"Good afternoon, officer! We dey go ${CITIES[this.leg.to].name}."` },
        ],
      });
      if (choice === "greet") await this.dialog({ art: "👮🏾‍♂️", title: "Police checkpoint", body: `<p class="quote">"Ehen, ${CITIES[this.leg.to].name}? Fine. Particulars, please."</p>`, actions: [{ id: "ok", label: "Hand over vehicle papers", style: "primary" }] });
      if (papersOk) return this.cleared("Everything correct. \"Safe journey o!\"");
      const fine = 10_000;
      this.pay(this.fine(fine), "fines", "must");
      await this.dialog({
        art: "🧾",
        title: "Papers expired",
        body: `<p class="quote">"Your papers don expire. Go and renew am for the next town."</p><p>Official fine: <b>${naira(fine)}</b>. Always ask for a receipt. You can renew your papers at any city stop.</p>`,
        actions: [{ id: "ok", label: "Okay, sir", style: "primary" }],
      });
    } else if (kind === "military") {
      await this.dialog({
        art: "🪖",
        title: "Military stop and search",
        body: `<p class="quote">"Everybody come down! Open your boot. Where you dey come from?"</p><p>Stay calm, keep your hands where they can see them, and answer politely.</p>`,
        actions: [{ id: "ok", label: "Step out and open the boot", style: "primary" }],
      });
      const quips = ["\"Na you get this fine car? Okay. Carry go.\"", "\"Wetin dey this bag?\" \"Na agege bread, sir.\" \"Hmm. You fit go.\"", "\"Drive safely, this road no good at night.\""];
      await this.dialog({ art: "🪖", title: "Search complete", body: `<p class="quote">${quips[Math.floor(Math.random() * quips.length)]}</p>`, actions: [{ id: "ok", label: "Thank you, sir", style: "primary" }] });
      return this.cleared("Search done. Back on the road.");
    } else if (kind === "frsc") {
      const missing = Object.entries(SAFETY_KIT).filter(([k]) => ["extinguisher", "triangle", "spareTyre"].includes(k) && !s.kit[k]);
      if (missing.length === 0) {
        await this.dialog({ art: "🦺", title: "FRSC patrol", body: `<p class="quote">"Fire extinguisher, warning triangle, spare tyre… complete! Thank you for keeping our roads safe."</p>`, actions: [{ id: "ok", label: "Safe journey!", style: "primary" }] });
        return this.cleared("FRSC: all safety kit present. +XP");
      }
      const fine = missing.length * 3_000;
      this.pay(this.fine(fine), "fines", "must");
      await this.dialog({
        art: "🦺",
        title: "FRSC patrol",
        cta: { target: "parts", context: { reason: "frsc_kit" } },
        body: `<p class="quote">"Where your ${missing.map(([, v]) => v.name.toLowerCase()).join(" and ")}? That's an offence."</p><p>Official fine: <b>${naira(fine)}</b>. Buy the kit in the Garage before the next patrol.</p>${UI.ctaBlock("Get a fire extinguisher, triangle and spare tyre from trusted GreenRev parts vendors.", "Shop safety kit on GreenRev")}`,
        actions: [{ id: "ok", label: "Noted, I'll buy them", style: "primary" }],
      });
    } else if (kind === "vio") {
      if (s.condition >= 50) {
        await this.dialog({ art: "🔧", title: "VIO inspection", body: `<p class="quote">"Lights, wipers, tyres… this car is roadworthy. Go well."</p>`, actions: [{ id: "ok", label: "Thank you", style: "primary" }] });
        return this.cleared("VIO: roadworthy.");
      }
      const fine = 15_000;
      this.pay(this.fine(fine), "fines", "must");
      await this.dialog({
        art: "🔧",
        title: "VIO: not roadworthy",
        cta: { target: "mechanic", context: { reason: "vio_fail", city: CITIES[this.leg.to].name } },
        body: `<p class="quote">"This car no roadworthy! Brake light no dey work, tyre don flat. See mechanic before you kill somebody."</p><p>Official fine: <b>${naira(fine)}</b>. Car condition: <b>${Math.round(s.condition)}%</b>.</p>${UI.ctaBlock("Book a verified mechanic near you on GreenRev and fix it properly.", "Find a GreenRev mechanic")}`,
        actions: [{ id: "ok", label: "I'll fix it at the next town", style: "primary" }],
      });
    }
    S.save(s);
  }

  async cleared(msg) {
    S.addStat(this.state, "checkpoints");
    this.legStats.checkpointsCleared++;
    this.state.xp += 20;
    UI.toast(msg, { kind: "gold" });
    this.checkProgress();
  }

  async ranCheckpoint(kind) {
    const fine = kind === "military" ? 50_000 : 25_000;
    this.pay(this.fine(fine), "fines", "must");
    this.audio.whistle();
    await this.dialog({
      art: "🚨",
      title: "You zoomed past a checkpoint!",
      body: `<p class="quote">"${kind === "military" ? "Stop there! You no see us?!" : "Oga! Park! Park well!"}"</p><p>They caught up with you. Fine: <b>${naira(fine)}</b>. Next time, slow down when you see the drums.</p>`,
      actions: [{ id: "ok", label: "Sorry, sir", style: "primary" }],
    });
  }

  async crashEvent(c, dmg) {
    const who = { danfo: "danfo driver", okada: "okada man", keke: "keke rider", truck: "trailer driver", tanker: "tanker driver", bus: "bus driver" }[c.body] ?? "other driver";
    if (dmg < 15) return UI.toast(`Bang! You hit a ${c.body}. −${dmg}% condition`, { kind: "bad" });
    const id = await this.dialog({
      art: "💥",
      title: "Accident!",
      cta: { target: "mechanic", context: { reason: "crash" } },
      body: `<p>You crashed into a ${c.body}. Car condition <b>−${dmg}%</b> (now ${Math.round(this.state.condition)}%).</p><p class="quote">The ${who} comes out shouting: "Na your fault! You no get eye?"</p><p>Everybody is okay. FRSC arrives to clear the road.</p>
        ${UI.ctaBlock("Get the damage looked at by a verified mechanic on GreenRev.", "Find a GreenRev mechanic")}`,
      actions: [
        { id: "settle", label: "Exchange numbers and drive on", hint: "Free" },
        { id: "fix", label: "Roadside panel beater", hint: naira(Math.round(dmg * 6_000)) },
      ],
    });
    if (id === "fix" && this.pay(Math.round(dmg * 6_000), "repairs", "overdraft")) this.state.condition = Math.min(100, this.state.condition + dmg * 0.8);
    S.save(this.state);
  }

  async animalEvent(kind) {
    const fine = kind === "cow" ? 60_000 : 15_000;
    this.pay(this.fine(fine), "fines", "must");
    await this.dialog({
      art: kind === "cow" ? "🐄" : "🐐",
      title: kind === "cow" ? "You hit a cow!" : "You knocked a goat!",
      body: `<p class="quote">${kind === "cow" ? "The herder runs over: \"Ah! My cow! You must pay!\"" : "\"Who get this goat?!\" A woman appears from nowhere."}</p><p>The animal is fine, but you pay <b>${naira(fine)}</b> compensation. Slow down when animals are on the road.</p>`,
      actions: [{ id: "ok", label: "Pay and move on", style: "primary" }],
    });
  }

  async tyreBurst() {
    this.player.speed = 0;
    const s = this.state;
    const actions = [];
    if (s.kit.spareTyre) actions.push({ id: "spare", label: "Change to your spare tyre", hint: "Free · uses your spare", style: "primary" });
    actions.push({ id: "vulc", label: "Call the roadside vulcanizer", hint: naira(15_000) });
    actions.push({ id: "gr", label: "Find a GreenRev mechanic", hint: "Opens GreenRev · 30% off in-game fix" });
    const id = await this.dialog({ art: "🛞", title: "Tyre burst!", body: "<p>That pothole was too deep. Your tyre don burst.</p>", actions });
    if (id === "spare") {
      s.kit.spareTyre = false;
      UI.toast("Spare tyre on. Buy a new spare in the Garage, FRSC checks for it.");
    } else if (id === "vulc") this.pay(15_000, "repairs", "must");
    else {
      this.cta("mechanic", { reason: "tyre_burst", city: this.leg.to });
      this.pay(10_500, "repairs", "must");
    }
    S.save(s);
  }

  async breakdownEvent(cause) {
    this.brokenDown = true;
    this.player.speed = 0;
    const s = this.state;
    const cost = S.servicePrices({ ...s, condition: 0 }).repair;
    const id = await this.dialog({
      art: "🔥",
      title: "Your car don knock!",
      body: `<p>Smoke is coming from the bonnet. The ${cause} has given up in the middle of the ${this.leg.road}.</p><p>A roadside mechanic offers to fix it, at a roadside price.</p>`,
      actions: [
        { id: "gr", label: "Find a verified GreenRev mechanic", hint: `30% off · ${naira(cost * 0.7)}`, style: "primary" },
        { id: "road", label: "Roadside mechanic", hint: naira(cost * 1.3) },
        { id: "limp", label: "Limp slowly to the next town", hint: "Free · very slow" },
      ],
    });
    if (id === "gr") {
      this.cta("mechanic", { reason: "breakdown", city: this.leg.to });
      s.condition = 100;
      this.pay(Math.round(cost * 0.7), "repairs", "must");
    } else if (id === "road") {
      s.condition = 100;
      this.pay(Math.round(cost * 1.3), "repairs", "must");
    } else s.condition = 8;
    this.brokenDown = false;
    S.save(s);
  }

  async outOfFuelEvent() {
    this.outOfFuel = true;
    const price = 25_000;
    await this.dialog({
      art: "⛽",
      title: "You don run out of fuel!",
      body: `<p>A boy appears with a jerrycan: "Oga, I get fuel. Na ${naira(price)} for 10 litres."</p><p>Black-market price, but you're stranded.</p>`,
      actions: [{ id: "ok", label: "Buy the jerrycan", hint: naira(price), style: "primary" }],
    });
    this.pay(price, "fuel", "must");
    this.state.fuel = 25;
    this.outOfFuel = false;
  }

  buySnack(h) {
    const snack = SNACKS[h.data.goods];
    if (!this.pay(snack.price, "food", "cash")) return UI.toast("You no get change!", { kind: "bad" });
    this.state.energy = Math.min(100, (this.state.energy ?? 100) + snack.energy);
    this.energyWarned = false;
    S.addStat(this.state, "hawkerBuys");
    this.audio.coin();
    this.actors.say(h, ["God bless you, oga!", "Thank you, ma!", "Buy another one!", "Correct customer!"][Math.floor(Math.random() * 4)]);
    h.role = "walker";
    h.vz = -1.2;
    UI.toast(`Bought ${snack.name} for ${naira(snack.price)}. Energy +${snack.energy}`, { kind: "gold" });
    this.checkProgress();
  }

  /** Pull in at a rest stop: fuel, a regional meal, a nap, a quick mechanic check, safety kit. */
  async restStopDialog(e) {
    const s = this.state;
    this.player.speed = 0;
    if (!e.state.visited) {
      e.state.visited = true;
      S.addStat(s, "restStops");
      this.checkProgress();
    }
    const menu = MENUS[this.leg.biome] ?? MENUS.south;
    const greet = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
    for (;;) {
      const prices = S.servicePrices(s);
      const check = Math.round(prices.repair * 0.25);
      const missingKit = Object.entries(SAFETY_KIT).filter(([k]) => !s.kit[k]);
      const id = await this.dialog({
        art: "🛑",
        title: e.name,
        body: `<p class="quote">${greet}</p><p>Fuel <b>${Math.round(s.fuel)}%</b> · Car <b>${Math.round(s.condition)}%</b> · Energy <b>${Math.round(s.energy ?? 100)}%</b> · Wallet <b>${naira(s.coins)}</b></p>
          ${UI.ctaBlock("Want your business on this rest stop's billboard? Drivers on this road see it every day.", "Advertise at rest stops")}`,
        cta: { target: "advertise", context: { reason: "rest_stop" } },
        actions: [
          { id: "fuel", label: "⛽ Fill the tank", hint: naira(prices.refuel), disabled: s.fuel > 97 },
          ...menu.map((m, i) => ({ id: `food-${i}`, label: `🍲 ${m.name}`, hint: `${naira(m.price)} · +${m.energy} energy` })),
          { id: "rest", label: "🛏 Rest for an hour", hint: `${naira(1_000)} · energy to 100%`, disabled: (s.energy ?? 100) > 95 },
          { id: "check", label: "🔧 Quick mechanic check", hint: `${naira(check)} · +15% condition`, disabled: s.condition > 92 },
          ...(missingKit.length ? [{ id: "kit", label: `🧯 Buy ${missingKit[0][1].name}`, hint: naira(missingKit[0][1].price) }] : []),
          { id: "go", label: "Back on the road →", style: "primary" },
        ],
      });
      if (id === "go") return S.save(s);
      if (id === "fuel") S.refuel(s, this.payer("overdraft")) || this.offerLoan("fuel");
      else if (id.startsWith("food-")) {
        const m = menu[Number(id.slice(5))];
        if (this.pay(m.price, "food", "cash")) {
          s.energy = Math.min(100, (s.energy ?? 100) + m.energy);
          this.energyWarned = false;
          S.addStat(s, "meals");
          this.audio.coin();
          UI.toast(`${m.name}. Correct food! Energy +${m.energy}`, { kind: "gold" });
          this.checkProgress();
        } else UI.toast("You no get money for food", { kind: "bad" });
      } else if (id === "rest") {
        if (this.pay(1_000, "rest", "cash")) {
          s.energy = 100;
          this.energyWarned = false;
          this.timeOfDay = ((this.timeOfDay ?? 8) + 1) % 24;
          UI.toast("You slept small. Fresh again! 😴");
        }
      } else if (id === "check") {
        if (this.pay(check, "repairs", "overdraft")) {
          s.condition = Math.min(100, s.condition + 15);
          UI.toast("The mechanic tightened a few things. +15% condition");
        }
      } else if (id === "kit") {
        const r = S.buyKit(s, missingKit[0][0]);
        if (!r.ok) UI.toast(r.reason, { kind: "bad" });
      }
      S.save(s);
    }
  }

  /** Booking panel for businesses that want a roadside billboard. Real links, so it works in any embed. */
  async openAdvertise(source) {
    const A = CONFIG.advertise;
    track("advertise_open", { source });
    const esc = (u) => String(u).replace(/"/g, "&quot;");
    const rows = A.packages.map((p) => {
      const href = p.paystackUrl || A.contactUrl;
      const label = p.paystackUrl ? "Pay with Paystack" : "Book now";
      return `<div class="pkg"><div><b>${p.days} days</b><small>${naira(Math.round(p.price / p.days))}/day</small></div><b class="price">${naira(p.price)}</b>
        <a class="btn primary" data-pkg="${p.id}" href="${esc(href)}" target="_blank" rel="noopener">${label}</a></div>`;
    }).join("");
    const p = this.dialog({
      art: "📣",
      title: "Advertise on Nigeria's highways",
      body: `<p>Put your business on the roadside billboards in GreenRev Roadtrip: on the Lagos–Abuja, Lagos–Calabar, Abuja–Kano, Jos and Maiduguri roads, in the web and mobile app.</p>
        <div class="pkgs">${rows}</div>
        <h2>How it works</h2>
        <ol class="steps"><li>Pick a package and pay securely with Paystack.</li><li>Send your billboard image and payment reference to <a href="${esc(A.contactUrl)}" target="_blank" rel="noopener">GreenRev advertising</a>. Add a link (website, WhatsApp or GreenRev store) for drivers who tap your ad.</li><li>Your ad goes live within 24 hours, and we send you how many drivers saw and tapped it.</li></ol>
        <h2>Billboard image</h2>
        <p><b>1024 × 512 px</b> (2:1 landscape), JPG or PNG, under 500 KB. Drivers see it for about 3 seconds: one big message, your logo, and a phone number or web address. Keep text 40 px from the edges.</p>
        <p><a class="btn" href="${esc(A.templateUrl)}" target="_blank" rel="noopener">Download the billboard template</a></p>`,
      actions: [{ id: "close", label: "Back to the road", style: "ghost" }],
    });
    document.querySelectorAll<HTMLElement>("#modal-body [data-pkg]").forEach((a) => a.addEventListener("click", () => track("advertise_package_click", { package: a.dataset.pkg, source })));
    await p;
  }

  roadsideRefuel() {
    const cost = S.servicePrices(this.state).refuel;
    if (S.refuel(this.state, this.payer("overdraft"))) {
      this.audio.coin();
      UI.toast(`Tank full. Paid ${naira(cost)}.`);
    } else UI.toast("Not enough money for fuel", { kind: "bad" });
  }

  // ---------------------------------------------------------------- arrivals

  async arrive() {
    const s = this.state;
    const leg = this.leg;
    const city = CITIES[leg.to];
    const seconds = this.t - this.legStats.startedAt;
    const pay = S.legPayout(leg, { ...this.legStats, seconds });
    const mult = this.diff?.pay ?? 1;
    pay.total = Math.round(pay.total * mult);
    const hour = this.timeOfDay ?? 12;
    const daylight = hour >= 6 && hour < 19;
    const daylightBonus = daylight ? 20_000 : 0;
    this.earn(pay.total, "trip pay");
    this.earn(daylightBonus, "daylight bonus");
    const bank = E.settleLeg(s, pay.total);
    if (bank.autoRepaid && !s.loan) S.addStat(s, "loansRepaid");
    s.xp += 40;
    s.stats.km += leg.km;
    S.addStat(s, "legs");
    if (this.legStats.crashes === 0) S.addStat(s, "cleanLegs");
    if (!s.stamps.includes(leg.from)) s.stamps.push(leg.from);
    const newStamp = !s.stamps.includes(leg.to);
    if (newStamp) s.stamps.push(leg.to);
    s.papersValidTrips = Math.max(0, s.papersValidTrips - 1);
    s.energy = 100;
    s.trip.elapsed = (s.trip.elapsed ?? 0) + seconds;
    const last = this.legIndex === this.route.legs.length - 1;
    s.trip.legIndex = this.legIndex + 1;
    this.checkProgress();
    S.save(s);
    track("leg_complete", { routeId: this.route.id, leg: this.legIndex, seconds: Math.round(seconds), crashes: this.legStats.crashes });
    this.audio.coin();

    this.paused = true;
    UI.actionButton(null);
    for (;;) {
      const prices = S.servicePrices(s);
      const cta = this.legIndex % 2 === 0
        ? UI.ctaBlock(`Are you a car dealer in ${city.name}? List your cars where thousands of buyers are looking.`, "Sign up as a GreenRev dealer")
        : UI.ctaBlock(`Ready for a stronger car for these roads? Browse cars in ${city.name} on GreenRev Marketplace.`, "Browse GreenRev Marketplace");
      const id = await UI.modal({
        art: newStamp ? "📍" : "🏙️",
        title: `Welcome to ${city.name}!`,
        cta: { target: this.legIndex % 2 === 0 ? "dealer" : "marketplace", context: { reason: "city_arrival", city: city.name } },
        body: `<p>${city.fact}</p><p>🍲 Must-eat: <b>${city.food}</b> · 🏛 ${city.landmark}</p>${newStamp ? `<p>🛂 New passport stamp: <b>${city.name}, ${city.state}</b></p>` : ""}
          <div class="kv"><span>Leg pay</span><b class="pos">${naira(pay.base)}</b><span>No-crash bonus</span><b class="pos">${naira(pay.clean)}</b><span>Checkpoints cleared</span><b class="pos">${naira(pay.law)}</b><span>Pothole damage deduction</span><b class="neg">${naira(pay.roadPenalty)}</b>
            ${mult !== 1 ? `<span>${this.diff.label} level ×${mult}</span><b class="pos">${naira(pay.total)}</b>` : ""}
            <span>${daylight ? "☀️ Arrived in daylight" : "🌙 Night arrival (risky, no bonus)"}</span><b class="${daylight ? "pos" : ""}">${naira(daylightBonus)}</b>
            ${bank.loanInterest ? `<span>Loan interest</span><b class="neg">−${naira(bank.loanInterest)}</b>` : ""}
            ${bank.autoRepaid ? `<span>Loan repayment (auto)</span><b class="neg">−${naira(bank.autoRepaid)}</b>` : ""}
            ${bank.overdraftFee ? `<span>Overdraft fee</span><b class="neg">−${naira(bank.overdraftFee)}</b>` : ""}
            <span>Leg time</span><b>${UI.fmtTime(seconds)}</b><span>Wallet</span><b class="${s.coins < 0 ? "neg" : ""}">${naira(s.coins)}</b></div>
          <p>Fuel ${Math.round(s.fuel)}% · Car ${Math.round(s.condition)}% · Papers ${s.papersValidTrips > 0 ? `${s.papersValidTrips} trips left` : "EXPIRED"}</p>${cta}`,
        actions: [
          { id: "fuel", label: "Refuel", hint: naira(prices.refuel), disabled: s.fuel > 98 },
          { id: "repair", label: "Mechanic: full repair", hint: naira(prices.repair), disabled: s.condition > 98 },
          { id: "papers", label: "Renew vehicle papers", hint: naira(prices.papers), disabled: s.papersValidTrips > 2 },
          { id: "garage", label: "Garage: cars, upgrades & safety kit" },
          { id: "bank", label: `🏦 Bank${E.loanBalance(s) ? ` (owing ${naira(E.loanBalance(s))})` : ""}` },
          ...(this.legHyped?.length ? [{ id: "hyped", label: `🔥 Cars you hyped on this road (${this.legHyped.length})`, style: "hype" }] : []),
          last ? { id: "finish", label: "Finish the journey 🎉", style: "primary" } : { id: "go", label: `Continue to ${CITIES[this.route.legs[this.legIndex + 1].to].name} →`, style: "primary" },
          { id: "menu", label: "Save and rest here (menu)", style: "ghost" },
        ],
      });
      if (id === "fuel") S.refuel(s, this.payer("overdraft")) || (await this.offerLoan("fuel"));
      else if (id === "repair") S.repair(s, 0, this.payer("overdraft")) || (await this.offerLoan("the repair"));
      else if (id === "papers") S.renewPapers(s, this.payer("cash")) || (await this.offerLoan("your papers"));
      else if (id === "bank") await this.openBank();
      else if (id === "hyped") {
        const unique: any[] = [...new Map<string, any>(this.legHyped.map((c) => [c.id, c])).values()];
        const pick = await UI.modal({
          art: "🔥",
          title: "Cars you hyped",
          body: "<p>Like what you saw? These are real cars from GreenRev dealers.</p>",
          actions: [...unique.map((c) => ({ id: c.id, label: c.title ?? "Featured car", hint: c.dealer })), { id: "back", label: "Back", style: "primary" }],
        });
        const car = unique.find((c) => c.id === pick);
        if (car) await this.openFeaturedCard(car, "arrival_hyped");
      } else if (id === "garage") {
        await UI.openGarage(s);
        this.player = { ...this.makePlayer(), z: this.player.z, x: this.player.x };
      } else if (id === "go") {
        S.save(s);
        this.legIndex++;
        this.legStartZ = this.player.z;
        this.paused = false;
        this.clock.getDelta();
        this.beginLeg();
        return;
      } else if (id === "finish") return this.finishRoute();
      else if (id === "menu") {
        this.paused = false;
        S.save(s);
        return this.showMenu();
      }
      S.save(s);
    }
  }

  async finishRoute() {
    const s = this.state;
    const r = this.route;
    const total = s.trip.elapsed ?? 0;
    const first = !s.completedRoutes.includes(r.id);
    if (first) s.completedRoutes.push(r.id);
    const best = s.bestTimes[r.id];
    if (!best || total < best) s.bestTimes[r.id] = total;
    const duel = settleChallenge(s, r.id, total);
    if (duel) track("challenge_result", { routeId: r.id, won: duel.won, from: duel.from });
    const bonus = (first ? 500_000 : 150_000) + (duel?.won ? 100_000 : 0);
    this.earn(bonus, "completion bonus");
    // the job you took for this journey
    const contract = s.trip.contract;
    let job = null;
    if (contract) {
      job = settleContract(contract, { seconds: total, ...(s.trip.tally ?? { potholes: 0, crashes: 0, hardBrakes: 0, fines: 0 }) });
      this.earn(job.pay, "contract");
      S.addStat(s, "contracts");
      track("contract_complete", { routeId: r.id, type: contract.type, pay: job.pay, rating: job.rating });
      awardPoints(CONFIG.cloud.pointsUrl, Math.round(job.rating / 4), "roadtrip_contract");
    }
    if (s.trip.diff === "hard") S.addStat(s, "hardRoutes");
    const money = E.tripSummary(s, total);
    const par = contract?.target ?? targetSeconds(r, E.difficulty(s).speed);
    s.xp += 200;
    s.trip = null;
    s.ledger = null;
    const unlocked = S.availableRoutes(s).filter((x) => x.unlockedBy === r.id).map((x) => x.name);
    this.checkProgress();
    S.save(s);
    track("route_complete", { routeId: r.id, seconds: Math.round(total), first });
    awardPoints(CONFIG.cloud.pointsUrl, first ? 30 : 10, "roadtrip_route_complete");
    const p = UI.modal({
      art: "🏁",
      title: `${r.name}: journey complete!`,
      cta: { target: "dealer", context: { reason: "route_complete" } },
      body: `<p>You made it by road. Driving time <b>${UI.fmtTime(total)}</b> (par ${UI.fmtTime(par)})${best && total < best ? " · new best!" : ""}.</p>
        ${job ? `<h2>${contract.icon} ${UI.esc(contract.title)}</h2><div class="kv">${job.lines.map(([l, v]) => `<span>${UI.esc(l)}</span><b class="${v < 0 ? "neg" : "pos"}">${v < 0 ? "−" : ""}${naira(Math.abs(v))}</b>`).join("")}<span><b>Contract pay</b></span><b class="pos">${naira(job.pay)}</b></div>` : ""}
        <h2>Trip money</h2>
        <div class="kv"><span>Started with</span><b>${naira(money.start)}</b>
          ${Object.entries(money.earnedBy).map(([k, v]) => `<span>+ ${UI.esc(k)}</span><b class="pos">${naira(v)}</b>`).join("")}
          ${Object.entries(money.spentBy).map(([k, v]) => `<span>− ${UI.esc(k)}</span><b class="neg">${naira(v)}</b>`).join("")}
          <span><b>Net for the trip</b></span><b class="${money.net < 0 ? "neg" : "pos"}">${money.net < 0 ? "−" : "+"}${naira(Math.abs(money.net))}</b>
          <span>Wallet now</span><b class="${money.end < 0 ? "neg" : ""}">${naira(money.end)}</b></div>${unlocked.length ? `<p>🔓 New journey unlocked: <b>${unlocked.join(", ")}</b></p>` : ""}
        ${duel ? `<p class="quote">${duel.won ? `🏆 You beat your friend's time (${UI.fmtTime(duel.seconds)})! +${naira(100_000)}` : `Your friend's ${UI.fmtTime(duel.seconds)} still stands. Run it back!`}</p>` : ""}
        <p>Tomorrow the roads change: new potholes, new checkpoints, and your streak reward goes up.</p>
        ${UI.ctaBlock("Sell cars? Thousands of buyers browse GreenRev every day. Dealers sign up free.", "Become a GreenRev dealer")}`,
      actions: [
        { id: "share", label: "Challenge a friend to beat my time", style: "warn" },
        { id: "menu", label: "Back to menu", style: "primary" },
      ],
    });
    const id = await p;
    if (id === "share") {
      const text = `I just drove ${r.name} on GreenRev Roadtrip in ${UI.fmtTime(total)}! 🚗🇳🇬 Potholes, checkpoints, go-slow and all. Think you can beat me?`;
      await this.shareLink(inviteUrl(this.playBase(), s.referral.code, { routeId: r.id, seconds: total }), text, "challenge");
    }
    this.paused = false;
    this.showMenu();
  }

  checkProgress() {
    for (const m of S.updateMissions(this.state)) UI.toast(`✅ Mission done: ${m.text} (+${naira(m.reward)})`, { kind: "gold" });
    for (const a of S.checkAchievements(this.state)) UI.toast(`🏆 Achievement: ${a.name}`, { kind: "gold" });
  }

  async pause() {
    if (this.mode !== "drive" || this.paused) return;
    const id = await this.dialog({
      art: "⏸",
      title: "Paused",
      body: `<p>${CITIES[this.leg.from].name} → ${CITIES[this.leg.to].name} · ${Math.max(0, Math.round((this.legEndZ - this.player.z) / this.plan.length * this.leg.km))} km to go</p>`,
      actions: [
        { id: "resume", label: "Resume", style: "primary" },
        { id: "camera", label: `Camera: ${CAMERAS[this.cameraMode].label}`, hint: "tap to switch" },
        { id: "sound", label: `Sound: ${this.state.settings.sound ? "on" : "off"}` },
        { id: "voice", label: `Voices: ${this.state.settings.voice !== false ? "on" : "off"}` },
        { id: "menu", label: "Quit to menu (progress saved at last town)", style: "ghost" },
      ],
    });
    if (id === "camera") this.cycleCamera();
    if (id === "sound") {
      this.state.settings.sound = !this.state.settings.sound;
      this.audio.setEnabled(this.state.settings.sound);
    }
    if (id === "voice") this.state.settings.voice = this.state.settings.voice === false;
    this.voice.setEnabled(this.state.settings.sound && this.state.settings.voice !== false);
    S.save(this.state);
    if (id === "menu") {
      this.mode = "menu";
      this.idleAttract();
      this.resetWorld();
      this.player = this.makePlayer();
      this.player.speed = 20;
      return this.showMenu();
    }
    if (id === "camera" || id === "sound" || id === "voice") return this.pause();
  }

  // ---------------------------------------------------------------- HUD & bubbles

  updateHud(phys) {
    const s = this.state;
    const p = this.player;
    const kmh = Math.round(p.speed * KMH);
    $("hud-speed").textContent = String(kmh);
    $("hud-speed").parentElement.classList.toggle("fast", kmh > 100);
    $("hud-coins").textContent = `${s.coins < 0 ? "−" : ""}${Math.abs(Math.round(s.coins)).toLocaleString("en-NG")}`;
    $("hud-coins").parentElement.classList.toggle("in-red", s.coins < 0);
    // clock (time of day), trip timer against the job's target or par time
    const h = this.timeOfDay ?? 8;
    const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    $("hud-time").textContent = `${h >= 6 && h < 19 ? "☀️" : "🌙"} ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    const elapsed = (s.trip?.elapsed ?? 0) + (this.t - this.legStats.startedAt);
    const target = s.trip?.contract?.target ?? (this.parTime ??= targetSeconds(this.route, (this.diff ?? E.difficulty(s)).speed));
    $("hud-timer").textContent = `⏱ ${UI.fmtTime(elapsed)} / ${UI.fmtTime(target)}`;
    $("hud-timer").classList.toggle("late", elapsed > target);
    const job = s.trip?.contract;
    $("hud-job").classList.toggle("hidden", !job);
    if (job) $("hud-job").textContent = `${job.icon} ${naira(job.pay)}`;
    UI.setBar("bar-fuel", s.fuel);
    UI.setBar("bar-cond", s.condition);
    UI.setBar("bar-energy", s.energy ?? 100);
    const progress = Math.min(1, (p.z - this.legStartZ) / this.plan.length);
    $("hud-km").textContent = `${Math.max(0, Math.round((1 - progress) * this.leg.km))} km`;
    UI.renderProgress(this.route, this.legIndex, progress);
    if (s.condition < 20 && !this.condWarned) {
      this.condWarned = true;
      UI.toast("Engine light is on and the car is struggling. Fix it at the next town.", {
        kind: "bad",
        cta: { label: "Find a mechanic", onClick: () => this.cta("mechanic", { reason: "low_condition" }) },
        ttl: 8000,
      });
    }
    if (s.condition >= 20) this.condWarned = false;
    void phys;
  }

  renderBubbles() {
    this.renderHypeTag();
    const box = $("bubbles");
    const want = this.mode === "drive" || this.attract ? this.actors.bubbles : [];
    while (box.children.length < want.length) box.appendChild(document.createElement("div")).className = "bubble";
    while (box.children.length > want.length) box.lastChild.remove();
    const v = new THREE.Vector3();
    want.forEach((b, i) => {
      const el = box.children[i] as HTMLElement;
      v.copy(b.actor.mesh.position);
      v.y += 2.3;
      v.project(this.camera);
      const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
      el.style.display = visible ? "" : "none";
      el.textContent = b.text;
      el.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`;
      el.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
    });
  }

  /** A floating label over the featured car while it can be hyped. */
  renderHypeTag() {
    const el = $("hype-tag");
    const h = this.hype;
    if (!h || this.mode !== "drive" || (h.stage !== "window" && h.stage !== "hyped")) return el.classList.add("hidden");
    const v = new THREE.Vector3().copy(h.car.mesh.position);
    v.y += 2.6;
    v.project(this.camera);
    if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) return el.classList.add("hidden");
    el.classList.remove("hidden");
    el.textContent = h.stage === "hyped" ? `🔥 Hyped · ${h.entry.dealer}` : `🔥 ${h.entry.dealer}`;
    el.classList.toggle("done", h.stage === "hyped");
    el.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`;
    el.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
  }

  /** Stop the game and release everything (used when a Next.js page unmounts it). */
  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.abort.abort();
    try {
      S.save(this.state);
    } catch {
      /* storage unavailable */
    }
    this.audio.radioOff?.();
    this.audio.ctx?.close?.();
    this.voice.stop();
    this.renderer.dispose();
  }

  /** Tap a GreenRev billboard in the 3D world to open it. */
  tapScene(e) {
    const ndc = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    if (this.hype?.stage === "window" && this.raycaster.intersectObject(this.hype.car.mesh, true).length) return this.doHype();
    const hits = this.raycaster.intersectObjects(this.world.dynamic.children, true);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData?.ad && !o.userData?.campaign) o = o.parent;
      if (o?.userData.campaign) {
        const c = o.userData.campaign;
        track("ad_click", { campaign: c.id, routeId: this.route.id });
        return openExternal(c.link, c.advertiser ?? "advertiser");
      }
      if (o?.userData.ad === "advertise") return this.openAdvertise("billboard_tap");
      if (o?.userData.ad) return this.cta(o.userData.ad, { reason: "billboard_tap" });
    }
  }
}


/** Start the game in a page that already contains the markup (see mount.ts). */
export function startGame(): Game | null {
  try {
    const game = new Game();
    window.game = game;
    return game;
  } catch (err) {
    console.error(err);
    return null;
  }
}

export type { Game };
