/**
 * Camera system: zoom-to-target, screen shake, hit-stop, screen flash.
 *
 * The PixiJS world lives inside a `worldContainer` that the camera
 * transforms each frame. The stage's `rootContainer` is this world,
 * so every scene/creature/particle inherits the camera transform
 * for free.
 *
 * All effects compose: shake stacks on zoom stacks on baseline.
 */
import { Container } from "pixi.js";

interface ShakeState {
    until: number;
    amplitude: number;
}

export class Camera {
    /** The container that everything renders into. */
    public readonly world: Container;

    private viewW = 0;
    private viewH = 0;
    private targetZoom = 1;
    private currentZoom = 1;
    private targetX = 0;
    private targetY = 0;
    private currentX = 0;
    private currentY = 0;
    private shake: ShakeState | null = null;
    private hitStopUntil = 0;
    private flashUntil = 0;
    private flashIntensity = 0;
    private flashColor = 0xffffff;

    constructor(world: Container) {
        this.world = world;
    }

    public setViewport(width: number, height: number): void {
        this.viewW = width;
        this.viewH = height;
        // Pivot at the centre so zoom/shake feel natural.
        this.world.pivot.set(width / 2, height / 2);
        this.world.x = width / 2;
        this.world.y = height / 2;
    }

    /** Update once per frame. */
    public update(deltaMs: number): boolean {
        // Hit-stop: freeze world updates until the timer passes.
        const now = performance.now();
        const hitStopActive = now < this.hitStopUntil;
        if (hitStopActive) return true;

        // Smoothly follow the target zoom and offset.
        const lerp = Math.min(1, deltaMs / 120);
        this.currentZoom += (this.targetZoom - this.currentZoom) * lerp;
        this.currentX += (this.targetX - this.currentX) * lerp;
        this.currentY += (this.targetY - this.currentY) * lerp;

        // Apply shake on top.
        let shakeX = 0, shakeY = 0;
        if (this.shake && now < this.shake.until) {
            shakeX = (Math.random() - 0.5) * this.shake.amplitude * 2;
            shakeY = (Math.random() - 0.5) * this.shake.amplitude * 2;
        } else if (this.shake) {
            this.shake = null;
        }

        this.world.scale.set(this.currentZoom);
        this.world.x = this.viewW / 2 + this.currentX + shakeX;
        this.world.y = this.viewH / 2 + this.currentY + shakeY;
        return false;
    }

    /** Tween zoom in for `holdMs` then back to 1. */
    public punchIn(zoom = 1.08, holdMs = 200): void {
        this.targetZoom = zoom;
        setTimeout(() => { this.targetZoom = 1; }, holdMs);
    }

    /** Tiny screen shake. */
    public shakeFor(amplitude: number, durationMs: number): void {
        const until = performance.now() + durationMs;
        this.shake = { until, amplitude };
    }

    /** Brief world freeze for impact accent. */
    public hitStop(durationMs: number): void {
        this.hitStopUntil = performance.now() + durationMs;
    }

    /** Returns flash params so the caller can render a coloured fill. */
    public getFlash(): { active: boolean; alpha: number; color: number } {
        if (performance.now() >= this.flashUntil) return { active: false, alpha: 0, color: 0 };
        const remaining = this.flashUntil - performance.now();
        // Decay from intensity to 0 across the duration.
        const total = this.flashUntil - (this.flashUntil - 350);
        const alpha = Math.max(0, Math.min(1, this.flashIntensity * (remaining / total)));
        return { active: true, alpha, color: this.flashColor };
    }

    public flash(color = 0xffffff, intensity = 0.45, durationMs = 350): void {
        this.flashColor = color;
        this.flashIntensity = intensity;
        this.flashUntil = performance.now() + durationMs;
    }
}
