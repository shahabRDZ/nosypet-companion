/**
 * Top-level game class. Owns the PixiJS application, the room, the
 * creature, the particle system, and the behavior tree. Exposes a
 * `mount/unmount` lifecycle and a small command surface that React
 * can call (e.g. `game.feed()`, `game.pet()`).
 *
 * Phase 2 design choices
 * ----------------------
 * - All graphics are procedural, derived from the DNA phenotype.
 * - The behavior tree drives autonomous behavior; touch input is a
 *   separate channel that interrupts the BT only with high-priority
 *   actions like "lift_up" and "pet".
 * - State (hunger/happiness/energy/hygiene) is simulated locally and
 *   periodically synced to the backend in Phase 3.
 */
import { Application, Container, Graphics } from "pixi.js";
import { BloomFilter } from "pixi-filters";

import type { Phenotype } from "../types/companion";
import { AmbientLayer } from "./Ambient";
import { Bathroom, type BathroomLayout } from "./Bathroom";
import { Camera } from "./Camera";
import {
    Action,
    Cooldown,
    type BlackboardLike,
    type Node,
    RandomChance,
    Selector,
    Sequence,
    Status,
} from "./BehaviorTree";
import { Creature } from "./Creature";
import { Garden, type GardenLayout } from "./Garden";
import { Kitchen, type KitchenLayout } from "./Kitchen";
import { LivingRoom, type LivingRoomLayout } from "./LivingRoom";
import { Nursery, type NurseryLayout } from "./Nursery";
import { ParticleSystem } from "./Particles";
import { Room, type RoomLayout } from "./Room";
import type { ActionName, CreatureState, RoomBounds } from "./types";

type SceneKind = "bedroom" | "bathroom" | "kitchen" | "garden" | "living" | "nursery";

function haptic(pattern: number | number[]): void {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        try { navigator.vibrate(pattern); } catch { /* iOS silently rejects */ }
    }
}

interface SceneEntry {
    container: Container;
    fxLayer: Container;
    fgLayer: Container;
    floorY: number;
    width: number;
    height: number;
    update?: (dt: number, isNight: boolean) => void;
}

interface Hotspot {
    x: number;
    y: number;
    radius: number;
    onTap: () => void;
    glow: Graphics;          // a pulsing ring rendered behind the object
    proximityActive: boolean;
}

interface GameBlackboard extends BlackboardLike {
    state: CreatureState;
    bounds: RoomBounds;
    creature: Creature;
    particles: ParticleSystem;
    room: Room;
    target: { x: number; y: number; arrivedRadius: number; arrived: boolean };
    speed: number;
}

export class Game {
    public readonly app: Application;
    private rootContainer: Container;
    private camera!: Camera;
    private flashOverlay!: Graphics;
    private room!: Room;
    private bathroom!: Bathroom;
    private kitchen!: Kitchen;
    private garden!: Garden;
    private living!: LivingRoom;
    private nursery!: Nursery;
    private currentScene: SceneKind = "bedroom";
    private fadeOverlay!: Graphics;
    private ambient!: AmbientLayer;
    private highlightLayer!: Container;
    /** Interactable hotspots, keyed by scene. Each has world coords +
     *  the action that fires when the creature is near. */
    private interactables = new Map<SceneKind, Hotspot[]>();
    private creature!: Creature;
    private particles!: ParticleSystem;
    private bbState!: CreatureState;
    private blackboard!: GameBlackboard;
    private tree!: Node;
    private mounted = false;
    private destroyed = false;
    private resizeHandler?: () => void;
    private actionTimers: number[] = [];
    /** Sequential action queue. Prevents two simultaneous goto-targets
     *  from overwriting each other and lets us preempt with priority. */
    private actionChain: Promise<void> = Promise.resolve();
    /** Cursor world position, used by the eye-tracking effect. */
    private cursor: { x: number; y: number } | null = null;

    constructor() {
        this.app = new Application();
        this.rootContainer = new Container();
        this.rootContainer.sortableChildren = true;
    }

