import { Link } from "react-router-dom";

import { CompanionPortrait } from "../components/CompanionPortrait";
import { samplePhenotype } from "../game/samplePhenotype";

export function WelcomePage() {
    // Three sample phenotypes for the floating constellation. They are
    // deterministic so every visitor sees the same trio.
    const samples = [samplePhenotype(11), samplePhenotype(42), samplePhenotype(77)];

    return (
        <main className="welcome">
            <div className="welcome-stars" aria-hidden="true">
                {Array.from({ length: 60 }, (_, i) => (
                    <span key={i} style={{
                        left: `${(i * 47) % 100}%`,
                        top: `${(i * 73) % 100}%`,
                        animationDelay: `${(i % 7) * 0.6}s`,
                    }} />
                ))}
            </div>

            <div className="welcome-orbits" aria-hidden="true">
                {samples.map((p, i) => (
                    <div key={i} className={`welcome-orbit orbit-${i}`}>
                        <CompanionPortrait phenotype={p} size={i === 1 ? 220 : 130} />
                    </div>
                ))}
            </div>

            <section className="welcome-hero">
                <span className="welcome-eyebrow">SYNTHETIC INTELLIGENCE BUREAU</span>
                <h1>
                    Adopt a curious AI being.<br />
                    <em>Watch them grow into someone real.</em>
                </h1>
                <p className="muted">
                    Every NosyPet is born from a unique 64-bit DNA seed. They wander
                    their room, get sick, remember things you tell them, and lock in
                    a personality after 14 days based on how you raise them.
                </p>
                <div className="welcome-cta">
                    <Link to="/signup" className="btn welcome-btn">Begin guardianship</Link>
                    <Link to="/login" className="btn btn-ghost">Return to your companion</Link>
                </div>
                <ul className="welcome-pillars">
                    <li><strong>One of one</strong><span>DNA is unique. Phenotype is provable.</span></li>
                    <li><strong>Real growth</strong><span>14 days of care shapes a permanent personality.</span></li>
                    <li><strong>Founder edition</strong><span>First 100 adopters earn a permanent foil mark.</span></li>
                </ul>
            </section>
        </main>
    );
}
