import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { ApiError, api } from "../api/client";
import type { MemoryEntry } from "../types/companion";

const FACT_LABELS: Record<string, string> = {
    owner_name: "Your name",
    preference: "Things you like",
    schedule:   "Times you visit",
    event:      "Events you mentioned",
    nickname:   "Nicknames",
};

export function MemoriesPage() {
    const [memories, setMemories] = useState<MemoryEntry[]>([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        api.memories(page).then((res) => {
            setMemories(res.memories);
            setHasMore(res.has_more);
        }).catch((e) => setError(e instanceof ApiError ? e.message : "Could not load memories."));
    }, [page]);

    const grouped: Record<string, MemoryEntry[]> = {};
    for (const m of memories) {
        (grouped[m.fact_type] ??= []).push(m);
    }

    return (
        <main className="shell">
            <header className="row" style={{ justifyContent: "space-between", alignItems: "baseline", marginBottom: "1rem" }}>
                <div>
                    <h1>What I know about you</h1>
                    <p className="muted">Things your companion has remembered. Stored encrypted at rest.</p>
                </div>
                <Link to="/app/play" className="btn btn-ghost">Back to room</Link>
            </header>

            {error && <p className="auth-error">{error}</p>}

            {memories.length === 0 ? (
                <section className="card center" style={{ marginTop: "2rem" }}>
                    <p className="muted">Nothing yet. Talk to your companion to teach them.</p>
                </section>
            ) : (
                Object.entries(grouped).map(([type, items]) => (
                    <section key={type} className="memory-group">
                        <h3>{FACT_LABELS[type] ?? type}</h3>
                        <ul className="memory-list">
                            {items.map((m, i) => (
                                <li key={i}>
                                    <strong>{m.key}</strong>
                                    <span>{m.value}</span>
                                    <em title={`confidence ${(m.confidence * 100).toFixed(0)}%`}>
                                        {(m.confidence * 100).toFixed(0)}%
                                    </em>
                                </li>
                            ))}
                        </ul>
                    </section>
                ))
            )}

            <div className="row-center" style={{ marginTop: "1rem" }}>
                {page > 1 && <button className="btn btn-ghost" onClick={() => setPage(page - 1)}>Previous</button>}
                {hasMore && <button className="btn btn-ghost" onClick={() => setPage(page + 1)}>Next</button>}
            </div>
        </main>
    );
}
