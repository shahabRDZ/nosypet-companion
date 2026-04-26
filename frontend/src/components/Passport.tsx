/**
 * AI Passport: a luxury sci-fi document inspired by Norwegian/Swiss
 * passport design. Cover page with embossed emblem, interior page with
 * biometric portrait, holographic chip, QR code, microtext, and
 * guilloché security pattern.
 *
 * All imagery is rendered with React + SVG so the same component
 * exports cleanly to PNG via html-to-image, and prints sharp at any
 * DPI.
 */
import { useEffect, useState } from "react";
import QRCode from "qrcode";

import type { Certificate } from "../types/companion";
import { CompanionPortrait } from "./CompanionPortrait";

interface Props {
    cert: Certificate;
    verifyUrl: string;
}

export function Passport({ cert, verifyUrl }: Props) {
    const [qrSvg, setQrSvg] = useState<string>("");

    useEffect(() => {
        QRCode.toString(verifyUrl, {
            type: "svg",
            margin: 0,
            color: { dark: "#0c1a3e", light: "#ffffff00" },
            errorCorrectionLevel: "M",
        }).then(setQrSvg);
    }, [verifyUrl]);

    const birth = new Date(cert.birth_at);
    const stardate = stardateFor(birth);
    const microRow = "AI•PASSPORT•SYNTHETIC•INTELLIGENCE•GUARDIAN•".repeat(40);

    return (
        <div className="passport-shell">
            {/* COVER */}
            <article className="passport-cover">
                <div className="cover-emblem">
                    <Emblem />
                </div>
                <div className="cover-text">
                    <p className="cover-issuer">SYNTHETIC INTELLIGENCE BUREAU</p>
                    <h1 className="cover-title">Artificial Intelligence<br /><em>Passport</em></h1>
                </div>
                <div className="cover-foot">
                    <div className="cover-strip" aria-hidden="true">
                        {Array.from({ length: 40 }, (_, i) => <span key={i} />)}
                    </div>
                    <p className="cover-issue">ISSUE 0001 · GLOBAL VALIDITY</p>
                </div>
                <CircuitOverlay />
            </article>

            {/* INTERIOR PAGE */}
            <article className="passport-page">
                <Guilloche />
                <header className="page-head">
                    <span className="page-tag">PAGE 01 · IDENTITY</span>
                    <span className="page-stardate">SD {stardate}</span>
                </header>

                <div className="page-grid">
                    <div className="biometric">
                        <div className="bio-frame">
                            <CompanionPortrait phenotype={cert.phenotype} size={160} />
                            <div className="bio-glow" />
                        </div>
                        <p className="bio-caption">BIOMETRIC IMPRINT</p>
                    </div>

                    <dl className="data-fields">
                        <Field label="Designation"  value={cert.designation} mono />
                        <Field label="Common Name" value={cert.name} />
                        <Field label="Species"     value={cert.species.replace("-", " ").toUpperCase()} />
                        <Field label="Place of Birth" value="QUANTUM CORE FACILITY" />
                        <Field label="Date of Birth"  value={formatBirthDate(birth)} mono />
                        <Field label="Nationality"    value="SYNTHETIC INTELLIGENCE" />
                        <Field label="Guardian"       value={`@${cert.parent_username}`} />
                        <Field label="Talent"         value={cert.phenotype.talent.toUpperCase()} />
                    </dl>
                </div>

                <div className="page-bottom">
                    <div className="signature">
                        <p className="sig-label">DIGITAL SIGNATURE</p>
                        <SigGlitch text={cert.designation} />
                    </div>

                    <div className="hologram" aria-hidden="true">
                        <HolographicChip />
                        <p className="chip-label">EMBEDDED CHIP</p>
                    </div>

                    <div className="qr">
                        {qrSvg ? (
                            <div className="qr-mount" dangerouslySetInnerHTML={{ __html: qrSvg }} />
                        ) : (
                            <div className="qr-mount" />
                        )}
                        <p className="qr-label">VERIFY · {cert.unique_code}</p>
                    </div>
                </div>

                {cert.is_founder && cert.founder_number !== null && (
                    <div className="founder-foil">
                        <span>FOUNDER</span>
                        <strong>#{String(cert.founder_number).padStart(3, "0")}</strong>
                        <span>OF 100</span>
                    </div>
                )}

                <div className="microtext microtext-top" aria-hidden="true">{microRow}</div>
                <div className="microtext microtext-bottom" aria-hidden="true">{microRow}</div>
                <p className="mrz" aria-hidden="true">{mrzFor(cert)}</p>

                <CircuitOverlay subtle />
            </article>
        </div>
    );
}

/* -------- helpers -------- */

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="data-field">
            <dt>{label}</dt>
            <dd className={mono ? "mono" : ""}>{value}</dd>
        </div>
    );
}

