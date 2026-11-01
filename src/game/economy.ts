/**
 * Money: what a trip earned and spent, going into the red, bank loans, and GreenRev credit packs.
 *
 * Rules
 * - Things you can't refuse (fines, tolls, levies, crash repairs on the road) are always paid, even
 *   if that takes your wallet below zero.
 * - Repairs and fuel can use an overdraft down to your overdraft limit.
 * - Cars, upgrades and other extras need real money in the wallet. If you're short, the bank offers
 *   a loan.
 * - Each finished leg charges interest on loans and on a negative wallet, and repays part of the
 *   loan from the trip pay automatically.
 */
import { level } from "./state.ts";

export const DIFFICULTY = {
  easy: { id: "easy", label: "Easy", traffic: 0.75, potholes: 0.6, fines: 0.7, damage: 0.7, pay: 0.8, events: 0.6, speed: 19 },
  normal: { id: "normal", label: "Normal", traffic: 1, potholes: 1, fines: 1, damage: 1, pay: 1, events: 1, speed: 21 },
  hard: { id: "hard", label: "Naija Hard", traffic: 1.25, potholes: 1.5, fines: 1.3, damage: 1.3, pay: 1.45, events: 1.5, speed: 23 },
};

export function difficulty(state) {
  return DIFFICULTY[state?.settings?.difficulty] ?? DIFFICULTY.normal;
}

// ------------------------------------------------------------------ trip ledger

/** Start the money record for a journey. */
export interface Ledger {
  routeId: string;
  startCoins: number;
  earned: Record<string, number>;
  spent: Record<string, number>;
}

export function startLedger(state, routeId: string): Ledger {
  state.ledger = { routeId, startCoins: Math.round(state.coins), earned: {}, spent: {} };
  return state.ledger;
}

function bump(book: Record<string, number>, category: string, amount: number) {
  book[category] = Math.round((book[category] ?? 0) + amount);
}

export function earn(state, amount, category = "other") {
  if (!(amount > 0)) return 0;
  state.coins += amount;
  if (state.ledger) bump(state.ledger.earned, category, amount);
  return amount;
}

export function overdraftLimit(state) {
  return Math.min(1_500_000, 150_000 + (level(state.xp ?? 0) - 1) * 50_000);
}

/** How much the bank will lend in total (grows as you finish legs cleanly). */
export function creditLimit(state) {
  const lv = level(state.xp ?? 0);
  const clean = state.stats?.cleanLegs ?? 0;
  return Math.min(8_000_000, 500_000 + lv * 250_000 + clean * 40_000);
}

/**
 * Pay for something.
 *   kind "must"      — fines, tolls, levies: always paid, can go below zero
 *   kind "overdraft" — repairs, fuel: may go below zero, down to the overdraft limit
 *   kind "cash"      — cars, upgrades, extras: needs the money in the wallet
 * Returns { ok, short, intoDebt }.
 */
export function charge(state, amount, category = "other", kind = "cash") {
  amount = Math.round(amount);
  if (!(amount > 0)) return { ok: true, short: 0, intoDebt: false };
  const after = state.coins - amount;
  if (kind === "cash" && after < 0) return { ok: false, short: -after, intoDebt: false };
  if (kind === "overdraft" && after < -overdraftLimit(state)) return { ok: false, short: -after - overdraftLimit(state), intoDebt: false };
  state.coins = after;
  if (state.ledger) bump(state.ledger.spent, category, amount);
  return { ok: true, short: 0, intoDebt: after < 0 };
}

export function tripSummary(state, seconds = 0) {
  const t: Ledger = state.ledger ?? { routeId: "", startCoins: state.coins, earned: {}, spent: {} };
  const earned = Object.values(t.earned).reduce((a, b) => a + b, 0);
  const spent = Object.values(t.spent).reduce((a, b) => a + b, 0);
  return { start: t.startCoins, end: Math.round(state.coins), earned, spent, net: earned - spent, earnedBy: { ...t.earned }, spentBy: { ...t.spent }, seconds };
}

// ------------------------------------------------------------------ bank

export const BANK_NAME = "Mama Bisi Microfinance"; // fictional lender

export function loanBalance(state) {
  return Math.round(state.loan?.balance ?? 0);
}

