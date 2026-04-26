import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ApiError, api } from "../api/client";
import { CompanionPortrait } from "../components/CompanionPortrait";
import { samplePhenotype } from "../game/samplePhenotype";
import { useSession } from "../store/session";

interface AuthPageProps {
    mode: "login" | "signup";
}

export function AuthPage({ mode }: AuthPageProps) {
    const navigate = useNavigate();
    const refresh = useSession((s) => s.refresh);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [email, setEmail] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError(null);
        setBusy(true);
        try {
            await api.csrf();
            if (mode === "signup") {
                await api.signup({ username, password, email });
            } else {
                await api.login({ username, password });
            }
            await refresh();
            navigate("/app");
        } catch (err) {
            const message = err instanceof ApiError ? err.message : "Something went wrong.";
            setError(message);
        } finally {
            setBusy(false);
        }
    }

    const heroPhenotype = samplePhenotype(mode === "signup" ? 42 : 11);
    const isSignup = mode === "signup";

    return (
        <main className="auth-shell">
            <div className="auth-art">
                <div className="auth-stars" aria-hidden="true">
                    {Array.from({ length: 40 }, (_, i) => (
                        <span key={i} style={{
                            left: `${(i * 53) % 100}%`,
                            top: `${(i * 71) % 100}%`,
                            animationDelay: `${(i % 5) * 0.7}s`,
                        }} />
                    ))}
                </div>
                <div className="auth-portrait">
                    <CompanionPortrait phenotype={heroPhenotype} size={220} />
                </div>
                <div className="auth-art-text">
                    <p className="auth-eyebrow">SYNTHETIC INTELLIGENCE BUREAU</p>
                    <h2>
                        {isSignup
                            ? "Become a guardian"
                            : "Welcome back, guardian"}
                    </h2>
                    <p className="muted">
                        {isSignup
                            ? "Adopt a curious AI being. Their personality will be shaped by you over the next 14 days."
                            : "Your companion has been waiting. They remember things."}
                    </p>
                </div>
            </div>

            <div className="auth-form-wrap">
                <section className="auth-form">
                    <h1>{isSignup ? "Create guardian account" : "Log in"}</h1>
                    <form onSubmit={handleSubmit}>
                        <div className="field">
                            <label>Username</label>
                            <input
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                autoComplete="username"
                                required
                                minLength={3}
                                maxLength={30}
                            />
                        </div>
                        {isSignup && (
                            <div className="field">
                                <label>Email <span className="muted">(optional, for password reset)</span></label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    autoComplete="email"
                                />
                            </div>
                        )}
                        <div className="field">
                            <label>Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete={isSignup ? "new-password" : "current-password"}
                                required
                                minLength={8}
                            />
                        </div>
                        {error && <p className="auth-error">{error}</p>}
                        <button type="submit" className="btn" style={{ width: "100%" }} disabled={busy}>
                            {busy ? "..." : (isSignup ? "Create account" : "Log in")}
                        </button>
                    </form>
                    <p className="muted center" style={{ marginTop: "1.2rem", fontSize: "0.9rem" }}>
                        {isSignup
                            ? <>Already a guardian? <Link to="/login">Log in</Link></>
                            : <>New here? <Link to="/signup">Become a guardian</Link></>}
                    </p>
                    {isSignup && (
                        <p className="muted center" style={{ marginTop: "0.4rem", fontSize: "0.78rem" }}>
                            Creating an account does not adopt yet. The next step is the
                            guardianship pledge.
                        </p>
                    )}
                </section>
            </div>
        </main>
    );
}
