/**
 * Skeleton-based creature.
 *
 * Each body part is its own PIXI.Container with its own pivot, so the
 * character can have a real walk cycle, head bob, tail secondary
 * motion, arm swings, and ear flicks that all compose naturally.
 *
 * Hierarchy:
 *
 *   character
 *     shadow            (on the ground, tracks body breath)
 *     tail              (behind body)
 *     leftLeg / rightLeg (animated alternately during walk)
 *     body              (rocks side to side during walk)
 *       torso + belly + pattern
 *       leftArm / rightArm
 *       head            (bobs counter to body, hosts eyes / mouth / ears)
 *
 * Public API matches the previous Creature so Game.ts integration is
 * unchanged: setPosition, setFacing, playAction, lookAt, say, update.
 */
import { Container, Graphics, Text } from "pixi.js";

import type { Phenotype } from "../types/companion";
import type { ActionName, CreatureState } from "./types";

const W = 80;       // body half-width
const H = 70;       // body half-height
const HEAD_R = 38;  // head radius

export class Creature {
    public readonly container: Container;

    private shadow: Graphics;
    private tail: Container;
    private body: Container;
    private head: Container;
    private leftLeg: Container;
    private rightLeg: Container;
    private leftArm: Container;
    private rightArm: Container;
    private leftEar: Container;
    private rightEar: Container;
    private leftEye: Graphics;
    private rightEye: Graphics;
    private leftPupil: Graphics;
    private rightPupil: Graphics;
    private leftLid: Graphics;
    private rightLid: Graphics;
    private mouth: Graphics;
    private cheekL: Graphics;
    private cheekR: Graphics;

    private speechBubble: Container;
    private speechText: Text;
    private speechBg: Graphics;

    private elapsed = 0;
    private currentAction: ActionName = "idle";
    private actionTimer = 0;
    private blinkTimer = Math.random() * 3000;
    private facing: 1 | -1 = 1;
    private speechVisibleUntil = 0;
    private gazeX = 0;
    private gazeY = 0;
    private wetness = 0;

