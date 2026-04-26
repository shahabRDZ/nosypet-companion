/**
 * Bathroom scene used during the wash action.
 *
 * Layout: tile floor, wallpaper, framed mirror, towel rack, window
 * letting in soft light, and a clawfoot tub at the centre. The
 * `washSequence` orchestrates filling the tub, the creature climbing
 * in, three rub cycles with bubble particles, a shake-off, and the
 * fade back to the bedroom.
 */
import { Container, Graphics } from "pixi.js";

export interface BathroomLayout {
    width: number;
    height: number;
    floorY: number;
    tubPos: { x: number; y: number };       // centre of the tub interior
    tubBounds: { x: number; y: number; w: number; h: number };
}

export class Bathroom {
    public readonly container: Container;
    public readonly bgLayer: Container;
    public readonly fgLayer: Container;
    public readonly fxLayer: Container;

    private wall: Graphics;
    private floor: Graphics;
    private tub: Graphics;
    private tubInterior: Graphics;
    private waterLevel = 0;                 // 0..1
    private water: Graphics;
    private mirror: Graphics;
    private towelRack: Graphics;
    private window: Graphics;

    constructor(public readonly layout: BathroomLayout) {
        this.container = new Container();
        this.container.sortableChildren = true;
        this.bgLayer = new Container(); this.bgLayer.zIndex = 0;
        this.fgLayer = new Container(); this.fgLayer.zIndex = 10;
        this.fxLayer = new Container(); this.fxLayer.zIndex = 20;
        this.container.addChild(this.bgLayer, this.fgLayer, this.fxLayer);

        this.wall = new Graphics();
        this.floor = new Graphics();
        this.window = new Graphics();
        this.mirror = new Graphics();
        this.towelRack = new Graphics();
        this.tub = new Graphics();
        this.tubInterior = new Graphics();
        this.water = new Graphics();

        this.bgLayer.addChild(this.wall, this.window, this.mirror, this.towelRack, this.floor);
        this.fgLayer.addChild(this.tubInterior, this.water, this.tub);

        this.draw();
    }

    public setWaterLevel(t: number): void {
        this.waterLevel = Math.max(0, Math.min(1, t));
        this.drawWater();
    }

    private draw(): void {
        const { width, height, floorY } = this.layout;

        // Wall
        this.wall.clear();
        this.wall.rect(0, 0, width, floorY).fill(0xb8d6e8);
        // Tile pattern (subtle grid)
        for (let y = 0; y < floorY; y += 24) {
            this.wall.rect(0, y, width, 1).fill({ color: 0x000000, alpha: 0.06 });
        }
        for (let x = 0; x < width; x += 24) {
            this.wall.rect(x, 0, 1, floorY).fill({ color: 0x000000, alpha: 0.06 });
        }

        // Window with soft light
        const wx = width * 0.62, wy = floorY * 0.18;
        const ww = 110, wh = 80;
        this.window.clear();
        this.window.rect(wx - 4, wy - 4, ww + 8, wh + 8).fill(0x4a6a8a);
        this.window.rect(wx, wy, ww, wh).fill(0xfff5d6);
        this.window.rect(wx + ww / 2 - 2, wy, 4, wh).fill(0x4a6a8a);
        this.window.rect(wx, wy + wh / 2 - 2, ww, 4).fill(0x4a6a8a);
        // Light cone
        this.window.poly([wx + ww * 0.5, wy + wh, wx + ww * 0.5 - 70, floorY + 40, wx + ww * 0.5 + 70, floorY + 40])
            .fill({ color: 0xfff5d6, alpha: 0.18 });

        // Mirror
        const mx = width * 0.18, my = floorY * 0.25;
        const mw = 85, mh = 100;
        this.mirror.clear();
        this.mirror.roundRect(mx - 4, my - 4, mw + 8, mh + 8, 8).fill(0x8c6a40);
        this.mirror.roundRect(mx, my, mw, mh, 6).fill(0xd6e8f0);
        // Reflection sheen
        this.mirror.roundRect(mx + 8, my + 8, 14, mh - 16, 4).fill({ color: 0xffffff, alpha: 0.4 });

        // Towel rack
        const tx = width * 0.36, ty = floorY * 0.45;
        this.towelRack.clear();
        this.towelRack.rect(tx, ty, 70, 4).fill(0xc89a6e);
        this.towelRack.roundRect(tx + 6, ty + 4, 24, 38, 3).fill(0xff9bc6);
        this.towelRack.roundRect(tx + 36, ty + 4, 24, 32, 3).fill(0xc8e8d6);

        // Floor (tile pattern)
        this.floor.clear();
        this.floor.rect(0, floorY, width, height - floorY).fill(0xe8d6c4);
        for (let y = floorY + 30; y < height; y += 30) {
            this.floor.rect(0, y, width, 1).fill({ color: 0x000000, alpha: 0.08 });
        }
        for (let x = 0; x < width; x += 60) {
            this.floor.rect(x, floorY, 1, height - floorY).fill({ color: 0x000000, alpha: 0.08 });
        }

        // Clawfoot tub
        const { x: tbx, y: tby, w: tbw, h: tbh } = this.layout.tubBounds;
        this.tubInterior.clear();
        // Inside (drawn before tub so the tub's outer rim covers it)
        this.tubInterior.roundRect(tbx + 8, tby + 8, tbw - 16, tbh - 16, tbh / 2).fill(0xe6f0f8);

        this.tub.clear();
        // Tub body — rounded rectangle with a higher back wall.
        this.tub.roundRect(tbx, tby, tbw, tbh, tbh / 2).stroke({
            color: 0xffffff, width: 6,
        });
        this.tub.roundRect(tbx, tby, tbw, tbh, tbh / 2).fill(0xffffff);
        this.tub.roundRect(tbx + 6, tby + 6, tbw - 12, tbh - 12, (tbh - 12) / 2).fill(0xe6f0f8);
        // Feet
        this.tub.ellipse(tbx + 18, tby + tbh + 4, 8, 6).fill(0xc8a058);
        this.tub.ellipse(tbx + tbw - 18, tby + tbh + 4, 8, 6).fill(0xc8a058);
        // Faucet
        this.tub.rect(tbx + tbw - 22, tby - 14, 4, 14).fill(0xb89858);
        this.tub.rect(tbx + tbw - 28, tby - 16, 16, 4).fill(0xb89858);
        this.tub.circle(tbx + tbw - 14, tby - 8, 3).fill(0xb89858);

        this.drawWater();
    }

    private drawWater(): void {
        const { x: tbx, y: tby, w: tbw, h: tbh } = this.layout.tubBounds;
        this.water.clear();
        if (this.waterLevel <= 0) return;
        const waterTop = tby + tbh - (tbh - 16) * this.waterLevel;
        const waterH = tby + tbh - 8 - waterTop;
        if (waterH < 2) return;
        this.water.roundRect(
            tbx + 8, waterTop, tbw - 16, waterH,
            Math.min(waterH / 2, (tbw - 16) / 2),
        ).fill({ color: 0x6dd3ff, alpha: 0.85 });
        // Surface highlight
        this.water.rect(tbx + 14, waterTop, tbw - 28, 2).fill({ color: 0xffffff, alpha: 0.55 });
    }
}
