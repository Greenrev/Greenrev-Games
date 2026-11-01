import * as THREE from "three";
import { curveHeading, laneX, MEDIAN_HALF, LANE_WIDTH } from "../game/physics.ts";
import { rng } from "../game/rng.ts";
import { toWorld } from "./world.ts";
import { flashPatrol, patrolCar, vehicleMesh, VEHICLE_SIZE } from "./models.ts";

// Bright, varied paint so traffic reads clearly on small screens (plus the usual silver, white and black).
const CAR_COLORS = [
  "#d7dce3", "#f7f7f5", "#1d1f24", "#c1121f", "#e63946", "#1d4ed8", "#0ea5e9", "#1faa59",
  "#f59e0b", "#ffd60a", "#f97316", "#7c3aed", "#db2777", "#14b8a6", "#b08968", "#9ca3af",
];

/** What drives on which roads. Weights per body type. */
function mixFor(region) {
  switch (region) {
    case "lagos": return { sedan: 30, suv: 14, danfo: 24, keke: 8, bus: 6, truck: 8, tanker: 4, okada: 6 };
    case "south": return { sedan: 32, suv: 16, danfo: 8, keke: 6, bus: 12, truck: 12, tanker: 6, okada: 8 };
    case "north": return { sedan: 26, suv: 14, pickup: 10, bus: 12, truck: 16, tanker: 6, okada: 16 };
    default: return { sedan: 32, suv: 16, pickup: 8, bus: 12, truck: 14, tanker: 6, okada: 12 };
  }
}

function weighted(r, mix) {
  const total = (Object.values(mix) as number[]).reduce((a, b) => a + b, 0);
  let roll = r.next() * total;
  for (const [k, w] of Object.entries(mix) as [string, number][]) if ((roll -= w) <= 0) return k;
  return "sedan";
}

const CRUISE = { sedan: 29, suv: 30, pickup: 27, danfo: 25, keke: 13, bus: 27, truck: 19, tanker: 18, okada: 17, limo: 36, luxsuv: 36, coupe: 40 };

/** Hard braking for a driver who sees the player stopped ahead (stronger than normal following). */
const EMERGENCY_BRAKE = 18;

export class Traffic {
  cars: any;
  closures: any;
  density: any;
  obstacles: any;
  r: any;
  rearHits: any;
  region: any;
  scene: any;
  slowZones: any;

  constructor(scene) {
    this.scene = scene;
    this.cars = [];
    this.r = rng(99);
    this.region = "south";
    this.density = 0.6;
    this.slowZones = []; // [{ from, to, speed }] go-slows and checkpoints, in route z
    this.rearHits = [];  // cars that ran into the player from behind this frame: [{ car, closing }]
    this.obstacles = []; // people and animals on the road this frame: [{ z, x }] (traffic stops for them)
    this.closures = [];  // lanes closed by road works: [{ from, to, lane }]
  }

  /**
   * A police or FRSC patrol pickup. Same direction: it cruises in the slow lane below the speed limit,
   * so the player catches up with it. Oncoming: it just passes on the other carriageway.
   */
  spawnPatrol(kind: "police" | "frsc", player, oncoming = false) {
    const z = oncoming ? player.z + 520 : player.z + 200;
    const lane = 1;
    if (!oncoming && this.cars.some((c) => c.dir > 0 && Math.abs(c.z - z) < 30 && Math.abs(c.x - laneX(lane)) < 2.4)) return null;
    const car = this.spawn(z, oncoming ? -1 : 1, lane, "pickup");
    this.scene.remove(car.mesh);
    car.mesh = patrolCar(kind);
    this.scene.add(car.mesh);
    car.patrol = kind;
    car.cruise = oncoming ? 24 : 21; // about 75 km/h: below the 100 km/h limit
    car.speed = car.cruise;
    car.laneTimer = 1e9; // patrols keep their lane
    return car;
  }

  /** The lane closed by road works at z, if any. */
  closedLane(z) {
    const c = this.closures.find((k) => z >= k.from && z <= k.to);
    return c ? c.lane : null;
  }

