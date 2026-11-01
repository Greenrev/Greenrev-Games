import type { ModalAction } from "../types/game.ts";
import { CARS, UPGRADES, SAFETY_KIT, getCar } from "../data/cars.ts";
import { CITIES, ROUTES, routeCities } from "../data/routes.ts";
import { openGreenRev } from "../config.ts";
import { ACHIEVEMENT_LIST, availableRoutes, buyCar, buyKit, buyUpgrade, dailyMissions, level, PAINTS, save, setPaint, upgradeCost } from "./state.ts";

const $ = (id) => document.getElementById(id);
export const naira = (n) => `${n < 0 ? "−" : ""}₦${Math.abs(Math.round(n)).toLocaleString("en-NG")}`;
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

let ctaHandler = openGreenRev;
/** The game routes GreenRev clicks through its own handler (stats, missions). */
export function setCtaHandler(fn) {
  ctaHandler = fn;
}

/**
 * Modal with a list of choices. Resolves with the chosen action id.
 * `cta: { target, context }` wires the GreenRev button rendered by ctaBlock() in the body.
 */
export function modal({ art = "", title, body = "", actions = [] as ModalAction[], cta = null }: { art?: string; title: string; body?: string; actions?: ModalAction[]; cta?: { target: string; context?: Record<string, any> } | null }): Promise<any> {
  $("modal-art").textContent = art;
  $("modal-title").textContent = title;
  $("modal-body").innerHTML = body;
  const ctaBtn = $("modal-body").querySelector<HTMLElement>("[data-cta-inline]");
  if (ctaBtn && cta) ctaBtn.onclick = () => ctaHandler(cta.target, cta.context ?? {});
  const box = $("modal-actions");
  box.innerHTML = "";
  $("modal").classList.remove("hidden");
  $("modal").querySelector(".card").scrollTop = 0;
  return new Promise((resolve) => {
    for (const a of actions) {
      const b = document.createElement("button");
      b.className = `btn ${a.style ?? ""}`;
      b.innerHTML = `<span>${esc(a.label)}</span>${a.hint ? `<small>${esc(a.hint)}</small>` : ""}`;
      b.disabled = !!a.disabled;
      if (a.disabled) b.style.opacity = "0.45";
      b.onclick = () => {
        if (a.keepOpen) return a.onClick?.();
        $("modal").classList.add("hidden");
        resolve(a.id);
      };
      box.appendChild(b);
    }
  });
}

export function closeModal() {
  $("modal").classList.add("hidden");
}

export function toast(text, { kind = "", cta = null, ttl = 4200 } = {}) {
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = text;
  if (cta) {
    const b = document.createElement("button");
    b.textContent = cta.label;
    b.onclick = cta.onClick;
    el.appendChild(b);
  }
  $("toasts").prepend(el);
  while ($("toasts").children.length > 4) $("toasts").lastChild.remove();
  setTimeout(() => el.remove(), ttl);
}

let alertTimer;
export function alertBanner(text, kind = "") {
  const el = $("alert");
  el.textContent = text;
  el.className = `alert ${kind}`;
  clearTimeout(alertTimer);
  alertTimer = setTimeout(() => el.classList.add("hidden"), 2600);
}

export function actionButton(text: string | null, onClick?: () => void, kind = "") {
  const el = $("action");
  if (!text) return el.classList.add("hidden");
  if (el.textContent !== text) el.textContent = text;
  el.onclick = onClick;
  el.classList.toggle("hype", kind === "hype");
  el.classList.remove("hidden");
}

/** Put the GreenRev logo in the menu and HUD; keep the GREENREV wordmark if the image can't load. */
export function applyLogo(url) {
  if (!url) return;
  for (const slot of document.querySelectorAll<HTMLElement>("[data-logo]")) {
    const img = new Image();
    img.alt = "GreenRev";
    img.decoding = "async";
    img.onload = () => {
      slot.textContent = "";
      slot.appendChild(img);
      slot.classList.add("has-img");
    };
    img.src = url;
  }
}

