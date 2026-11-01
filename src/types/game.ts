/** Shared data shapes for routes, legs and road features. */
export type Biome = "south" | "savanna" | "sahel" | "plateau";

export interface Security {
  police: number;
  military: number;
  frsc: number;
  vio: number;
}

export interface Leg {
  from: string;
  to: string;
  km: number;
  road: string;
  biome: Biome;
  quality: number;   // 0 crater-filled .. 1 fresh asphalt
  traffic: number;   // 0 .. 1
  security: Security;
  goSlowAtStart?: boolean;
  goSlowAtEnd?: boolean;
  bridge?: string;
  toll?: boolean;
}

export interface Route {
  id: string;
  name: string;
  tagline: string;
  color: string;
  unlockedBy: string | null;
  legs: Leg[];
}

export interface City {
  name: string;
  state: string;
  food: string;
  fact: string;
  landmark: string;
}

/** A button in a modal dialog. */
export interface ModalAction {
  id: string;
  label: string;
  hint?: string;
  style?: string;
  disabled?: boolean;
  keepOpen?: boolean;
  onClick?: () => void;
}

/** Context sent with GreenRev links and analytics. */
export type LinkContext = Record<string, any>;
