import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { sound } from "../audio/Sounds";
import { ChatBox } from "../components/ChatBox";
import { ComaOverlay } from "../components/ComaOverlay";
import { Onboarding } from "../components/Onboarding";
import { TraitPanel } from "../components/TraitPanel";
import { Game } from "../game/Game";
import { useLiveCompanion } from "../store/useLiveCompanion";

export function GamePage() {
    const live = useLiveCompanion();
    const hostRef = useRef<HTMLDivElement | null>(null);
    const gameRef = useRef<Game | null>(null);
    const [archetypeRevealed, setArchetypeRevealed] = useState(false);
    const sickTimerRef = useRef<number | undefined>(undefined);

    // Mount the canvas exactly once per companion. Re-creating the
    // PixiJS app on every poll caused the room to reset every 7s.
    const companionId = live.state?.id ?? null;
    useEffect(() => {
        if (!hostRef.current || !companionId || !live.state) return;
        const g = new Game();
        gameRef.current = g;
        g.mount(hostRef.current, live.state.phenotype, live.state.name).catch((err) => {
            console.error("Game mount failed:", err);
        });
        return () => {
            g.unmount();
            if (gameRef.current === g) gameRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [companionId]);

    // Keep canvas state in sync with server. Idempotent and safe to
    // call before mount() finishes.
    useEffect(() => {
        if (!gameRef.current || !live.state) return;
        gameRef.current.applyServerState({
            hunger: live.state.hunger,
            happiness: live.state.happiness,
            energy: live.state.energy,
            hygiene: live.state.hygiene,
            is_sick: live.state.is_sick,
            is_in_coma: live.state.is_in_coma,
        });
    }, [live.state]);

    // While sick, sneeze on a timer.
    useEffect(() => {
        if (!live.state?.is_sick) {
            if (sickTimerRef.current !== undefined) {
                window.clearInterval(sickTimerRef.current);
                sickTimerRef.current = undefined;
            }
            return;
        }
        sickTimerRef.current = window.setInterval(() => {
            gameRef.current?.emitSneeze();
        }, 6000);
        return () => {
            if (sickTimerRef.current !== undefined) window.clearInterval(sickTimerRef.current);
        };
    }, [live.state?.is_sick]);

    // Detect archetype-just-locked moment for the reveal modal.
    useEffect(() => {
        if (!live.state?.archetype_locked) return;
        const lockedAt = live.state.archetype_locked_at;
        if (!lockedAt) return;
        const ageOfLock = Date.now() - new Date(lockedAt).getTime();
        // Show within first 5 minutes of locking.
        if (ageOfLock < 5 * 60 * 1000) setArchetypeRevealed(true);
    }, [live.state?.archetype_locked, live.state?.archetype_locked_at]);

    if (!live.state) {
        return (
            <main className="shell">
                <p className="muted">{live.error ?? "Loading your companion..."}</p>
            </main>
        );
    }

    const c = live.state;

    return (
        <main className="shell">
            <header className="row" style={{ justifyContent: "space-between", alignItems: "baseline", marginBottom: "1rem" }}>
                <div>
                    <h1>{c.name}</h1>
                    <p className="muted">
                        {c.unique_code} · {c.phenotype.temperament_seed} · age {c.age_days}d
                        {c.is_sick && <span style={{ color: "#7fcfa0" }}> · {c.disease}</span>}
                    </p>
                </div>
                <Link to="/app/certificate" className="btn btn-ghost">Certificate</Link>
            </header>

            <div className="game-viewport" ref={hostRef} />

            <div style={{ marginTop: "1rem" }}>
                <StatRow label="Hunger" value={c.hunger ?? 0} hue="#ff8a5b" />
                <StatRow label="Happy"  value={c.happiness ?? 0} hue="#ffd166" />
                <StatRow label="Energy" value={c.energy ?? 0} hue="#6dd3ff" />
                <StatRow label="Hygiene" value={c.hygiene ?? 0} hue="#a78bfa" />
            </div>

            <div className="game-controls">
                <ActionButton emoji="🍔" label="Feed"  onClick={() => { sound.unlock(); sound.eat(); live.feed(); }} />
                <ActionButton emoji="🎾" label="Play"  onClick={() => { sound.unlock(); sound.play(); live.play(); }} />
                <ActionButton emoji="💤" label="Sleep" onClick={() => { sound.unlock(); sound.sleep(); live.sleep(); }} />
                <ActionButton emoji="🤍" label="Pet"   onClick={() => { sound.unlock(); sound.pet(); live.pet(); }} />
                <ActionButton emoji="🛁" label="Wash"  onClick={() => { sound.unlock(); sound.nuzzle(); live.wash(); }} />
                <ActionButton emoji="✨" label="Heal"  onClick={() => { sound.unlock(); sound.heal(); live.heal(); }} disabled={!c.is_sick && !c.is_in_coma} />
            </div>

            <div style={{ marginTop: "1.4rem" }}>
                <ChatBox
                    onSend={live.chat}
                    onReply={(text) => gameRef.current?.say(text, 4500)}
                    disabled={c.is_in_coma}
                />
            </div>

            <div style={{ marginTop: "1.4rem" }}>
                <TraitPanel
                    traits={c.traits}
                    archetype={c.archetype}
                    archetypeLocked={c.archetype_locked}
                    ageDays={c.age_days}
                />
            </div>

            {c.is_in_coma && (
                <ComaOverlay
                    onComplete={async () => {
                        await live.revive();
                    }}
                />
            )}

            {archetypeRevealed && c.archetype_locked && (
                <ArchetypeReveal
                    archetype={c.archetype_locked}
                    name={c.name}
                    onClose={() => setArchetypeRevealed(false)}
                />
            )}

            {!c.is_in_coma && !archetypeRevealed && <Onboarding />}
        </main>
    );
}

function StatRow({ label, value, hue }: { label: string; value: number; hue: string }) {
    return (
        <div className="stat-row">
            <span>{label}</span>
            <div className="bar"><span style={{ width: `${value}%`, background: hue }} /></div>
            <strong>{value}</strong>
        </div>
    );
}

function ActionButton({ emoji, label, onClick, disabled }: {
    emoji: string; label: string; onClick: () => void; disabled?: boolean;
}) {
    return (
        <button className="action-tile" onClick={onClick} disabled={disabled} aria-label={label}>
            <span className="emoji">{emoji}</span><span className="label">{label}</span>
        </button>
    );
}

function ArchetypeReveal({ archetype, name, onClose }: {
    archetype: string; name: string; onClose: () => void;
}) {
    const human = archetype.split("_").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
    return (
        <div className="coma-overlay">
            <div className="coma-card center">
                <div style={{ fontSize: "3rem" }}>✨</div>
                <h2>{name} is grown.</h2>
                <p className="muted" style={{ marginBottom: "1rem" }}>14 days of care shaped a unique personality.</p>
                <p style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--gold)" }}>
                    {human}
                </p>
                <button className="btn" style={{ marginTop: "1.2rem" }} onClick={onClose}>
                    Continue
                </button>
            </div>
        </div>
    );
}
