/**
 * Top HUD strip that floats above the game canvas. Shows the
 * companion's portrait, name + level, four stat dots with ring fills,
 * and a coin pill. Stat values come from the live state hook.
 */
import { CompanionPortrait } from "./CompanionPortrait";
import type { Companion } from "../types/companion";

interface Props {
    companion: Companion;
}

const STAT_KEYS = [
    { key: "hunger" as const,    label: "Hunger",    color: "#ff8a5b", icon: "🍔" },
    { key: "happiness" as const, label: "Happiness", color: "#ffd166", icon: "😊" },
    { key: "energy" as const,    label: "Energy",    color: "#6dd3ff", icon: "⚡" },
    { key: "hygiene" as const,   label: "Hygiene",   color: "#a78bfa", icon: "🛁" },
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
                {STAT_KEYS.map(({ key, label, color, icon }) => {
                    const value = companion[key] ?? 0;
                    return (
                        <div key={key} className="hud-stat" title={`${label}: ${value}`}>
                            <Ring value={value} color={color} icon={icon} />
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