  /**
   * A "one-way" driver: comes at the player in their own lane, flashing and honking. Returns the car,
   * or null if the lane ahead isn't clear enough to stage it fairly.
   */
  spawnWrongWay(player) {
    const lane = player.x > laneX(0.5) ? 1 : 0;
    const z = player.z + 230;
    // only its own spot needs to be clear; it swerves round anything else on the way
    if (this.cars.some((c) => c.dir > 0 && Math.abs(c.z - z) < 30 && Math.abs(c.x - laneX(lane)) < 2.4)) return null;
    const car = this.spawn(z, 1, lane, this.r.pick(["sedan", "suv", "danfo"]));
    car.wrongWay = true;
    car.speed = 17;
    car.cruise = 17;
    car.horn = 1;
    return car;
  }

  setRegion(region, density) {
    this.region = region;
    this.density = density;
  }

  spawn(z: number, dir: number, lane?: number, forcedBody?: string, forcedColor?: string) {
    const body = forcedBody ?? weighted(this.r, mixFor(this.region));
    const color = forcedColor ?? this.r.pick(CAR_COLORS);
    const mesh = vehicleMesh(body, body === "truck" ? this.r.pick(["#b23a48", "#1d4e89", "#f1faee"]) : color);
    const size = VEHICLE_SIZE[body];
    // Slow vehicles keep left (lane 1 is the slow lane); okadas and kekes hug the shoulder.
    let laneSel = lane ?? (body === "okada" || body === "keke" ? 1.25 : ["truck", "tanker", "bus"].includes(body) ? (this.r.chance(0.8) ? 1 : 0) : this.r.chance(0.5) ? 0 : 1);
    // never appear inside road works in the closed lane
    if (dir > 0) {
      const closed = this.closedLane(z) ?? this.closedLane(z + 50);
      if (closed !== null && Math.round(laneSel) === closed) laneSel = closed === 0 ? 1 : 0;
    }
    const car = {
      body, mesh, dir, z, lane: laneSel, x: laneX(laneSel) * dir, ...size,
      cruise: CRUISE[body] * this.r.range(0.85, 1.12), speed: CRUISE[body] * 0.8, laneTimer: this.r.range(3, 12),
      aggressive: body === "danfo" || (body === "okada" && this.r.chance(0.5)),
      horn: 0, overtakeCheck: 0,
    };
    this.scene.add(mesh);
    this.cars.push(car);
    return car;
  }

  /**
   * A featured dealer car appears ahead of the player in the clearer lane, driving a little slower,
   * so the player catches up and passes right beside it: always in view, never stuck behind.
   */
  spawnFeatured(entry, player) {
    const busy = (lane: number) => this.cars.filter((c) => c.dir > 0 && c.z > player.z && c.z < player.z + 220 && Math.abs(c.x - laneX(lane)) < 2.4).length;
    const mine = player.x > laneX(0.5) ? 1 : 0;
    const other = mine === 0 ? 1 : 0;
    const lane = busy(other) <= busy(mine) ? other : mine;
    for (const z of [player.z + 150, player.z + 120, player.z + 180]) {
      if (this.cars.some((c) => c.dir > 0 && Math.abs(c.z - z) < 25 && Math.abs(c.x - laneX(lane)) < 2.4)) continue;
      const car = this.spawn(z, 1, lane, entry.body, entry.color);
      car.featured = entry;
      car.cruise = Math.max(11, Math.min(28, player.speed * 0.75));
      car.speed = car.cruise;
      car.laneTimer = 1e9; // keeps its lane so the player can pass it
      return car;
    }
    return null;
  }

  clear() {
    for (const c of this.cars) this.scene.remove(c.mesh);
    this.cars = [];
    this.rearHits = [];
  }

  /** Is the other lane free around this car? Counts the player too, so nobody swerves into them. */
  laneClear(c, lane, player, ahead = 16, behind = 12) {
    if (this.closedLane(c.z) === lane || this.closedLane(c.z + 40) === lane) return false;
    const x = laneX(lane);
    const blocks = (o) => o !== c && (o.dir ?? 1) > 0 && Math.abs(o.x - x) < (o.width + c.width) / 2 + 0.4 && o.z - c.z < ahead + (o.length + c.length) / 2 && c.z - o.z < behind + (o.length + c.length) / 2;
    return !this.cars.some(blocks) && !(player && blocks(player));
  }

