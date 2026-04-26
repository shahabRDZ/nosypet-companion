/**
 * A deterministic mini-version of the backend's DNA derivation.
 * Used purely for marketing imagery on /, /login and /signup.
 *
 * Kept tiny on purpose: this is *not* a real companion, just a few
 * floating illustrations that hint at what the user will adopt.
 */
import type { Phenotype } from "../types/companion";

const BODY = [
    ["lavender", "#c8b2ff"],
    ["peach",    "#ffc7a8"],
    ["mint",     "#aef2cf"],
    ["sky",      "#a8d8ff"],
    ["rose",     "#ffb3d6"],
] as const;
const EYES = [
    ["amber",    "#ffb627"],
    ["sapphire", "#3b82f6"],
    ["rose",     "#f472b6"],
    ["emerald",  "#10b981"],
] as const;
const PATTERN: Phenotype["pattern"][] = ["solid", "spots", "stripes", "patches", "freckles"];
const EARS:    Phenotype["ear_shape"][] = ["round", "pointy", "floppy", "tufted", "small"];
const TAILS:   Phenotype["tail_style"][] = ["long", "short", "fluffy", "curly", "stubby"];

function lcg(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0x100000000;
    };
}

export function samplePhenotype(seed: number): Phenotype {
    const rng = lcg(seed);
    const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rng() * arr.length)];
    const [bn, bh] = pick(BODY);
    const [en, eh] = pick(EYES);
    const accent = `#${(0x800000 | Math.floor(rng() * 0x7fffff)).toString(16)}`;
    return {
        body_color_name: bn,
        body_color_hex: bh,
        eye_color_name: en,
        eye_color_hex: eh,
        pattern: pick(PATTERN),
        ear_shape: pick(EARS),
        tail_style: pick(TAILS),
        size_modifier: 0.95 + rng() * 0.15,
        temperament_seed: "demo",
        talent: "demo",
        fingerprint: Array.from({ length: 64 }, () => rng()),
        accent_color_hex: accent,
        pattern_density: 0.4 + rng() * 0.4,
    };
}
