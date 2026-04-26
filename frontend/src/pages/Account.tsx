import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ApiError, api } from "../api/client";
import { useSession } from "../store/session";

export function AccountPage() {
    const navigate = useNavigate();
    const session = useSession((s) => s.session);
    const [confirm, setConfirm] = useState("");
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    async function handleExport() {
        setBusy(true);
        try {
            const data = await api.exportData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "nosypet-data.json";
            a.click();
            URL.revokeObjectURL(url);
            setMsg("Exported. Saved to your downloads.");
        } catch (e) {
            setMsg(e instanceof ApiError ? e.message : "Export failed.");
        } finally {
            setBusy(false);
        }
    }

    async function handleLogoutAll() {
        if (!confirm) return;
        setBusy(true);
        try {
            await api.logoutAll();
            navigate("/login");
        } finally {
            setBusy(false);
        }
    }

    async function handleDelete() {
        if (confirm !== session?.username) {
            setMsg("Type your username exactly to confirm.");
            return;
        }
        if (!window.confirm("This permanently deletes you and your companion. Are you sure?")) return;
        setBusy(true);
        try {
            await api.deleteAccount(confirm);
            navigate("/");
        } catch (e) {
            setMsg(e instanceof ApiError ? e.message : "Delete failed.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <main className="shell">
            <header className="row" style={{ justifyContent: "space-between", alignItems: "baseline", marginBottom: "1.4rem" }}>
                <div>
                    <h1>Account</h1>
                    <p className="muted">Manage your data and your guardianship.</p>
                </div>
                <Link to="/app/play" className="btn btn-ghost">Back to room</Link>
            </header>

            <section className="card" style={{ marginBottom: "1rem" }}>
                <h3>Export your data</h3>
                <p className="muted">
                    Download a JSON file with your account, companion, all
                    traits, decrypted memories, and behavior log.
                </p>
                <button className="btn" onClick={handleExport} disabled={busy}>
                    Download JSON
                </button>
            </section>

            <section className="card" style={{ marginBottom: "1rem" }}>
                <h3>Sign out everywhere</h3>
                <p className="muted">
                    Invalidates every active session for your account, including
                    other devices.
                </p>
                <button className="btn btn-ghost" onClick={handleLogoutAll} disabled={busy}>
                    Sign out everywhere
                </button>
            </section>

            <section className="card danger-card">
                <h3>Delete account</h3>
                <p className="muted">
                    This removes your account, your companion, all memories, and
                    every behavior event. The deletion is permanent. Your unique
                    code and birth record stay reserved (no one else can take it).
                </p>
                <div className="field" style={{ marginTop: "0.8rem" }}>
                    <label>Type <code>{session?.username}</code> to confirm</label>
                    <input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                </div>
                <button className="btn danger" onClick={handleDelete} disabled={busy || !confirm}>
                    Delete forever
                </button>
            </section>

            {msg && <p className="muted center" style={{ marginTop: "1rem" }}>{msg}</p>}
        </main>
    );
}