    public async mount(host: HTMLElement, phenotype: Phenotype, name: string): Promise<void> {
        if (this.mounted || this.destroyed) return;
        await this.app.init({
            background: 0x000000,
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
            resizeTo: host,
        });
        // The owner may have unmounted us while init() was in flight.
        if (this.destroyed) {
            this.app.destroy(true, { children: true });
            return;
        }
        if (host.isConnected) host.appendChild(this.app.canvas);
        this.app.stage.addChild(this.rootContainer);

        const w = this.app.canvas.width / (window.devicePixelRatio || 1);
        const h = this.app.canvas.height / (window.devicePixelRatio || 1);

        // Camera transforms the world container.
        this.camera = new Camera(this.rootContainer);
        this.camera.setViewport(w, h);

        // Bloom for dreamy halos around bright accents (sun, eyes, particles).
        try {
            const bloom = new BloomFilter({ strength: 6, kernelSize: 9, quality: 4 });
            this.rootContainer.filters = [bloom];
        } catch {
            // Filter unavailable in this build; degrade gracefully.
        }

        // Flash overlay outside the camera so it always covers the canvas.
        this.flashOverlay = new Graphics();
        this.flashOverlay.alpha = 0;
        this.flashOverlay.eventMode = "none";
        this.app.stage.addChild(this.flashOverlay);

        const layout = this.computeLayout();
        this.room = new Room(layout);
        this.particles = new ParticleSystem();
        this.creature = new Creature(phenotype);
        this.creature.setPosition(layout.width / 2, layout.floorY + 20);
        this.room.fxLayer.addChild(this.particles.container);
        this.rootContainer.addChild(this.room.container);
        this.rootContainer.addChild(this.creature.container);

        // Build the other scenes immediately so transitions are
        // instant (no async load).
        this.bathroom = new Bathroom(this.computeBathroomLayout(layout));
        this.kitchen = new Kitchen(this.computeKitchenLayout(layout));
        this.garden = new Garden(this.computeGardenLayout(layout));
        this.living = new LivingRoom(this.computeLivingLayout(layout));
        this.nursery = new Nursery(this.computeNurseryLayout(layout));

        // Ambient atmosphere lives above the active scene but below
        // the creature's speech bubble.
        this.ambient = new AmbientLayer(layout.width, layout.height, 24);
        this.rootContainer.addChild(this.ambient.container);

        // Highlight rings for interactable objects render in their own
        // layer so they show through scene contents.
        this.highlightLayer = new Container();
        this.highlightLayer.zIndex = 9;
        this.rootContainer.addChild(this.highlightLayer);

        this.registerInteractables();

        // Fade overlay for scene transitions.
        this.fadeOverlay = new Graphics();
        this.fadeOverlay.zIndex = 999;
        this.fadeOverlay.alpha = 0;
        this.rootContainer.addChild(this.fadeOverlay);
        this.drawFadeOverlay(layout.width, layout.height);

        // Direct manipulation: tap bowl/bed/toy/tub directly.
        this.attachSceneTaps();

        // Initial state. The server overwrites these on first poll.
        this.bbState = {
            phenotype,
            name,
            hunger: 75,
            happiness: 75,
            energy: 75,
            hygiene: 80,
            bladder: 20,
            sick: false,
            inComa: false,
            sleeping: false,
        };
        // Speed shaped by temperament so a calm pet drifts and a wild
        // one sprints. The DNA seed already chose temperament.
        const speedByTemp: Record<string, number> = {
            calm: 22, lazy: 18, shy: 28,
            curious: 38, energetic: 50, wild: 55, bold: 42,
        };
        const speed = speedByTemp[phenotype.temperament_seed] ?? 35;
        this.blackboard = {
            state: this.bbState,
            bounds: this.computeBounds(layout),
            creature: this.creature,
            particles: this.particles,
            room: this.room,
            target: { x: layout.width / 2, y: layout.floorY + 20, arrivedRadius: 6, arrived: true },
            speed,
        };

        this.tree = this.buildTree();
        this.attachInput();
        this.app.ticker.add((ticker) => this.tick(ticker.deltaMS));

        // Keep the world responsive on resize.
        this.resizeHandler = () => {
            const newLayout = this.computeLayout();
            this.room.layout.width = newLayout.width;
            this.room.layout.height = newLayout.height;
            this.room.layout.floorY = newLayout.floorY;
            this.ambient.resize(newLayout.width, newLayout.height);
            this.blackboard.bounds = this.computeBounds(newLayout);
        };
        window.addEventListener("resize", this.resizeHandler);

        // Greeting!
        this.creature.say(`Hi, I'm ${name}!`, 3500);

        this.mounted = true;
    }

    public unmount(): void {
        this.destroyed = true;
        if (this.actionTimers.length) {
            this.actionTimers.forEach((id) => clearInterval(id));
            this.actionTimers = [];
        }
        if (!this.mounted) return;
        if (this.resizeHandler) window.removeEventListener("resize", this.resizeHandler);
        this.app.destroy(true, { children: true });
        this.mounted = false;
    }

    /* ------------------------- public commands ------------------------ */

    private waitForArrival(): Promise<void> {
        if (!this.isReady()) return Promise.resolve();
        return new Promise<void>((resolve) => {
            const id = window.setInterval(() => {
                if (this.destroyed) { clearInterval(id); resolve(); return; }
                if (this.blackboard.target.arrived) {
                    clearInterval(id);
                    this.actionTimers = this.actionTimers.filter((t) => t !== id);
                    resolve();
                }
            }, 50);
            this.actionTimers.push(id);
        });
    }

    private wait(ms: number): Promise<void> {
        return new Promise<void>((resolve) => {
            const id = window.setTimeout(resolve, ms);
            this.actionTimers.push(id as unknown as number);
        });
    }

    /**
     * Queue an action so two clicks in a row do not race for the same
     * target. Each step runs sequentially. The chain swallows errors
     * so one broken step does not poison future ones.
     */
    private enqueue(step: () => Promise<void>): Promise<void> {
        const next = this.actionChain.then(() => {
            if (this.destroyed || !this.isReady()) return;
            return step().catch((e) => console.warn("action step failed", e));
        });
        this.actionChain = next.then(() => undefined, () => undefined);
        return next;
    }

