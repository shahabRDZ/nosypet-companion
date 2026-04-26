/**
 * Ambient atmosphere layer.
 *
 * Day: dust motes drift slowly through the light shaft.
 * Night: fireflies blink and weave around the room.
 *
 * The pool keeps a fixed number of particles alive so we never
 * allocate during the tick.
 */
import { Container, Graphics } from "pixi.js";

interface Mote {
    sprite: Graphics;
    vx: number;
    vy: number;
    phase: number;
    maxAlpha: number;
}

export class AmbientLayer {
    public readonly container: Container;
    private motes: Mote[] = [];
    private bounds: { w: number; h: number };
    private mode: "day" | "night" = "day";

    constructor(width: number, height: number, count = 24) {
        this.container = new Container();
        this.container.zIndex = 12;
        this.bounds = { w: width, h: height };
        for (let i = 0; i < count; i++) {
            const g = new Graphics();
            this.motes.push({
                sprite: g,
                vx: (Math.random() - 0.5) * 8,
                vy: -2 - Math.random() * 6,
                phase: Math.random() * Math.PI * 2,
                maxAlpha: 0.3 + Math.random() * 0.5,
            });
            g.x = Math.random() * width;
            g.y = Math.random() * height;
            this.container.addChild(g);
        }
        this.applyStyle();
    }

    public setMode(mode: "day" | "night"): void {
        if (mode === this.mode) return;
        this.mode = mode;
        this.applyStyle();
    }

    public resize(w: number, h: number): void {
        this.bounds = { w, h };
    }

    public update(deltaMs: number): void {
        const dt = deltaMs / 1000;
        for (const m of this.motes) {
            m.phase += dt * 1.4;
            m.sprite.x += m.vx * dt;
            m.sprite.y += m.vy * dt;
            // Wrap softly across the bounds.
            if (m.sprite.x < -10) m.sprite.x = this.bounds.w + 10;
            if (m.sprite.x > this.bounds.w + 10) m.sprite.x = -10;
            if (m.sprite.y < -10) {
                m.sprite.y = this.bounds.h + 10;
                m.sprite.x = Math.random() * this.bounds.w;
            }
            // Twinkle (fireflies blink hard, dust motes pulse softly).
            const flicker = this.mode === "night"
                ? 0.5 + 0.5 * Math.sin(m.phase * 3)
                : 0.7 + 0.3 * Math.sin(m.phase);
            m.sprite.alpha = m.maxAlpha * flicker;
        }
    }

    private applyStyle(): void {
        for (const m of this.motes) {
            m.sprite.clear();
            if (this.mode === "night") {
                // Firefly: bright yellow with glow.
                m.sprite.circle(0, 0, 2.4).fill(0xfff5a0);
                m.sprite.circle(0, 0, 4).fill({ color: 0xfff5a0, alpha: 0.35 });
                m.vx = (Math.random() - 0.5) * 14;
                m.vy = -3 - Math.random() * 6;
            } else {
                // Dust mote: subtle pale gold.
                m.sprite.circle(0, 0, 1.4).fill({ color: 0xfff5d6, alpha: 0.9 });
                m.vx = (Math.random() - 0.5) * 6;
                m.vy = -1.5 - Math.random() * 3;
            }
        }
    }
}
