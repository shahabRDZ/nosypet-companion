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
    private lightShaft: Graphics;
    private vignette: Graphics;
    private nightstand: Graphics;
    private dresser: Graphics;
    private wallArt: Graphics;
    private plant: Graphics;

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
        this.lightShaft = new Graphics();
        this.vignette = new Graphics();
        this.nightstand = new Graphics();
        this.dresser = new Graphics();
        this.wallArt = new Graphics();
        this.plant = new Graphics();

        this.bgLayer.addChild(
            this.wall, this.window, this.sun, this.moon, this.wallArt, this.wainscot,
            this.floor, this.rug, this.lightShaft,
        );
        this.fgLayer.addChild(this.dresser, this.bed, this.bowl, this.nightstand, this.plant, this.toy);
        this.fxLayer.addChild(this.vignette);
        this.vignette.zIndex = 50;

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

        // Light shaft from the window — warm amber by day, cool blue moonlight by night.
        this.lightShaft.tint = isNight ? 0xb8c8e8 : 0xfff5d6;
        this.lightShaft.alpha = isNight ? 0.18 : 0.32;

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

        // Food bowl with placemat
        this.bowl.clear();
        const bw = 32, bh = 14;
        // Placemat
        this.bowl.roundRect(bowlPos.x - 38, bowlPos.y - 4, 76, 22, 4)
            .fill(0xfae3c1);
        this.bowl.roundRect(bowlPos.x - 38, bowlPos.y - 4, 76, 22, 4)
            .stroke({ color: 0xc89a6e, width: 1.5 });
        // Bowl
        this.bowl.ellipse(bowlPos.x, bowlPos.y + 8, bw * 0.85, 6).fill({ color: 0x000000, alpha: 0.2 });
        this.bowl.ellipse(bowlPos.x, bowlPos.y, bw, bh).fill(0xc44a3b);
        this.bowl.ellipse(bowlPos.x, bowlPos.y - 3, bw * 0.78, bh * 0.7).fill(0x6e2818);
        // Kibble
        this.bowl.ellipse(bowlPos.x - 7, bowlPos.y - 3, 4, 3).fill(0xffd84a);
        this.bowl.ellipse(bowlPos.x + 6, bowlPos.y - 2, 4, 3).fill(0xb87838);
        this.bowl.ellipse(bowlPos.x, bowlPos.y - 5, 4, 3).fill(0xd8a058);

        // Bed: a proper rectangular dog bed with frame and cushion.
        this.bed.clear();
        const bedW = 110, bedH = 36;
        const bx = bedPos.x - bedW / 2, by = bedPos.y - bedH / 2;
        // Shadow
        this.bed.ellipse(bedPos.x, by + bedH + 6, bedW * 0.5, 6)
            .fill({ color: 0x000000, alpha: 0.22 });
        // Wooden base
        this.bed.roundRect(bx, by + bedH * 0.55, bedW, bedH * 0.5, 4).fill(0x8c5a35);
        this.bed.roundRect(bx, by + bedH * 0.55, bedW, bedH * 0.5, 4)
            .stroke({ color: 0x4a2818, width: 1.5 });
        // Cushion
        this.bed.roundRect(bx + 6, by, bedW - 12, bedH * 0.7, 8).fill(0xa78bfa);
        this.bed.roundRect(bx + 6, by, bedW - 12, bedH * 0.7, 8)
            .stroke({ color: 0x000000, width: 1, alpha: 0.18 });
        // Pillow
        this.bed.roundRect(bx + 14, by + 4, 26, bedH * 0.45, 4).fill(0xfff5d6);
        this.bed.roundRect(bx + 14, by + 4, 26, bedH * 0.45, 4)
            .stroke({ color: 0xc89a6e, width: 0.8 });
        // Stitch detail
        for (let i = 0; i < 3; i++) {
            this.bed.circle(bx + 18 + i * 6, by + 8, 0.6)
                .fill({ color: 0x000000, alpha: 0.4 });
        }

        // Toy: a small ball
        this.toy.clear();
        this.toy.circle(toyPos.x, toyPos.y + 5, 8).fill({ color: 0x000000, alpha: 0.22 });
        this.toy.circle(toyPos.x, toyPos.y, 10).fill(0xff7eb3);
        this.toy.circle(toyPos.x - 3, toyPos.y - 3, 3).fill({ color: 0xffffff, alpha: 0.6 });
        this.toy.moveTo(toyPos.x - 7, toyPos.y).quadraticCurveTo(toyPos.x, toyPos.y - 3, toyPos.x + 7, toyPos.y)
            .stroke({ color: 0xc44a3b, width: 1, alpha: 0.6 });

        // Nightstand next to the bed (right side)
        const nsX = bx + bedW + 10;
        const nsY = floorY - 32;
        this.nightstand.clear();
        // Shadow
        this.nightstand.ellipse(nsX + 14, nsY + 36, 20, 4).fill({ color: 0x000000, alpha: 0.2 });
        // Body
        this.nightstand.roundRect(nsX, nsY, 28, 30, 2).fill(0x8c5a35);
        this.nightstand.roundRect(nsX, nsY, 28, 30, 2).stroke({ color: 0x4a2818, width: 1.2 });
        // Drawer line
        this.nightstand.rect(nsX + 2, nsY + 14, 24, 1).fill({ color: 0x000000, alpha: 0.3 });
        this.nightstand.circle(nsX + 14, nsY + 22, 1.2).fill(0xb89858);
        // Legs
        this.nightstand.rect(nsX + 1, nsY + 30, 3, 6).fill(0x6e4a30);
        this.nightstand.rect(nsX + 24, nsY + 30, 3, 6).fill(0x6e4a30);
        // Lamp on top
        this.nightstand.rect(nsX + 13, nsY - 14, 2, 14).fill(0x4a2818);
        this.nightstand.poly([nsX + 6, nsY - 14, nsX + 22, nsY - 14, nsX + 18, nsY - 26, nsX + 10, nsY - 26])
            .fill(0xfff5a0);
        this.nightstand.ellipse(nsX + 14, nsY, 8, 2).fill(0x4a2818);
        // Tiny clock on top
        this.nightstand.roundRect(nsX + 18, nsY - 6, 9, 6, 1).fill(0x222244);
        this.nightstand.rect(nsX + 19, nsY - 5, 7, 4).fill(0x6dd3ff);

        // Dresser on the left side of the room
        const drX = width * 0.05;
        const drY = floorY - 50;
        const drW = 60;
        const drH = 50;
        this.dresser.clear();
        this.dresser.ellipse(drX + drW / 2, drY + drH + 6, drW * 0.45, 6)
            .fill({ color: 0x000000, alpha: 0.22 });
        this.dresser.roundRect(drX, drY, drW, drH, 3).fill(0x8c5a35);
        this.dresser.roundRect(drX, drY, drW, drH, 3).stroke({ color: 0x4a2818, width: 1.5 });
        // 3 drawers
        for (let i = 0; i < 3; i++) {
            this.dresser.roundRect(drX + 4, drY + 4 + i * 14, drW - 8, 12, 1).fill(0xa66e42);
            this.dresser.roundRect(drX + 4, drY + 4 + i * 14, drW - 8, 12, 1)
                .stroke({ color: 0x4a2818, width: 0.8 });
            this.dresser.circle(drX + 14, drY + 10 + i * 14, 1.4).fill(0xb89858);
            this.dresser.circle(drX + drW - 14, drY + 10 + i * 14, 1.4).fill(0xb89858);
        }
        // Picture frame on the dresser
        this.dresser.rect(drX + drW * 0.3, drY - 18, 16, 18).fill(0x6e4a30);
        this.dresser.rect(drX + drW * 0.3 + 2, drY - 16, 12, 14).fill(0xfff5e0);
        this.dresser.circle(drX + drW * 0.3 + 8, drY - 11, 3).fill(0xff7eb3);

        // Wall art above the bed
        const waX = bedPos.x - 50;
        const waY = floorY * 0.25;
        this.wallArt.clear();
        this.wallArt.rect(waX, waY, 100, 50).fill(0x4a2818);
        this.wallArt.rect(waX + 4, waY + 4, 92, 42).fill(0xfff5e0);
        // Subject — soft pastel landscape
        this.wallArt.rect(waX + 4, waY + 4, 92, 26).fill(0xb8e6ff);
        this.wallArt.rect(waX + 4, waY + 30, 92, 16).fill(0x68a058);
        this.wallArt.circle(waX + 70, waY + 16, 6).fill(0xffd84a);

        // Houseplant in the front corner
        const plX = width * 0.92, plY = floorY + (height - floorY) * 0.5;
        this.plant.clear();
        // Pot
        this.plant.poly([plX - 14, plY + 26, plX + 14, plY + 26, plX + 11, plY + 8, plX - 11, plY + 8])
            .fill(0xc44a3b);
        this.plant.poly([plX - 14, plY + 26, plX + 14, plY + 26, plX + 11, plY + 8, plX - 11, plY + 8])
            .stroke({ color: 0x6e2818, width: 1 });
        this.plant.ellipse(plX, plY + 8, 11, 3).fill(0x4a1810);
        // Leaves
        for (let i = -2; i <= 2; i++) {
            const angle = -Math.PI / 2 + i * 0.45;
            const len = 22 + Math.abs(i) * 4;
            const ex = plX + Math.cos(angle) * len * 0.25;
            const ey = plY + 4 + Math.sin(angle) * len * 0.5;
            this.plant.ellipse(ex, ey - len * 0.4, 7, len * 0.5).fill(0x4a8038);
            this.plant.ellipse(ex, ey - len * 0.4, 7, len * 0.5)
                .stroke({ color: 0x2a5018, width: 0.8 });
        }

        // Light shaft from the window onto the floor.
        this.lightShaft.clear();
        const lx = wx + ww * 0.5;
        const ly = wy + wh;
        this.lightShaft.poly([
            lx - 30, ly,
            lx + 30, ly,
            lx + 90, height,
            lx - 90, height,
        ]).fill(0xfff5d6);

        // Vignette: dark corners, slightly softens the canvas edges.
        this.vignette.clear();
        const r = Math.max(width, height);
        this.vignette.circle(width / 2, height / 2, r * 0.85)
            .fill({ color: 0x000000, alpha: 0 });
        // Outer black falloff via a stroked path.
        for (let i = 0; i < 12; i++) {
            const a = i / 12;
            this.vignette.rect(0, 0, width, height).stroke({
                color: 0x000000, width: 4, alpha: a * 0.04,
            });
        }
    }
}
