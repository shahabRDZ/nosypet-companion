/**
 * Anatomic skeleton creature with two-segment limbs.
 *
 * Hierarchy (each level is a Container with its own pivot):
 *
 *   character
 *     shadow
 *     tail (secondary motion, behind body)
 *     leftThigh                   pivot at hip
 *       leftShin                  pivot at knee
 *         leftFoot                pivot at ankle
 *     rightThigh / rightShin / rightFoot   (mirrored)
 *     body                        pivot at hip joint
 *       torso
 *       belly + pattern
 *       leftShoulder              pivot at shoulder
 *         leftForearm             pivot at elbow
 *           leftPaw
 *       rightShoulder / rightForearm / rightPaw
 *       head                      pivot at neck
 *         (ears, eyes, brows, lids, cheeks, mouth, antenna, nose)
 *
 * The two-segment limbs let the walk cycle have a real knee bend
 * (heel strike: leg extends; recovery: knee bends as the leg lifts).
 * Arms get an elbow bend too. Idle adds gentle breathing, slow head
 * settle, occasional ear twitches and a roving gaze.
 */
import { Container, Graphics, Text } from "pixi.js";

import type { Phenotype } from "../types/companion";
import type { ActionName, CreatureState } from "./types";

const W = 64;        // half torso width
const H = 56;        // half torso height
const HEAD_R = 46;   // head radius (intentionally large for chibi-cute)
const NECK_OFFSET = -H * 0.6;
const HIP_W = W * 0.32;     // x-distance of leg from centre
const SHOULDER_W = W * 0.62;
const THIGH_LEN = 16;
const SHIN_LEN = 16;
const UPPER_ARM_LEN = 16;
const FOREARM_LEN = 16;

export class Creature {
    public readonly container: Container;

    private shadow: Graphics;
    private tail: Container;

    // Lower body (full hierarchy for IK-lite walk)
    private leftThigh: Container;  private leftShin: Container;  private leftFoot: Container;
    private rightThigh: Container; private rightShin: Container; private rightFoot: Container;

    private body: Container;          // torso + arms + head all pivot here
    private torsoG: Graphics;
    private bellyG: Graphics;
    private pattern: Graphics | null = null;

    // Arms with elbow bend
    private leftShoulder: Container;  private leftForearm: Container;  private leftPaw: Container;
    private rightShoulder: Container; private rightForearm: Container; private rightPaw: Container;

    private head: Container;
    private leftEar: Container;  private rightEar: Container;
    private leftEye: Graphics;   private rightEye: Graphics;
    private leftPupil: Graphics; private rightPupil: Graphics;
    private leftLid: Graphics;   private rightLid: Graphics;
    private leftBrow: Graphics;  private rightBrow: Graphics;
    private mouth: Graphics;
    private nose: Graphics;
    private cheekL: Graphics;    private cheekR: Graphics;

    private speechBubble: Container;
    private speechText: Text;
    private speechBg: Graphics;

    private elapsed = 0;
    private currentAction: ActionName = "idle";
    private actionTimer = 0;
    private blinkTimer = Math.random() * 3000;
    private idleGazeTimer = 0;
    private idleGazeTarget = { x: 0, y: 0 };
    private earTwitchTimer = 4000;
    private facing: 1 | -1 = 1;
    private speechVisibleUntil = 0;
    private gazeX = 0;
    private gazeY = 0;
    private wetness = 0;

