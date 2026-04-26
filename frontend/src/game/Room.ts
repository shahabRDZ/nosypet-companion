/**
 * The room scene: floor, wall, sun/moon, food bowl, bed, toy, particles.
 * Everything is procedural so we can ship Phase 2 without art assets.
 */
import { Container, Graphics } from "pixi.js";

export interface RoomLayout {
    width: number;
    height: number;
    floorY: number;          // y where the floor starts
    bowlPos: { x: number; y: number };
    bedPos: { x: number; y: number };
    toyPos: { x: number; y: number };
}

export class Room {
    public readonly container: Container;
    public readonly bgLayer: Container;
    public readonly fgLayer: Container;
    public readonly fxLayer: Container;       // particles, speech bubbles

    private wall: Graphics;
    private floor: Graphics;
    private window: Graphics;
    private sun: Graphics;
    private moon: Graphics;
    private bowl: Graphics;
    private bed: Graphics;
    private toy: Graphics;
    private rug: Graphics;
    private wainscot: Graphics;
    private clouds: Graphics[] = [];
    private cloudOffsets: number[] = [];

    constructor(public readonly layout: RoomLayout) {
        this.container = new Container();
        this.container.sortableChildren = true;
        this.bgLayer = new Container(); this.bgLayer.zIndex = 0;
        this.fgLayer = new Container(); this.fgLayer.zIndex = 10;
        this.fxLayer = new Container(); this.fxLayer.zIndex = 20;
        this.container.addChild(this.bgLayer, this.fgLayer, this.fxLayer);

        this.wall = new Graphics();
        this.wainscot = new Graphics();
        this.window = new Graphics();
        this.sun = new Graphics();
        this.moon = new Graphics();
        this.floor = new Graphics();
        this.rug = new Graphics();
        this.bowl = new Graphics();
        this.bed = new Graphics();
        this.toy = new Graphics();

        this.bgLayer.addChild(
            this.wall, this.window, this.sun, this.moon, this.wainscot,
            this.floor, this.rug,
        );
        this.fgLayer.addChild(this.bowl, this.bed, this.toy);

        for (let i = 0; i < 3; i++) {
            const c = new Graphics();
            this.cloudOffsets.push(Math.random() * layout.width);
            this.bgLayer.addChild(c);
            this.clouds.push(c);
        }

        this.draw();
    }

    public update(deltaMs: number, isNight: boolean): void {
        // Day/night: fade sun and moon.
        this.sun.alpha = isNight ? 0 : 1;
        this.moon.alpha = isNight ? 1 : 0;

        // Wall/floor tints shift with day phase.
        const dayWall = 0xfbe9d3, nightWall = 0x3a2a6e;
        const dayFloor = 0xb9885d, nightFloor = 0x5a3a4e;
        this.wall.tint = isNight ? nightWall : dayWall;
        this.floor.tint = isNight ? nightFloor : dayFloor;
        this.wainscot.tint = isNight ? 0x2a1a4e : 0xe5cdb0;

        // Drift the clouds across the window.
        this.cloudOffsets = this.cloudOffsets.map((o, i) => {
            const speed = 8 + i * 5;
            let next = o + (deltaMs / 1000) * speed;
            if (next > this.layout.width + 80) next = -80;
            return next;
        });
        this.clouds.forEach((g, i) => {
            g.x = this.cloudOffsets[i];
        });
    }