    constructor(private phenotype: Phenotype) {
        this.container = new Container();
        this.container.sortableChildren = true;

        this.shadow = new Graphics();
        this.shadow.zIndex = 0;
        this.tail = new Container();
        this.tail.zIndex = 1;
        this.leftLeg = new Container();   this.leftLeg.zIndex = 2;
        this.rightLeg = new Container();  this.rightLeg.zIndex = 2;
        this.body = new Container();      this.body.zIndex = 3;
        this.head = new Container();      this.head.zIndex = 4;
        this.leftArm = new Container();   this.leftArm.zIndex = 5;
        this.rightArm = new Container();  this.rightArm.zIndex = 5;

        this.container.addChild(
            this.shadow, this.tail,
            this.leftLeg, this.rightLeg,
            this.body, this.leftArm, this.rightArm,
            this.head,
        );

        this.leftEar = new Container();
        this.rightEar = new Container();
        this.leftEye = new Graphics();
        this.rightEye = new Graphics();
        this.leftPupil = new Graphics();
        this.rightPupil = new Graphics();
        this.leftLid = new Graphics();
        this.rightLid = new Graphics();
        this.mouth = new Graphics();
        this.cheekL = new Graphics();
        this.cheekR = new Graphics();
        this.head.addChild(
            this.leftEar, this.rightEar,
            this.leftEye, this.rightEye,
            this.leftPupil, this.rightPupil,
            this.leftLid, this.rightLid,
            this.cheekL, this.cheekR,
            this.mouth,
        );

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

    public setPosition(x: number, y: number): void {
        this.container.x = x;
        this.container.y = y;
    }

    public setFacing(dir: 1 | -1): void {
        if (dir === this.facing) return;
        this.facing = dir;
        const flip = dir;
        this.body.scale.x = flip;
        this.head.scale.x = flip;
        this.tail.scale.x = flip;
        this.leftArm.scale.x = flip;
        this.rightArm.scale.x = flip;
        this.leftLeg.scale.x = flip;
        this.rightLeg.scale.x = flip;
    }

    public playAction(name: ActionName, durationMs = 1500): void {
        this.currentAction = name;
        this.actionTimer = durationMs;
    }

    public lookAt(localX: number, localY: number): void {
        const tx = Math.max(-3.2, Math.min(3.2, localX / 50));
        const ty = Math.max(-2.5, Math.min(2.5, (localY + 70) / 60));
        this.gazeX = tx;
        this.gazeY = ty;
    }

    public say(text: string, durationMs = 3000): void {
        this.speechText.text = text;
        const padding = 8;
        const w = Math.min(180, this.speechText.width + padding * 2);
        const h = this.speechText.height + padding * 2;
        this.speechBg.clear();
        this.speechBg.roundRect(0, 0, w, h, 10).fill({ color: 0xffffff, alpha: 0.96 });
        this.speechBg.stroke({ color: 0x222244, width: 1, alpha: 0.6 });
        this.speechBg.moveTo(w / 2 - 6, h)
            .lineTo(w / 2 + 6, h)
            .lineTo(w / 2,    h + 8)
            .closePath()
            .fill({ color: 0xffffff, alpha: 0.96 })
            .stroke({ color: 0x222244, width: 1, alpha: 0.6 });
        this.speechText.x = padding;
        this.speechText.y = padding;
        this.speechBubble.x = -w / 2;
        this.speechBubble.y = -H * 1.6 * this.phenotype.size_modifier - h - 28;
        this.speechBubble.visible = true;
        this.speechVisibleUntil = performance.now() + durationMs;
    }

    public setWetness(amount: number): void {
        this.wetness = Math.max(0, Math.min(1, amount));
    }

    public update(deltaMs: number, state: CreatureState): void {
        this.elapsed += deltaMs;
        this.blinkTimer -= deltaMs;
        const t = this.elapsed / 1000;

        const lerp = 0.2;
        this.leftPupil.x  = lerp * this.gazeX + (1 - lerp) * this.leftPupil.x;
        this.leftPupil.y  = lerp * this.gazeY + (1 - lerp) * this.leftPupil.y;
        this.rightPupil.x = lerp * this.gazeX + (1 - lerp) * this.rightPupil.x;
        this.rightPupil.y = lerp * this.gazeY + (1 - lerp) * this.rightPupil.y;

        if (this.blinkTimer < 0) {
            this.blink();
            this.blinkTimer = 2000 + Math.random() * 2000;
        }

        if (this.speechBubble.visible && performance.now() > this.speechVisibleUntil) {
            this.speechBubble.visible = false;
        }

        let tint = 0xffffff;
        if (state.sick) tint = 0xb8d8b8;
        else if (state.happiness < 25) tint = 0xc8c8c8;
        this.body.tint = tint;

        if (this.wetness > 0.05) {
            this.head.alpha = 1 - this.wetness * 0.15;
            this.wetness = Math.max(0, this.wetness - deltaMs / 8000);
        } else {
            this.head.alpha = 1;
        }

        this.applyAction(t, deltaMs);

        const bodyOffset = this.body.y;
        const shadowScale = 1 - Math.min(0.4, Math.max(0, -bodyOffset) / 30);
        this.shadow.scale.x = shadowScale;
        this.shadow.alpha = 0.18 + (1 - shadowScale) * 0.1;

        this.container.scale.set(this.phenotype.size_modifier);
    }

    private draw(): void {
        const p = this.phenotype;
        const bodyHex = parseInt(p.body_color_hex.slice(1), 16);
        const accentHex = parseInt(p.accent_color_hex.slice(1), 16);
        const eyeHex = parseInt(p.eye_color_hex.slice(1), 16);

        this.shadow.clear();
        this.shadow.ellipse(0, H * 1.05, W * 0.65, 8).fill({ color: 0x000000, alpha: 0.25 });

        this.drawTail(bodyHex);
        this.drawLeg(this.leftLeg, -W * 0.3, H * 0.6, bodyHex);
        this.drawLeg(this.rightLeg,  W * 0.3, H * 0.6, bodyHex);
        this.drawTorso(bodyHex, accentHex);
        this.drawArm(this.leftArm,  -W * 0.55, -H * 0.05, bodyHex);
        this.drawArm(this.rightArm,  W * 0.55, -H * 0.05, bodyHex);
        this.drawHead(bodyHex, eyeHex, accentHex);
    }

    private drawTorso(bodyHex: number, accentHex: number): void {
        const torso = new Graphics();
        torso.moveTo(-W * 0.7, -H * 0.45);
        torso.bezierCurveTo(-W * 0.95, -H * 0.45, -W * 0.95, H * 0.55, -W * 0.55, H * 0.6);
        torso.lineTo(W * 0.55, H * 0.6);
        torso.bezierCurveTo(W * 0.95, H * 0.55, W * 0.95, -H * 0.45, W * 0.7, -H * 0.45);
        torso.closePath();
        torso.fill(bodyHex);
        torso.stroke({ color: 0x000000, width: 2, alpha: 0.18 });
        this.body.addChild(torso);

        const belly = new Graphics();
        belly.ellipse(0, H * 0.1, W * 0.42, H * 0.35).fill({ color: 0xffffff, alpha: 0.42 });
        this.body.addChild(belly);

        const pattern = this.makePattern(accentHex);
        if (pattern) this.body.addChild(pattern);
    }

    private makePattern(accent: number): Graphics | null {
        const p = this.phenotype;
        if (p.pattern === "solid") return null;
        const g = new Graphics();
        const fp = p.fingerprint;
        const density = p.pattern_density;

        if (p.pattern === "spots") {
            const count = Math.floor(8 + density * 10);
            for (let i = 0; i < count; i++) {
                const angle = fp[i] * Math.PI * 2;
                const radius = (0.18 + fp[i + count] * 0.42) * W * 0.55;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius * (H / W);
                const r = 2.5 + fp[i + 16] * 4;
                g.circle(x, y, r).fill({ color: accent, alpha: 0.85 });
                g.circle(x - 1, y - 1, r * 0.4).fill({ color: 0xffffff, alpha: 0.3 });
            }
        } else if (p.pattern === "stripes") {
            const count = Math.floor(4 + density * 4);
            for (let i = 0; i < count; i++) {
                const offset = -H * 0.4 + (H * 0.85 * (i + 1)) / (count + 1);
                g.moveTo(-W * 0.6, offset).quadraticCurveTo(0, offset + 6, W * 0.6, offset)
                    .stroke({ color: accent, width: 4, alpha: 0.8 });
            }
        } else if (p.pattern === "patches") {
            for (let i = 0; i < 4; i++) {
                const x = (fp[i * 4] - 0.5) * W * 0.9;
                const y = (fp[i * 4 + 1] - 0.5) * H * 0.7;
                const rx = 8 + fp[i * 4 + 2] * 12;
                const ry = 6 + fp[i * 4 + 3] * 10;
                g.ellipse(x, y, rx, ry).fill({ color: accent, alpha: 0.78 });
            }
        } else if (p.pattern === "freckles") {
            for (let i = 0; i < 14; i++) {
                const x = (fp[i + 30] - 0.5) * W * 0.5;
                const y = -H * 0.05 + (fp[i + 42] - 0.5) * H * 0.25;
                g.circle(x, y, 1.4).fill({ color: 0x000000, alpha: 0.5 });
            }
        }
        return g;
    }

    private drawLeg(leg: Container, x: number, y: number, bodyHex: number): void {
        leg.x = x;
        leg.y = y;
        leg.pivot.set(0, -8);
        const upper = new Graphics();
        upper.roundRect(-7, 0, 14, 18, 6).fill(bodyHex);
        upper.stroke({ color: 0x000000, width: 1.5, alpha: 0.18 });
        leg.addChild(upper);
        const foot = new Graphics();
        foot.ellipse(0, 22, 11, 5).fill(0x6e3a52);
        leg.addChild(foot);
    }

    private drawArm(arm: Container, x: number, y: number, bodyHex: number): void {
        arm.x = x;
        arm.y = y;
        arm.pivot.set(0, -10);
        const upper = new Graphics();
        upper.roundRect(-6, 0, 12, 22, 5).fill(bodyHex);
        upper.stroke({ color: 0x000000, width: 1.3, alpha: 0.18 });
        arm.addChild(upper);
        const paw = new Graphics();
        paw.circle(0, 24, 6).fill(bodyHex);
        paw.circle(-2, 22, 1.4).fill({ color: 0x000000, alpha: 0.4 });
        paw.circle(0, 22, 1.4).fill({ color: 0x000000, alpha: 0.4 });
        paw.circle(2, 22, 1.4).fill({ color: 0x000000, alpha: 0.4 });
        arm.addChild(paw);
    }

    private drawTail(bodyHex: number): void {
        this.tail.x = -W * 0.75;
        this.tail.y = H * 0.05;
        const g = new Graphics();
        switch (this.phenotype.tail_style) {
            case "long":
                g.moveTo(0, 0).quadraticCurveTo(-18, -10, -22, 4)
                    .stroke({ color: bodyHex, width: 8, cap: "round" });
                break;
            case "fluffy":
                g.circle(-6, 0, 9).fill(bodyHex);
                g.circle(-12, -4, 7).fill(bodyHex);
                g.circle(-16, 2, 6).fill(bodyHex);
                break;
            case "curly":
                g.moveTo(0, 0).quadraticCurveTo(-16, -2, -10, -16)
                    .quadraticCurveTo(-2, -22, -16, -22)
                    .stroke({ color: bodyHex, width: 6, cap: "round" });
                break;
            case "stubby":
                g.ellipse(-5, 0, 7, 4).fill(bodyHex);
                break;
            case "short":
            default:
                g.circle(-6, 0, 5).fill(bodyHex);
        }
        this.tail.addChild(g);
    }

    private drawHead(bodyHex: number, eyeHex: number, accentHex: number): void {
        this.head.x = 0;
        this.head.y = -H * 0.85;

        const headG = new Graphics();
        headG.ellipse(0, 0, HEAD_R, HEAD_R * 0.92).fill(bodyHex);
        headG.stroke({ color: 0x000000, width: 2, alpha: 0.18 });
        this.head.addChildAt(headG, 0);

        const headPattern = this.makeHeadPattern(accentHex);
        if (headPattern) this.head.addChildAt(headPattern, 1);

        const antenna = new Graphics();
        antenna.moveTo(2, -HEAD_R * 0.95)
            .quadraticCurveTo(0, -HEAD_R * 1.2, 4, -HEAD_R * 1.4)
            .stroke({ color: 0x6e3a52, width: 2.5, cap: "round" });
        antenna.circle(4, -HEAD_R * 1.42, 4.5).fill(0xffd84a);
        antenna.circle(2.8, -HEAD_R * 1.45, 1.4).fill(0xffffff);
        this.head.addChildAt(antenna, 2);

        this.drawEar(this.leftEar,  -HEAD_R * 0.75, -HEAD_R * 0.65, -1, bodyHex);
        this.drawEar(this.rightEar,  HEAD_R * 0.75, -HEAD_R * 0.65,  1, bodyHex);

        const eyeY = -HEAD_R * 0.05;
        const eyeR = 7;
        this.leftEye.clear();
        this.leftEye.ellipse(-HEAD_R * 0.32, eyeY, eyeR, eyeR * 1.1).fill(0xffffff);
        this.leftEye.ellipse(-HEAD_R * 0.32, eyeY, eyeR, eyeR * 1.1).stroke({ color: eyeHex, width: 1.2, alpha: 0.7 });

        this.rightEye.clear();
        this.rightEye.ellipse(HEAD_R * 0.32, eyeY, eyeR, eyeR * 1.1).fill(0xffffff);
        this.rightEye.ellipse(HEAD_R * 0.32, eyeY, eyeR, eyeR * 1.1).stroke({ color: eyeHex, width: 1.2, alpha: 0.7 });

        this.leftPupil.clear();
        this.leftPupil.circle(-HEAD_R * 0.32, eyeY, 3.5).fill(0x1a1230);
        this.leftPupil.circle(-HEAD_R * 0.32 + 1, eyeY - 1, 1.2).fill(0xffffff);

        this.rightPupil.clear();
        this.rightPupil.circle(HEAD_R * 0.32, eyeY, 3.5).fill(0x1a1230);
        this.rightPupil.circle(HEAD_R * 0.32 + 1, eyeY - 1, 1.2).fill(0xffffff);

        this.leftLid.clear();
        this.rightLid.clear();

        this.cheekL.clear();
        this.cheekL.circle(-HEAD_R * 0.6, eyeY + 9, 4).fill({ color: 0xff7eb3, alpha: 0.6 });
        this.cheekR.clear();
        this.cheekR.circle(HEAD_R * 0.6, eyeY + 9, 4).fill({ color: 0xff7eb3, alpha: 0.6 });

        this.mouth.clear();
        this.mouth.moveTo(-5, eyeY + 16)
            .quadraticCurveTo(0, eyeY + 21, 5, eyeY + 16)
            .stroke({ color: 0x1a1230, width: 1.8, cap: "round" });
    }

    private makeHeadPattern(accent: number): Graphics | null {
        if (this.phenotype.pattern !== "spots" && this.phenotype.pattern !== "freckles") return null;
        const g = new Graphics();
        const fp = this.phenotype.fingerprint;
        if (this.phenotype.pattern === "spots") {
            for (let i = 0; i < 5; i++) {
                const x = (fp[i * 3 + 5] - 0.5) * HEAD_R * 1.4;
                const y = (fp[i * 3 + 6] - 0.5) * HEAD_R * 0.6;
                g.circle(x, y, 2.5 + fp[i * 3 + 7] * 2)
                    .fill({ color: accent, alpha: 0.7 });
            }
        } else {
            for (let i = 0; i < 8; i++) {
                const x = (fp[i + 20] - 0.5) * HEAD_R * 1.2;
                const y = (fp[i + 30] - 0.5) * HEAD_R * 0.4;
                g.circle(x, y, 0.9).fill({ color: 0x000000, alpha: 0.5 });
            }
        }
        return g;
    }

    private drawEar(ear: Container, x: number, y: number, mirror: number, bodyHex: number): void {
        ear.x = x;
        ear.y = y;
        ear.pivot.set(0, 4);
        const g = new Graphics();
        switch (this.phenotype.ear_shape) {
            case "round":
                g.circle(0, 0, 9).fill(bodyHex);
                g.circle(0, 0, 5).fill({ color: 0xff7eb3, alpha: 0.4 });
                break;
            case "pointy":
                g.poly([-7, 6, 7 * mirror, 6, 2 * mirror, -16]).fill(bodyHex);
                break;
            case "floppy":
                g.ellipse(0, 8, 7, 14).fill(bodyHex);
                break;
            case "tufted":
                g.poly([-5, 4, 5, 4, 2 * mirror, -16, -1 * mirror, -8]).fill(bodyHex);
                break;
            case "small":
                g.circle(0, 4, 5).fill(bodyHex);
                break;
        }
        g.stroke({ color: 0x000000, width: 1.2, alpha: 0.18 });
        ear.addChild(g);
    }

    private blink(): void {
        const eyeY = -HEAD_R * 0.05;
        this.leftLid.clear();
        this.leftLid.moveTo(-HEAD_R * 0.32 - 7, eyeY).lineTo(-HEAD_R * 0.32 + 7, eyeY)
            .stroke({ color: 0x1a1230, width: 2.2, cap: "round" });
        this.rightLid.clear();
        this.rightLid.moveTo(HEAD_R * 0.32 - 7, eyeY).lineTo(HEAD_R * 0.32 + 7, eyeY)
            .stroke({ color: 0x1a1230, width: 2.2, cap: "round" });
        this.leftEye.alpha = 0;  this.rightEye.alpha = 0;
        this.leftPupil.alpha = 0; this.rightPupil.alpha = 0;
        setTimeout(() => {
            this.leftLid.clear(); this.rightLid.clear();
            this.leftEye.alpha = 1;  this.rightEye.alpha = 1;
            this.leftPupil.alpha = 1; this.rightPupil.alpha = 1;
        }, 80);
    }

    private applyAction(tSec: number, deltaMs: number): void {
        let bodyY = 0, bodyRot = 0;
        let headY = 0, headRot = 0;
        let leftLegRot = 0, rightLegRot = 0;
        let leftLegY = 0, rightLegY = 0;
        let leftArmRot = -0.05, rightArmRot = 0.05;
        let tailRot = Math.sin(tSec * 1.6) * 0.12;
        let leftEarRot = 0, rightEarRot = 0;

        // Idle breathing
        bodyY = Math.sin(tSec * 1.2) * 1.2;
        headY = bodyY * 0.8;

        switch (this.currentAction) {
            case "walk": {
                const phase = tSec * 4.2;
                bodyY = Math.abs(Math.sin(phase)) * -3;
                bodyRot = Math.sin(phase) * 0.04;
                headY = bodyY * -0.5;
                headRot = -bodyRot * 0.6;
                leftLegRot = Math.sin(phase) * 0.45;
                rightLegRot = Math.sin(phase + Math.PI) * 0.45;
                leftLegY = Math.max(0, -Math.sin(phase)) * -4;
                rightLegY = Math.max(0, -Math.sin(phase + Math.PI)) * -4;
                leftArmRot = Math.sin(phase + Math.PI) * 0.35 - 0.05;
                rightArmRot = Math.sin(phase) * 0.35 + 0.05;
                tailRot = Math.sin(phase) * 0.25;
                break;
            }
            case "eat":
                bodyY = 4; bodyRot = 0.05;
                headY = 6; headRot = 0.15;
                this.mouth.clear();
                this.mouth.ellipse(0, 5, 4, 2 + Math.abs(Math.sin(tSec * 7) * 3)).fill(0x1a1230);
                leftArmRot = -0.4; rightArmRot = 0.4;
                break;
            case "sleep": {
                bodyY = 8; bodyRot = 0.08;
                headY = 12; headRot = 0.25;
                leftEarRot = 0.15; rightEarRot = -0.15;
                this.leftEye.alpha = 0; this.rightEye.alpha = 0;
                this.leftPupil.alpha = 0; this.rightPupil.alpha = 0;
                const eyeY = -HEAD_R * 0.05;
                this.leftLid.clear();
                this.leftLid.moveTo(-HEAD_R * 0.32 - 6, eyeY).lineTo(-HEAD_R * 0.32 + 6, eyeY)
                    .stroke({ color: 0x1a1230, width: 2.2, cap: "round" });
                this.rightLid.clear();
                this.rightLid.moveTo(HEAD_R * 0.32 - 6, eyeY).lineTo(HEAD_R * 0.32 + 6, eyeY)
                    .stroke({ color: 0x1a1230, width: 2.2, cap: "round" });
                break;
            }
            case "yawn":
                this.mouth.clear();
                this.mouth.ellipse(0, 6, 5, 6).fill(0x1a1230);
                bodyY = -3; headY = -4;
                break;
            case "sneeze":
                if ((tSec * 8) % 2 < 1) {
                    bodyY = -4; headRot = -0.2;
                    leftEarRot = -0.2; rightEarRot = 0.2;
                }
                break;
            case "scratch":
                rightArmRot = -1.4 + Math.sin(tSec * 6) * 0.25;
                headRot = Math.sin(tSec * 6) * 0.1;
                break;
            case "look_at_camera":
                headRot = 0; bodyRot = 0;
                break;
            case "chase_tail":
                this.container.rotation = Math.sin(tSec * 2.5) * 0.5;
                tailRot = Math.sin(tSec * 4) * 0.5;
                break;
            case "fart":
                bodyY = Math.sin(tSec * 12) * 1.2;
                tailRot = Math.sin(tSec * 8) * 0.4;
                break;
            case "play_with_toy":
                bodyY = Math.sin(tSec * 4) * -4;
                leftArmRot = Math.sin(tSec * 4) * 0.6;
                rightArmRot = Math.sin(tSec * 4 + Math.PI) * 0.6;
                tailRot = Math.sin(tSec * 6) * 0.4;
                break;
            case "wash":
                leftArmRot = -1.2 + Math.sin(tSec * 5) * 0.4;
                rightArmRot = 1.2 + Math.sin(tSec * 5 + Math.PI) * 0.4;
                bodyY = Math.sin(tSec * 5) * -1.5;
                headRot = Math.sin(tSec * 5) * 0.1;
                break;
            case "shake":
                this.container.rotation = Math.sin(tSec * 22) * 0.18;
                tailRot = Math.sin(tSec * 22) * 0.6;
                break;
            case "sit":
                bodyY = 6;
                leftLegRot = -0.4;
                rightLegRot = -0.4;
                break;
            case "idle":
            default:
                break;
        }

        this.body.y = bodyY;
        this.body.rotation = bodyRot;
        this.head.y = -H * 0.85 + headY;
        this.head.rotation = headRot;
        this.leftLeg.rotation = leftLegRot;
        this.rightLeg.rotation = rightLegRot;
        this.leftLeg.y = H * 0.6 + leftLegY;
        this.rightLeg.y = H * 0.6 + rightLegY;
        this.leftArm.rotation = leftArmRot;
        this.rightArm.rotation = rightArmRot;
        this.tail.rotation = tailRot;
        this.leftEar.rotation = leftEarRot;
        this.rightEar.rotation = rightEarRot;

        if (this.actionTimer > 0) {
            this.actionTimer -= deltaMs;
            if (this.actionTimer <= 0) {
                this.currentAction = "idle";
                this.container.rotation = 0;
                const eyeY = -HEAD_R * 0.05;
                this.mouth.clear();
                this.mouth.moveTo(-5, eyeY + 16)
                    .quadraticCurveTo(0, eyeY + 21, 5, eyeY + 16)
                    .stroke({ color: 0x1a1230, width: 1.8, cap: "round" });
                this.leftEye.alpha = 1;  this.rightEye.alpha = 1;
                this.leftPupil.alpha = 1; this.rightPupil.alpha = 1;
                this.leftLid.clear(); this.rightLid.clear();
            }
        }
    }
}