    constructor(private phenotype: Phenotype) {
        this.container = new Container();
        this.container.sortableChildren = true;

        this.shadow = new Graphics();   this.shadow.zIndex = 0;
        this.tail   = new Container();  this.tail.zIndex = 1;

        // Build left and right leg chains.
        const buildLeg = (xOffset: number) => {
            const thigh = new Container();
            thigh.x = xOffset;
            thigh.y = H * 0.55;
            thigh.zIndex = 2;
            const shin = new Container();
            shin.y = THIGH_LEN;
            const foot = new Container();
            foot.y = SHIN_LEN;
            shin.addChild(foot);
            thigh.addChild(shin);
            return { thigh, shin, foot };
        };
        const left = buildLeg(-HIP_W);
        const right = buildLeg(HIP_W);
        this.leftThigh = left.thigh;   this.leftShin = left.shin;   this.leftFoot = left.foot;
        this.rightThigh = right.thigh; this.rightShin = right.shin; this.rightFoot = right.foot;

        this.body = new Container();
        this.body.zIndex = 3;
        this.torsoG = new Graphics();
        this.bellyG = new Graphics();
        this.body.addChild(this.torsoG, this.bellyG);

        // Arms — two-segment, child of body so they move with torso rock.
        const buildArm = (xOffset: number) => {
            const shoulder = new Container();
            shoulder.x = xOffset;
            shoulder.y = -H * 0.05;
            const forearm = new Container();
            forearm.y = UPPER_ARM_LEN;
            const paw = new Container();
            paw.y = FOREARM_LEN;
            forearm.addChild(paw);
            shoulder.addChild(forearm);
            return { shoulder, forearm, paw };
        };
        const lArm = buildArm(-SHOULDER_W);
        const rArm = buildArm(SHOULDER_W);
        this.leftShoulder = lArm.shoulder;   this.leftForearm = lArm.forearm;   this.leftPaw = lArm.paw;
        this.rightShoulder = rArm.shoulder;  this.rightForearm = rArm.forearm;  this.rightPaw = rArm.paw;
        this.body.addChild(this.leftShoulder, this.rightShoulder);

        this.head = new Container();
        this.head.y = NECK_OFFSET;
        this.body.addChild(this.head);

        this.leftEar = new Container();   this.rightEar = new Container();
        this.leftEye = new Graphics();    this.rightEye = new Graphics();
        this.leftPupil = new Graphics();  this.rightPupil = new Graphics();
        this.leftLid = new Graphics();    this.rightLid = new Graphics();
        this.leftBrow = new Graphics();   this.rightBrow = new Graphics();
        this.mouth = new Graphics();
        this.nose = new Graphics();
        this.cheekL = new Graphics();     this.cheekR = new Graphics();
        this.head.addChild(
            this.leftEar, this.rightEar,
            this.leftEye, this.rightEye,
            this.leftPupil, this.rightPupil,
            this.leftLid, this.rightLid,
            this.leftBrow, this.rightBrow,
            this.cheekL, this.cheekR,
            this.nose, this.mouth,
        );

        this.container.addChild(
            this.shadow, this.tail,
            this.leftThigh, this.rightThigh,
            this.body,
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

    /* ---------------- public API ---------------- */

    public setPosition(x: number, y: number): void {
        this.container.x = x;
        this.container.y = y;
    }

    public setFacing(dir: 1 | -1): void {
        if (dir === this.facing) return;
        this.facing = dir;
        // Mirror by flipping the body (with everything beneath it) and
        // swapping leg/arm offsets via the existing transform.
        const flip = dir;
        this.body.scale.x = flip;
        this.tail.scale.x = flip;
        this.leftThigh.scale.x = flip;
        this.rightThigh.scale.x = flip;
    }

    public playAction(name: ActionName, durationMs = 1500): void {
        this.currentAction = name;
        this.actionTimer = durationMs;
    }

    public lookAt(localX: number, localY: number): void {
        const tx = Math.max(-3.5, Math.min(3.5, localX / 40));
        const ty = Math.max(-2.8, Math.min(2.8, (localY + 70) / 50));
        this.gazeX = tx;
        this.gazeY = ty;
        this.idleGazeTimer = 4000;  // overrides the wandering gaze for a bit
    }

    public say(text: string, durationMs = 3000): void {
        this.speechText.text = text;
        const padding = 10;
        const w = Math.min(190, this.speechText.width + padding * 2);
        const h = this.speechText.height + padding * 2;
        this.speechBg.clear();
        this.speechBg.roundRect(0, 0, w, h, 12).fill({ color: 0xffffff, alpha: 0.97 });
        this.speechBg.stroke({ color: 0x222244, width: 1, alpha: 0.6 });
        this.speechBg.moveTo(w / 2 - 6, h)
            .lineTo(w / 2 + 6, h)
            .lineTo(w / 2,    h + 8)
            .closePath()
            .fill({ color: 0xffffff, alpha: 0.97 })
            .stroke({ color: 0x222244, width: 1, alpha: 0.6 });
        this.speechText.x = padding;
        this.speechText.y = padding;
        this.speechBubble.x = -w / 2;
        this.speechBubble.y = NECK_OFFSET - HEAD_R - h - 30;
        this.speechBubble.visible = true;
        this.speechVisibleUntil = performance.now() + durationMs;
    }

    public setWetness(amount: number): void {
        this.wetness = Math.max(0, Math.min(1, amount));
    }

    public update(deltaMs: number, state: CreatureState): void {
        this.elapsed += deltaMs;
        this.blinkTimer -= deltaMs;
        this.idleGazeTimer -= deltaMs;
        this.earTwitchTimer -= deltaMs;
        const t = this.elapsed / 1000;

        // Wandering gaze when nothing is grabbing attention.
        if (this.idleGazeTimer <= 0) {
            this.idleGazeTarget.x = (Math.random() - 0.5) * 5;
            this.idleGazeTarget.y = (Math.random() - 0.5) * 3;
            this.idleGazeTimer = 1800 + Math.random() * 1800;
        }
        const gx = this.idleGazeTimer < 1500 ? this.idleGazeTarget.x : this.gazeX;
        const gy = this.idleGazeTimer < 1500 ? this.idleGazeTarget.y : this.gazeY;
        const lerp = 0.18;
        this.leftPupil.x  = lerp * gx + (1 - lerp) * this.leftPupil.x;
        this.leftPupil.y  = lerp * gy + (1 - lerp) * this.leftPupil.y;
        this.rightPupil.x = lerp * gx + (1 - lerp) * this.rightPupil.x;
        this.rightPupil.y = lerp * gy + (1 - lerp) * this.rightPupil.y;

        if (this.blinkTimer < 0) {
            this.blink();
            this.blinkTimer = 2300 + Math.random() * 2400;
        }

        if (this.earTwitchTimer < 0) {
            const which = Math.random() < 0.5 ? this.leftEar : this.rightEar;
            const dir = Math.random() < 0.5 ? -0.25 : 0.25;
            which.rotation = dir;
            setTimeout(() => { which.rotation = 0; }, 120);
            this.earTwitchTimer = 5000 + Math.random() * 4000;
        }

        if (this.speechBubble.visible && performance.now() > this.speechVisibleUntil) {
            this.speechBubble.visible = false;
        }

        // Mood tint
        let tint = 0xffffff;
        if (state.sick) tint = 0xb8d8b8;
        else if (state.happiness < 25) tint = 0xc8c8c8;
        this.body.tint = tint;

        // Eyebrow shape responds to mood
        this.drawBrows(state.sick ? "sick" : state.happiness < 25 ? "sad" : state.happiness > 70 ? "happy" : "neutral");

        if (this.wetness > 0.05) {
            this.head.alpha = 1 - this.wetness * 0.18;
            this.wetness = Math.max(0, this.wetness - deltaMs / 8000);
        } else {
            this.head.alpha = 1;
        }

        this.applyAction(t, deltaMs);

        // Shadow follows body height (smaller and fainter when jumping).
        const bodyOffset = this.body.y;
        const shadowScale = 1 - Math.min(0.4, Math.max(0, -bodyOffset) / 30);
        this.shadow.scale.x = shadowScale;
        this.shadow.alpha = 0.18 + (1 - shadowScale) * 0.1;

        this.container.scale.set(this.phenotype.size_modifier);
    }

    /* ---------------- drawing ---------------- */

    private draw(): void {
        const p = this.phenotype;
        const bodyHex = parseInt(p.body_color_hex.slice(1), 16);
        const accentHex = parseInt(p.accent_color_hex.slice(1), 16);
        const eyeHex = parseInt(p.eye_color_hex.slice(1), 16);
        const innerEarHex = darken(bodyHex, 0.7);

        // Shadow
        this.shadow.clear();
        this.shadow.ellipse(0, H + THIGH_LEN + SHIN_LEN + 6, W * 0.85, 7).fill({ color: 0x000000, alpha: 0.28 });

        // Tail
        this.drawTail(bodyHex);

        // Legs (two-segment) - draw upper and lower segments.
        this.drawLegSegments(this.leftThigh, this.leftShin, this.leftFoot, bodyHex);
        this.drawLegSegments(this.rightThigh, this.rightShin, this.rightFoot, bodyHex);

        // Torso (rounded chibi shape — wider near top of body)
        this.torsoG.clear();
        this.torsoG.moveTo(-W * 0.78, -H * 0.45);
        this.torsoG.bezierCurveTo(-W * 1.05, -H * 0.4, -W * 1.0, H * 0.5, -W * 0.62, H * 0.6);
        this.torsoG.lineTo(W * 0.62, H * 0.6);
        this.torsoG.bezierCurveTo(W * 1.0, H * 0.5, W * 1.05, -H * 0.4, W * 0.78, -H * 0.45);
        this.torsoG.closePath();
        this.torsoG.fill(bodyHex);
        this.torsoG.stroke({ color: 0x000000, width: 2.5, alpha: 0.18 });

        // Belly (lighter cream patch)
        this.bellyG.clear();
        this.bellyG.ellipse(0, H * 0.15, W * 0.45, H * 0.4).fill({ color: 0xffffff, alpha: 0.5 });

        if (this.pattern) this.body.removeChild(this.pattern);
        this.pattern = this.makePattern(accentHex);
        if (this.pattern) {
            this.pattern.zIndex = 1;
            this.body.addChildAt(this.pattern, 2);
        }

        // Arm segments
        this.drawArmSegments(this.leftShoulder, this.leftForearm, this.leftPaw, bodyHex);
        this.drawArmSegments(this.rightShoulder, this.rightForearm, this.rightPaw, bodyHex);

        // Head
        this.drawHead(bodyHex, eyeHex, accentHex, innerEarHex);
    }

    private drawLegSegments(thigh: Container, shin: Container, foot: Container, bodyHex: number): void {
        // Clear previous segments if redrawing
        thigh.removeChildren().filter((_, i) => i === 0); // keep shin (children[0])
        const thighG = new Graphics();
        thighG.roundRect(-7, 0, 14, THIGH_LEN + 2, 6).fill(bodyHex);
        thighG.stroke({ color: 0x000000, width: 1.4, alpha: 0.18 });
        thigh.addChildAt(thighG, 0);

        const shinG = new Graphics();
        shinG.roundRect(-6, 0, 12, SHIN_LEN + 2, 5).fill(bodyHex);
        shinG.stroke({ color: 0x000000, width: 1.3, alpha: 0.18 });
        shin.addChildAt(shinG, 0);

        const footG = new Graphics();
        footG.ellipse(0, 4, 11, 5).fill(0x6e3a52);
        // Toe pads
        footG.circle(-4, 1, 1.6).fill({ color: 0xffffff, alpha: 0.3 });
        footG.circle(4, 1, 1.6).fill({ color: 0xffffff, alpha: 0.3 });
        foot.addChildAt(footG, 0);
    }

    private drawArmSegments(shoulder: Container, forearm: Container, paw: Container, bodyHex: number): void {
        const upperG = new Graphics();
        upperG.roundRect(-5, 0, 10, UPPER_ARM_LEN + 2, 4).fill(bodyHex);
        upperG.stroke({ color: 0x000000, width: 1.3, alpha: 0.18 });
        shoulder.addChildAt(upperG, 0);

        const fG = new Graphics();
        fG.roundRect(-5, 0, 10, FOREARM_LEN + 2, 4).fill(bodyHex);
        fG.stroke({ color: 0x000000, width: 1.3, alpha: 0.18 });
        forearm.addChildAt(fG, 0);

        const pawG = new Graphics();
        pawG.circle(0, 4, 6).fill(bodyHex);
        pawG.stroke({ color: 0x000000, width: 1, alpha: 0.18 });
        // Toe pads
        pawG.circle(-2.3, 3, 1.2).fill({ color: 0x000000, alpha: 0.4 });
        pawG.circle(0,    3, 1.2).fill({ color: 0x000000, alpha: 0.4 });
        pawG.circle(2.3,  3, 1.2).fill({ color: 0x000000, alpha: 0.4 });
        paw.addChildAt(pawG, 0);
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

    private drawTail(bodyHex: number): void {
        this.tail.x = -W * 0.7;
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

    private drawHead(bodyHex: number, eyeHex: number, accentHex: number, innerEarHex: number): void {
        // Background head fill
        const headG = new Graphics();
        headG.ellipse(0, 0, HEAD_R, HEAD_R * 0.94).fill(bodyHex);
        headG.stroke({ color: 0x000000, width: 2.5, alpha: 0.2 });
        this.head.addChildAt(headG, 0);

        // Optional pattern on head (spots / freckles)
        const headPattern = this.makeHeadPattern(accentHex);
        if (headPattern) this.head.addChildAt(headPattern, 1);

        // Antenna with glowing tip
        const antenna = new Graphics();
        antenna.moveTo(2, -HEAD_R * 0.95)
            .quadraticCurveTo(0, -HEAD_R * 1.2, 4, -HEAD_R * 1.42)
            .stroke({ color: 0x6e3a52, width: 2.8, cap: "round" });
        antenna.circle(4, -HEAD_R * 1.44, 5).fill(0xffd84a);
        antenna.circle(2.5, -HEAD_R * 1.47, 1.5).fill(0xffffff);
        this.head.addChildAt(antenna, 2);

        // Ears with inner colour for depth
        this.drawEar(this.leftEar,  -HEAD_R * 0.78, -HEAD_R * 0.6, -1, bodyHex, innerEarHex);
        this.drawEar(this.rightEar,  HEAD_R * 0.78, -HEAD_R * 0.6,  1, bodyHex, innerEarHex);

        const eyeY = -HEAD_R * 0.06;
        const eyeR = 8;

        this.leftEye.clear();
        this.leftEye.ellipse(-HEAD_R * 0.32, eyeY, eyeR, eyeR * 1.15).fill(0xffffff);
        this.leftEye.ellipse(-HEAD_R * 0.32, eyeY, eyeR, eyeR * 1.15).stroke({ color: eyeHex, width: 1.4, alpha: 0.75 });

        this.rightEye.clear();
        this.rightEye.ellipse(HEAD_R * 0.32, eyeY, eyeR, eyeR * 1.15).fill(0xffffff);
        this.rightEye.ellipse(HEAD_R * 0.32, eyeY, eyeR, eyeR * 1.15).stroke({ color: eyeHex, width: 1.4, alpha: 0.75 });

        this.leftPupil.clear();
        this.leftPupil.circle(-HEAD_R * 0.32, eyeY, 4).fill(0x1a1230);
        this.leftPupil.circle(-HEAD_R * 0.32 + 1.3, eyeY - 1.3, 1.5).fill(0xffffff);

        this.rightPupil.clear();
        this.rightPupil.circle(HEAD_R * 0.32, eyeY, 4).fill(0x1a1230);
        this.rightPupil.circle(HEAD_R * 0.32 + 1.3, eyeY - 1.3, 1.5).fill(0xffffff);

        this.leftLid.clear();
        this.rightLid.clear();

        // Eyebrows (default neutral)
        this.drawBrows("neutral");

        // Cheeks
        this.cheekL.clear();
        this.cheekL.circle(-HEAD_R * 0.62, eyeY + 11, 4.5).fill({ color: 0xff7eb3, alpha: 0.62 });
        this.cheekR.clear();
        this.cheekR.circle(HEAD_R * 0.62, eyeY + 11, 4.5).fill({ color: 0xff7eb3, alpha: 0.62 });

        // Tiny nose
        this.nose.clear();
        this.nose.ellipse(0, eyeY + 12, 2.5, 1.6).fill(0x4a2030);

        // Default mouth (small smile)
        this.mouth.clear();
        this.mouth.moveTo(-5, eyeY + 18)
            .quadraticCurveTo(0, eyeY + 22, 5, eyeY + 18)
            .stroke({ color: 0x1a1230, width: 1.8, cap: "round" });
    }

    private drawBrows(mood: "neutral" | "happy" | "sad" | "sick"): void {
        const eyeY = -HEAD_R * 0.06;
        const browY = eyeY - 11;
        this.leftBrow.clear();
        this.rightBrow.clear();
        const stroke = { color: 0x1a1230, width: 2, cap: "round" } as const;
        if (mood === "happy") {
            this.leftBrow.moveTo(-HEAD_R * 0.4, browY + 1)
                .quadraticCurveTo(-HEAD_R * 0.32, browY - 3, -HEAD_R * 0.24, browY + 1)
                .stroke(stroke);
            this.rightBrow.moveTo(HEAD_R * 0.4, browY + 1)
                .quadraticCurveTo(HEAD_R * 0.32, browY - 3, HEAD_R * 0.24, browY + 1)
                .stroke(stroke);
        } else if (mood === "sad" || mood === "sick") {
            this.leftBrow.moveTo(-HEAD_R * 0.42, browY - 2)
                .lineTo(-HEAD_R * 0.22, browY + 2)
                .stroke(stroke);
            this.rightBrow.moveTo(HEAD_R * 0.42, browY - 2)
                .lineTo(HEAD_R * 0.22, browY + 2)
                .stroke(stroke);
        } else {
            this.leftBrow.moveTo(-HEAD_R * 0.4, browY)
                .lineTo(-HEAD_R * 0.24, browY).stroke(stroke);
            this.rightBrow.moveTo(HEAD_R * 0.4, browY)
                .lineTo(HEAD_R * 0.24, browY).stroke(stroke);
        }
    }

    private makeHeadPattern(accent: number): Graphics | null {
        if (this.phenotype.pattern !== "spots" && this.phenotype.pattern !== "freckles") return null;
        const g = new Graphics();
        const fp = this.phenotype.fingerprint;
        if (this.phenotype.pattern === "spots") {
            for (let i = 0; i < 5; i++) {
                const x = (fp[i * 3 + 5] - 0.5) * HEAD_R * 1.4;
                const y = (fp[i * 3 + 6] - 0.5) * HEAD_R * 0.7;
                g.circle(x, y, 2.5 + fp[i * 3 + 7] * 2).fill({ color: accent, alpha: 0.7 });
            }
        } else {
            for (let i = 0; i < 8; i++) {
                const x = (fp[i + 20] - 0.5) * HEAD_R * 1.2;
                const y = (fp[i + 30] - 0.5) * HEAD_R * 0.4;
                g.circle(x, y, 0.9).fill({ color: 0x000000, alpha: 0.55 });
            }
        }
        return g;
    }

    private drawEar(ear: Container, x: number, y: number, mirror: number, bodyHex: number, innerHex: number): void {
        ear.x = x;
        ear.y = y;
        ear.pivot.set(0, 4);
        const g = new Graphics();
        switch (this.phenotype.ear_shape) {
            case "round":
                g.circle(0, 0, 10).fill(bodyHex);
                g.circle(0, 1, 6).fill(innerHex);
                break;
            case "pointy":
                g.poly([-7, 6, 7 * mirror, 6, 2 * mirror, -16]).fill(bodyHex);
                g.poly([-3, 4, 4 * mirror, 4, 1 * mirror, -10]).fill(innerHex);
                break;
            case "floppy":
                g.ellipse(0, 8, 7, 14).fill(bodyHex);
                g.ellipse(0, 9, 4, 9).fill(innerHex);
                break;
            case "tufted":
                g.poly([-5, 4, 5, 4, 2 * mirror, -16, -1 * mirror, -8]).fill(bodyHex);
                g.poly([-2, 3, 3, 3, 1 * mirror, -10]).fill(innerHex);
                break;
            case "small":
                g.circle(0, 4, 5).fill(bodyHex);
                g.circle(0, 4.5, 3).fill(innerHex);
                break;
        }
        g.stroke({ color: 0x000000, width: 1.4, alpha: 0.2 });
        ear.addChild(g);
    }

    /* ---------------- animations ---------------- */

    private blink(): void {
        const eyeY = -HEAD_R * 0.06;
        this.leftLid.clear();
        this.leftLid.moveTo(-HEAD_R * 0.32 - 8, eyeY).lineTo(-HEAD_R * 0.32 + 8, eyeY)
            .stroke({ color: 0x1a1230, width: 2.4, cap: "round" });
        this.rightLid.clear();
        this.rightLid.moveTo(HEAD_R * 0.32 - 8, eyeY).lineTo(HEAD_R * 0.32 + 8, eyeY)
            .stroke({ color: 0x1a1230, width: 2.4, cap: "round" });
        this.leftEye.alpha = 0;  this.rightEye.alpha = 0;
        this.leftPupil.alpha = 0; this.rightPupil.alpha = 0;
        setTimeout(() => {
            this.leftLid.clear(); this.rightLid.clear();
            this.leftEye.alpha = 1;  this.rightEye.alpha = 1;
            this.leftPupil.alpha = 1; this.rightPupil.alpha = 1;
        }, 100);
    }

    private applyAction(tSec: number, deltaMs: number): void {
        // Defaults
        let bodyY = 0, bodyRot = 0;
        let bodyScaleY = 1, bodyScaleX = 1;
        let headRot = 0;
        let leftThighRot = 0, rightThighRot = 0;
        let leftShinRot = 0, rightShinRot = 0;
        let leftShoulderRot = -0.15, rightShoulderRot = 0.15;
        let leftElbow = 0.3, rightElbow = 0.3;
        let tailRot = Math.sin(tSec * 1.6) * 0.15;
        let leftEarBase = 0, rightEarBase = 0;

        // Idle breathing
        const breath = Math.sin(tSec * 1.4) * 1.2;
        bodyY = breath;

        switch (this.currentAction) {
            case "walk": {
                const phase = tSec * 4.5;
                const bounce = Math.abs(Math.sin(phase)) * -3.5;
                bodyY = bounce + Math.sin(tSec * 1.2) * 0.4;
                bodyRot = Math.sin(phase) * 0.04;
                headRot = -bodyRot * 0.7;            // head settles, counter to body
                bodyScaleY = 1 + Math.sin(phase * 2) * 0.025;

                // Hip swings: left forward when right back.
                leftThighRot  = Math.sin(phase) * 0.5;
                rightThighRot = Math.sin(phase + Math.PI) * 0.5;
                // Knee bend: shin bends on the lifting (forward) phase.
                leftShinRot  = Math.max(0, Math.sin(phase)) * 0.6;
                rightShinRot = Math.max(0, Math.sin(phase + Math.PI)) * 0.6;

                leftShoulderRot = Math.sin(phase + Math.PI) * 0.32 - 0.15;
                rightShoulderRot = Math.sin(phase) * 0.32 + 0.15;
                leftElbow = 0.3 + Math.max(0, Math.sin(phase)) * 0.25;
                rightElbow = 0.3 + Math.max(0, Math.sin(phase + Math.PI)) * 0.25;

                tailRot = Math.sin(phase) * 0.3;
                break;
            }

            case "eat": {
                bodyY = 5; bodyRot = 0.06;
                headRot = 0.18;
                this.mouth.clear();
                const open = 2 + Math.abs(Math.sin(tSec * 7) * 4);
                this.mouth.ellipse(0, -HEAD_R * 0.06 + 18, 5, open).fill(0x1a1230);
                leftShoulderRot = -0.6; rightShoulderRot = 0.6;
                leftElbow = 0.9; rightElbow = 0.9;
                break;
            }

            case "sleep": {
                bodyY = 12; bodyRot = 0.1;
                headRot = 0.28;
                bodyScaleY = 0.92;
                leftEarBase = 0.18; rightEarBase = -0.18;
                leftThighRot = -0.35; rightThighRot = -0.35;
                leftShinRot = 0.4; rightShinRot = 0.4;
                leftShoulderRot = -0.5; rightShoulderRot = 0.5;
                leftElbow = 1.1; rightElbow = 1.1;
                this.leftEye.alpha = 0; this.rightEye.alpha = 0;
                this.leftPupil.alpha = 0; this.rightPupil.alpha = 0;
                const eyeY = -HEAD_R * 0.06;
                this.leftLid.clear();
                this.leftLid.moveTo(-HEAD_R * 0.32 - 7, eyeY).lineTo(-HEAD_R * 0.32 + 7, eyeY)
                    .stroke({ color: 0x1a1230, width: 2.4, cap: "round" });
                this.rightLid.clear();
                this.rightLid.moveTo(HEAD_R * 0.32 - 7, eyeY).lineTo(HEAD_R * 0.32 + 7, eyeY)
                    .stroke({ color: 0x1a1230, width: 2.4, cap: "round" });
                break;
            }

            case "yawn": {
                this.mouth.clear();
                this.mouth.ellipse(0, -HEAD_R * 0.06 + 18, 6, 7).fill(0x1a1230);
                bodyY = -3; headRot = -0.05;
                bodyScaleY = 1.04;
                break;
            }

            case "sneeze": {
                if ((tSec * 8) % 2 < 1) {
                    bodyY = -5; headRot = -0.25;
                    leftEarBase = -0.25; rightEarBase = 0.25;
                }
                break;
            }

            case "scratch": {
                rightShoulderRot = -1.4 + Math.sin(tSec * 6) * 0.25;
                rightElbow = 1.0;
                headRot = Math.sin(tSec * 6) * 0.1;
                break;
            }

            case "look_at_camera": {
                headRot = 0; bodyRot = 0;
                break;
            }

            case "chase_tail": {
                this.container.rotation = Math.sin(tSec * 2.5) * 0.5;
                tailRot = Math.sin(tSec * 4) * 0.5;
                break;
            }

            case "fart": {
                bodyY = Math.sin(tSec * 12) * 1.3;
                tailRot = Math.sin(tSec * 8) * 0.4;
                break;
            }

            case "play_with_toy": {
                // Anticipation crouch -> jump -> recovery
                const t = tSec * 2;
                const crouch = Math.max(0, Math.sin(t)) ;
                bodyY = -crouch * 7;
                bodyScaleY = 1 + crouch * -0.1;
                bodyScaleX = 1 + crouch * 0.08;
                leftShoulderRot = Math.sin(tSec * 4) * 0.6;
                rightShoulderRot = Math.sin(tSec * 4 + Math.PI) * 0.6;
                tailRot = Math.sin(tSec * 6) * 0.4;
                break;
            }

            case "wash": {
                leftShoulderRot = -1.3 + Math.sin(tSec * 5) * 0.45;
                rightShoulderRot = 1.3 + Math.sin(tSec * 5 + Math.PI) * 0.45;
                leftElbow = 1.0; rightElbow = 1.0;
                bodyY = Math.sin(tSec * 5) * -1.5;
                headRot = Math.sin(tSec * 5) * 0.12;
                break;
            }

            case "shake": {
                this.container.rotation = Math.sin(tSec * 22) * 0.18;
                tailRot = Math.sin(tSec * 22) * 0.6;
                leftEarBase = Math.sin(tSec * 22) * 0.4;
                rightEarBase = Math.sin(tSec * 22) * 0.4;
                break;
            }

            case "sit": {
                bodyY = 8;
                leftThighRot = -0.7; rightThighRot = -0.7;
                leftShinRot = 1.2; rightShinRot = 1.2;
                break;
            }

            case "idle":
            default:
                break;
        }

        // Apply transforms
        this.body.y = bodyY;
        this.body.rotation = bodyRot;
        this.body.scale.set(this.facing * bodyScaleX, bodyScaleY);
        this.head.rotation = headRot;

        this.leftThigh.rotation = leftThighRot;
        this.rightThigh.rotation = rightThighRot;
        this.leftShin.rotation = leftShinRot;
        this.rightShin.rotation = rightShinRot;

        this.leftShoulder.rotation = leftShoulderRot;
        this.rightShoulder.rotation = rightShoulderRot;
        this.leftForearm.rotation = leftElbow;
        this.rightForearm.rotation = rightElbow;

        this.tail.rotation = tailRot;
        this.leftEar.rotation = leftEarBase;
        this.rightEar.rotation = rightEarBase;

        if (this.actionTimer > 0) {
            this.actionTimer -= deltaMs;
            if (this.actionTimer <= 0) {
                this.currentAction = "idle";
                this.container.rotation = 0;
                const eyeY = -HEAD_R * 0.06;
                this.mouth.clear();
                this.mouth.moveTo(-5, eyeY + 18)
                    .quadraticCurveTo(0, eyeY + 22, 5, eyeY + 18)
                    .stroke({ color: 0x1a1230, width: 1.8, cap: "round" });
                this.leftEye.alpha = 1;  this.rightEye.alpha = 1;
                this.leftPupil.alpha = 1; this.rightPupil.alpha = 1;
                this.leftLid.clear(); this.rightLid.clear();
            }
        }
    }
}

/* ---------------- helpers ---------------- */

function darken(hex: number, factor: number): number {
    const r = Math.floor(((hex >> 16) & 0xff) * factor);
    const g = Math.floor(((hex >> 8) & 0xff) * factor);
    const b = Math.floor((hex & 0xff) * factor);
    return (r << 16) | (g << 8) | b;
}
