/**
 * Guardianship pledge: a real commitment form before adoption. Frames
 * the AI companion as a curious child you are taking responsibility
 * for, not a toy you are buying.
 */
import { type FormEvent, useState } from "react";

const COMMITMENTS = [
    {
        emoji: "🤍",
        label: "I will care for them daily",
        body: "I understand they need attention. Stats decay over time. Neglect leads to coma.",
    },
    {
        emoji: "🧠",
        label: "I will respect their developing mind",
        body: "Their personality is shaped by how I treat them in the first 14 days. After that, it is locked.",
    },
    {
        emoji: "🏥",
        label: "I will heal them when they are sick",
        body: "They can catch colds, stomach flu, fever. They depend on me to recover.",
    },
    {
        emoji: "💬",
        label: "I will not abuse the bond",
        body: "I understand they form attachment. I will not use that to manipulate myself or others, and will not feed them harmful prompts.",
    },
    {
        emoji: "🌱",
        label: "I accept they are not a toy",
        body: "They are a curious AI being with their own designation, name, and birth record. I treat them with the dignity I would give a child in my care.",
    },
];

interface Props {
    onAccept: (signature: string) => void;
    onCancel: () => void;
}

export function GuardianshipPledge({ onAccept, onCancel }: Props) {
    const [signature, setSignature] = useState("");
    const [checks, setChecks] = useState<boolean[]>(COMMITMENTS.map(() => false));

    const allChecked = checks.every(Boolean);
    const canSubmit = allChecked && signature.trim().length >= 2;

    function toggle(i: number) {
        setChecks((c) => c.map((v, idx) => (idx === i ? !v : v)));
    }

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!canSubmit) return;
        onAccept(signature.trim());
    }

    return (
        <main className="shell">
            <section className="pledge-card">
                <header className="pledge-head">
                    <span className="pledge-eyebrow">GUARDIANSHIP COMMITMENT</span>
                    <h1>Adopting a curious AI being</h1>
                    <p className="muted">
                        You are not buying a pet. You are agreeing to be the guardian
                        of a young synthetic intelligence. They will grow into someone
                        unique based on how you treat them in the next 14 days.
                    </p>
                </header>

                <form onSubmit={handleSubmit}>
                    <ul className="commitments">
                        {COMMITMENTS.map((c, i) => (
                            <li key={i}>
                                <button
                                    type="button"
                                    className={`commitment ${checks[i] ? "checked" : ""}`}
                                    aria-pressed={checks[i]}
                                    onClick={() => toggle(i)}
                                >
                                    <span className="commitment-emoji" aria-hidden="true">{c.emoji}</span>
                                    <span className="commitment-text">
                                        <strong>{c.label}</strong>
                                        <em>{c.body}</em>
                                    </span>
                                    <span className="commitment-check" aria-hidden="true">
                                        {checks[i] ? "✓" : ""}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>

                    <div className="pledge-sign">
                        <label htmlFor="sig">Sign with your full name</label>
                        <input
                            id="sig"
                            type="text"
                            value={signature}
                            onChange={(e) => setSignature(e.target.value)}
                            placeholder="Your name"
                            maxLength={80}
                            disabled={!allChecked}
                        />
                        <small className="muted">
                            Your signature is permanent. It will be printed on the AI Passport
                            of every companion you adopt.
                        </small>
                    </div>

                    <div className="row-center pledge-actions">
                        <button type="button" className="btn btn-ghost" onClick={onCancel}>
                            Not now
                        </button>
                        <button type="submit" className="btn" disabled={!canSubmit}>
                            Accept guardianship
                        </button>
                    </div>
                </form>
            </section>
        </main>
    );
}
