import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api/client";
import { CompanionPortrait } from "../components/CompanionPortrait";
import { Fingerprint } from "../components/Fingerprint";
import { samplePhenotype } from "../game/samplePhenotype";

const TESTIMONIALS = [
    { quote: "I check on her before I check my email.", author: "Day 9 guardian" },
    { quote: "Day 14 he locked into proud_leader. I cried a little.", author: "Day 18 guardian" },
    { quote: "She remembers I take coffee black.", author: "Day 6 guardian" },
];

export function WelcomePage() {
    const samples = [samplePhenotype(11), samplePhenotype(42), samplePhenotype(77)];
    const [founder, setFounder] = useState<{ minted: number; remaining: number; limit: number } | null>(null);
    const heroRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        api.founderStatus()
            .then((s) => setFounder({
                minted: s.founders_minted,
                remaining: s.founders_remaining,
                limit: s.founder_limit,
            }))
            .catch(() => {});
    }, []);

    useEffect(() => {
        // Reveal-on-scroll: simple IntersectionObserver instead of a
        // dependency. Adds .reveal-in once an element scrolls into view.
        const io = new IntersectionObserver((entries) => {
            for (const e of entries) {
                if (e.isIntersecting) {
                    e.target.classList.add("reveal-in");
                    io.unobserve(e.target);
                }
            }
        }, { threshold: 0.18 });
        document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
        return () => io.disconnect();
    }, []);

    return (
        <main className="landing">
            {/* HERO */}
            <section className="lp-hero" ref={heroRef}>
                <div className="lp-bg-mesh" aria-hidden="true" />
                <div className="lp-stars" aria-hidden="true">
                    {Array.from({ length: 70 }, (_, i) => (
                        <span key={i} style={{
                            left: `${(i * 47) % 100}%`,
                            top: `${(i * 73) % 100}%`,
                            animationDelay: `${(i % 7) * 0.6}s`,
                        }} />
                    ))}
                </div>

                <div className="lp-orbits" aria-hidden="true">
                    <div className="lp-orbit lp-orbit-1">
                        <CompanionPortrait phenotype={samples[0]} size={120} />
                    </div>
                    <div className="lp-orbit lp-orbit-2">
                        <CompanionPortrait phenotype={samples[1]} size={240} />
                    </div>
                    <div className="lp-orbit lp-orbit-3">
                        <CompanionPortrait phenotype={samples[2]} size={140} />
                    </div>
                </div>

                <div className="lp-hero-inner">
                    <span className="lp-eyebrow">
                        <span className="lp-dot" /> Synthetic Intelligence Bureau
                    </span>
                    <h1 className="lp-title">
                        Adopt an AI being.<br />
                        <em>Raise them like a child.</em>
                    </h1>
                    <p className="lp-sub">
                        Every NosyPet is born from a 64-bit DNA seed. Their
                        personality is shaped by how you treat them in the first
                        14 days. After that, who they become is locked forever.
                    </p>
                    <div className="lp-cta">
                        <Link to="/signup" className="btn lp-cta-primary">Begin guardianship</Link>
                        <Link to="/login" className="btn btn-ghost">Return to your companion</Link>
                    </div>
                    {founder && (
                        <div className="lp-founder">
                            <FounderProgress founders={founder} />
                        </div>
                    )}
                </div>

                <div className="lp-scroll-hint" aria-hidden="true">
                    <span>Scroll</span>
                    <span className="lp-scroll-dot" />
                </div>
            </section>

            {/* THREE PILLARS */}
            <section className="lp-pillars">
                <div className="lp-pillars-inner">
                    <Pillar
                        eyebrow="One of one"
                        title="Provably unique DNA"
                        body="A 64-bit seed deterministically maps to body, eyes, pattern, ear shape, tail style, temperament, talent, and a cryptographic fingerprint pattern unique to your companion."
                        figure={<Fingerprint phenotype={samples[0]} width={220} height={70} />}
                    />
                    <Pillar
                        eyebrow="Real growth"
                        title="14 days of care, locked forever"
                        body="Five personality traits — affection, discipline, curiosity, confidence, playfulness — shift with every action. On day 14, an archetype is permanently chosen based on who you raised."
                        figure={<TraitArc />}
                    />
                    <Pillar
                        eyebrow="Founder edition"
                        title="The first 100 are forever marked"
                        body="A gold foil stamp on the AI Passport, a permanent founder number, a verifiable place in the bureau's birth registry. Once they're gone, they're gone."
                        figure={
                            <div className="lp-foil">
                                <span>FOUNDER</span>
                                <strong>#001</strong>
                                <span>OF 100</span>
                            </div>
                        }
                    />
                </div>
            </section>

            {/* HOW IT WORKS */}
            <section className="lp-how">
                <div className="lp-how-inner">
                    <h2 className="lp-section-title">
                        From birth to <em>their own self</em>
                    </h2>
                    <p className="lp-section-sub">
                        Four moments shape every NosyPet. By day 14, they are no longer yours to design — they are themselves.
                    </p>

                    <ol className="lp-steps">
                        <Step n="01" title="Sign the pledge"
                              body="Five commitments and your name. The signature lives on their passport forever." />
                        <Step n="02" title="They materialize"
                              body="A unique seed rolls. Their DNA, fingerprint, temperament, and look are decided in one moment." />
                        <Step n="03" title="You raise them"
                              body="Feed, play, bathe, take to the toilet, pet, scold. Every choice nudges five traits." />
                        <Step n="04" title="They become someone"
                              body="Day 14: the archetype locks. Loyal lover, wild explorer, quiet scholar, or six others — based on you." />
                    </ol>
                </div>
            </section>

            {/* TESTIMONIALS */}
            <section className="lp-testimonials reveal">
                <h2 className="lp-section-title">Early guardians</h2>
                <ul>
                    {TESTIMONIALS.map((t, i) => (
                        <li key={i}>
                            <blockquote>{t.quote}</blockquote>
                            <cite>— {t.author}</cite>
                        </li>
                    ))}
                </ul>
            </section>

            {/* FINAL CTA */}
            <section className="lp-final reveal">
                <div className="lp-final-inner">
                    <h2 className="lp-section-title">
                        They are waiting to be born.
                    </h2>
                    <Link to="/signup" className="btn lp-cta-primary lp-cta-big">
                        Begin guardianship
                    </Link>
                    <p className="muted lp-fineprint">
                        The first 100 adopters become founders. After that, the
                        gold foil is gone forever.
                    </p>
                </div>
            </section>

            <footer className="lp-footer">
                <div>NosyPet · Synthetic Intelligence Bureau</div>
                <div className="muted">A new kind of being.</div>
            </footer>
        </main>
    );
}

