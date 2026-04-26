import { type FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { sound } from "../audio/Sounds";
import { ActionDock, type Action } from "../components/ActionDock";
import { ComaOverlay } from "../components/ComaOverlay";
import { GameHUD } from "../components/GameHUD";
import { Onboarding } from "../components/Onboarding";
import { SceneNavigator } from "../components/SceneNavigator";
import { TraitPanel } from "../components/TraitPanel";
import { Game } from "../game/Game";
import { useLiveCompanion } from "../store/useLiveCompanion";

export function GamePage() {
    const live = useLiveCompanion();
    const hostRef = useRef<HTMLDivElement | null>(null);
    const gameRef = useRef<Game | null>(null);
    const [archetypeRevealed, setArchetypeRevealed] = useState(false);
    const [chatValue, setChatValue] = useState("");
    const [chatBusy, setChatBusy] = useState(false);
    const [scene, setScene] = useState<string>("bedroom");
    const sickTimerRef = useRef<number | undefined>(undefined);

    // Poll the active scene from Game so the SceneNavigator stays in sync.
    useEffect(() => {
        const id = window.setInterval(() => {
            const s = gameRef.current?.getCurrentScene();
            if (s && s !== scene) setScene(s);
        }, 250);
        return () => window.clearInterval(id);
    }, [scene]);

    const companionId = live.state?.id ?? null;
    useEffect(() => {
        if (!hostRef.current || !companionId || !live.state) return;
        const g = new Game();
        gameRef.current = g;
        g.mount(hostRef.current, live.state.phenotype, live.state.name).catch((err) => {
            console.error("Game mount failed:", err);
        });

        // Gesture routing: tap wakes a sleeping pet, otherwise pets.
        g.onTap = () => {
            const c = live.state;
            if (c?.is_sleeping) {
                void live.wake();
                g.wakeUp();
            } else {
                g.pet();
                void live.pet();
            }
        };
        // Long-press = strong pet (counts as pet, more affection).
        g.onLongPress = () => {
            if (live.state?.is_sleeping) return;
            g.pet();
            void live.pet();
        };
        // Hard swipe-down = scold (discipline +, affection -).
        g.onSwipeDown = () => {
            if (live.state?.is_sleeping) return;
            g.scold();
            void live.scold();
        };

        return () => {
            g.unmount();
            if (gameRef.current === g) gameRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [companionId]);

    useEffect(() => {
        if (!gameRef.current || !live.state) return;
        gameRef.current.applyServerState({
            hunger: live.state.hunger,
            happiness: live.state.happiness,
            energy: live.state.energy,
            hygiene: live.state.hygiene,
            bladder: live.state.bladder,
            is_sick: live.state.is_sick,
            is_in_coma: live.state.is_in_coma,
            is_sleeping: live.state.is_sleeping,
        });
    }, [live.state]);

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

    useEffect(() => {
        if (!live.state?.archetype_locked) return;
        const lockedAt = live.state.archetype_locked_at;
        if (!lockedAt) return;
        const ageOfLock = Date.now() - new Date(lockedAt).getTime();
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
    const needsHeal = !c.is_alive || (c.hunger ?? 100) < 20 || (c.happiness ?? 100) < 20 || (c.energy ?? 100) < 20;

    async function sendChat(e: FormEvent) {
        e.preventDefault();
        const message = chatValue.trim();
        if (!message || chatBusy) return;
        setChatBusy(true);
        setChatValue("");
        try {
            const r = await live.chat(message);
            gameRef.current?.say(r.reply, 4500);
        } finally {
            setChatBusy(false);
        }
    }

    const sleeping = !!c.is_sleeping;
    const bladder = c.bladder ?? 0;
    const actions: Action[] = [
        { key: "feed",  icon: "🍔", label: "Feed",  accent: "#ff8a5b",
          disabled: sleeping || (c.hunger ?? 0) >= 90,
          onClick: () => { sound.unlock(); sound.eat(); void gameRef.current?.feed(); void live.feed(); } },
        { key: "play",  icon: "🎾", label: "Play",  accent: "#ffd166",
          disabled: sleeping,
          onClick: () => { sound.unlock(); sound.play(); void gameRef.current?.play(); void live.play(); } },
        { key: "toilet", icon: "🚽", label: "Toilet", accent: "#7fcfa0",
          hidden: bladder < 50 && !sleeping ? bladder < 50 : false,
          disabled: sleeping,
          onClick: () => { sound.unlock(); void gameRef.current?.toilet(); void live.toilet(); } },
        { key: "sleep", icon: sleeping ? "🌙" : "💤", label: sleeping ? "Wake" : "Sleep", accent: "#6dd3ff",
          onClick: () => {
              sound.unlock();
              if (sleeping) {
                  void live.wake();
                  gameRef.current?.wakeUp();
              } else {
                  sound.sleep();
                  void gameRef.current?.sleep();
                  void live.sleep();
              }
          } },
        { key: "wash",  icon: "🛁", label: "Wash",  accent: "#a78bfa",
          disabled: sleeping,
          onClick: () => { sound.unlock(); sound.nuzzle(); void gameRef.current?.wash(); void live.wash(); } },
        { key: "pet",   icon: "🤍", label: "Pet",   accent: "#ff7eb3",
          disabled: sleeping,
          onClick: () => { sound.unlock(); sound.pet(); gameRef.current?.pet(); void live.pet(); } },
        { key: "scold", icon: "🚫", label: "Scold", accent: "#ef4444",
          disabled: sleeping,
          onClick: () => { sound.unlock(); sound.error(); gameRef.current?.scold(); void live.scold(); } },
        { key: "heal",  icon: "✨", label: "Heal",  accent: "#c084fc",
          hidden: !needsHeal && !c.is_in_coma,
          onClick: () => { sound.unlock(); sound.heal(); void live.heal(); } },
    ];

    const moodLine = (() => {
        if (!c.is_alive) return "Unconscious. Heal to revive.";
        if (c.is_sleeping) return "Sleeping... tap to wake 🌙";
        if ((c.bladder ?? 0) >= 90) return "About to have an accident! 🚽";
        if ((c.bladder ?? 0) >= 70) return "Needs the toilet 💧";
        if (c.is_sick) return `${c.disease ?? "feeling under the weather"}`;
        if ((c.hunger ?? 100) < 20) return "Starving — please feed 🍔";
        if ((c.energy ?? 100) < 20) return "Exhausted";
        if ((c.happiness ?? 100) < 20) return "Bored";
        if ((c.overall ?? 0) > 80) return "Living the good life ✨";
        return null;
    })();

    return (
        <main className="shell">
            <header className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <p className="muted" style={{ fontSize: "0.85rem" }}>
                    {c.unique_code} · {c.phenotype.temperament_seed} · age {c.age_days}d
                </p>
                <Link to="/app/certificate" className="btn btn-ghost" style={{ padding: "0.4rem 0.9rem" }}>
                    Passport
                </Link>
            </header>

            <div className="game-stage">
                <div className="game-viewport" ref={hostRef} />
                <GameHUD companion={c} />
                <SceneNavigator scenes={[
                    { key: "bedroom", icon: "🛏",  label: "Bedroom", active: scene === "bedroom",
                      onClick: () => { sound.unlock(); void gameRef.current?.goBedroom(); } },
                    { key: "living",  icon: "🛋",  label: "Living",  active: scene === "living",
                      onClick: () => { sound.unlock(); void gameRef.current?.goLiving(); } },
                    { key: "nursery", icon: "🧸",  label: "Nursery", active: scene === "nursery",
                      onClick: () => { sound.unlock(); void gameRef.current?.goNursery(); } },
                ]} />
                {moodLine && <div className="mood-line">{moodLine}</div>}

                <form className="chat-chip" onSubmit={sendChat}>
                    <input
                        type="text"
                        value={chatValue}
                        onChange={(e) => setChatValue(e.target.value)}
                        placeholder="Say something to your companion..."
                        maxLength={300}
                        disabled={c.is_in_coma || chatBusy}
                        aria-label="Talk to your companion"
                    />
                    <button type="submit" disabled={c.is_in_coma || chatBusy || !chatValue.trim()} aria-label="Send">
                        ➤
                    </button>
                </form>

                <ActionDock actions={actions} />
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
                <ComaOverlay onComplete={async () => { await live.revive(); }} />
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