/** A GreenRev call-to-action block for modals. */
export function ctaBlock(text, label) {
  return `<div class="gr-cta">${text}<button class="btn primary" data-cta-inline>${esc(label)}</button></div>`;
}

// ------------------------------------------------------------------ menu

export function renderMenu(state, { onStart }) {
  $("m-coins").textContent = naira(state.coins);
  $("m-streak").textContent = `🔥 ${state.streak.count} day${state.streak.count === 1 ? "" : "s"}`;
  $("m-level").textContent = `${level(state.xp)} · ${state.xp} XP`;
  $("m-car").textContent = getCar(state.carId).name;
  $("m-hype").textContent = `🔥 ${state.hype ?? 0}`;
  $("m-loan").textContent = naira(state.loan?.balance ?? 0);
  $("m-coins").classList.toggle("neg", state.coins < 0);

  const missions = dailyMissions(state);
  $("m-missions").innerHTML = missions.map((m) => {
    const pct = Math.min(100, (((state.stats[m.stat] ?? 0) - m.base) / m.target) * 100);
    return `<li class="${m.done ? "done" : ""}"><span>${esc(m.text)} <small>· ${naira(m.reward)}</small></span><span class="meter"><i style="width:${m.done ? 100 : pct}%"></i></span></li>`;
  }).join("");

  const box = $("m-routes");
  box.innerHTML = "";
  for (const r of availableRoutes(state)) {
    const b = document.createElement("button");
    b.className = `route ${r.unlocked ? "" : "locked"}`;
    b.style.setProperty("--c", r.color);
    const inTrip = state.trip?.routeId === r.id;
    const badge = !r.unlocked ? `🔒 Finish ${ROUTES.find((x) => x.id === r.unlockedBy).name}` : inTrip ? `▶ Continue (leg ${state.trip.legIndex + 1}/${r.legs.length})` : r.completed ? `✓ Best ${fmtTime(state.bestTimes[r.id])}` : `${r.legs.length} legs`;
    b.innerHTML = `<span class="badge">${esc(badge)}</span><h3>${esc(r.name)}</h3><p>${esc(r.tagline)}</p><div class="cities">${routeCities(r).map((c) => CITIES[c].name).join(" · ")}</div>`;
    if (r.unlocked) b.onclick = () => onStart(r.id);
    box.appendChild(b);
  }
}

