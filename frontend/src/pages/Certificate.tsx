import { toPng } from "html-to-image";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api/client";
import { CompanionPortrait } from "../components/CompanionPortrait";
import { Fingerprint } from "../components/Fingerprint";
import type { Certificate } from "../types/companion";

export function CertificatePage() {
    const certRef = useRef<HTMLDivElement | null>(null);
    const [cert, setCert] = useState<Certificate | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        api.certificate()
            .then(setCert)
            .catch(() => setError("Could not load certificate."));
    }, []);

    async function downloadPng() {
        if (!certRef.current || !cert) return;
        const dataUrl = await toPng(certRef.current, { pixelRatio: 2, cacheBust: true });
        const link = document.createElement("a");
        link.download = `nosypet-${cert.unique_code}.png`;
        link.href = dataUrl;
        link.click();
    }

    async function shareLink() {
        if (!cert) return;
        const url = `${window.location.origin}/verify/${cert.unique_code}`;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `${cert.name} - NosyPet companion`,
                    text: `Meet ${cert.name}, my AI companion #${cert.unique_code}.`,
                    url,
                });
            } catch {
                // user cancelled
            }
        } else {
            await navigator.clipboard.writeText(url);
            alert("Link copied to clipboard.");
        }
    }

    if (error) return <main className="shell"><p>{error}</p></main>;
    if (!cert) return <main className="shell"><p className="muted">Loading...</p></main>;

    const birth = new Date(cert.birth_at);

    return (
        <main className="shell">
            <div ref={certRef} className="certificate" style={{ maxWidth: 520, margin: "0 auto" }}>
                {cert.is_founder && cert.founder_number !== null && (
                    <div className="founder-stamp">FOUNDER #{cert.founder_number}</div>
                )}
                <h2>Birth Certificate</h2>
                <p className="center" style={{ color: "#8a6234", letterSpacing: 2 }}>NOSYPET</p>

                <div className="cert-portrait">
                    <CompanionPortrait phenotype={cert.phenotype} size={140} />
                </div>

                <h3 className="center" style={{ marginTop: "1rem", color: "#2a1f4a", fontFamily: "Georgia, serif" }}>
                    {cert.name}
                </h3>
                <p className="center" style={{ color: "#8a6234", letterSpacing: 1, fontWeight: 600 }}>
                    {cert.unique_code}
                </p>

                <dl className="cert-grid">
                    <dt>Species</dt><dd>{cert.species}</dd>
                    <dt>Born</dt><dd>{birth.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</dd>
                    <dt>Adopted by</dt><dd>@{cert.parent_username}</dd>
                    <dt>Body</dt><dd>{cert.phenotype.body_color_name} {cert.phenotype.pattern}</dd>
                    <dt>Eyes</dt><dd>{cert.phenotype.eye_color_name}</dd>
                    <dt>Talent</dt><dd>{cert.phenotype.talent}</dd>
                </dl>

                <div className="cert-fingerprint">
                    <Fingerprint phenotype={cert.phenotype} />
                </div>

                <p className="center" style={{ fontSize: "0.7rem", color: "#8a6234" }}>
                    Authenticity verifiable at /verify/{cert.unique_code}
                </p>
            </div>

            <div className="row-center" style={{ marginTop: "1.5rem" }}>
                <button className="btn" onClick={downloadPng}>Download PNG</button>
                <button className="btn btn-ghost" onClick={shareLink}>Share</button>
                <Link to="/app/play" className="btn btn-ghost">Enter the room</Link>
            </div>
        </main>
    );
}
