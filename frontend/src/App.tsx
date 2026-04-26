import { lazy, Suspense, useEffect, useState } from "react";
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
import { ToastHost } from "./components/ToastHost";
import { AuthPage } from "./pages/Auth";
import { WelcomePage } from "./pages/Welcome";
import { useSession } from "./store/session";

// Heavy pages (PixiJS, html-to-image, qrcode) ship in their own chunks
// so the marketing surface stays light.
const GamePage        = lazy(() => import("./pages/Game").then(m => ({ default: m.GamePage })));
const HatchingPage    = lazy(() => import("./pages/Hatching").then(m => ({ default: m.HatchingPage })));
const CertificatePage = lazy(() => import("./pages/Certificate").then(m => ({ default: m.CertificatePage })));
const MemoriesPage    = lazy(() => import("./pages/Memories").then(m => ({ default: m.MemoriesPage })));
const AccountPage     = lazy(() => import("./pages/Account").then(m => ({ default: m.AccountPage })));

export function App() {
    return (
        <ErrorBoundary>
            <Router>
                <Bootstrap />
                <div className="app">
                    <Topbar />
                    <InstallPrompt />
                    <ToastHost />
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
                        <Link to="/app">Room</Link>
                        <Link to="/app/memories">Memories</Link>
                        <Link to="/app/account">@{session.username}</Link>
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
        <Suspense fallback={<main className="shell"><p className="muted">Loading...</p></main>}>
            <Routes>
                <Route index element={<HomeOrHatching companion={companion} />} />
                <Route path="hatch" element={<HatchingPage />} />
                <Route path="certificate" element={<CertificatePage />} />
                <Route path="play" element={<GamePage />} />
                <Route path="memories" element={<MemoriesPage />} />
                <Route path="account" element={<AccountPage />} />
            </Routes>
        </Suspense>
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
