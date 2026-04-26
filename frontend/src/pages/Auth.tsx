import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ApiError, api } from "../api/client";
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

    return (
        <main className="shell">
            <section className="card" style={{ maxWidth: 380, margin: "3rem auto" }}>
                <h1 className="center" style={{ marginBottom: "1.5rem" }}>
                    {mode === "signup" ? "Adopt your companion" : "Welcome back"}
                </h1>
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
                    {mode === "signup" && (
                        <div className="field">
                            <label>Email (optional)</label>
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
                            autoComplete={mode === "signup" ? "new-password" : "current-password"}
                            required
                            minLength={8}
                        />
                    </div>
                    {error && (
                        <p style={{ color: "#ffb3b3", fontSize: "0.9rem", marginBottom: "0.8rem" }}>
                            {error}
                        </p>
                    )}
                    <button type="submit" className="btn" style={{ width: "100%" }} disabled={busy}>
                        {busy ? "..." : (mode === "signup" ? "Continue" : "Log in")}
                    </button>
                </form>
                <p className="center muted" style={{ marginTop: "1rem", fontSize: "0.9rem" }}>
                    {mode === "signup"
                        ? <>Already have an account? <Link to="/login">Log in</Link></>
                        : <>New here? <Link to="/signup">Adopt</Link></>}
                </p>
            </section>
        </main>
    );
}
