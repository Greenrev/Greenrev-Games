import * as THREE from "three";
import { baseY, curveHeading, curveX, EMBANKMENT_MAX, groundY, hillY, lateralX, liftAt, ROAD_EDGE, SHOULDER, widen } from "../game/physics.ts";
import { rng } from "../game/rng.ts";
import * as M from "./models.ts";
import { toWorld } from "./world.ts";

const RHT = ROAD_EDGE + SHOULDER;
const CROSS_COLORS = ["#c9ced6", "#1d1f24", "#8b0000", "#f4f4f4", "#0b2545", "#e9c46a"];

/**
 * Builds the 3D set piece for one road feature (bridge, flyover, overpass, roundabout) into `parent`.
 * Returns animated extras: `movers` drive along cross roads, `bobbers` float on the river,
 * `waver` is the roundabout traffic warden.
 */
export function buildFeature(parent, f, biome) {
  const r = rng(Math.round(f.from));
  const out = { movers: [], bobbers: [], waver: null };
  const add = (mesh, z?: number) => {
    mesh.userData.z = z ?? f.to;
    parent.add(mesh);
    return mesh;
  };
  const at = (mesh, z, x, rot = 0) => {
    toWorld(z, x, 0, biome, mesh.position);
    mesh.rotation.y = curveHeading(z, x || 1) + rot;
    return add(mesh, Math.max(z, f.to));
  };
  const mid = (f.from + f.to) / 2;
  const heading = curveHeading(mid);
  const across = new THREE.Vector3(Math.cos(heading), 0, -Math.sin(heading)); // perpendicular to the road

  /** Cars driving across our road (under a flyover, over an overpass, along roundabout arms). */
  const crossTraffic = (centre, y, count, spread = 90, yAt?: (s: number) => number) => {
    for (let i = 0; i < count; i++) {
      const dir = i % 2 ? 1 : -1;
      const body = r.pick(["sedan", "suv", "danfo", "sedan", "keke"]);
      const mesh = add(M.vehicleMesh(body, r.pick(CROSS_COLORS)));
      out.movers.push({ mesh, centre: centre.clone().setY(y), dir, s: r.range(-spread, spread), lane: dir * 2.2, speed: r.range(9, 15), spread, heading, yAt });
    }
  };

  if (f.type === "bridge" || f.type === "flyover") {
    // deck, parapets and piers
    for (let z = f.from; z < f.to; z += 8) {
      const lift = liftAt(z);
      // flyover ramps below EMBANKMENT_MAX sit on earth (see world terrain); above it the deck is open
      const elevated = f.type === "bridge" || lift > EMBANKMENT_MAX - 0.3;
      if (elevated) at(M.deckSlab(RHT * 2), z + 4, 1e-6);
      if (elevated || f.type === "bridge") {
        at(M.parapet(), z + 4, RHT - 0.2);
        at(M.parapet(), z + 4, -(RHT - 0.2));
        if (f.type === "flyover") at(M.parapet(), z + 4, 0.15);
      }
      if (f.style === "truss") {
        at(M.trussPanel(), z + 4, RHT + 0.1);
        at(M.trussPanel(), z + 4, -(RHT + 0.1));
      }
    }
    for (let z = f.from + 12; z < f.to - 6; z += f.type === "bridge" ? 30 : 24) {
      const h = f.type === "bridge" ? hillY(z) - groundY(z) + 1 : liftAt(z);
      if (h > 1.5) at(M.pier(h + 0.6, RHT * 1.6), z, 1e-6);
    }
  }

  if (f.type === "bridge") {
    const len = f.to - f.from;
    const water = add(M.riverWater(len - 10));
    water.position.set(lateralX(mid, 0), baseY(mid) - f.depth * 0.55, mid);
    water.rotation.z = -heading; // plane is rotated onto XZ; spin it to follow the road
    if (f.style === "cable") {
      for (const z of [f.from + len * 0.3, f.from + len * 0.7]) at(M.pylon(70), z, 1e-6);
    }
    const canoes = f.style === "beam" ? 1 : 3;
    for (let i = 0; i < canoes; i++) {
      const c = add(M.canoe());
      const z = f.from + r.range(len * 0.2, len * 0.8);
      const side = r.chance(0.5) ? 1 : -1;
      c.position.set(lateralX(z, side * r.range(22, 90)), water.position.y + 0.05, z);
      c.rotation.y = r.range(0, Math.PI * 2);
      out.bobbers.push({ mesh: c, y: c.position.y, phase: r.range(0, 6) });
    }
    const label = f.style === "beam" ? f.name : `${f.name}`;
    at(M.textSign(label.toUpperCase(), { bg: "#1d4e89", sub: f.style === "beam" ? "Narrow bridge · No overtaking" : "River Niger · No stopping on the bridge" }), f.from - 110, ROAD_EDGE + 3);
  }

  if (f.type === "flyover") {
    at(M.textSign("FLYOVER AHEAD", { bg: "#0b6e4f", sub: `${f.name} · Keep left for the junction below` }), f.from - 150, ROAD_EDGE + 3);
    // the junction road under the deck, with its own traffic
    // (the land is levelled for this road in the world terrain, so it and its traffic sit on the ground)
    const road = add(M.sideRoad(150, 9));
    road.position.set(curveX(mid), groundY(mid) + 0.04, mid);
    road.rotation.y = heading;
    crossTraffic(road.position, groundY(mid) + 0.05, 5, 68);
    // roadside traders under the flyover, a Lagos classic
    for (let i = 0; i < 3; i++) {
      const k = add(M.kiosk(r.pick(["#e63946", "#1faa59", "#ffb703"])));
      const side = i % 2 ? 1 : -1;
      k.position.copy(road.position).addScaledVector(across, side * r.range(14, 26)).setY(groundY(mid));
      k.position.z += r.range(-8, 8);
      k.rotation.y = heading;
    }
  }

  if (f.type === "overpass") {
    // a bridge carrying a cross road over ours, with earth ramps down to the ground on both sides
    // (the land there is levelled, see junctionFlatten) so its traffic never drives off into the air
    const span = RHT * 2 + 10;
    const RAMP_LEN = 60, TOP = 8.25;
    const deck = at(M.overpass(span), mid, 1e-6);
    deck.position.x = curveX(mid);
    for (const side of [1, -1]) {
      const ramp = M.overpassRamp(RAMP_LEN, TOP);
      ramp.position.x = side * span / 2;
      ramp.rotation.y = side > 0 ? 0 : Math.PI;
      deck.add(ramp);
    }
    const half = span / 2;
    const yAt = (s: number) => (Math.abs(s) <= half ? TOP : TOP * Math.max(0, 1 - (Math.abs(s) - half) / RAMP_LEN)) + 0.05;
    crossTraffic(deck.position, deck.position.y, 3, half + RAMP_LEN - 3, yAt);
  }

  if (f.type === "roundabout") {
    // island follows the gap between the two carriageways
    const pts = [];
    for (let z = f.from; z <= f.to; z += 2) pts.push([lateralX(z, 0.5), z]);
    for (let z = f.to; z >= f.from; z -= 2) pts.push([lateralX(z, -0.5), z]);
    const island = add(M.roundaboutIsland(pts.map(([x, z]) => [x, z])));
    island.position.y = hillY(mid);
    // ShapeGeometry is built in world XZ (rotated onto the ground), so the group itself stays at the origin
    island.children[0].position.y = 0.16;
    // centre of the island is the road's centre line (lateralX(mid, 0) would add the swing and put
    // the monument and palms on our carriageway)
    const centre = new THREE.Vector3(curveX(mid), hillY(mid), mid);
    const monument = island.children[2];
    island.remove(monument);
    monument.position.copy(centre);
    add(monument);
    // palms stay well inside the island's kerb at their z
    for (const [sx, dz] of [[-1, -12], [1, -12], [-1, 12], [1, 12]]) {
      const inside = widen(mid + dz) + 0.5 - 2;
      if (inside < 1) continue;
      const p = add(M.palm(6));
      p.position.set(centre.x + sx * Math.min(3.6, inside), centre.y + 0.2, centre.z + dz);
    }
    // traffic warden in the middle, directing traffic
    const warden = add(M.person("police"));
    warden.position.set(centre.x + 3, centre.y + 0.25, centre.z - 6);
    warden.rotation.y = heading + Math.PI;
    out.waver = warden;
    // side arms joining the roundabout, with traffic waiting to enter
    // each arm starts at the outer edge of the carriageway (world distance RHT + swing from the centre)
    const edge = RHT + widen(mid);
    for (const side of [-1, 1]) {
      const len = 60;
      const arm = add(M.sideRoad(len, 8));
      arm.position.copy(centre).addScaledVector(across, side * (edge + 0.2 + len / 2)).setY(groundY(mid) + 0.04);
      arm.rotation.y = heading;
    }
    // cars queueing on each arm, waiting to enter (they don't drive through the island)
    for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
      const mesh = add(M.vehicleMesh(r.pick(["sedan", "danfo", "keke", "suv"]), r.pick(CROSS_COLORS)));
      const s = side * (edge + 5 + i * 7);
      out.movers.push({ mesh, centre: centre.clone().setY(groundY(mid) + 0.05), dir: -side, s, lane: side * 2.2, speed: 0, spread: 1e9, heading });
    }
    at(M.arrowSign("ROUNDABOUT AHEAD"), f.from - 160, ROAD_EDGE + 3);
    at(M.textSign(f.name.toUpperCase(), { bg: "#f1faee", fg: "#0b6e4f", w: 6, h: 1.4 }), f.from - 20, ROAD_EDGE + 3.5);
  }
  return out;
}

