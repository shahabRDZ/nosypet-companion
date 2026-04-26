/**
 * Procedural creature: every shape is drawn from the DNA phenotype.
 *
 * The creature is composed of a few PIXI.Graphics layers grouped into
 * a single Container so we can move, scale, and animate the whole
 * thing as one. When real sprite art arrives later, swap this class
 * with a `SpriteCreature` that exposes the same public interface
 * (`update`, `playAction`, `setPosition`, `container`).
 */
import { Container, Graphics, Text } from "pixi.js";

import type { Phenotype } from "../types/companion";
import type { ActionName, CreatureState } from "./types";

const BASE_BODY_WIDTH = 90;
const BASE_BODY_HEIGHT = 80;

export class Creature {
    public readonly container: Container;

    private body: Graphics;
    private belly: Graphics;
    private patternLayer: Graphics;
    private leftEar: Graphics;
    private rightEar: Graphics;
    private tail: Graphics;
    private leftEye: Graphics;
    private rightEye: Graphics;
    private mouth: Graphics;
    private cheekL: Graphics;
    private cheekR: Graphics;
    private speechBubble: Container;
    private speechText: Text;
    private speechBg: Graphics;

    private elapsed = 0;
    private currentAction: ActionName = "idle";
    private actionTimer = 0;
    private blinkPhase = 0;
    private facing: 1 | -1 = 1;          // 1 = right, -1 = left
    private wobblePhase = 0;
    private moodTint = 0xffffff;
    private speechVisibleUntil = 0;

    constructor(private phenotype: Phenotype) {
        this.container = new Container();
        this.container.sortableChildren = true;

        this.tail = new Graphics();        this.tail.zIndex = 1;
        this.body = new Graphics();        this.body.zIndex = 2;
        this.belly = new Graphics();       this.belly.zIndex = 3;
        this.patternLayer = new Graphics(); this.patternLayer.zIndex = 4;
        this.leftEar = new Graphics();     this.leftEar.zIndex = 5;
        this.rightEar = new Graphics();    this.rightEar.zIndex = 5;
        this.leftEye = new Graphics();     this.leftEye.zIndex = 6;
        this.rightEye = new Graphics();    this.rightEye.zIndex = 6;
        this.mouth = new Graphics();       this.mouth.zIndex = 6;
        this.cheekL = new Graphics();      this.cheekL.zIndex = 6;
        this.cheekR = new Graphics();      this.cheekR.zIndex = 6;

        this.container.addChild(
            this.tail, this.body, this.belly, this.patternLayer,
            this.leftEar, this.rightEar,
            this.leftEye, this.rightEye, this.mouth,
            this.cheekL, this.cheekR,
        );

        // Speech bubble
        this.speechBubble = new Container();
        this.speechBubble.zIndex = 20;
        this.speechBubble.visible = false;
        this.speechBg = new Graphics();
        this.speechText = new Text({
            text: "",
            style: { fontFamily: "system-ui", fontSize: 14, fill: 0x222244 },
        });
        this.speechBubble.addChild(this.speechBg, this.speechText);
        this.container.addChild(this.speechBubble);

        this.draw();
    }

    /* ---------------------------------------------------------------
     * Public API
     * ------------------------------------------------------------- */

    public setPosition(x: number, y: number): void {
        this.container.x = x;
        this.container.y = y;
    }

    public setFacing(dir: 1 | -1): void {
        if (dir === this.facing) return;
        this.facing = dir;
        // Flip horizontally without affecting y scale.
        this.body.scale.x = dir;
        this.belly.scale.x = dir;
        this.patternLayer.scale.x = dir;
        this.leftEar.scale.x = dir;
        this.rightEar.scale.x = dir;
        this.tail.scale.x = dir;
        this.leftEye.scale.x = dir;
        this.rightEye.scale.x = dir;
        this.mouth.scale.x = dir;
        this.cheekL.scale.x = dir;
        this.cheekR.scale.x = dir;
    }

    public playAction(name: ActionName, durationMs = 1500): void {
        this.currentAction = name;
        this.actionTimer = durationMs;
    }