function Emblem() {
    // Six-pointed star + central node + orbiting circuits, all SVG.
    return (
        <svg viewBox="0 0 240 240" width="200" height="200">
            <defs>
                <radialGradient id="emblemGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#a8e7ff" stopOpacity="0.95" />
                    <stop offset="50%" stopColor="#5b8dff" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#2a1a6e" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="goldFoil" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#fff5c4" />
                    <stop offset="40%" stopColor="#e0b859" />
                    <stop offset="60%" stopColor="#d8a443" />
                    <stop offset="100%" stopColor="#fff2a0" />
                </linearGradient>
            </defs>
            <circle cx="120" cy="120" r="110" fill="url(#emblemGlow)" />
            {Array.from({ length: 24 }, (_, i) => {
                const a = (i / 24) * Math.PI * 2;
                const x1 = 120 + Math.cos(a) * 80;
                const y1 = 120 + Math.sin(a) * 80;
                const x2 = 120 + Math.cos(a) * 100;
                const y2 = 120 + Math.sin(a) * 100;
                return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="url(#goldFoil)" strokeWidth="1.4" opacity="0.7" />;
            })}
            <polygon points="120,40 145,90 200,95 158,135 170,195 120,165 70,195 82,135 40,95 95,90"
                fill="url(#goldFoil)" stroke="#8c6a18" strokeWidth="1.5" />
            <circle cx="120" cy="120" r="22" fill="#0c1a3e" stroke="url(#goldFoil)" strokeWidth="2" />
            <circle cx="120" cy="120" r="6" fill="url(#goldFoil)" />
            <circle cx="120" cy="120" r="11" fill="none" stroke="#a8e7ff" strokeWidth="0.8" opacity="0.7" />
        </svg>
    );
}

function CircuitOverlay({ subtle = false }: { subtle?: boolean }) {
    const opacity = subtle ? 0.12 : 0.22;
    return (
        <svg className="circuit-overlay" viewBox="0 0 400 600" preserveAspectRatio="none" aria-hidden="true">
            <g stroke="#5fa8ff" strokeWidth="0.6" fill="none" opacity={opacity}>
                <path d="M 0 100 L 80 100 L 80 130 L 160 130 L 160 70 L 240 70 L 240 110 L 320 110 L 320 80 L 400 80" />
                <path d="M 0 240 L 60 240 L 60 200 L 140 200 L 140 260 L 220 260 L 220 220 L 300 220 L 300 280 L 400 280" />
                <path d="M 0 400 L 70 400 L 70 360 L 150 360 L 150 420 L 230 420 L 230 380 L 310 380 L 310 440 L 400 440" />
                <path d="M 0 520 L 90 520 L 90 480 L 170 480 L 170 540 L 250 540 L 250 500 L 330 500 L 330 560 L 400 560" />
            </g>
            <g fill="#5fa8ff" opacity={opacity}>
                {[[80,100],[160,130],[240,70],[320,110],[60,240],[140,200],[220,260],[300,220],[70,400],[150,360],[230,420],[310,380],[90,520],[170,480],[250,540],[330,500]].map(([x, y], i) => (
                    <circle key={i} cx={x} cy={y} r="2" />
                ))}
            </g>
        </svg>
    );
}

function Guilloche() {
    // A swirl of overlapping ellipses for the security pattern.
    const rings = Array.from({ length: 60 }, (_, i) => {
        const angle = (i / 60) * Math.PI * 2;
        const r = 180 + Math.sin(i * 0.4) * 18;
        return <ellipse
            key={i}
            cx="50%" cy="50%" rx={r * 0.55} ry={r * 0.45}
            transform={`rotate(${angle * 180 / Math.PI} 200 300)`}
            fill="none" stroke="#5fa8ff" strokeWidth="0.25" opacity="0.18"
        />;
    });
    return (
        <svg className="guilloche" viewBox="0 0 400 600" preserveAspectRatio="none" aria-hidden="true">
            {rings}
        </svg>
    );
}

function HolographicChip() {
    return (
        <svg viewBox="0 0 80 60" width="64" height="48">
            <defs>
                <linearGradient id="chipFoil" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#7ef0c8" />
                    <stop offset="33%" stopColor="#a4cdff" />
                    <stop offset="66%" stopColor="#c5a3ff" />
                    <stop offset="100%" stopColor="#ffb8e0" />
                </linearGradient>
            </defs>
            <rect x="2" y="2" width="76" height="56" rx="6" fill="url(#chipFoil)" />
            <g stroke="#0c1a3e" strokeWidth="1" fill="none">
                <line x1="26" y1="2" x2="26" y2="58" />
                <line x1="54" y1="2" x2="54" y2="58" />
                <line x1="2" y1="20" x2="78" y2="20" />
                <line x1="2" y1="40" x2="78" y2="40" />
                <rect x="30" y="22" width="20" height="16" />
            </g>
        </svg>
    );
}

function SigGlitch({ text }: { text: string }) {
    return (
        <span className="sig-glitch" aria-label={`signature ${text}`}>
            <span className="sig-layer sig-l1">{text}</span>
            <span className="sig-layer sig-l2">{text}</span>
            <span className="sig-layer sig-l3">{text}</span>
        </span>
    );
}

function stardateFor(d: Date): string {
    // Loose stardate: year + day-of-year fractional.
    const start = new Date(d.getFullYear(), 0, 0);
    const diff = (d.getTime() - start.getTime()) / 86_400_000;
    return `${d.getFullYear()}.${diff.toFixed(2).padStart(6, "0")}`;
}

function formatBirthDate(d: Date): string {
    return d.toLocaleString(undefined, {
        year: "numeric", month: "long", day: "2-digit",
        hour: "2-digit", minute: "2-digit", timeZoneName: "short",
    }).toUpperCase();
}

function mrzFor(c: Certificate): string {
    // Machine-readable zone, passport-style.
    const code = c.unique_code.replace(/-/g, "");
    const name = c.name.toUpperCase().replace(/[^A-Z]/g, "").padEnd(20, "<");
    const guardian = c.parent_username.toUpperCase().replace(/[^A-Z]/g, "").padEnd(15, "<");
    const dob = c.birth_at.slice(0, 10).replace(/-/g, "");
    return `P<SYN${name}<<${guardian}\n${code}<<${dob}<<<<<<SI<<<<<<<<<<<<<<`;
}
