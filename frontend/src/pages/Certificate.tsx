import { toPng } from "html-to-image";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api/client";
import { Passport } from "../components/Passport";
import type { Certificate } from "../types/companion";

export function CertificatePage() {
    const passportRef = useRef<HTMLDivElement | null>(null);
    const [cert, setCert] = useState<Certificate | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        api.certificate()
            .then(setCert)
            .catch(() => setError("Could not load passport."));
    }, []);

    async function downloadPng() {
        if (!passportRef.current || !cert) return;
        const dataUrl = await toPng(passportRef.current, {
            pixelRatio: 2,
            cacheBust: true,
            backgroundColor: "#080418",
        });
        const link = document.createElement("a");
        link.download = `nosypet-passport-${cert.unique_code}.png`;
        link.href = dataUrl;
        link.click();
    }

    async function shareLink() {
        if (!cert) return;
        const url = `${window.location.origin}/verify/${cert.unique_code}`;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `${cert.name} · AI Passport`,
                    text: `Meet ${cert.name}, an AI companion. Verify here:`,
                    url,
                });
            } catch { /* user cancelled */ }
        } else {
            await navigator.clipboard.writeText(url);
            alert("Verify link copied to clipboard.");
        }
    }

    if (error) return <main className="shell"><p>{error}</p></main>;
    if (!cert) return <main className="shell"><p className="muted">Loading passport...</p></main>;

    const verifyUrl = `${window.location.origin}/verify/${cert.unique_code}`;

    return (
        <main className="shell">
            <div ref={passportRef} className="passport-wrap">
                <Passport cert={cert} verifyUrl={verifyUrl} />
            </div>

            <div className="row-center" style={{ marginTop: "1.5rem" }}>
                <button className="btn" onClick={downloadPng}>Download passport</button>
                <button className="btn btn-ghost" onClick={shareLink}>Share verify link</button>
                <Link to="/app/play" className="btn btn-ghost">Enter the room</Link>
            </div>
        </main>
    );
}