    public feed(): Promise<void> {
        return this.enqueue(async () => {
            await this.slideToScene("kitchen");
            const layout = this.kitchen.layout;
            this.creature.setPosition(60, layout.floorY + 30);
            this.creature.setFacing(1);
            this.blackboard.target = {
                x: layout.bowlPos.x - 20, y: layout.floorY + 30, arrivedRadius: 8, arrived: false,
            };
            await this.waitForArrival();
            if (!this.isReady()) return;
            this.creature.playAction("eat", 2400);
            this.bbState.hunger = Math.min(100, this.bbState.hunger + 25);
            this.camera.punchIn(1.06, 240);
            this.camera.flash(0xffd166, 0.18, 260);
            for (let i = 0; i < 4; i++) {
                this.particles.emit({
                    x: this.creature.container.x + 10, y: this.creature.container.y - 20,
                    text: "🍞", count: 1, lifeMs: 900,
                });
                this.camera.shakeFor(2, 80);
                await this.wait(450);
            }
            await this.slideToScene("bedroom");
            this.creature.setPosition(this.room.layout.width / 2, this.room.layout.floorY + 30);
        });
    }

    public play(): Promise<void> {
        return this.enqueue(async () => {
            await this.slideToScene("garden");
            const layout = this.garden.layout;
            this.creature.setPosition(60, layout.floorY + 30);
            this.creature.setFacing(1);
            this.blackboard.target = {
                x: layout.toyPos.x - 20, y: layout.floorY + 30, arrivedRadius: 8, arrived: false,
            };
            await this.waitForArrival();
            if (!this.isReady()) return;
            this.creature.playAction("play_with_toy", 2500);
            this.bbState.happiness = Math.min(100, this.bbState.happiness + 25);
            this.bbState.energy = Math.max(0, this.bbState.energy - 10);
            this.camera.punchIn(1.05, 220);
            this.camera.flash(0xff7eb3, 0.15, 240);
            for (let i = 0; i < 5; i++) {
                this.particles.emit({
                    x: this.creature.container.x, y: this.creature.container.y - 30,
                    text: "❤️", count: 1, lifeMs: 1200,
                });
                if (i === 2) this.camera.shakeFor(3, 100);
                await this.wait(280);
            }
            await this.slideToScene("bedroom");
            this.creature.setPosition(this.room.layout.width / 2, this.room.layout.floorY + 30);
        });
    }

    public sleep(): Promise<void> {
        return this.enqueue(async () => {
            const layout = this.room.layout;
            this.blackboard.target = { x: layout.bedPos.x, y: layout.bedPos.y + 8, arrivedRadius: 22, arrived: false };
            await this.waitForArrival();
            if (!this.isReady()) return;
            this.creature.playAction("sleep", 4000);
            this.bbState.energy = Math.min(100, this.bbState.energy + 35);
            const id = window.setInterval(() => {
                if (this.destroyed) { clearInterval(id); return; }
                this.particles.emit({
                    x: this.creature.container.x + 20,
                    y: this.creature.container.y - 30,
                    text: "Z", count: 1, lifeMs: 1500, size: 22,
                });
            }, 600);
            this.actionTimers.push(id);
            await this.wait(4000);
            clearInterval(id);
        });
    }

    public pet(): void {
        if (!this.isReady()) return;
        if (this.bbState.sleeping) return;
        this.creature.playAction("look_at_camera", 1200);
        this.bbState.happiness = Math.min(100, this.bbState.happiness + 5);
        this.particles.emit({
            x: this.creature.container.x,
            y: this.creature.container.y - 50,
            text: "💕", count: 3, lifeMs: 1100,
        });
        this.creature.say("That feels nice", 1800);
        // Juice: subtle zoom-in pulse + hit-stop for tactile feedback.
        this.camera.punchIn(1.04, 180);
        this.camera.hitStop(40);
        this.camera.flash(0xff7eb3, 0.15, 200);
        haptic(20);
    }

    public scold(): void {
        if (!this.isReady() || this.bbState.sleeping) return;
        this.creature.playAction("flinch", 900);
        this.particles.emit({
            x: this.creature.container.x,
            y: this.creature.container.y - 30,
            text: "😢", count: 2, lifeMs: 1300,
        });
        this.creature.say("...sorry", 1500);
        // Hard, jagged feedback: shake + dim red flash + hit-stop.
        this.camera.shakeFor(6, 220);
        this.camera.hitStop(60);
        this.camera.flash(0xef4444, 0.25, 320);
        haptic([15, 30, 15]);
    }

    public toilet(): Promise<void> {
        return this.enqueue(async () => {
            await this.slideToScene("bathroom");
            const layout = this.bathroom.layout;
            this.creature.setPosition(layout.width * 0.18, layout.floorY + 30);
            this.creature.setFacing(1);
            // Walk to a position next to the tub (bathroom doubles as
            // the toilet location until we add a separate fixture).
            this.blackboard.target = {
                x: layout.tubPos.x - 70, y: layout.floorY + 30,
                arrivedRadius: 8, arrived: false,
            };
            await this.waitForArrival();
            if (!this.isReady()) return;
            this.creature.playAction("sit", 2200);
            // Relief particle + small sigh
            this.particles.emit({
                x: this.creature.container.x, y: this.creature.container.y - 20,
                text: "💧", count: 2, lifeMs: 900, upward: false,
            });
            this.creature.say("phew", 1400);
            await this.wait(2200);
            this.bbState.bladder = 0;
            await this.slideToScene("bedroom");
            this.creature.setPosition(this.room.layout.width / 2, this.room.layout.floorY + 30);
        });
    }

    public wakeUp(): void {
        if (!this.isReady() || !this.bbState.sleeping) return;
        this.bbState.sleeping = false;
        this.creature.playAction("yawn", 1400);
        this.creature.say("...mm?", 1500);
        haptic(30);
    }