  /** Keep a population around the player: more in go-slows, fewer on empty northern roads. */
  maintain(playerZ, jam) {
    const ourTarget = Math.round(6 + this.density * 12 + (jam ? 14 : 0));
    const oncomingTarget = Math.round(4 + this.density * 8);
    const ours = this.cars.filter((c) => c.dir > 0);
    const theirs = this.cars.filter((c) => c.dir < 0);
    for (let i = ours.length; i < ourTarget; i++) {
      const ahead = this.r.chance(jam ? 0.85 : 0.75);
      const z = ahead ? playerZ + this.r.range(60, 520) : playerZ - this.r.range(45, 140);
      if (this.cars.some((c) => c.dir > 0 && Math.abs(c.z - z) < 14)) continue;
      if (this.nearObstacle(z)) continue; // never drop a car on top of a herd
      this.spawn(z, 1);
    }
    for (let i = theirs.length; i < oncomingTarget; i++) {
      const z = playerZ + this.r.range(200, 700);
      if (!this.nearObstacle(z)) this.spawn(z, -1, this.r.chance(0.5) ? 0 : 1);
    }
  }

  nearObstacle(z: number) {
    return this.obstacles.some((o) => Math.abs(o.z - z) < 30);
  }

  slowLimit(z) {
    let limit = Infinity;
    for (const s of this.slowZones) if (z > s.from && z < s.to) limit = Math.min(limit, s.speed);
    return limit;
  }

