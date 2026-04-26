/**
 * Minimal Behavior Tree.
 *
 * Three node types are enough for everything we need in Phase 2:
 *   - Selector: try each child until one returns Running or Success.
 *   - Sequence: run children in order; abort on Failure.
 *   - Action: do work for a tick. Return Running while working,
 *     Success when finished, Failure to give up.
 *
 * Conditions are just Actions that immediately return Success/Failure.
 *
 * The tree is ticked once per frame. Long-running actions keep
 * returning `Running` until done; the runner remembers which leaf
 * was running last frame and resumes it before re-evaluating.
 */
export const enum Status {
    Running = "running",
    Success = "success",
    Failure = "failure",
}

export interface BlackboardLike {
    [key: string]: unknown;
}

export abstract class Node<B extends BlackboardLike = BlackboardLike> {
    abstract tick(dt: number, bb: B): Status;
    reset(): void { /* override if stateful */ }
}

export class Selector<B extends BlackboardLike = BlackboardLike> extends Node<B> {
    private running = -1;
    constructor(private children: Node<B>[]) { super(); }
    tick(dt: number, bb: B): Status {
        const start = this.running >= 0 ? this.running : 0;
        for (let i = start; i < this.children.length; i++) {
            const status = this.children[i].tick(dt, bb);
            if (status === Status.Running) { this.running = i; return Status.Running; }
            if (status === Status.Success)  { this.running = -1; return Status.Success; }
            if (this.running === i) this.children[i].reset();
        }
        this.running = -1;
        return Status.Failure;
    }
    reset(): void { this.running = -1; this.children.forEach(c => c.reset()); }
}

export class Sequence<B extends BlackboardLike = BlackboardLike> extends Node<B> {
    private running = -1;
    constructor(private children: Node<B>[]) { super(); }
    tick(dt: number, bb: B): Status {
        const start = this.running >= 0 ? this.running : 0;
        for (let i = start; i < this.children.length; i++) {
            const status = this.children[i].tick(dt, bb);
            if (status === Status.Running) { this.running = i; return Status.Running; }
            if (status === Status.Failure)  { this.running = -1; return Status.Failure; }
            if (this.running === i) this.children[i].reset();
        }
        this.running = -1;
        return Status.Success;
    }
    reset(): void { this.running = -1; this.children.forEach(c => c.reset()); }
}

export class Condition<B extends BlackboardLike = BlackboardLike> extends Node<B> {
    constructor(private fn: (bb: B) => boolean) { super(); }
    tick(_dt: number, bb: B): Status {
        return this.fn(bb) ? Status.Success : Status.Failure;
    }
}

export class RandomChance<B extends BlackboardLike = BlackboardLike> extends Node<B> {
    /** Probability per second. 0.5 means 50% per second. */
    constructor(private perSecond: number, private inner: Node<B>) { super(); }
    tick(dt: number, bb: B): Status {
        // dt is in ms. Convert per-second probability to per-tick.
        const p = 1 - Math.exp(-this.perSecond * dt / 1000);
        if (Math.random() < p) {
            return this.inner.tick(dt, bb);
        }
        return Status.Failure;
    }
    reset(): void { this.inner.reset(); }
}

export class Cooldown<B extends BlackboardLike = BlackboardLike> extends Node<B> {
    /** Wraps a child so it cannot run more than once per `cooldownMs`. */
    private nextReadyAt = 0;
    constructor(private cooldownMs: number, private inner: Node<B>) { super(); }
    tick(dt: number, bb: B): Status {
        const now = performance.now();
        if (now < this.nextReadyAt) return Status.Failure;
        const status = this.inner.tick(dt, bb);
        if (status === Status.Success) {
            this.nextReadyAt = now + this.cooldownMs;
        }
        return status;
    }
    reset(): void { this.inner.reset(); }
}

export class Action<B extends BlackboardLike = BlackboardLike> extends Node<B> {
    constructor(private fn: (dt: number, bb: B) => Status) { super(); }
    tick(dt: number, bb: B): Status { return this.fn(dt, bb); }
}