    public triggerAccident(): void {
        if (!this.isReady()) return;
        this.creature.playAction("flinch", 1100);
        this.particles.emit({
            x: this.creature.container.x,
            y: this.creature.container.y + 6,
            text: "💩", count: 1, lifeMs: 2200, upward: false, size: 24,
        });
        this.creature.say("...uh oh", 2000);
        this.bbState.bladder = 0;
        this.camera.shakeFor(8, 360);
        this.camera.flash(0x6b3a1a, 0.25, 420);
        haptic([10, 80, 10]);
    }

    /** Navigate to the living room. */
    public goLiving(): Promise<void> {
        return this.enqueue(async () => {
            await this.slideToScene("living");
            this.creature.setPosition(this.living.layout.width * 0.32, this.living.layout.floorY + 30);
            this.creature.setFacing(1);
        });
    }

    /** Navigate to the nursery. */
    public goNursery(): Promise<void> {
        return this.enqueue(async () => {
            await this.slideToScene("nursery");
            this.creature.setPosition(this.nursery.layout.width * 0.3, this.nursery.layout.floorY + 30);
            this.creature.setFacing(1);
        });
    }

    /** Return home to the bedroom. */
    public goBedroom(): Promise<void> {
        return this.enqueue(async () => {
            await this.slideToScene("bedroom");
            this.creature.setPosition(this.room.layout.width / 2, this.room.layout.floorY + 30);
        });
    }

    public getCurrentScene(): SceneKind { return this.currentScene; }

    /** Full bath sequence: transition to bathroom, walk to tub, three
     *  rub cycles with bubble particles, shake-off, transition back. */
    public wash(): Promise<void> {
        return this.enqueue(async () => {
            await this.slideToScene("bathroom");
            const layout = this.bathroom.layout;
            this.creature.setPosition(layout.width * 0.18, layout.floorY + 30);
            this.creature.setFacing(1);
            this.bathroom.setWaterLevel(0);

            // Walk over to the tub.
            this.blackboard.target = {
                x: layout.tubPos.x - 30,
                y: layout.floorY + 30,
                arrivedRadius: 8,
                arrived: false,
            };
            await this.waitForArrival();
            if (!this.isReady()) return;

            // Climb in (small jump).
            await this.fadeJump(layout.tubPos.x, layout.tubPos.y, 320);
            this.creature.setPosition(layout.tubPos.x, layout.tubPos.y);

            // Fill tub with water.
            await this.animateValue(0, 1, 1200, (v) => {
                this.bathroom.setWaterLevel(v);
                if (Math.random() < 0.3) {
                    this.particles.emit({
                        x: layout.tubBounds.x + layout.tubBounds.w * 0.85,
                        y: layout.tubBounds.y + 6,
                        text: "💧", count: 1, lifeMs: 800, upward: false, size: 14,
                    });
                }
            });

            // Rub cycle: 3 wash bursts with bubbles.
            for (let i = 0; i < 3; i++) {
                this.creature.playAction("wash", 1100);
                for (let k = 0; k < 4; k++) {
                    this.particles.emit({
                        x: layout.tubPos.x + (Math.random() - 0.5) * 50,
                        y: layout.tubPos.y - 30,
                        text: "○", count: 1, lifeMs: 1100, size: 18 + Math.random() * 10,
                    });
                }
                await this.wait(900);
            }

            this.creature.setWetness(1);

            // Climb out + shake off.
            await this.fadeJump(layout.tubPos.x - 60, layout.floorY + 30, 320);
            this.creature.setPosition(layout.tubPos.x - 60, layout.floorY + 30);
            this.creature.playAction("shake", 1200);
            for (let i = 0; i < 12; i++) {
                this.particles.emit({
                    x: this.creature.container.x + (Math.random() - 0.5) * 60,
                    y: this.creature.container.y - 30,
                    text: "💧", count: 1, lifeMs: 700,
                });
                await this.wait(80);
            }

            // Drain water as the creature walks away.
            await this.animateValue(1, 0, 600, (v) => this.bathroom.setWaterLevel(v));

            await this.slideToScene("bedroom");
            this.creature.setPosition(this.room.layout.width / 2, this.room.layout.floorY + 30);
            this.bbState.hygiene = Math.min(100, this.bbState.hygiene + 40);
        });
    }

    public emitSneeze(): void {
        if (!this.isReady()) return;
        this.creature.playAction("sneeze", 1100);
        this.particles.emit({
            x: this.creature.container.x, y: this.creature.container.y - 30,
            text: "💧", count: 1,
        });
    }

    public say(text: string, durationMs?: number): void {
        this.creature.say(text, durationMs);
    }

    public isReady(): boolean {
        return this.mounted && !!this.bbState;
    }

