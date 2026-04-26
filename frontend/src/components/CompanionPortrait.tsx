/**
 * SVG portrait of the companion using the same DNA. Used for the
 * birth certificate and any small "facecam" outside the game canvas.
 */
import type { Phenotype } from "../types/companion";

interface Props {
    phenotype: Phenotype;
    size?: number;
}

export function CompanionPortrait({ phenotype, size = 160 }: Props) {
    const p = phenotype;
    const cx = 60, cy = 60;
    const rx = 38 * p.size_modifier;
    const ry = 32 * p.size_modifier;

    const ear = renderEars(p, cx, cy, rx, ry);
    const tail = renderTail(p, cx, cy, rx, ry);
    const pattern = renderPattern(p, cx, cy, rx, ry);

    return (
        <svg width={size} height={size} viewBox="0 0 120 120">
            <defs>
                <radialGradient id="bodyGrad" cx="40%" cy="35%" r="70%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
                    <stop offset="100%" stopColor={p.body_color_hex} />
                </radialGradient>
                <radialGradient id="bellyGrad" cx="50%" cy="40%" r="60%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
                    <stop offset="100%" stopColor={p.body_color_hex} stopOpacity="0.3" />
                </radialGradient>
            </defs>
            <ellipse cx={cx} cy={cy + 32} rx={rx * 0.8} ry={4} fill="rgba(0,0,0,0.18)" />
            {tail}
            <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="url(#bodyGrad)" stroke="rgba(0,0,0,0.15)" />
            <ellipse cx={cx} cy={cy + 6} rx={rx * 0.55} ry={ry * 0.5} fill="url(#bellyGrad)" />
            {pattern}
            {ear}
            <g>
                <ellipse cx={cx - rx * 0.35} cy={cy - 4} rx={3.5} ry={5} fill="#1a1230" />
                <ellipse cx={cx + rx * 0.35} cy={cy - 4} rx={3.5} ry={5} fill="#1a1230" />
                <circle cx={cx - rx * 0.35 + 1.2} cy={cy - 5.5} r={1.2} fill="#fff" />
                <circle cx={cx + rx * 0.35 + 1.2} cy={cy - 5.5} r={1.2} fill="#fff" />
                <circle cx={cx - rx * 0.35} cy={cy - 4} r={6} fill="none" stroke={p.eye_color_hex} strokeOpacity="0.6" strokeWidth={0.7} />
                <circle cx={cx + rx * 0.35} cy={cy - 4} r={6} fill="none" stroke={p.eye_color_hex} strokeOpacity="0.6" strokeWidth={0.7} />
            </g>
            <circle cx={cx - rx * 0.55} cy={cy + 5} r={2.4} fill="#ff7eb3" opacity={0.55} />
            <circle cx={cx + rx * 0.55} cy={cy + 5} r={2.4} fill="#ff7eb3" opacity={0.55} />
            <path d={`M ${cx - 4} ${cy + 7} Q ${cx} ${cy + 11} ${cx + 4} ${cy + 7}`}
                  stroke="#1a1230" strokeWidth={1.2} fill="none" strokeLinecap="round" />
        </svg>
    );
}

function renderEars(p: Phenotype, cx: number, cy: number, rx: number, ry: number) {
    const yTop = cy - ry * 0.85;
    const xL = cx - rx * 0.55;
    const xR = cx + rx * 0.55;
    const c = p.body_color_hex;
    switch (p.ear_shape) {
        case "round":
            return (<>
                <circle cx={xL} cy={yTop} r={5} fill={c} />
                <circle cx={xR} cy={yTop} r={5} fill={c} />
            </>);
        case "pointy":
            return (<>
                <polygon points={`${xL - 4},${yTop + 3} ${xL + 4},${yTop + 3} ${xL + 1},${yTop - 7}`} fill={c} />
                <polygon points={`${xR - 4},${yTop + 3} ${xR + 4},${yTop + 3} ${xR - 1},${yTop - 7}`} fill={c} />
            </>);
        case "floppy":
            return (<>
                <ellipse cx={xL} cy={yTop + 4} rx={3.2} ry={6} fill={c} />
                <ellipse cx={xR} cy={yTop + 4} rx={3.2} ry={6} fill={c} />
            </>);
        case "tufted":
            return (<>
                <polygon points={`${xL - 3},${yTop + 2} ${xL + 3},${yTop + 2} ${xL + 1},${yTop - 8} ${xL - 1},${yTop - 4}`} fill={c} />
                <polygon points={`${xR - 3},${yTop + 2} ${xR + 3},${yTop + 2} ${xR - 1},${yTop - 8} ${xR + 1},${yTop - 4}`} fill={c} />
            </>);
        case "small":
            return (<>
                <circle cx={xL} cy={yTop + 2} r={3} fill={c} />
                <circle cx={xR} cy={yTop + 2} r={3} fill={c} />
            </>);
    }
}

