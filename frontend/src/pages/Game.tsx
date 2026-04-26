import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { Game } from "../game/Game";
import { useSession } from "../store/session";

interface Stats {
    hunger: number;
    happiness: number;
    energy: number;
}

export function GamePage() {
    const companion = useSession((s) => s.companion);
    const hostRef = useRef<HTMLDivElement | null>(null);
    const gameRef = useRef<Game | null>(null);
    const [stats, setStats] = useState<Stats>({ hunger: 75, happiness: 75, energy: 75 });

    useEffect(() => {
        if (!hostRef.current || !companion) return;
        const game = new Game();
        gameRef.current = game;
        game.mount(hostRef.current, companion.phenotype, companion.name);
        const id = setInterval(() => {
            const snap = game.getStateSnapshot();
            setStats({ hunger: Math.round(snap.hunger), happiness: Math.round(snap.happiness), energy: Math.round(snap.energy) });
        }, 1000);
        return () => {
            clearInterval(id);
            game.unmount();
            gameRef.current = null;
        };
    }, [companion]);

    if (!companion) {
        return (
            <main className="shell">
                <p className="muted">No companion yet. <Link to="/app">Adopt one</Link>.</p>
            </main>
        );
    }

    return (
        <main className="shell">
            <header className="row" style={{ justifyContent: "space-between", alignItems: "baseline", marginBottom: "1rem" }}>
                <div>
                    <h1>{companion.name}</h1>
                    <p className="muted">{companion.unique_code} · {companion.phenotype.temperament_seed} · age {companion.age_days}d</p>
                </div>
                <Link to="/app/certificate" className="btn btn-ghost">Certificate</Link>
            </header>

            <div className="game-viewport" ref={hostRef} />

            <div style={{ marginTop: "1rem" }}>
                <StatRow label="Hunger" value={stats.hunger} hue="#ff8a5b" />
                <StatRow label="Happy"  value={stats.happiness} hue="#ffd166" />
                <StatRow label="Energy" value={stats.energy} hue="#6dd3ff" />
            </div>

            <div className="game-controls">
                <button className="action-tile" onClick={() => gameRef.current?.feed()}>
                    <span className="emoji">🍔</span><span className="label">Feed</span>
                </button>
                <button className="action-tile" onClick={() => gameRef.current?.play()}>
                    <span className="emoji">🎾</span><span className="label">Play</span>
                </button>
                <button className="action-tile" onClick={() => gameRef.current?.sleep()}>
                    <span className="emoji">💤</span><span className="label">Sleep</span>
                </button>
                <button className="action-tile" onClick={() => gameRef.current?.pet()}>
                    <span className="emoji">🤍</span><span className="label">Pet</span>
                </button>
            </div>
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