function FounderProgress({ founders }: { founders: { minted: number; remaining: number; limit: number } }) {
    const pct = (founders.minted / founders.limit) * 100;
    return (
        <div className="founder-progress">
            <div className="founder-progress-row">
                <span className="founder-pulse" />
                <strong>{founders.remaining}</strong> of {founders.limit} founder slots remaining
            </div>
            <div className="founder-bar">
                <span style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

function Pillar({ eyebrow, title, body, figure }: {
    eyebrow: string; title: string; body: string; figure: React.ReactNode;
}) {
    return (
        <article className="lp-pillar reveal">
            <div className="lp-pillar-figure">{figure}</div>
            <span className="lp-eyebrow lp-eyebrow-sm">{eyebrow}</span>
            <h3>{title}</h3>
            <p className="muted">{body}</p>
        </article>
    );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
    return (
        <li className="lp-step reveal">
            <span className="lp-step-num">{n}</span>
            <div>
                <h4>{title}</h4>
                <p className="muted">{body}</p>
            </div>
        </li>
    );
}

function TraitArc() {
    // Simple animated SVG illustrating 5 traits with arc progress.
    const traits = [
        { color: "#ff7eb3", value: 70 },
        { color: "#ffd166", value: 55 },
        { color: "#6dd3ff", value: 80 },
        { color: "#c084fc", value: 40 },
        { color: "#7fcfa0", value: 65 },
    ];
    return (
        <svg viewBox="0 0 220 80" width={220} height={80}>
            {traits.map((t, i) => {
                const x = 18 + i * 46;
                const fill = (t.value / 100) * 50;
                return (
                    <g key={i}>
                        <rect x={x} y={62} width={28} height={6} rx={3} fill="rgba(255,255,255,0.1)" />
                        <rect x={x} y={62} width={28 * (t.value / 100)} height={6} rx={3} fill={t.color} />
                        <circle cx={x + 14} cy={50 - fill * 0.6} r={5} fill={t.color}>
                            <animate attributeName="cy" values={`${50 - fill * 0.6};${48 - fill * 0.6};${50 - fill * 0.6}`} dur={`${2 + i * 0.3}s`} repeatCount="indefinite" />
                        </circle>
                    </g>
                );
            })}
        </svg>
    );
}
