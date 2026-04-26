/**
 * Procedural sound effects via Web Audio API.
 *
 * Why procedural? No license complications, zero asset weight, instant
 * iteration. Each sound is a tiny envelope-shaped tone or noise burst
 * tuned by ear. Real recorded SFX can replace any of these later by
 * subbing the body of a single method without changing callers.
 */
class SoundEngine {
    private ctx: AudioContext | null = null;
    private master: GainNode | null = null;
    private muted = false;

    private ensure(): AudioContext | null {
        if (this.ctx) return this.ctx;
        try {
            const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!Ctor) return null;
            this.ctx = new Ctor();
            this.master = this.ctx.createGain();
            this.master.gain.value = 0.3;
            this.master.connect(this.ctx.destination);
        } catch {
            return null;
        }
        return this.ctx;
    }

    /** Resume context after the first user gesture (browser policy). */
    public unlock(): void {
        const ctx = this.ensure();
        if (ctx && ctx.state === "suspended") void ctx.resume();
    }

    public setMuted(m: boolean): void {
        this.muted = m;
        if (this.master) this.master.gain.value = m ? 0 : 0.3;
    }
    public isMuted(): boolean { return this.muted; }

    private envelope(
        ctx: AudioContext,
        node: AudioNode,
        attack: number,
        sustain: number,
        release: number,
        peak = 0.5,
    ): void {
        const gain = ctx.createGain();
        const t = ctx.currentTime;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(peak, t + attack);
        gain.gain.linearRampToValueAtTime(peak, t + attack + sustain);
        gain.gain.linearRampToValueAtTime(0, t + attack + sustain + release);
        node.connect(gain);
        gain.connect(this.master!);
        const total = attack + sustain + release;
        setTimeout(() => { gain.disconnect(); }, total * 1000 + 100);
    }

    private chirp(start: number, end: number, duration: number, type: OscillatorType = "sine", peak = 0.4): void {
        const ctx = this.ensure();
        if (!ctx || this.muted) return;
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(start, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(end, ctx.currentTime + duration);
        this.envelope(ctx, osc, 0.005, duration, 0.05, peak);
        osc.start();
        osc.stop(ctx.currentTime + duration + 0.1);
    }

    private noise(duration: number, peak = 0.4): void {
        const ctx = this.ensure();
        if (!ctx || this.muted) return;
        const buf = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / data.length * 5);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 1500;
        src.connect(filter);
        this.envelope(ctx, filter, 0.005, duration, 0.05, peak);
        src.start();
    }

    /* ----- public sounds ----- */

    nuzzle(): void { this.chirp(420, 660, 0.18, "sine", 0.35); }
    eat():    void { this.chirp(180, 220, 0.08, "square", 0.25);
                     setTimeout(() => this.chirp(180, 220, 0.08, "square", 0.25), 110); }
    play():   void { this.chirp(660, 880, 0.16, "triangle", 0.4); }
    sleep():  void { this.chirp(440, 220, 0.6, "sine", 0.3); }
    pet():    void { this.chirp(540, 720, 0.2, "sine", 0.4); }
    heal():   void { this.chirp(660, 990, 0.4, "triangle", 0.4);
                     setTimeout(() => this.chirp(990, 1320, 0.3, "triangle", 0.35), 120); }
    sneeze(): void { this.noise(0.18, 0.5); }
    levelUp():void { [523, 659, 784].forEach((f, i) => setTimeout(() =>
                       this.chirp(f, f, 0.18, "triangle", 0.45), i * 90)); }
    hatch():  void {
        [261, 329, 392, 523].forEach((f, i) => setTimeout(() =>
            this.chirp(f, f * 1.5, 0.4, "triangle", 0.4), i * 110));
    }
    error():  void { this.chirp(220, 165, 0.2, "square", 0.3); }
}

export const sound = new SoundEngine();