/** Animate cross traffic, canoes and the warden. Movers wrap around and skip the roundabout island. */
export function animateFeatures(state, dt, t) {
  for (const m of state.movers) {
    m.s += m.dir * m.speed * dt;
    if (m.s > m.spread) m.s = -m.spread;
    if (m.s < -m.spread) m.s = m.spread;
    const across = new THREE.Vector3(Math.cos(m.heading), 0, -Math.sin(m.heading));
    const along = new THREE.Vector3(Math.sin(m.heading), 0, Math.cos(m.heading));
    m.mesh.position.copy(m.centre).addScaledVector(across, m.s).addScaledVector(along, m.lane);
    if (m.yAt) m.mesh.position.y = m.centre.y + m.yAt(m.s); // follows the overpass deck and ramps
    m.mesh.rotation.y = m.heading + (m.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  }
  for (const b of state.bobbers) {
    b.mesh.position.y = b.y + Math.sin(t * 1.3 + b.phase) * 0.12;
    b.mesh.rotation.z = Math.sin(t * 1.1 + b.phase) * 0.05;
  }
  if (state.waver) {
    const arms = state.waver.userData.arms;
    arms[1].rotation.x = -1.5 + Math.sin(t * 3) * 0.5;
    arms[0].rotation.z = 0.2 + Math.sin(t * 2) * 0.3;
  }
}