/** What the bank offers right now. Rate is interest per finished leg. */
export function loanOffers(state) {
  const room = creditLimit(state) - loanBalance(state);
  const offers = [
    { id: "small", amount: 300_000, rate: 0.03, label: "Quick loan" },
    { id: "medium", amount: 1_000_000, rate: 0.045, label: "Business loan" },
    { id: "large", amount: 3_000_000, rate: 0.06, label: "Big money loan" },
  ];
  return offers.map((o) => ({ ...o, available: o.amount <= room }));
}

export function takeLoan(state, offerId) {
  const o = loanOffers(state).find((x) => x.id === offerId);
  if (!o) return { ok: false, reason: "Unknown loan" };
  if (!o.available) return { ok: false, reason: `The bank says no. Your limit is ${creditLimit(state).toLocaleString("en-NG")}.` };
  const prev = state.loan;
  const balance = loanBalance(state) + o.amount;
  // blended rate if you top up an existing loan
  const rate = prev ? (prev.rate * prev.balance + o.rate * o.amount) / balance : o.rate;
  state.loan = { balance, rate: +rate.toFixed(4), takenOn: prev?.takenOn ?? new Date().toISOString().slice(0, 10) };
  state.coins += o.amount;
  if (state.ledger) bump(state.ledger.earned, "loan", o.amount);
  return { ok: true, amount: o.amount };
}

export function repayLoan(state, amount) {
  const bal = loanBalance(state);
  const pay = Math.round(Math.min(bal, amount, Math.max(0, state.coins)));
  if (pay <= 0) return 0;
  state.coins -= pay;
  state.loan.balance = bal - pay;
  if (state.loan.balance <= 0) state.loan = null;
  if (state.ledger) bump(state.ledger.spent, "loan repayment", pay);
  return pay;
}

/**
 * End of a leg: interest on the loan and on a negative wallet, then an automatic repayment of up to
 * a quarter of what the leg paid. Returns the lines for the arrival screen.
 */
export function settleLeg(state, legPay) {
  const out = { loanInterest: 0, overdraftFee: 0, autoRepaid: 0 };
  if (state.loan) {
    out.loanInterest = Math.round(state.loan.balance * state.loan.rate);
    state.loan.balance += out.loanInterest;
  }
  if (state.coins < 0) {
    out.overdraftFee = Math.round(-state.coins * 0.05);
    state.coins -= out.overdraftFee;
    if (state.ledger) bump(state.ledger.spent, "overdraft fee", out.overdraftFee);
  }
  if (state.loan && state.coins > 0) out.autoRepaid = repayLoan(state, Math.round(Math.max(0, legPay) * 0.25));
  return out;
}

/** Cars, upgrades and extras are locked while the wallet is in the red. */
export function inTheRed(state) {
  return state.coins < 0;
}

// ------------------------------------------------------------------ GreenRev credits (real money)

/**
 * Credit packs bought with real money add game naira to the wallet. They can never be cashed out.
 * The purchase itself runs in the GreenRev app or website (Paystack on the web; Apple/Google in-app
 * purchase inside the store apps), and the backend confirms it before the game grants anything.
 */
export const CREDIT_PACKS = [
  { id: "starter", price: 500, coins: 1_000_000, label: "Starter pack" },
  { id: "driver", price: 1_000, coins: 2_500_000, label: "Driver pack", tag: "Popular" },
  { id: "boss", price: 2_500, coins: 7_000_000, label: "Oga pack" },
  { id: "chairman", price: 5_000, coins: 16_000_000, label: "Chairman pack", tag: "Best value" },
];

/** Grant a confirmed purchase once (receipts are remembered so a retry never pays twice). */
export function grantCredits(state, packId, receiptId) {
  const pack = CREDIT_PACKS.find((p) => p.id === packId);
  if (!pack || !receiptId) return { ok: false };
  state.creditReceipts ??= [];
  if (state.creditReceipts.includes(receiptId)) return { ok: false, duplicate: true };
  state.creditReceipts.push(receiptId);
  state.coins += pack.coins;
  state.stats ??= {};
  state.stats.creditsBought = (state.stats.creditsBought ?? 0) + 1;
  return { ok: true, coins: pack.coins };
}