    /**
     * Update the creature's mood/state from the server. Lets the
     * server be authoritative for hunger/happiness/energy/sickness
     * while the client still drives spontaneous animation.
     *
     * Safe to call before mount() finishes: it no-ops until the
     * blackboard is initialized, since calling code (React effects)
     * may race the async PixiJS init.
     */
    public applyServerState(s: {
        hunger?: number;
        happiness?: number;
        energy?: number;
        hygiene?: number;
        bladder?: number;
        is_sick?: boolean;
        is_in_coma?: boolean;
        is_sleeping?: boolean;
    }): void {
        if (!this.bbState) return;
        if (s.hunger !== undefined) this.bbState.hunger = s.hunger;
        if (s.happiness !== undefined) this.bbState.happiness = s.happiness;
        if (s.energy !== undefined) this.bbState.energy = s.energy;
        if (s.hygiene !== undefined) this.bbState.hygiene = s.hygiene;
        if (s.bladder !== undefined) this.bbState.bladder = s.bladder;
        if (s.is_sick !== undefined) this.bbState.sick = s.is_sick;
        if (s.is_in_coma !== undefined) this.bbState.inComa = s.is_in_coma;
        if (s.is_sleeping !== undefined) this.bbState.sleeping = s.is_sleeping;
    }

    public getStateSnapshot(): CreatureState {
        return { ...this.bbState };
    }

    /* ------------------------- internals ------------------------ */

    private tick(deltaMs: number): void {
        this.elapsed += deltaMs;

        // Camera step (returns true if hit-stopped: skip world update).
        const frozen = this.camera.update(deltaMs);

        // Render the flash overlay over the entire viewport.
        const flash = this.camera.getFlash();
        if (flash.active) {
            const w = this.app.canvas.width / (window.devicePixelRatio || 1);
            const h = this.app.canvas.height / (window.devicePixelRatio || 1);
            this.flashOverlay.clear();
            this.flashOverlay.rect(0, 0, w, h).fill({ color: flash.color, alpha: flash.alpha });
            this.flashOverlay.alpha = 1;
        } else {
            this.flashOverlay.alpha = 0;
        }

        if (frozen) return;

        // Decay over real time, very slow.
        const minutes = deltaMs / 60000;
        this.bbState.hunger = Math.max(0, this.bbState.hunger - 1.2 * minutes);
        this.bbState.happiness = Math.max(0, this.bbState.happiness - 0.9 * minutes);
        this.bbState.energy = Math.max(0, this.bbState.energy - 0.7 * minutes);

        const isNight = (() => {
            const h = new Date().getHours();
            return h >= 20 || h < 6;
        })();
        const scene = this.getSceneEntry(this.currentScene);
        scene.update?.(deltaMs, isNight);
        this.ambient.setMode(isNight ? "night" : "day");
        this.ambient.update(deltaMs);
        this.updateHotspotGlows(deltaMs);
        this.driveNeeds(deltaMs);
        // BT only ticks when the companion is awake.
        if (!this.bbState.sleeping) {
            this.tree.tick(deltaMs, this.blackboard);
        }
        if (this.cursor) {
            const local = this.creature.container.toLocal({ x: this.cursor.x, y: this.cursor.y });
            this.creature.lookAt(local.x, local.y);
        }
        this.creature.update(deltaMs, this.bbState);
        this.particles.update(deltaMs);
    }

    /** Move the creature in a parabolic arc (used for jumping into / out of the tub). */
    private fadeJump(targetX: number, targetY: number, durationMs: number): Promise<void> {
        const startX = this.creature.container.x;
        const startY = this.creature.container.y;
        return this.animateValue(0, 1, durationMs, (t) => {
            const x = startX + (targetX - startX) * t;
            const y = startY + (targetY - startY) * t - Math.sin(t * Math.PI) * 30;
            this.creature.setPosition(x, y);
        });
    }

    /** Generic eased value animator. */
    private animateValue(
        from: number, to: number, durationMs: number,
        onUpdate: (value: number) => void,
    ): Promise<void> {
        return new Promise<void>((resolve) => {
            const start = performance.now();
            const tick = () => {
                if (this.destroyed) { resolve(); return; }
                const t = Math.min(1, (performance.now() - start) / durationMs);
                const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
                onUpdate(from + (to - from) * eased);
                if (t < 1) requestAnimationFrame(tick);
                else resolve();
            };
            requestAnimationFrame(tick);
        });
    }

    private getSceneEntry(kind: SceneKind): SceneEntry {
        if (kind === "bedroom") return {
            container: this.room.container, fxLayer: this.room.fxLayer, fgLayer: this.room.fgLayer,
            floorY: this.room.layout.floorY, width: this.room.layout.width, height: this.room.layout.height,
            update: (dt, n) => this.room.update(dt, n),
        };
        if (kind === "bathroom") return {
            container: this.bathroom.container, fxLayer: this.bathroom.fxLayer, fgLayer: this.bathroom.fgLayer,
            floorY: this.bathroom.layout.floorY, width: this.bathroom.layout.width, height: this.bathroom.layout.height,
        };
        if (kind === "kitchen") return {
            container: this.kitchen.container, fxLayer: this.kitchen.fxLayer, fgLayer: this.kitchen.fgLayer,
            floorY: this.kitchen.layout.floorY, width: this.kitchen.layout.width, height: this.kitchen.layout.height,
        };
        if (kind === "living") return {
            container: this.living.container, fxLayer: this.living.fxLayer, fgLayer: this.living.fgLayer,
            floorY: this.living.layout.floorY, width: this.living.layout.width, height: this.living.layout.height,
            update: (dt) => this.living.update(dt),
        };
        if (kind === "nursery") return {
            container: this.nursery.container, fxLayer: this.nursery.fxLayer, fgLayer: this.nursery.fgLayer,
            floorY: this.nursery.layout.floorY, width: this.nursery.layout.width, height: this.nursery.layout.height,
            update: (dt) => this.nursery.update(dt),
        };
        return {
            container: this.garden.container, fxLayer: this.garden.fxLayer, fgLayer: this.garden.fgLayer,
            floorY: this.garden.layout.floorY, width: this.garden.layout.width, height: this.garden.layout.height,
            update: (dt) => this.garden.update(dt),
        };
    }