    public say(text: string, durationMs = 3000): void {
        this.speechText.text = text;
        const padding = 8;
        const w = Math.min(180, this.speechText.width + padding * 2);
        const h = this.speechText.height + padding * 2;
        this.speechBg.clear();
        this.speechBg.roundRect(0, 0, w, h, 10).fill({ color: 0xffffff, alpha: 0.95 });
        this.speechBg.stroke({ color: 0x222244, width: 1, alpha: 0.6 });
        // tail of bubble
        this.speechBg.moveTo(w / 2 - 6, h)
            .lineTo(w / 2 + 6, h)
            .lineTo(w / 2,    h + 8)
            .closePath()
            .fill({ color: 0xffffff, alpha: 0.95 })
            .stroke({ color: 0x222244, width: 1, alpha: 0.6 });
        this.speechText.x = padding;
        this.speechText.y = padding;
        this.speechBubble.x = -w / 2;
        // place above the head: body radius + ears + bubble height + gap
        this.speechBubble.y = -BASE_BODY_HEIGHT * this.phenotype.size_modifier - h - 24;
        this.speechBubble.visible = true;
        this.speechVisibleUntil = performance.now() + durationMs;
    }

    public update(deltaMs: number, state: CreatureState): void {
        this.elapsed += deltaMs;
        this.blinkPhase += deltaMs;
        this.wobblePhase += deltaMs;

        // Mood tint based on health
        const newTint = state.sick
            ? 0xb0d4b0  // sickly green
            : state.happiness < 25
                ? 0xc8c8c8  // muted gray
                : 0xffffff;
        if (newTint !== this.moodTint) {
            this.moodTint = newTint;
            this.body.tint = newTint;
            this.belly.tint = newTint;
        }

        // Gentle breathing scale on the whole creature.
        const breath = 1 + Math.sin(this.elapsed / 400) * 0.015;
        this.container.scale.set(this.phenotype.size_modifier * breath);

        // Tail wag (faster when happy).
        const wagSpeed = state.happiness > 60 ? 6 : 3;
        this.tail.rotation = Math.sin(this.elapsed / 200) * 0.18 * wagSpeed / 6;

        // Blink (every ~3s).
        const blinkPeriod = 3000;
        if (this.blinkPhase > blinkPeriod) {
            this.blinkPhase = 0;
        }
        const blink = this.blinkPhase < 120;
        this.leftEye.scale.y = blink ? 0.1 : 1;
        this.rightEye.scale.y = blink ? 0.1 : 1;

        // Speech bubble auto-hide
        if (this.speechBubble.visible && performance.now() > this.speechVisibleUntil) {
            this.speechBubble.visible = false;
        }

        // Action-specific keyframes
        this.applyActionAnimation(deltaMs);
    }

    /* ---------------------------------------------------------------
     * Drawing
     * ------------------------------------------------------------- */

    private draw(): void {
        const p = this.phenotype;
        const w = BASE_BODY_WIDTH;
        const h = BASE_BODY_HEIGHT;
        const bodyHex = parseInt(p.body_color_hex.slice(1), 16);
        const accentHex = parseInt(p.accent_color_hex.slice(1), 16);
        const eyeHex = parseInt(p.eye_color_hex.slice(1), 16);

        // Body: rounded blob shape
        this.body.clear();
        this.body.ellipse(0, 0, w / 2, h / 2).fill(bodyHex);
        this.body.ellipse(0, 0, w / 2, h / 2).stroke({ color: 0x000000, width: 2, alpha: 0.15 });

        // Belly highlight
        this.belly.clear();
        this.belly.ellipse(0, h * 0.18, w * 0.32, h * 0.28).fill({
            color: 0xffffff,
            alpha: 0.45,
        });

        // Pattern overlay
        this.drawPattern(p, w, h, accentHex);

        // Ears (positioned by ear_shape)
        this.drawEars(p.ear_shape, w, h, bodyHex);

        // Tail behind body
        this.drawTail(p.tail_style, w, h, bodyHex);

        // Eyes
        const eyeY = -h * 0.1;
        const eyeR = 5;
        this.leftEye.clear();
        this.leftEye.circle(-w * 0.15, eyeY, eyeR).fill(0x1a1230);
        this.leftEye.circle(-w * 0.15 + 1.3, eyeY - 1.3, eyeR * 0.4).fill(0xffffff);
        this.rightEye.clear();
        this.rightEye.circle(w * 0.15, eyeY, eyeR).fill(0x1a1230);
        this.rightEye.circle(w * 0.15 + 1.3, eyeY - 1.3, eyeR * 0.4).fill(0xffffff);

        // Eye color rim (subtle)
        this.leftEye.circle(-w * 0.15, eyeY, eyeR + 1).stroke({ color: eyeHex, width: 1.2, alpha: 0.6 });
        this.rightEye.circle(w * 0.15, eyeY, eyeR + 1).stroke({ color: eyeHex, width: 1.2, alpha: 0.6 });

        // Cheeks
        const cheekColor = 0xff7eb3;
        this.cheekL.clear();
        this.cheekL.circle(-w * 0.27, eyeY + 8, 4).fill({ color: cheekColor, alpha: 0.55 });
        this.cheekR.clear();
        this.cheekR.circle(w * 0.27, eyeY + 8, 4).fill({ color: cheekColor, alpha: 0.55 });

        // Mouth (small smile)
        this.mouth.clear();
        this.mouth.moveTo(-w * 0.07, eyeY + 12)
            .quadraticCurveTo(0, eyeY + 18, w * 0.07, eyeY + 12)
            .stroke({ color: 0x1a1230, width: 1.8, cap: "round" });
    }

