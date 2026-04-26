/**
 * Top HUD strip that floats above the game canvas. Shows the
 * companion's portrait, name + level, and a row of stat rings.
 * Bladder fills as pressure builds (red when urgent).
 */
import { CompanionPortrait } from "./CompanionPortrait";
import type { Companion } from "../types/companion";

interface Props {
    companion: Companion;
}

interface StatDef {
    key: "hunger" | "happiness" | "energy" | "hygiene" | "bladder";
    label: string;
    color: string;
    icon: string;
    invert?: boolean;
}

const STAT_KEYS: StatDef[] = [
    { key: "hunger",    label: "Hunger",    color: "#ff8a5b", icon: "🍔" },
    { key: "happiness", label: "Happiness", color: "#ffd166", icon: "😊" },
    { key: "energy",    label: "Energy",    color: "#6dd3ff", icon: "⚡" },
    { key: "hygiene",   label: "Hygiene",   color: "#a78bfa", icon: "🛁" },
    { key: "bladder",   label: "Bladder",   color: "#7fcfa0", icon: "💧", invert: true },
];

export function GameHUD({ companion }: Props) {
    return (
        <header className="game-hud">
            <div className="hud-id">
                <div className="hud-portrait">
                    <CompanionPortrait phenotype={companion.phenotype} size={48} />
                </div>
                <div className="hud-id-text">
                    <strong>{companion.name}</strong>
                    <span className="muted">
                        Lv {companion.level ?? 1}
                        {companion.archetype_locked && ` · ${humanize(companion.archetype_locked)}`}
                    </span>
                </div>
            </div>

            <div className="hud-stats" role="group" aria-label="Vital stats">
                {STAT_KEYS.map(({ key, label, color, icon, invert }) => {
                    const raw = companion[key] ?? 0;
                    // For inverted stats (bladder), the *fill* tracks
                    // the raw value (so a full bladder shows a full
                    // ring), and we shift the colour to red when urgent.
                    const fill = invert ? raw : raw;
                    const ringColor = invert
                        ? raw >= 70 ? "#ef4444" : raw >= 40 ? "#ffae3a" : color
                        : color;
                    return (
                        <div key={key} className="hud-stat" title={`${label}: ${raw}`}>
                            <Ring value={fill} color={ringColor} icon={icon} />
                        </div>
                    );
                })}
            </div>
        </header>
    );
}

function Ring({ value, color, icon }: { value: number; color: string; icon: string }) {
    const r = 18;
    const c = 2 * Math.PI * r;
    const offset = c * (1 - Math.max(0, Math.min(1, value / 100)));
    return (
        <div className="hud-ring" style={{ "--ring-color": color } as React.CSSProperties}>
            <svg viewBox="0 0 44 44" width={44} height={44} aria-hidden="true">
                <circle cx={22} cy={22} r={r} stroke="rgba(255,255,255,0.12)" strokeWidth={3} fill="none" />
                <circle
                    cx={22} cy={22} r={r}
                    stroke={color} strokeWidth={3} fill="none" strokeLinecap="round"
                    strokeDasharray={c} strokeDashoffset={offset}
                    transform="rotate(-90 22 22)"
                />
            </svg>
            <span className="hud-ring-icon" aria-hidden="true">{icon}</span>
        </div>
    );
}

function humanize(s: string): string {
    return s.split("_").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
}