    /** Build a Hotspot entry per scene with a pulsing glow ring. */
    private registerInteractables(): void {
        const make = (_scene: SceneKind, x: number, y: number, radius: number, onTap: () => void): Hotspot => {
            const glow = new Graphics();
            glow.visible = false;
            glow.x = x; glow.y = y;
            this.highlightLayer.addChild(glow);
            const hs: Hotspot = { x, y, radius, onTap, glow, proximityActive: false };
            return hs;
        };
        const room = this.room.layout;
        this.interactables.set("bedroom", [
            make("bedroom", room.bowlPos.x, room.bowlPos.y, 36, () => this.feed()),
            make("bedroom", room.bedPos.x,  room.bedPos.y,  46, () => this.sleep()),
            make("bedroom", room.toyPos.x,  room.toyPos.y,  28, () => this.play()),
        ]);
        const k = this.kitchen.layout;
        this.interactables.set("kitchen", [
            make("kitchen", k.bowlPos.x, k.bowlPos.y, 38, () => this.feed()),
        ]);
        const g = this.garden.layout;
        this.interactables.set("garden", [
            make("garden", g.toyPos.x, g.toyPos.y, 32, () => this.play()),
        ]);
        const liv = this.living.layout;
        this.interactables.set("living", [
            make("living", liv.sofaPos.x, liv.sofaPos.y, 60, () => this.pet()),
        ]);
        const nur = this.nursery.layout;
        this.interactables.set("nursery", [
            make("nursery", nur.cribPos.x, nur.cribPos.y, 70, () => this.sleep()),
        ]);
        // Bathroom hotspot is handled by the wash sequence itself.
    }

    /** Slide transition: old scene exits left, new scene enters from
     *  right. More cinematic than a fade. */
    private async slideToScene(kind: SceneKind): Promise<void> {
        if (kind === this.currentScene) return;
        const oldEntry = this.getSceneEntry(this.currentScene);
        const newEntry = this.getSceneEntry(kind);
        const w = newEntry.width;

        // Stage the new scene off-screen to the right.
        newEntry.container.x = w;
        newEntry.fxLayer.addChild(this.particles.container);
        this.rootContainer.addChildAt(newEntry.container, 0);

        await this.animateValue(0, 1, 420, (t) => {
            const eased = 1 - Math.pow(1 - t, 3);
            oldEntry.container.x = -w * eased;
            newEntry.container.x = w * (1 - eased);
        });

        try { this.rootContainer.removeChild(oldEntry.container); } catch { /* */ }
        oldEntry.container.x = 0;
        newEntry.container.x = 0;
        this.blackboard.bounds = {
            minX: 60,
            maxX: newEntry.width - 60,
            minY: newEntry.floorY + 14,
            maxY: newEntry.height - 30,
        };
        this.currentScene = kind;
    }

    private computeBathroomLayout(roomLayout: RoomLayout): BathroomLayout {
        const tubW = 180;
        const tubH = 70;
        const tubX = roomLayout.width / 2 - tubW / 2;
        const tubY = roomLayout.floorY + (roomLayout.height - roomLayout.floorY) * 0.45;
        return {
            width: roomLayout.width,
            height: roomLayout.height,
            floorY: roomLayout.floorY,
            tubPos: { x: tubX + tubW / 2, y: tubY + tubH * 0.55 },
            tubBounds: { x: tubX, y: tubY, w: tubW, h: tubH },
        };
    }

    private computeKitchenLayout(roomLayout: RoomLayout): KitchenLayout {
        return {
            width: roomLayout.width,
            height: roomLayout.height,
            floorY: roomLayout.floorY,
            bowlPos: { x: roomLayout.width * 0.5, y: roomLayout.floorY + (roomLayout.height - roomLayout.floorY) * 0.55 },
        };
    }

    private computeGardenLayout(roomLayout: RoomLayout): GardenLayout {
        return {
            width: roomLayout.width,
            height: roomLayout.height,
            floorY: roomLayout.floorY,
            toyPos: { x: roomLayout.width * 0.5, y: roomLayout.floorY + (roomLayout.height - roomLayout.floorY) * 0.6 },
        };
    }

    private computeLivingLayout(roomLayout: RoomLayout): LivingRoomLayout {
        return {
            width: roomLayout.width,
            height: roomLayout.height,
            floorY: roomLayout.floorY,
            sofaPos: { x: roomLayout.width * 0.42, y: roomLayout.floorY - 4 },
        };
    }

    private computeNurseryLayout(roomLayout: RoomLayout): NurseryLayout {
        return {
            width: roomLayout.width,
            height: roomLayout.height,
            floorY: roomLayout.floorY,
            cribPos: { x: roomLayout.width * 0.5, y: roomLayout.floorY - 16 },
        };
    }

    private drawFadeOverlay(width: number, height: number): void {
        this.fadeOverlay.clear();
        this.fadeOverlay.rect(0, 0, width, height).fill(0x000000);
    }

