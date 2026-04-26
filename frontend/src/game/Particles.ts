/**
 * A tiny pooled particle system for emoji-like overlays. We use Text
 * sprites because emojis render natively across platforms.
 */
import { Container, Text } from "pixi.js";

interface Particle {
    text: Text;
    vx: number;
    vy: number;
    age: number;
    life: number;
    rotation: number;
}

export class ParticleSystem {
    public readonly container: Container;
    private alive: Particle[] = [];

    constructor() {
        this.container = new Container();
        this.container.zIndex = 30;
    }

    public emit(opts: {
        x: number;
        y: number;
        text: string;
        count?: number;
        spread?: number;
        lifeMs?: number;
        upward?: boolean;
        size?: number;
    }): void {
        const {
            x, y, text,
            count = 1, spread = 30,
            lifeMs = 1500, upward = true,
            size = 18,
        } = opts;
        for (let i = 0; i < count; i++) {
            const t = new Text({
                text,
                style: { fontFamily: "system-ui", fontSize: size, fill: 0xffffff },
            });
            t.anchor.set(0.5);
            t.x = x + (Math.random() - 0.5) * spread;
            t.y = y;
            t.alpha = 0;
            this.container.addChild(t);
            this.alive.push({
                text: t,
                vx: (Math.random() - 0.5) * 30,
                vy: upward ? -40 - Math.random() * 30 : 40 + Math.random() * 20,
                age: 0,
                life: lifeMs,
                rotation: (Math.random() - 0.5) * 0.05,
            });
        }
    }

    public update(deltaMs: number): void {
        const dtSec = deltaMs / 1000;
        for (let i = this.alive.length - 1; i >= 0; i--) {
            const p = this.alive[i];
            p.age += deltaMs;
            const u = p.age / p.life;
            // Fade in fast, fade out slow.
            p.text.alpha = u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85;
            p.text.x += p.vx * dtSec;
            p.text.y += p.vy * dtSec;
            p.text.rotation += p.rotation;
            if (p.age >= p.life) {
                p.text.destroy();
                this.alive.splice(i, 1);
            }
        }
    }
}