    private drawPattern(p: Phenotype, w: number, h: number, accent: number): void {
        this.patternLayer.clear();
        const density = p.pattern_density;
        const fp = p.fingerprint;

        if (p.pattern === "spots") {
            const count = Math.floor(6 + density * 8);
            for (let i = 0; i < count; i++) {
                const angle = fp[i] * Math.PI * 2;
                const radius = (0.15 + fp[i + count] * 0.35) * w * 0.5;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius * (h / w);
                const r = 2 + fp[i + 16] * 4;
                this.patternLayer.circle(x, y, r).fill({ color: accent, alpha: 0.55 });
            }
        } else if (p.pattern === "stripes") {
            const count = Math.floor(3 + density * 4);
            for (let i = 0; i < count; i++) {
                const offset = -h * 0.4 + (h * 0.8 * (i + 1)) / (count + 1);
                this.patternLayer.moveTo(-w * 0.45, offset)
                    .quadraticCurveTo(0, offset + 4, w * 0.45, offset)
                    .stroke({ color: accent, width: 2.5, alpha: 0.5 });
            }
        } else if (p.pattern === "patches") {
            for (let i = 0; i < 3; i++) {
                const x = (fp[i * 4] - 0.5) * w * 0.7;
                const y = (fp[i * 4 + 1] - 0.5) * h * 0.7;
                const rx = 6 + fp[i * 4 + 2] * 12;
                const ry = 5 + fp[i * 4 + 3] * 10;
                this.patternLayer.ellipse(x, y, rx, ry).fill({ color: accent, alpha: 0.5 });
            }
        } else if (p.pattern === "freckles") {
            for (let i = 0; i < 12; i++) {
                const x = (fp[i + 30] - 0.5) * w * 0.5;
                const y = -h * 0.05 + (fp[i + 42] - 0.5) * h * 0.2;
                this.patternLayer.circle(x, y, 1.2).fill({ color: 0x000000, alpha: 0.3 });
            }
        }
        // "solid" intentionally draws nothing.
    }

    private drawEars(shape: Phenotype["ear_shape"], w: number, h: number, bodyHex: number): void {
        const yTop = -h * 0.45;
        const xL = -w * 0.28;
        const xR = w * 0.28;

        this.leftEar.clear();
        this.rightEar.clear();

        const drawOne = (g: Graphics, x: number, mirror: number) => {
            switch (shape) {
                case "round":
                    g.circle(x, yTop, 9).fill(bodyHex);
                    break;
                case "pointy":
                    g.poly([x - 7, yTop + 6, x + 7 * mirror, yTop + 6, x + 2 * mirror, yTop - 14]).fill(bodyHex);
                    break;
                case "floppy":
                    g.ellipse(x, yTop + 8, 6, 12).fill(bodyHex);
                    break;
                case "tufted":
                    g.poly([x - 5, yTop + 4, x + 5, yTop + 4, x + 2 * mirror, yTop - 16, x - 1 * mirror, yTop - 8]).fill(bodyHex);
                    break;
                case "small":
                    g.circle(x, yTop + 4, 5).fill(bodyHex);
                    break;
            }
        };
        drawOne(this.leftEar, xL, -1);
        drawOne(this.rightEar, xR, 1);
    }