    /** Tap-on-object: each hotspot has a hit container in highlightLayer
     *  that lights up when the creature is close. Tapping it triggers
     *  the action. */
    private attachSceneTaps(): void {
        for (const [, list] of this.interactables) {
            for (const hs of list) {
                hs.glow.eventMode = "static";
                hs.glow.cursor = "pointer";
                hs.glow.on("pointertap", () => hs.onTap());
            }
        }
    }

    /** Pulse the glow rings for hotspots in the active scene, brighter
     *  when the creature is within the proximity radius. */
    private updateHotspotGlows(deltaMs: number): void {
        const t = this.elapsed / 600;
        for (const [scene, list] of this.interactables) {
            const inActive = scene === this.currentScene && !this.destroyed;
            for (const hs of list) {
                if (!inActive) {
                    hs.glow.visible = false;
                    hs.proximityActive = false;
                    continue;
                }
                const dx = this.creature.container.x - hs.x;
                const dy = this.creature.container.y - hs.y;
                const dist = Math.hypot(dx, dy);
                const near = dist <= hs.radius * 1.6;
                hs.glow.visible = true;
                hs.proximityActive = near;
                hs.glow.clear();
                const baseR = hs.radius;
                const pulse = 1 + Math.sin(t) * 0.06;
                if (near) {
                    // Strong concentric rings + warm fill
                    hs.glow.circle(0, 0, baseR * 1.0 * pulse)
                        .stroke({ color: 0xffd84a, width: 3, alpha: 0.85 });
                    hs.glow.circle(0, 0, baseR * 1.25 * pulse)
                        .stroke({ color: 0xffd84a, width: 2, alpha: 0.45 });
                    hs.glow.circle(0, 0, baseR)
                        .fill({ color: 0xffd84a, alpha: 0.08 });
                } else {
                    // Subtle hint ring
                    hs.glow.circle(0, 0, baseR * 0.95)
                        .stroke({ color: 0xffffff, width: 1.5, alpha: 0.35 });
                }
            }
        }
        void deltaMs;
    }

    /** Track elapsed time for animations. */
    private elapsed = 0;
    private nextNeedNagAt = 0;
    private bladderWasFull = false;

    /** Auto-trigger begging / potty dancing / crying based on stats. */
    private driveNeeds(_deltaMs: number): void {
        if (!this.isReady()) return;
        const s = this.bbState;

        // Sleeping: pin to sleep animation, emit Z particles slowly.
        if (s.sleeping) {
            this.creature.playAction("sleep", 1500);
            if (this.elapsed - this.nextNeedNagAt > 0) {
                this.nextNeedNagAt = this.elapsed + 2200;
                this.particles.emit({
                    x: this.creature.container.x + 22,
                    y: this.creature.container.y - 30,
                    text: "Z", count: 1, lifeMs: 1500, size: 22,
                });
            }
            return;
        }

        // Accident detection — server flips bladder to 0 and we want
        // to play the local accident animation just once.
        if (s.bladder >= 100) {
            if (!this.bladderWasFull) {
                this.bladderWasFull = true;
                this.triggerAccident();
            }
            return;
        }
        if (s.bladder < 90) this.bladderWasFull = false;

        // Don't override an action that is currently playing.
        if (this.creature["currentAction"] !== "idle" && this.creature["currentAction"] !== "walk") {
            return;
        }

        if (this.elapsed < this.nextNeedNagAt) return;

        // Priority: bladder > hunger > happiness.
        if (s.bladder >= 70) {
            this.creature.playAction("potty_dance", 1500);
            this.particles.emit({
                x: this.creature.container.x, y: this.creature.container.y - 50,
                text: "💧", count: 1, lifeMs: 1100,
            });
            this.creature.say("I need to go!", 2200);
            this.nextNeedNagAt = this.elapsed + 5000;
            haptic([10, 50, 10]);
            return;
        }
        if (s.hunger < 25) {
            this.creature.playAction("beg", 1800);
            this.particles.emit({
                x: this.creature.container.x, y: this.creature.container.y - 40,
                text: "🍞", count: 1, lifeMs: 1100,
            });
            this.creature.say("I'm hungry...", 2200);
            this.nextNeedNagAt = this.elapsed + 6000;
            haptic([10, 40]);
            return;
        }
        if (s.happiness < 25) {
            this.creature.playAction("cry", 1500);
            this.particles.emit({
                x: this.creature.container.x, y: this.creature.container.y - 30,
                text: "😢", count: 2, lifeMs: 1200,
            });
            this.nextNeedNagAt = this.elapsed + 8000;
            return;
        }
    }

    private computeLayout(): RoomLayout {
        const width = this.app.canvas.width / (window.devicePixelRatio || 1);
        const height = this.app.canvas.height / (window.devicePixelRatio || 1);
        const floorY = height * 0.58;
        const usableY = height - floorY;
        return {
            width, height, floorY,
            // Bowl bottom-right between dresser (left) and plant (far right).
            bowlPos: { x: width * 0.30, y: floorY + usableY * 0.7 },
            // Bed in the centre-left of the floor, below wall art.
            bedPos:  { x: width * 0.55, y: floorY + usableY * 0.42 },
            // Toy bottom-centre, on the rug.
            toyPos:  { x: width * 0.5,  y: floorY + usableY * 0.85 },
        };
    }

    private computeBounds(layout: RoomLayout): RoomBounds {
        return {
            minX: 60,
            maxX: layout.width - 60,
            minY: layout.floorY + 14,
            maxY: layout.height - 30,
        };
    }

