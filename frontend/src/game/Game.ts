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
import { Application, Container } from "pixi.js";

import type { Phenotype } from "../types/companion";
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
import { ParticleSystem } from "./Particles";
import { Room, type RoomLayout } from "./Room";
import type { ActionName, CreatureState, RoomBounds } from "./types";

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
    private room!: Room;
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

        const layout = this.computeLayout();
        this.room = new Room(layout);
        this.particles = new ParticleSystem();
        this.creature = new Creature(phenotype);
        this.creature.setPosition(layout.width / 2, layout.floorY + 20);
        this.room.fxLayer.addChild(this.particles.container);
        this.rootContainer.addChild(this.room.container);
        this.rootContainer.addChild(this.creature.container);

        // Initial state. In Phase 3 these come from the server.
        this.bbState = {
            phenotype,
            name,
            hunger: 75,
            happiness: 75,
            energy: 75,
            hygiene: 80,
            sick: false,
            inComa: false,
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
            const layout = this.room.layout;
            this.blackboard.target = { x: layout.bowlPos.x, y: layout.bowlPos.y + 10, arrivedRadius: 18, arrived: false };
            await this.waitForArrival();
            if (!this.isReady()) return;
            this.creature.playAction("eat", 2000);
            this.bbState.hunger = Math.min(100, this.bbState.hunger + 25);
            this.particles.emit({
                x: this.creature.container.x, y: this.creature.container.y - 30,
                text: "🍞", count: 3, lifeMs: 1200,
            });
            await this.wait(2000);
        });
    }

    public play(): Promise<void> {
        return this.enqueue(async () => {
            const layout = this.room.layout;
            this.blackboard.target = { x: layout.toyPos.x, y: layout.toyPos.y + 6, arrivedRadius: 18, arrived: false };
            await this.waitForArrival();
            if (!this.isReady()) return;
            this.creature.playAction("play_with_toy", 2500);
            this.bbState.happiness = Math.min(100, this.bbState.happiness + 25);
            this.bbState.energy = Math.max(0, this.bbState.energy - 10);
            this.particles.emit({
                x: this.creature.container.x, y: this.creature.container.y - 30,
                text: "❤️", count: 4, lifeMs: 1300,
            });
            await this.wait(2500);
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
        this.creature.playAction("look_at_camera", 1200);
        this.bbState.happiness = Math.min(100, this.bbState.happiness + 5);
        this.particles.emit({
            x: this.creature.container.x,
            y: this.creature.container.y - 50,
            text: "💕", count: 3, lifeMs: 1100,
        });
        this.creature.say("That feels nice", 1800);
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
        is_sick?: boolean;
        is_in_coma?: boolean;
    }): void {
        if (!this.bbState) return;
        if (s.hunger !== undefined) this.bbState.hunger = s.hunger;
        if (s.happiness !== undefined) this.bbState.happiness = s.happiness;
        if (s.energy !== undefined) this.bbState.energy = s.energy;
        if (s.hygiene !== undefined) this.bbState.hygiene = s.hygiene;
        if (s.is_sick !== undefined) this.bbState.sick = s.is_sick;
        if (s.is_in_coma !== undefined) this.bbState.inComa = s.is_in_coma;
    }

    public getStateSnapshot(): CreatureState {
        return { ...this.bbState };
    }

    /* ------------------------- internals ------------------------ */

    private tick(deltaMs: number): void {
        // Decay over real time, very slow.
        const minutes = deltaMs / 60000;
        this.bbState.hunger = Math.max(0, this.bbState.hunger - 1.2 * minutes);
        this.bbState.happiness = Math.max(0, this.bbState.happiness - 0.9 * minutes);
        this.bbState.energy = Math.max(0, this.bbState.energy - 0.7 * minutes);

        const isNight = (() => {
            const h = new Date().getHours();
            return h >= 20 || h < 6;
        })();
        this.room.update(deltaMs, isNight);
        this.tree.tick(deltaMs, this.blackboard);
        if (this.cursor) {
            const local = this.creature.container.toLocal({ x: this.cursor.x, y: this.cursor.y });
            this.creature.lookAt(local.x, local.y);
        }
        this.creature.update(deltaMs, this.bbState);
        this.particles.update(deltaMs);
    }

    private computeLayout(): RoomLayout {
        const width = this.app.canvas.width / (window.devicePixelRatio || 1);
        const height = this.app.canvas.height / (window.devicePixelRatio || 1);
        const floorY = height * 0.55;
        return {
            width, height, floorY,
            bowlPos: { x: width * 0.18, y: floorY + (height - floorY) * 0.55 },
            bedPos:  { x: width * 0.82, y: floorY + (height - floorY) * 0.55 },
            toyPos:  { x: width * 0.42, y: floorY + (height - floorY) * 0.78 },
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

    private attachInput(): void {
        this.app.stage.eventMode = "static";
        this.creature.container.eventMode = "static";
        this.creature.container.cursor = "pointer";

        // Disable native gestures (context menu, scroll) on the canvas
        // so touch holds reliably register as long-press.
        this.app.canvas.style.touchAction = "none";

        // Track cursor for the eye-tracking effect.
        this.app.stage.on("globalpointermove", (e) => {
            this.cursor = { x: e.global.x, y: e.global.y };
        });

        let pressTimer: number | undefined;
        let didLong = false;
        this.creature.container.on("pointerdown", () => {
            didLong = false;
            pressTimer = window.setTimeout(() => {
                this.pet();
                pressTimer = undefined;
                didLong = true;
            }, 320);
        });
        const cancel = () => {
            if (pressTimer !== undefined) {
                clearTimeout(pressTimer);
                pressTimer = undefined;
                if (!didLong) {
                    // Short tap = nuzzle
                    this.creature.playAction("look_at_camera", 800);
                    if (this.bbState) {
                        this.bbState.happiness = Math.min(100, this.bbState.happiness + 1);
                    }
                    this.particles.emit({
                        x: this.creature.container.x, y: this.creature.container.y - 50,
                        text: "💕", count: 1, lifeMs: 1000,
                    });
                }
            }
        };
        this.creature.container.on("pointerup", cancel);
        this.creature.container.on("pointerupoutside", cancel);
    }
}
