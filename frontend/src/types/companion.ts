export interface Phenotype {
    body_color_name: string;
    body_color_hex: string;
    eye_color_name: string;
    eye_color_hex: string;
    pattern: "solid" | "spots" | "stripes" | "patches" | "freckles";
    ear_shape: "round" | "pointy" | "floppy" | "tufted" | "small";
    tail_style: "long" | "short" | "fluffy" | "curly" | "stubby";
    size_modifier: number;
    temperament_seed: string;
    talent: string;
    fingerprint: number[];
    accent_color_hex: string;
    pattern_density: number;
}

export interface Companion {
    id: number;
    name: string;
    unique_code: string;
    species: string;
    birth_at: string;
    age_days: number;
    founder_number: number | null;
    is_founder: boolean;
    parent_username_at_birth: string;
    dna_seed: number;
    phenotype: Phenotype;
    archetype: string | null;
    is_in_coma: boolean;

    // Phase 3 additions (present on /me, optional on hatch response)
    hunger?: number;
    happiness?: number;
    energy?: number;
    hygiene?: number;
    immunity?: number;
    is_sick?: boolean;
    disease?: string;
    symptoms?: string[];
    severity?: number;
    hours_since_interaction?: number;
    traits?: Record<string, number>;
    archetype_locked?: string | null;
    archetype_locked_at?: string | null;
}

export interface ChatReply {
    reply: string;
    facts_learned: number;
    in_coma: boolean;
}

export interface MemoryEntry {
    fact_type: string;
    key: string;
    value: string;
    confidence: number;
}

export interface Certificate {
    name: string;
    unique_code: string;
    designation: string;
    species: string;
    birth_at: string;
    parent_username: string;
    founder_number: number | null;
    is_founder: boolean;
    phenotype: Phenotype;
    verification_hint: string;
    pledge_signature: string;
    pledge_signed_at: string | null;
}

export interface Session {
    authenticated: boolean;
    username?: string;
    has_companion?: boolean;
}