    /* ------------------------- behavior tree ------------------------ */

    private buildTree(): Node {
        const moveToTarget: Action = new Action((dt, bb) => {
            const g = bb as GameBlackboard;
            if (g.target.arrived) return Status.Success;
            const dx = g.target.x - g.creature.container.x;
            const dy = g.target.y - g.creature.container.y;
            const dist = Math.hypot(dx, dy);
            if (dist <= g.target.arrivedRadius) {
                g.target.arrived = true;
                g.creature.playAction("idle");
                return Status.Success;
            }
            const step = (g.speed * dt) / 1000;
            const nx = g.creature.container.x + (dx / dist) * step;
            const ny = g.creature.container.y + (dy / dist) * step;
            g.creature.setFacing(dx > 0 ? 1 : -1);
            g.creature.setPosition(nx, ny);
            g.creature.playAction("walk", 200);
            return Status.Running;
        });

        const pickRandomTarget: Action = new Action((_dt, bb) => {
            const g = bb as GameBlackboard;
            const x = g.bounds.minX + Math.random() * (g.bounds.maxX - g.bounds.minX);
            const y = g.bounds.minY + Math.random() * (g.bounds.maxY - g.bounds.minY);
            g.target = { x, y, arrivedRadius: 6, arrived: false };
            return Status.Success;
        });

        const idleFor = (ms: number): Action => {
            let elapsed = 0;
            return new Action((dt) => {
                elapsed += dt;
                if (elapsed >= ms) {
                    elapsed = 0;
                    return Status.Success;
                }
                return Status.Running;
            });
        };

        const playOneShot = (action: ActionName, durationMs: number, particle?: { text: string; count?: number; size?: number }): Action => {
            let started = false;
            let elapsed = 0;
            return new Action((dt, bb) => {
                const g = bb as GameBlackboard;
                if (!started) {
                    g.creature.playAction(action, durationMs);
                    if (particle) {
                        g.particles.emit({
                            x: g.creature.container.x,
                            y: g.creature.container.y - 30,
                            text: particle.text,
                            count: particle.count ?? 2,
                            size: particle.size,
                        });
                    }
                    started = true;
                    elapsed = 0;
                }
                elapsed += dt;
                if (elapsed >= durationMs) {
                    started = false;
                    return Status.Success;
                }
                return Status.Running;
            });
        };

        // Root selector: priority list.
        return new Selector([
            // 1. Spontaneous quirks. Cooldowns prevent spam.
            new Cooldown(8000, new RandomChance(0.4, new Sequence([
                playOneShot("fart", 1300, { text: "💨", count: 2 }),
            ]))),
            new Cooldown(7000, new RandomChance(0.3, new Sequence([
                playOneShot("sneeze", 1100, { text: "💧", count: 1 }),
            ]))),
            new Cooldown(6000, new RandomChance(0.4, new Sequence([
                playOneShot("yawn", 1300),
            ]))),
            new Cooldown(5000, new RandomChance(0.3, new Sequence([
                playOneShot("scratch", 1500),
            ]))),
            new Cooldown(4000, new RandomChance(0.5, new Sequence([
                playOneShot("look_at_camera", 1200),
            ]))),
            new Cooldown(15000, new RandomChance(0.2, new Sequence([
                playOneShot("chase_tail", 2400, { text: "✨", count: 4 }),
            ]))),

            // 2. Default: wander to a random spot, idle, repeat.
            new Sequence([
                pickRandomTarget,
                moveToTarget,
                idleFor(1200 + Math.random() * 1500),
            ]),
        ]);
    }

    /** Outside listeners (set by the React page). */
    public onTap?: () => void;
    public onLongPress?: () => void;
    public onSwipeDown?: () => void;

    private attachInput(): void {
        this.app.stage.eventMode = "static";
        this.creature.container.eventMode = "static";
        this.creature.container.cursor = "pointer";
        this.app.canvas.style.touchAction = "none";

        this.app.stage.on("globalpointermove", (e) => {
            this.cursor = { x: e.global.x, y: e.global.y };
        });

        let pressTimer: number | undefined;
        let downX = 0, downY = 0, downAt = 0;
        let didLong = false;

        const onDown = (e: { global: { x: number; y: number } }) => {
            downX = e.global.x;
            downY = e.global.y;
            downAt = performance.now();
            didLong = false;
            pressTimer = window.setTimeout(() => {
                pressTimer = undefined;
                didLong = true;
                this.onLongPress?.();
                haptic([15, 30, 15]);
            }, 600);
        };

        const onUp = (e?: { global: { x: number; y: number } }) => {
            if (pressTimer !== undefined) {
                clearTimeout(pressTimer);
                pressTimer = undefined;
            }
            if (didLong) return;
            if (e) {
                const dx = e.global.x - downX;
                const dy = e.global.y - downY;
                const elapsed = performance.now() - downAt;
                // Hard swipe down = scold.
                if (dy > 70 && Math.abs(dy) > Math.abs(dx) * 1.4 && elapsed < 500) {
                    this.onSwipeDown?.();
                    haptic([15, 50]);
                    return;
                }
            }
            this.onTap?.();
            haptic(15);
        };

        this.creature.container.on("pointerdown", onDown);
        this.creature.container.on("pointerup", onUp);
        this.creature.container.on("pointerupoutside", () => onUp());
    }
}