    private draw(): void {
        const { width, height, floorY, bowlPos, bedPos, toyPos } = this.layout;

        // Wall (back)
        this.wall.clear();
        this.wall.rect(0, 0, width, floorY).fill(0xfbe9d3);

        // Wainscot (lower wall band)
        const wainHeight = 28;
        this.wainscot.clear();
        this.wainscot.rect(0, floorY - wainHeight, width, wainHeight).fill(0xe5cdb0);

        // Window with frame
        const wx = width * 0.62, wy = floorY * 0.18;
        const ww = 130, wh = 90;
        this.window.clear();
        this.window.rect(wx - 4, wy - 4, ww + 8, wh + 8).fill(0x8b5e3c);
        this.window.rect(wx, wy, ww, wh).fill(0xb8e6ff);
        // Cross frame
        this.window.rect(wx + ww / 2 - 2, wy, 4, wh).fill(0x8b5e3c);
        this.window.rect(wx, wy + wh / 2 - 2, ww, 4).fill(0x8b5e3c);

        // Sun (visible during day)
        this.sun.clear();
        this.sun.circle(wx + ww * 0.7, wy + wh * 0.35, 16).fill(0xffd84a);

        // Moon (visible at night)
        this.moon.clear();
        this.moon.circle(wx + ww * 0.7, wy + wh * 0.35, 14).fill(0xfffbe6);
        this.moon.circle(wx + ww * 0.7 + 5, wy + wh * 0.35 - 3, 13).fill(0xb8e6ff);

        // Clouds inside window
        this.clouds.forEach((g) => {
            g.clear();
            g.circle(0, 0, 10).fill({ color: 0xffffff, alpha: 0.85 });
            g.circle(8, -2, 8).fill({ color: 0xffffff, alpha: 0.85 });
            g.circle(-8, -1, 7).fill({ color: 0xffffff, alpha: 0.85 });
            g.y = wy + wh * 0.35;
        });

        // Floor
        this.floor.clear();
        this.floor.rect(0, floorY, width, height - floorY).fill(0xb9885d);
        // Floor planks
        for (let x = 0; x < width; x += 40) {
            this.floor.rect(x, floorY, 1, height - floorY).fill({ color: 0x000000, alpha: 0.1 });
        }
        for (let y = floorY + 30; y < height; y += 30) {
            this.floor.rect(0, y, width, 1).fill({ color: 0x000000, alpha: 0.08 });
        }

        // Rug
        const rugW = 220, rugH = 70;
        const rugX = width / 2 - rugW / 2;
        const rugY = floorY + 16;
        this.rug.clear();
        this.rug.roundRect(rugX, rugY, rugW, rugH, 8).fill(0xc1675a);
        this.rug.roundRect(rugX + 8, rugY + 8, rugW - 16, rugH - 16, 6)
            .stroke({ color: 0xfae3c1, width: 2 });

        // Food bowl
        this.bowl.clear();
        this.bowl.ellipse(bowlPos.x, bowlPos.y + 4, 22, 8).fill({ color: 0x000000, alpha: 0.18 });
        this.bowl.ellipse(bowlPos.x, bowlPos.y, 22, 12).fill(0xc44a3b);
        this.bowl.ellipse(bowlPos.x, bowlPos.y - 2, 18, 9).fill(0x8c2e22);
        this.bowl.ellipse(bowlPos.x - 5, bowlPos.y - 2, 4, 3).fill(0xffd84a);
        this.bowl.ellipse(bowlPos.x + 4, bowlPos.y - 1, 3, 2).fill(0x8b5e3c);

        // Bed (round pillow)
        this.bed.clear();
        this.bed.ellipse(bedPos.x, bedPos.y + 6, 50, 12).fill({ color: 0x000000, alpha: 0.18 });
        this.bed.ellipse(bedPos.x, bedPos.y, 50, 22).fill(0xa78bfa);
        this.bed.ellipse(bedPos.x, bedPos.y - 4, 38, 14).fill(0xc4b5fd);

        // Toy: a small ball
        this.toy.clear();
        this.toy.circle(toyPos.x, toyPos.y + 4, 6).fill({ color: 0x000000, alpha: 0.2 });
        this.toy.circle(toyPos.x, toyPos.y, 8).fill(0xff7eb3);
        this.toy.circle(toyPos.x - 2, toyPos.y - 2, 2).fill({ color: 0xffffff, alpha: 0.6 });
    }
}
