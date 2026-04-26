/**
 * A unique signature pattern, generated deterministically from the
 * 64-float fingerprint array baked into the DNA. Looks like a
 * waveform-meets-EKG and serves as a visual proof-of-uniqueness.
 */
import type { Phenotype } from "../types/companion";

export function Fingerprint({ phenotype, width = 200, height = 60 }: {
    phenotype: Phenotype;
    width?: number;
    height?: number;
}) {
    const fp = phenotype.fingerprint;
    const points: string[] = [];
    fp.forEach((v, i) => {
        const x = (i / (fp.length - 1)) * width;
        const y = height / 2 + (v - 0.5) * height * 0.85;
        points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    });
    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
            <polyline
                points={points.join(" ")}
                fill="none"
                stroke={phenotype.accent_color_hex}
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
            />
        </svg>
    );
}
