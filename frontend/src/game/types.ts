import type { Phenotype } from "../types/companion";

export interface RoomBounds {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

export type ActionName =
    | "idle"
    | "walk"
    | "sit"
    | "yawn"
    | "fart"
    | "sneeze"
    | "scratch"
    | "look_at_camera"
    | "chase_tail"
    | "sleep"
    | "eat"
    | "play_with_toy"
    | "wash"
    | "shake";

export interface CreatureState {
    phenotype: Phenotype;
    name: string;
    hunger: number;        // 0-100, higher = full
    happiness: number;
    energy: number;
    hygiene: number;
    sick: boolean;
    inComa: boolean;
}
