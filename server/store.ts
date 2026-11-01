/**
 * Storage for the Roadtrip backend. Swap MemoryStore for your database (Postgres, Mongo, Redis…)
 * by implementing the same interface. Every method is async so a real database drops straight in.
 */
export interface Purchase {
  receipt: string;      // payment reference (Paystack reference, Apple/Google transaction id)
  player: string;       // the player's referral code (their stable in-game id)
  pack: string;         // credit pack id, see src/game/economy.ts CREDIT_PACKS
  amountKobo: number;
  provider: "paystack" | "apple" | "google";
  createdAt: string;
  claimed: boolean;     // handed to the game yet?
}

export interface FeaturedCar {
  id: string;
  dealer: string;
  city?: string;
  title: string;
  body: "limo" | "luxsuv" | "coupe";
  color: string;
  price?: number;
  listingUrl?: string;
  start?: string;
  end?: string;
}

export interface RoadtripStore {
  // featured dealer cars (paid placement)
  listFeatured(): Promise<FeaturedCar[]>;
  // referrals: a new player joined with someone's code
  recordJoin(code: string, newPlayer: string): Promise<boolean>; // false if this new player already joined
  unpaidJoins(code: string): Promise<number>;
  markJoinsPaid(code: string, count: number): Promise<void>;
  // credit purchases
  recordPurchase(p: Purchase): Promise<boolean>; // false if the receipt already exists
  unclaimedPurchases(player: string): Promise<Purchase[]>;
  markClaimed(receipts: string[]): Promise<void>;
  // cloud saves and GreenRev Points (per signed-in GreenRev user)
  getSave(userId: string): Promise<unknown | null>;
  putSave(userId: string, save: unknown): Promise<void>;
  getPoints(userId: string): Promise<number>;
  addPoints(userId: string, delta: number, reason: string): Promise<number>;
}

export class MemoryStore implements RoadtripStore {
  featured: FeaturedCar[] = [];
  joins = new Map<string, { newPlayer: string; paid: boolean }[]>();
  joinedPlayers = new Set<string>();
  purchases = new Map<string, Purchase>();
  saves = new Map<string, unknown>();
  points = new Map<string, number>();
  pointsLog: { userId: string; delta: number; reason: string; at: string }[] = [];

  async listFeatured() {
    return this.featured;
  }
  async recordJoin(code: string, newPlayer: string) {
    if (this.joinedPlayers.has(newPlayer) || code === newPlayer) return false;
    this.joinedPlayers.add(newPlayer);
    const list = this.joins.get(code) ?? [];
    list.push({ newPlayer, paid: false });
    this.joins.set(code, list);
    return true;
  }
  async unpaidJoins(code: string) {
    return (this.joins.get(code) ?? []).filter((j) => !j.paid).length;
  }
  async markJoinsPaid(code: string, count: number) {
    for (const j of (this.joins.get(code) ?? []).filter((x) => !x.paid).slice(0, count)) j.paid = true;
  }
  async recordPurchase(p: Purchase) {
    if (this.purchases.has(p.receipt)) return false;
    this.purchases.set(p.receipt, p);
    return true;
  }
  async unclaimedPurchases(player: string) {
    return [...this.purchases.values()].filter((p) => p.player === player && !p.claimed);
  }
  async markClaimed(receipts: string[]) {
    for (const r of receipts) {
      const p = this.purchases.get(r);
      if (p) p.claimed = true;
    }
  }
  async getSave(userId: string) {
    return this.saves.get(userId) ?? null;
  }
  async putSave(userId: string, save: unknown) {
    this.saves.set(userId, save);
  }
  async getPoints(userId: string) {
    return this.points.get(userId) ?? 0;
  }
  async addPoints(userId: string, delta: number, reason: string) {
    const next = Math.max(0, (this.points.get(userId) ?? 0) + delta);
    this.points.set(userId, next);
    this.pointsLog.push({ userId, delta, reason, at: new Date().toISOString() });
    return next;
  }
}
