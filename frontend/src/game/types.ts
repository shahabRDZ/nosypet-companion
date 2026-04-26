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
    | "shake"
    | "beg"           // sit + look at camera + paws up
    | "potty_dance"   // squirming, holding
    | "cry"           // sad face + fake tears
    | "flinch";       // brief recoil after a scold

export interface CreatureState {
    phenotype: Phenotype;
    name: string;
    hunger: number;        // 0-100, higher = full
    happiness: number;
    energy: number;
    hygiene: number;
    bladder: number;       // 0-100, higher = needs to go
    sick: boolean;
    inComa: boolean;
    sleeping: boolean;
}