  update(dt, playerZ, biome, player) {
    this.rearHits = [];
    const roadHalf = MEDIAN_HALF + LANE_WIDTH * 2 + 1.5;
    for (const c of this.cars) {
      if (c.wrongWay) {
        // drives against traffic: looks well ahead, swerves into a clear lane (never into the player),
        // otherwise brakes and waits for the cars coming at it to stop
        const blocking = (lane) => {
          const x = laneX(lane);
          const car = this.cars.some((o) => o !== c && o.dir > 0 && !o.wrongWay && o.z < c.z + 6 && c.z - o.z < 45 && Math.abs(o.x - x) < 2.4);
          const you = player && player.z < c.z + 6 && c.z - player.z < 45 && Math.abs(player.x - x) < 2.4;
          return car || you;
        };
        const mine = Math.round(c.lane);
        if (blocking(mine)) {
          const other = mine === 0 ? 1 : 0;
          if (!blocking(other)) c.lane = other;
          else c.speed = Math.max(0, c.speed - EMERGENCY_BRAKE * dt);
        } else c.speed = Math.min(c.cruise, c.speed + 3 * dt);
        c.z -= c.speed * dt;
        c.x += THREE.MathUtils.clamp(laneX(c.lane) - c.x, -3.2 * dt, 3.2 * dt);
        toWorld(c.z, c.x, 0, biome, c.mesh.position);
        c.mesh.rotation.y = curveHeading(c.z, c.x) + Math.PI;
        continue;
      }
      if (c.patrol) flashPatrol(c.mesh, performance.now() / 1000, !!c.chasing);
      if (c.chasing && player) {
        // siren on: follow the player at a safe distance, matching their lane; traffic makes way
        const lane = player.x > laneX(0.5) ? 1 : 0;
        if (Math.round(c.lane) !== lane && this.laneClear(c, lane, null, 10, 8)) c.lane = lane; // only into a clear lane
        let target = Math.max(0, player.speed + (player.z - 14 - c.z) * 0.9);
        for (const o of this.cars) {
          if (o === c || o.dir < 0) continue;
          const dz = o.z - c.z;
          if (dz > 0 && dz < 30 && Math.abs(o.x - c.x) < 2.4) target = Math.min(target, Math.max(0, o.speed + (dz - (o.length + c.length) / 2 - 5) * 0.8));
        }
        c.speed += THREE.MathUtils.clamp(target - c.speed, -EMERGENCY_BRAKE * dt, 6 * dt);
        c.speed = Math.min(Math.max(0, c.speed), 48);
        c.z += c.speed * dt;
        c.x += THREE.MathUtils.clamp(laneX(c.lane) - c.x, -3 * dt, 3 * dt);
        const minGap = (c.length + player.length) / 2 + 1;
        if (c.z > player.z - minGap && Math.abs(c.x - player.x) < 2.4) c.z = player.z - minGap; // never into the player
        for (const o of this.cars) {
          if (o === c || o.dir < 0 || o.wrongWay || o.z <= c.z) continue;
          const gap = (o.length + c.length) / 2 + 0.3;
          if (o.z - c.z < gap && Math.abs(o.x - c.x) < (o.width + c.width) / 2) {
            c.z = o.z - gap;
            c.speed = Math.min(c.speed, o.speed);
          }
        }
        toWorld(c.z, c.x, 0, biome, c.mesh.position);
        c.mesh.rotation.y = curveHeading(c.z, c.x);
        continue;
      }
      if (c.dir > 0) {
        // a patrol with its siren on close behind in our lane: move over if the other lane is clear
        const siren = this.cars.find((o) => o.chasing && o.z < c.z && c.z - o.z < 45 && Math.abs(o.x - c.x) < 2.4);
        if (siren && c.overtakeCheck <= 0) {
          c.overtakeCheck = 0.5;
          const other = Math.round(c.lane) === 0 ? 1 : 0;
          if (this.laneClear(c, other, player, 10, 8)) c.lane = other;
        }
        // car following: slow for whoever is ahead in the same lane (including the player)
        let gapSpeed = c.cruise;
        let wrongWayAhead = false;
        for (const o of this.cars) {
          if (o === c || o.dir < 0) continue;
          const dz = o.z - c.z;
          if (dz > 0 && dz < (o.wrongWay ? 140 : 45) && Math.abs(o.x - c.x) < 2.6) {
            const gap = dz - (o.length + c.length) / 2;
            // a car coming the wrong way: stop well short of it
            gapSpeed = Math.min(gapSpeed, Math.max(0, (o.wrongWay ? 0 : o.speed) + (gap - (o.wrongWay ? 18 : 6)) * 0.8));
            if (o.wrongWay) wrongWayAhead = true;
          }
        }
        let decel = wrongWayAhead ? EMERGENCY_BRAKE : 9;
        // goats, cows, herders and people on the road: stop before them
        for (const ob of this.obstacles) {
          const dz = ob.z - c.z;
          // the whole herd counts, including animals about to step onto the road
          if (dz > 0 && dz < 70 && Math.abs(ob.x) < roadHalf + 12) {
            const gap = dz - c.length / 2 - 3;
            gapSpeed = Math.min(gapSpeed, Math.max(0, gap * 0.6));
            if (gap < 22) decel = EMERGENCY_BRAKE;
          }
        }
        // road works ahead in our lane: merge out, or stop at the cones if the other lane is busy
        // already inside the works in the closed lane (e.g. it was cut off): merge out now
        const here = this.closedLane(c.z);
        if (here !== null && Math.round(c.lane) === here) c.lane = here === 0 ? 1 : 0;
        const closed = this.closedLane(c.z + 45);
        if (closed !== null && Math.round(c.lane) === closed) {
          const other = closed === 0 ? 1 : 0;
          if (this.laneClear(c, other, player, 12, 10)) c.lane = other;
          else {
            const start = this.closures.find((k) => k.lane === closed && k.from > c.z);
            if (start) gapSpeed = Math.min(gapSpeed, Math.max(0, (start.from - c.z - c.length / 2 - 3) * 0.6));
          }
        }
        // the player ahead in our lane: keep a safe gap, brake hard if they stop, or go round them
        if (player) {
          const dzP = player.z - c.z;
          const sameLane = Math.abs(player.x - c.x) < (player.width + c.width) / 2 + 0.5;
          if (dzP > 0 && dzP < 60 && sameLane) {
            const gap = dzP - (player.length + c.length) / 2;
            gapSpeed = Math.min(gapSpeed, Math.max(0, player.speed + (gap - 8) * 0.7));
            if (gap < 18 && c.speed > player.speed) decel = EMERGENCY_BRAKE;
            const blocked = c.speed - player.speed > 2 || player.speed < c.cruise * 0.7;
            if (blocked && gap < 30 && c.body !== "okada" && c.body !== "keke" && c.overtakeCheck <= 0) {
              c.overtakeCheck = 0.6;
              const other = c.lane < 0.5 ? 1 : 0;
              if (this.laneClear(c, other, player)) c.lane = other;
            }
          }
        }
        c.overtakeCheck = (c.overtakeCheck ?? 0) - dt;
        let target = Math.min(gapSpeed, this.slowLimit(c.z));
        // stop-and-go rhythm inside jams
        if (this.slowLimit(c.z) < 6) target *= 0.5 + 0.5 * Math.max(0, Math.sin(performance.now() / 1800 + c.z));
        c.speed += THREE.MathUtils.clamp(target - c.speed, -decel * dt, 3.5 * dt);
        c.speed = Math.max(0, c.speed);
        c.z += c.speed * dt;
        // lane changes; danfos cut in without much warning, but never into the player
        c.laneTimer -= dt;
        if (c.laneTimer < 0 && c.body !== "okada" && c.body !== "keke") {
          c.laneTimer = this.r.range(c.aggressive ? 2 : 6, c.aggressive ? 6 : 16);
          if (gapSpeed < c.cruise * 0.8 || c.aggressive) {
            const nl = c.lane < 0.5 ? 1 : 0;
            if (this.laneClear(c, nl, player, c.aggressive ? 9 : 16, c.aggressive ? 6 : 12)) c.lane = nl;
          }
        }
        c.x += THREE.MathUtils.clamp(laneX(c.lane) - c.x, -2.2 * dt, 2.2 * dt);
        // Nobody drives through the car ahead of them either. Same lane: stop at its bumper.
        // Half-way through a lane change beside it: ease off and steer back to the old lane
        // (no jumping backwards).
        for (const o of this.cars) {
          if (o === c || o.dir < 0 || o.wrongWay || o.z <= c.z) continue;
          const minGap = (o.length + c.length) / 2 + 0.3;
          if (o.z - c.z < minGap && Math.abs(o.x - c.x) < (o.width + c.width) / 2) {
            c.speed = Math.min(c.speed, o.speed * 0.9);
            if (Math.abs(o.x - c.x) < 1.2) c.z = o.z - minGap;
            else c.lane = Math.abs(laneX(0) - c.x) < Math.abs(laneX(1) - c.x) ? 0 : 1;
          }
        }
        // Nobody drives through the player. A car that still reaches them from behind stops at their
        // bumper, and the game is told about the knock (it's the other driver's fault, not yours).
        if (player && c.z < player.z && Math.abs(c.z - player.z) < (c.length + player.length) / 2 && Math.abs(c.x - player.x) < (c.width + player.width) / 2) {
          const closing = c.speed - player.speed;
          c.z = player.z - (c.length + player.length) / 2 - 0.05;
          c.speed = Math.min(c.speed, player.speed);
          if (closing > 2) this.rearHits.push({ car: c, closing });
        }
      } else {
        // oncoming traffic also stops for animals and people crossing on its side
        let target = c.cruise;
        for (const ob of this.obstacles) {
          const dz = c.z - ob.z;
          if (dz > 0 && dz < 70 && Math.abs(ob.x) < roadHalf + 12) target = Math.min(target, Math.max(0, (dz - c.length / 2 - 3) * 0.6));
        }
        c.speed += THREE.MathUtils.clamp(target - c.speed, -EMERGENCY_BRAKE * dt, 3.5 * dt);
        c.speed = Math.max(0, c.speed);
        c.z -= c.speed * dt;
        c.x = -(MEDIAN_HALF + LANE_WIDTH * (c.lane + 0.5));
      }
      toWorld(c.z, c.x, 0, biome, c.mesh.position);
      c.mesh.rotation.y = curveHeading(c.z, c.x) + (c.dir < 0 ? Math.PI : 0) + (c.dir > 0 ? (laneX(c.lane) - c.x) * -0.04 : 0);
    }
    // recycle far-away cars
    this.cars = this.cars.filter((c) => {
      const keep = c.z > playerZ - 180 && c.z < playerZ + 800;
      if (!keep) this.scene.remove(c.mesh);
      return keep;
    });
  }
}
