import { Link } from "react-router-dom";

export function WelcomePage() {
    return (
        <main className="shell">
            <section className="card center" style={{ maxWidth: 520, margin: "3rem auto" }}>
                <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🌱</div>
                <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>Adopt an AI companion</h1>
                <p className="muted" style={{ marginBottom: "1.5rem" }}>
                    A unique, ever-evolving creature with its own personality and a
                    permanent birth certificate. The first 100 adopters earn a
                    Founder mark.
                </p>
                <div className="row-center">
                    <Link to="/signup" className="btn">Adopt yours</Link>
                    <Link to="/login" className="btn btn-ghost">Log in</Link>
                </div>
            </section>
        </main>
    );
}
