import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ApiError, api } from "../api/client";
import { sound } from "../audio/Sounds";
import { CompanionPortrait } from "../components/CompanionPortrait";
import { useSession } from "../store/session";

export function HatchingPage() {
    const navigate = useNavigate();
    const setCompanion = useSession((s) => s.setCompanion);
    const [name, setName] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [stage, setStage] = useState<"name" | "summoning" | "reveal">("name");
    const [companion, setLocalCompanion] = useState<import("../types/companion").Companion | null>(null);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError(null);
        setBusy(true);
        setStage("summoning");
        sound.unlock();
        sound.hatch();
        try {
            await api.csrf();
            const [created] = await Promise.all([
                api.hatch({ name }),
                new Promise((r) => setTimeout(r, 1800)),
            ]);
            setLocalCompanion(created);
            setCompanion(created);
            setStage("reveal");
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Could not adopt. Try again.");
            setStage("name");
        } finally {
            setBusy(false);
        }
    }

    if (stage === "name") {
        return (
            <main className="shell">
                <section className="card" style={{ maxWidth: 460, margin: "3rem auto" }}>
                    <h1 className="center" style={{ marginBottom: "0.4rem" }}>Name your companion</h1>
                    <p className="muted center" style={{ marginBottom: "1.6rem" }}>
                        Their DNA is rolling up right now. The name you give them is permanent
                        for today, but you can change it later.
                    </p>
                    <form onSubmit={handleSubmit}>
                        <div className="field">
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                maxLength={30}
                                required
                                placeholder="e.g. Pixel"
                                autoFocus
                            />
                        </div>
                        {error && <p style={{ color: "#ffb3b3", marginBottom: "0.8rem" }}>{error}</p>}
                        <button className="btn" style={{ width: "100%" }} disabled={busy || !name.trim()}>
                            Begin life
                        </button>
                    </form>
                </section>
            </main>
        );
    }

    if (stage === "summoning") {
        return (
            <main className="shell">
                <section className="card center" style={{ maxWidth: 460, margin: "3rem auto" }}>
                    <h2 style={{ marginBottom: "1rem" }}>Materializing...</h2>
                    <div className="hatch-stage">
                        <div className="hatch-orb">
                            <svg viewBox="0 0 100 100">
                                <defs>
                                    <radialGradient id="orbGrad" cx="50%" cy="50%" r="50%">
                                        <stop offset="0%" stopColor="#ffe1f0" />
                                        <stop offset="60%" stopColor="#ff9bc6" />
                                        <stop offset="100%" stopColor="#7b3da3" stopOpacity="0" />
                                    </radialGradient>
                                </defs>
                                <circle cx="50" cy="50" r="40" fill="url(#orbGrad)" />
                                <circle cx="50" cy="50" r="24" fill="#fff" opacity="0.6">
                                    <animate attributeName="r" from="20" to="32" dur="1.5s" repeatCount="indefinite" />
                                    <animate attributeName="opacity" from="0.7" to="0" dur="1.5s" repeatCount="indefinite" />
                                </circle>
                            </svg>
                        </div>
                    </div>
                    <p className="muted" style={{ marginTop: "1rem" }}>Decoding DNA, claiming founder slot...</p>
                </section>
            </main>
        );
    }

    if (stage === "reveal" && companion) {
        return (
            <main className="shell">
                <section className="card center" style={{ maxWidth: 520, margin: "3rem auto" }}>
                    <h1 style={{ marginBottom: "0.2rem" }}>Meet {companion.name}</h1>
                    {companion.is_founder && (
                        <p style={{ color: "var(--gold)", fontWeight: 700 }}>
                            ⭐ Founder #{companion.founder_number}
                        </p>
                    )}
                    <div style={{ margin: "1.4rem 0" }}>
                        <CompanionPortrait phenotype={companion.phenotype} size={180} />
                    </div>
                    <p className="muted">
                        Code <strong style={{ color: "#fff" }}>{companion.unique_code}</strong>
                        {" · "} {companion.phenotype.body_color_name} {companion.phenotype.pattern}
                    </p>
                    <div className="row-center" style={{ marginTop: "1.8rem" }}>
                        <button className="btn" onClick={() => navigate("/app/certificate")}>
                            View certificate
                        </button>
                        <button className="btn btn-ghost" onClick={() => navigate("/app/play")}>
                            Enter the room
                        </button>
                    </div>
                </section>
            </main>
        );
    }

    return null;
}