export function fmtTime(sec) {
  if (!sec && sec !== 0) return "–";
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ------------------------------------------------------------------ garage

export async function openGarage(state) {
  for (;;) {
    const car = getCar(state.carId);
    const ups = state.upgrades[state.carId] ?? {};
    const stat = (v) => "▮".repeat(Math.round(v * 10)).padEnd(10, "▯");
    const cars = CARS.map((c) => {
      const owned = state.owned.includes(c.id);
      return `<div class="tile ${c.id === state.carId ? "selected" : ""}"><b>${esc(c.name)}</b>${esc(c.tag)}<br><small>Speed ${stat(c.topSpeed)}<br>Tough ${stat(c.toughness)}</small><br>${owned ? (c.id === state.carId ? "✅ Driving" : "Owned") : naira(c.price)}
        <button class="btn ${owned ? "" : "primary"}" data-car="${c.id}">${owned ? "Drive" : "Buy"}</button>
        <button class="btn ghost" data-real="${c.id}">See the real one on GreenRev →</button></div>`;
    }).join("");
    const upgrades = Object.entries(UPGRADES).map(([k, u]) => {
      const cost = upgradeCost(state, k);
      return `<div class="tile"><b>${u.name} · Lv ${ups[k] ?? 0}/3</b>${u.effect}<button class="btn" data-up="${k}" ${cost === null ? "disabled" : ""}>${cost === null ? "Maxed" : naira(cost)}</button></div>`;
    }).join("");
    const myPaint = state.paint?.[state.carId] ?? car.color;
    const paints = PAINTS.map((p) => `<button class="swatch ${p.hex === myPaint ? "on" : ""}" data-paint="${p.hex}" style="--sw:${p.hex}" title="${esc(p.name)}" aria-label="${esc(p.name)}"></button>`).join("");
    const kit = Object.entries(SAFETY_KIT).map(([k, item]) => `<div class="tile"><b>${item.name}</b>${state.kit[k] ? "✅ In the boot" : "FRSC will check for this"}<button class="btn" data-kit="${k}" ${state.kit[k] ? "disabled" : ""}>${state.kit[k] ? "Have it" : naira(item.price)}</button></div>`).join("");

    const result = await new Promise<any>((resolve) => {
      modal({
        art: "🚗",
        title: `Garage · ${naira(state.coins)}`,
        body: `<p>Driving: <b>${esc(car.name)}</b></p><h2>Paint your car</h2><div class="swatches">${paints}</div><p class="hint">${esc(PAINTS.find((p) => p.hex === myPaint)?.name ?? "Factory colour")} · free to change</p><h2>Cars</h2><div class="grid2">${cars}</div><h2>Upgrades for this car</h2><div class="grid2">${upgrades}</div><h2>Safety kit</h2><div class="grid2">${kit}</div>
          ${ctaBlock("Need genuine parts or accessories for your real car? Trusted vendors are on GreenRev.", "Shop parts on GreenRev")}`,
        actions: [{ id: "close", label: "Back", style: "primary" }],
        cta: { target: "parts", context: { reason: "garage" } },
      }).then(() => resolve(null));
      const body = $("modal-body");
      body.querySelectorAll<HTMLElement>("[data-car]").forEach((b) => (b.onclick = () => resolve({ car: b.dataset.car })));
      body.querySelectorAll<HTMLElement>("[data-real]").forEach((b) => (b.onclick = () => ctaHandler("marketplace", { query: CARS.find((c) => c.id === b.dataset.real).marketplace, reason: "garage_real_car" })));
      body.querySelectorAll<HTMLElement>("[data-up]").forEach((b) => (b.onclick = () => resolve({ up: b.dataset.up })));
      body.querySelectorAll<HTMLElement>("[data-kit]").forEach((b) => (b.onclick = () => resolve({ kit: b.dataset.kit })));
      body.querySelectorAll<HTMLElement>("[data-paint]").forEach((b) => (b.onclick = () => resolve({ paint: b.dataset.paint })));
    });
    if (!result) return;
    closeModal();
    if (result.paint) {
      setPaint(state, state.carId, result.paint);
      save(state);
      continue;
    }
    const r = result.car ? buyCar(state, result.car) : result.up ? buyUpgrade(state, result.up) : buyKit(state, result.kit);
    if (!r.ok) toast(state.coins < 0 ? "Your wallet is in the red. Cars and upgrades are locked until you clear it (Bank in the menu)." : `${r.reason}. The Bank in the menu can lend you money.`, { kind: "bad", ttl: 6000 });
    save(state);
  }
}

export async function openPassport(state) {
  const all = Object.entries(CITIES);
  await modal({
    art: "🛂",
    title: `Travel passport · ${state.stamps.length}/${all.length} cities`,
    body: `<div>${all.map(([id, c]) => `<span class="stamp ${state.stamps.includes(id) ? "" : "no"}">${state.stamps.includes(id) ? "📍" : "○"} ${esc(c.name)}</span>`).join("")}</div>
      <h2>Achievements</h2><div>${ACHIEVEMENT_LIST.map((a) => `<span class="stamp ${state.achievements.includes(a.id) ? "" : "no"}">${state.achievements.includes(a.id) ? "🏆" : "○"} ${esc(a.name)}</span>`).join("")}</div>
      <h2>Road stats</h2><div class="kv"><span>Distance</span><b>${Math.round(state.stats.km)} km</b><span>Potholes dodged / hit</span><b>${state.stats.potholesDodged} / ${state.stats.potholesHit}</b><span>Checkpoints cleared</span><b>${state.stats.checkpoints}</b><span>Hawker snacks bought</span><b>${state.stats.hawkerBuys}</b><span>Crashes</span><b>${state.stats.crashes}</b></div>`,
    actions: [{ id: "close", label: "Back", style: "primary" }],
  });
}

export async function openSettings(state, audio, onQuality, voice) {
  for (;;) {
    const id = await modal({
      art: "⚙️",
      title: "Settings",
      body: `<p>Graphics: <b>${state.settings.quality}</b>. Use <i>low</i> on older phones.</p>`,
      actions: [
        { id: "sound", label: `Sound: ${state.settings.sound ? "On" : "Off"}` },
        { id: "voice", label: `Voices: ${state.settings.voice !== false ? "On" : "Off"}`, hint: "hype men, police, roadside" },
        { id: "robot", label: `Robot voice for unrecorded lines: ${state.settings.robotVoice ? "On" : "Off"}`, hint: "preview lines before recordings exist" },
        { id: "difficulty", label: `Level: ${{ easy: "Easy", normal: "Normal", hard: "Naija Hard" }[state.settings.difficulty ?? "normal"]}`, hint: "harder = more traffic and fines, more pay" },
        { id: "quality", label: `Graphics: ${state.settings.quality}`, hint: "auto → low → medium → high" },
        { id: "reset", label: "Reset saved game", style: "ghost" },
        { id: "close", label: "Back", style: "primary" },
      ],
    });
    if (id === "close") return;
    if (id === "sound") {
      state.settings.sound = !state.settings.sound;
      audio.setEnabled(state.settings.sound);
    }
    if (id === "voice") state.settings.voice = state.settings.voice === false;
    if (id === "robot") {
      state.settings.robotVoice = !state.settings.robotVoice;
      if (voice) voice.tts = state.settings.robotVoice;
    }
    if (id === "difficulty") {
      const order = ["easy", "normal", "hard"];
      state.settings.difficulty = order[(order.indexOf(state.settings.difficulty ?? "normal") + 1) % 3];
    }
    voice?.setEnabled(state.settings.sound && state.settings.voice !== false);
    if (id === "quality") {
      const order = ["auto", "low", "medium", "high"];
      state.settings.quality = order[(order.indexOf(state.settings.quality) + 1) % order.length];
      onQuality();
    }
    if (id === "reset") {
      const sure = await modal({ art: "⚠️", title: "Reset everything?", body: "<p>Your wallet, cars, stamps and streak will be wiped.</p>", actions: [{ id: "yes", label: "Yes, start over", style: "warn" }, { id: "no", label: "Cancel" }] });
      if (sure === "yes") {
        localStorage.clear();
        location.reload();
      }
    }
    save(state);
  }
}

// ------------------------------------------------------------------ HUD

export function renderProgress(route, legIndex, legProgress) {
  const n = route.legs.length;
  const pct = ((legIndex + legProgress) / n) * 100;
  $("hud-progress-fill").style.width = `${pct}%`;
  const dots = $("hud-progress-dots");
  if (dots.dataset.route !== route.id) {
    dots.dataset.route = route.id;
    dots.innerHTML = routeCities(route).map((c, i) => `<i title="${CITIES[c].name}" style="left:${(i / n) * 100}%"></i>`).join("");
  }
  [...dots.children].forEach((d, i) => d.classList.toggle("done", i <= legIndex));
}

export function setBar(id, v) {
  const el = $(id);
  el.style.width = `${Math.max(0, Math.min(100, v))}%`;
  el.className = v < 25 ? "low" : v < 50 ? "mid" : "";
}
