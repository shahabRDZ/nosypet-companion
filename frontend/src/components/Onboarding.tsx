/**
 * 4-step coach mark overlay shown once after the very first visit
 * to the game page. Uses localStorage to remember dismissal.
 */
import { useEffect, useState } from "react";

const KEY = "nosypet:onboarded:v1";

const STEPS = [
    { emoji: "👆", title: "Tap to nuzzle",
      body: "A short tap on your companion gives them a small bonus." },
    { emoji: "💗", title: "Long-press to pet",
      body: "Hold your finger on them for a real cuddle." },
    { emoji: "🍔", title: "Use the bowl, bed and toy",
      body: "The action buttons send your companion to objects in the room." },
    { emoji: "💬", title: "Talk to them",
      body: "Type a message. They learn things and remember you." },
];

export function Onboarding() {
    const [step, setStep] = useState<number | null>(null);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!window.localStorage.getItem(KEY)) setStep(0);
    }, []);

    if (step === null) return null;
    const s = STEPS[step];

    function next() {
        if (step === null) return;
        if (step + 1 >= STEPS.length) {
            window.localStorage.setItem(KEY, "1");
            setStep(null);
        } else {
            setStep(step + 1);
        }
    }
    function skip() {
        window.localStorage.setItem(KEY, "1");
        setStep(null);
    }

    return (
        <div className="coma-overlay" role="dialog" aria-labelledby="onb-title">
            <div className="coma-card center">
                <div style={{ fontSize: "3rem", marginBottom: "0.6rem" }}>{s.emoji}</div>
                <h2 id="onb-title">{s.title}</h2>
                <p className="muted" style={{ marginTop: "0.4rem" }}>{s.body}</p>
                <div className="row-center" style={{ marginTop: "1.4rem" }}>
                    <button className="btn-ghost btn" onClick={skip}>Skip</button>
                    <button className="btn" onClick={next}>
                        {step + 1 === STEPS.length ? "Got it" : "Next"}
                    </button>
                </div>
                <div className="onb-dots" aria-hidden="true">
                    {STEPS.map((_, i) => (
                        <span key={i} className={i === step ? "on" : ""} />
                    ))}
                </div>
            </div>
        </div>
    );
}