    private drawTail(style: Phenotype["tail_style"], w: number, h: number, bodyHex: number): void {
        this.tail.clear();
        this.tail.pivot.set(-w * 0.45, 0);
        const x = -w * 0.45;
        const y = h * 0.05;
        switch (style) {
            case "long":
                this.tail.moveTo(x, y)
                    .quadraticCurveTo(x - 18, y - 12, x - 22, y - 2)
                    .stroke({ color: bodyHex, width: 6, cap: "round" });
                break;
            case "short":
                this.tail.circle(x - 6, y, 4).fill(bodyHex);
                break;
            case "fluffy":
                this.tail.circle(x - 8, y, 8).fill(bodyHex);
                this.tail.circle(x - 12, y - 4, 5).fill(bodyHex);
                break;
            case "curly":
                this.tail.moveTo(x, y)
                    .quadraticCurveTo(x - 16, y, x - 12, y - 14)
                    .quadraticCurveTo(x - 6, y - 22, x - 16, y - 22)
                    .stroke({ color: bodyHex, width: 5, cap: "round" });
                break;
            case "stubby":
                this.tail.ellipse(x - 4, y, 5, 3).fill(bodyHex);
                break;
        }
    }

    private applyActionAnimation(_deltaMs: number): void {
        const t = this.elapsed / 100;

        // Reset offsets each frame; specific actions add their own.
        this.body.y = 0;
        this.leftEar.rotation = 0;
        this.rightEar.rotation = 0;

        switch (this.currentAction) {
            case "walk":
                // Tiny vertical bob during walk.
                this.body.y = Math.sin(t * 0.6) * 1.5;
                break;
            case "yawn":
                // Open mouth and stretch up.
                this.mouth.clear();
                this.mouth.ellipse(0, -BASE_BODY_HEIGHT * 0.05, 4, 5).fill(0x1a1230);
                this.body.y = -2;
                break;
            case "sit":
                this.body.y = 4;
                break;
            case "sneeze":
                if (Math.floor(t / 4) % 2 === 0) {
                    this.body.y = -3;
                    this.leftEar.rotation = -0.1;
                    this.rightEar.rotation = 0.1;
                }
                break;
            case "scratch":
                this.body.x = Math.sin(t * 1.5) * 2;
                break;
            case "look_at_camera":
                // Eyes track forward; body still.
                break;
            case "chase_tail":
                this.container.rotation = Math.sin(t * 0.6) * 0.5;
                break;
            case "sleep":
                this.body.y = 6;
                this.leftEye.scale.y = 0.05;
                this.rightEye.scale.y = 0.05;
                break;
            case "fart":
                // Body trembles briefly; visible particle handled by Game.
                this.body.y = Math.sin(t * 1.5) * 1;
                break;
            case "eat":
                this.mouth.clear();
                this.mouth.ellipse(0, -BASE_BODY_HEIGHT * 0.04, 3, 2 + Math.sin(t) * 1.5)
                    .fill(0x1a1230);
                break;
            case "play_with_toy":
                this.body.y = Math.sin(t * 1.2) * 3;
                break;
            case "idle":
            default:
                break;
        }

        if (this.actionTimer > 0) {
            this.actionTimer -= _deltaMs;
            if (this.actionTimer <= 0) {
                this.currentAction = "idle";
                // Restore default mouth
                const eyeY = -BASE_BODY_HEIGHT * 0.1;
                this.mouth.clear();
                this.mouth.moveTo(-BASE_BODY_WIDTH * 0.07, eyeY + 12)
                    .quadraticCurveTo(0, eyeY + 18, BASE_BODY_WIDTH * 0.07, eyeY + 12)
                    .stroke({ color: 0x1a1230, width: 1.8, cap: "round" });
                this.container.rotation = 0;
                this.body.x = 0;
            }
        }
    }
}