function renderTail(p: Phenotype, cx: number, cy: number, rx: number, ry: number) {
    const x = cx - rx * 0.95;
    const y = cy + ry * 0.1;
    const c = p.body_color_hex;
    switch (p.tail_style) {
        case "long":
            return <path d={`M ${x} ${y} Q ${x - 8} ${y - 6} ${x - 12} ${y}`} stroke={c} strokeWidth={3} fill="none" strokeLinecap="round" />;
        case "short":
            return <circle cx={x - 3} cy={y} r={2.2} fill={c} />;
        case "fluffy":
            return (<>
                <circle cx={x - 4} cy={y} r={4.5} fill={c} />
                <circle cx={x - 7} cy={y - 2} r={3} fill={c} />
            </>);
        case "curly":
            return <path d={`M ${x} ${y} q -8 0 -6 -7 q 3 -4 -8 -4`} stroke={c} strokeWidth={2.5} fill="none" strokeLinecap="round" />;
        case "stubby":
            return <ellipse cx={x - 2} cy={y} rx={2.6} ry={1.5} fill={c} />;
    }
}

function renderPattern(p: Phenotype, cx: number, cy: number, rx: number, ry: number) {
    if (p.pattern === "solid") return null;
    const fp = p.fingerprint;
    const accent = p.accent_color_hex;
    if (p.pattern === "spots") {
        const count = Math.floor(4 + p.pattern_density * 5);
        return (<g opacity={0.6}>
            {Array.from({ length: count }).map((_, i) => {
                const a = fp[i] * Math.PI * 2;
                const r = (0.15 + fp[i + count] * 0.35);
                const x = cx + Math.cos(a) * rx * r;
                const y = cy + Math.sin(a) * ry * r;
                return <circle key={i} cx={x} cy={y} r={1.2 + fp[i + 16] * 1.8} fill={accent} />;
            })}
        </g>);
    }
    if (p.pattern === "stripes") {
        const count = Math.floor(2 + p.pattern_density * 3);
        return (<g opacity={0.55}>
            {Array.from({ length: count }).map((_, i) => {
                const offset = cy - ry * 0.6 + (ry * 1.2 * (i + 1)) / (count + 1);
                return <path key={i} d={`M ${cx - rx * 0.7} ${offset} Q ${cx} ${offset + 2} ${cx + rx * 0.7} ${offset}`} stroke={accent} strokeWidth={1.2} fill="none" />;
            })}
        </g>);
    }
    if (p.pattern === "patches") {
        return (<g opacity={0.6}>
            {[0, 1, 2].map((i) => (
                <ellipse key={i}
                    cx={cx + (fp[i * 4] - 0.5) * rx}
                    cy={cy + (fp[i * 4 + 1] - 0.5) * ry}
                    rx={2.5 + fp[i * 4 + 2] * 4}
                    ry={2 + fp[i * 4 + 3] * 3}
                    fill={accent} />
            ))}
        </g>);
    }
    if (p.pattern === "freckles") {
        return (<g opacity={0.5}>
            {Array.from({ length: 10 }).map((_, i) => (
                <circle key={i}
                    cx={cx + (fp[i + 30] - 0.5) * rx * 0.5}
                    cy={cy - 2 + (fp[i + 42] - 0.5) * ry * 0.4}
                    r={0.5}
                    fill="#000" />
            ))}
        </g>);
    }
    return null;
}
