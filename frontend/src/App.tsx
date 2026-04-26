import { useEffect, useState } from "react";
import {
    Link,
    Navigate,
    Route,
    BrowserRouter as Router,
    Routes,
    useNavigate,
} from "react-router-dom";

import { sound } from "./audio/Sounds";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { InstallPrompt } from "./components/InstallPrompt";
import { AuthPage } from "./pages/Auth";
import { CertificatePage } from "./pages/Certificate";
import { GamePage } from "./pages/Game";
import { HatchingPage } from "./pages/Hatching";
import { WelcomePage } from "./pages/Welcome";
import { useSession } from "./store/session";

export function App() {
    return (
        <ErrorBoundary>
            <Router>
                <Bootstrap />
                <div className="app">
                    <Topbar />
                    <InstallPrompt />
                    <Routes>
                        <Route path="/" element={<WelcomePage />} />
                        <Route path="/login" element={<AuthPage mode="login" />} />
                        <Route path="/signup" element={<AuthPage mode="signup" />} />
                        <Route path="/app/*" element={<AuthedRoutes />} />
                    </Routes>
                </div>
            </Router>
        </ErrorBoundary>
    );
}

function Bootstrap() {
    const refresh = useSession((s) => s.refresh);
    useEffect(() => { refresh(); }, [refresh]);
    return null;
}

function Topbar() {
    const session = useSession((s) => s.session);
    const logout = useSession((s) => s.logout);
    const [muted, setMuted] = useState(() => sound.isMuted());
    return (
        <header className="topbar">
            <Link to="/" className="brand">🌱 NosyPet</Link>
            <nav style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                <button
                    className="link-btn"
                    aria-label={muted ? "Unmute" : "Mute"}
                    title={muted ? "Sound off" : "Sound on"}
                    onClick={() => { sound.unlock(); sound.setMuted(!muted); setMuted(!muted); }}
                >
                    {muted ? "🔇" : "🔊"}
                </button>
                {session?.authenticated ? (
                    <>
                        <Link to="/app">Companion</Link>
                        <span className="muted">@{session.username}</span>
                        <button className="btn-ghost btn" style={{ padding: "0.4rem 0.9rem" }} onClick={() => logout()}>
                            Log out
                        </button>
                    </>
                ) : (
                    <>
                        <Link to="/login">Log in</Link>
                        <Link to="/signup" className="btn" style={{ padding: "0.4rem 1rem" }}>Adopt</Link>
                    </>
                )}
            </nav>
        </header>
    );
}

function AuthedRoutes() {
    const session = useSession((s) => s.session);
    const bootstrapping = useSession((s) => s.bootstrapping);
    const companion = useSession((s) => s.companion);

    if (bootstrapping) return <main className="shell"><p className="muted">...</p></main>;
    if (!session?.authenticated) return <Navigate to="/login" replace />;

    return (
        <Routes>
            <Route index element={<HomeOrHatching companion={companion} />} />
            <Route path="hatch" element={<HatchingPage />} />
            <Route path="certificate" element={<CertificatePage />} />
            <Route path="play" element={<GamePage />} />
        </Routes>
    );
}

function HomeOrHatching({ companion }: { companion: import("./types/companion").Companion | null }) {
    const navigate = useNavigate();
    useEffect(() => {
        if (companion) navigate("/app/play", { replace: true });
        else navigate("/app/hatch", { replace: true });
    }, [companion, navigate]);
    return <main className="shell"><p className="muted">...</p></main>;
}
