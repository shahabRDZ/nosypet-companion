interface Props {
    traits: Record<string, number> | undefined;
    archetype: string | null | undefined;
    archetypeLocked: string | null | undefined;
    ageDays: number;
}

const TRAIT_LABELS: Record<string, string> = {
    affection: "Affection",
    discipline: "Discipline",
    curiosity: "Curiosity",
    confidence: "Confidence",
    playfulness: "Playfulness",
};

export function TraitPanel({ traits, archetype, archetypeLocked, ageDays }: Props) {
    const isLocked = !!archetypeLocked;
    const daysToLock = Math.max(0, 14 - ageDays);

    return (
        <section className="trait-panel">
            <header className="row" style={{ alignItems: "baseline", justifyContent: "space-between" }}>
                <h3 style={{ fontSize: "1.05rem" }}>Personality</h3>
                <span className="muted" style={{ fontSize: "0.8rem" }}>
                    {isLocked
                        ? `Locked: ${humanizeArchetype(archetypeLocked!)}`
                        : daysToLock === 0
                            ? "Locking soon..."
                            : `Locks in ${daysToLock}d (preview: ${humanizeArchetype(archetype ?? "strange_one")})`}
                </span>
            </header>
            <ul className="trait-list">
                {Object.entries(TRAIT_LABELS).map(([key, label]) => {
                    const v = traits?.[key] ?? 0;
                    const pos = Math.max(0, v);
                    const neg = Math.max(0, -v);
                    return (
                        <li key={key} className="trait-row">
                            <span>{label}</span>
                            <div className="trait-bar">
                                <span className="trait-neg" style={{ width: `${neg}%` }} />
                                <span className="trait-pos" style={{ width: `${pos}%` }} />
                            </div>
                            <strong style={{ width: 36, textAlign: "right" }}>{v}</strong>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

function humanizeArchetype(a: string): string {
    return a.split("_").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
}
