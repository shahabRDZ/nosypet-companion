/**
 * Living room scene: cozy lounge with sofa, TV, picture frames,
 * floor lamp, rug, side table with mug, and a houseplant. Used as
 * the bonding space when we add a "watch TV" / "cuddle on the sofa"
 * action later.
 */
import { Container, Graphics } from "pixi.js";

export interface LivingRoomLayout {
    width: number;
    height: number;
    floorY: number;
    sofaPos: { x: number; y: number };       // cuddle target
}

export class LivingRoom {
    public readonly container: Container;
    public readonly bgLayer: Container;
    public readonly fgLayer: Container;
    public readonly fxLayer: Container;

    private wall: Graphics;
    private wainscot: Graphics;
    private floor: Graphics;
    private rug: Graphics;
    private sofa: Graphics;
    private tv: Graphics;
    private tvScreen: Graphics;
    private lamp: Graphics;
    private plant: Graphics;
    private sideTable: Graphics;
    private picture1: Graphics;
    private picture2: Graphics;
    private clock: Graphics;
    private elapsed = 0;

    constructor(public readonly layout: LivingRoomLayout) {
        this.container = new Container();
        this.container.sortableChildren = true;
        this.bgLayer = new Container(); this.bgLayer.zIndex = 0;
        this.fgLayer = new Container(); this.fgLayer.zIndex = 10;
        this.fxLayer = new Container(); this.fxLayer.zIndex = 20;
        this.container.addChild(this.bgLayer, this.fgLayer, this.fxLayer);

        this.wall = new Graphics();
        this.wainscot = new Graphics();
        this.picture1 = new Graphics();
        this.picture2 = new Graphics();
        this.clock = new Graphics();
        this.tv = new Graphics();
        this.tvScreen = new Graphics();
        this.lamp = new Graphics();
        this.floor = new Graphics();
        this.rug = new Graphics();
        this.sofa = new Graphics();
        this.plant = new Graphics();
        this.sideTable = new Graphics();

        this.bgLayer.addChild(
            this.wall, this.wainscot,
            this.picture1, this.picture2, this.clock,
            this.tv, this.tvScreen, this.lamp,
            this.floor, this.rug,
        );
        this.fgLayer.addChild(this.sofa, this.sideTable, this.plant);

        this.draw();
    }

    public update(deltaMs: number): void {
        this.elapsed += deltaMs;
        // Subtle TV scanline flicker.
        this.tvScreen.alpha = 0.92 + Math.sin(this.elapsed / 90) * 0.05;
    }

    private draw(): void {
        const { width, height, floorY } = this.layout;

        // Wall: warm sage with subtle stripes.
        this.wall.clear();
        this.wall.rect(0, 0, width, floorY).fill(0xc5d8be);
        for (let x = 36; x < width; x += 56) {
            this.wall.rect(x, 0, 1, floorY).fill({ color: 0x000000, alpha: 0.05 });
        }

        // Wainscot panelling
        const wainH = 32;
        this.wainscot.clear();
        this.wainscot.rect(0, floorY - wainH, width, wainH).fill(0xf5e3c4);
        this.wainscot.rect(0, floorY - wainH, width, 2).fill({ color: 0x000000, alpha: 0.18 });
        for (let x = 0; x < width; x += 70) {
            this.wainscot.rect(x, floorY - wainH + 6, 1, wainH - 12)
                .fill({ color: 0x000000, alpha: 0.1 });
        }

        // Picture frames on the wall
        this.drawPicture(this.picture1, width * 0.18, floorY * 0.32, 60, 50, 0xffd6e8);
        this.drawPicture(this.picture2, width * 0.3,  floorY * 0.4,  46, 60, 0xb8e0ff);

        // Wall clock (above the sofa)
        const cx = width * 0.5, cy = floorY * 0.28;
        this.clock.clear();
        this.clock.circle(cx, cy, 22).fill(0xffffff);
        this.clock.circle(cx, cy, 22).stroke({ color: 0x6e4a30, width: 3 });
        this.clock.circle(cx, cy, 18).stroke({ color: 0x000000, width: 0.6, alpha: 0.4 });
        // Hour ticks
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
            const x1 = cx + Math.cos(a) * 17;
            const y1 = cy + Math.sin(a) * 17;
            const x2 = cx + Math.cos(a) * 20;
            const y2 = cy + Math.sin(a) * 20;
            this.clock.moveTo(x1, y1).lineTo(x2, y2)
                .stroke({ color: 0x222244, width: i % 3 === 0 ? 2 : 1 });
        }
        // Hands (frozen at 10:10 — classic clock-display pose)
        this.clock.moveTo(cx, cy).lineTo(cx - 9, cy - 5)
            .stroke({ color: 0x222244, width: 2.5, cap: "round" });
        this.clock.moveTo(cx, cy).lineTo(cx + 11, cy - 4)
            .stroke({ color: 0x222244, width: 1.8, cap: "round" });
        this.clock.circle(cx, cy, 1.5).fill(0x222244);

        // TV (right side, on a media stand)
        const tvX = width * 0.75;
        const tvY = floorY * 0.35;
        const tvW = 110;
        const tvH = 70;
        this.tv.clear();
        this.tv.roundRect(tvX, tvY, tvW, tvH, 4).fill(0x222233);
        this.tv.roundRect(tvX + 4, tvY + 4, tvW - 8, tvH - 8, 2).fill(0x0c1a3e);
        // Stand
        this.tv.rect(tvX + tvW * 0.35, tvY + tvH, tvW * 0.3, 8).fill(0x6e4a30);
        // Cabinet underneath
        this.tv.roundRect(tvX - 10, tvY + tvH + 8, tvW + 20, 22, 3).fill(0x8c5a35);
        this.tv.rect(tvX, tvY + tvH + 14, tvW, 1).fill({ color: 0x000000, alpha: 0.3 });

        // TV screen content (scrolling colour bars)
        this.tvScreen.clear();
        const innerX = tvX + 6, innerY = tvY + 6;
        const innerW = tvW - 12, innerH = tvH - 12;
        const colours = [0xff7eb3, 0xffd84a, 0x6dd3ff, 0xc084fc];
        const bandH = innerH / colours.length;
        for (let i = 0; i < colours.length; i++) {
            this.tvScreen.rect(innerX, innerY + i * bandH, innerW, bandH)
                .fill({ color: colours[i], alpha: 0.85 });
        }
        // Scanlines
        for (let y = innerY; y < innerY + innerH; y += 2) {
            this.tvScreen.rect(innerX, y, innerW, 1).fill({ color: 0x000000, alpha: 0.18 });
        }

        // Floor lamp (left of the sofa)
        const lampX = width * 0.16;
        const lampBaseY = floorY + 30;
        this.lamp.clear();
        this.lamp.rect(lampX - 1.5, lampBaseY - 70, 3, 70).fill(0x4a2818);
        this.lamp.poly([lampX - 18, lampBaseY - 70, lampX + 18, lampBaseY - 70, lampX + 12, lampBaseY - 92, lampX - 12, lampBaseY - 92])
            .fill(0xfff5a0);
        this.lamp.ellipse(lampX, lampBaseY, 14, 4).fill(0x4a2818);
        // Glow
        this.lamp.circle(lampX, lampBaseY - 80, 30)
            .fill({ color: 0xfff5a0, alpha: 0.18 });

        // Floor (planks)
        this.floor.clear();
        this.floor.rect(0, floorY, width, height - floorY).fill(0xb88858);
        for (let x = 0; x < width; x += 50) {
            this.floor.rect(x, floorY, 1, height - floorY).fill({ color: 0x000000, alpha: 0.1 });
        }
        for (let y = floorY + 25; y < height; y += 25) {
            this.floor.rect(0, y, width, 1).fill({ color: 0x000000, alpha: 0.06 });
        }

        // Rug (pattern: concentric ovals)
        const rugW = 280, rugH = 80;
        const rugX = width / 2 - rugW / 2;
        const rugY = floorY + 18;
        this.rug.clear();
        this.rug.roundRect(rugX, rugY, rugW, rugH, 10).fill(0x9b4a52);
        this.rug.roundRect(rugX + 10, rugY + 10, rugW - 20, rugH - 20, 8)
            .stroke({ color: 0xfae3c1, width: 2 });
        this.rug.roundRect(rugX + 22, rugY + 22, rugW - 44, rugH - 44, 6)
            .stroke({ color: 0xfae3c1, width: 1.5 });
        // Tassels at the ends
        for (let i = 0; i < 8; i++) {
            const t = (i + 0.5) / 8 * rugH;
            this.rug.rect(rugX - 4, rugY + t, 4, 3).fill(0xfae3c1);
            this.rug.rect(rugX + rugW, rugY + t, 4, 3).fill(0xfae3c1);
        }

        // Sofa (centre, behind rug)
        const sx = width * 0.32, sy = floorY - 30;
        const sw = 200, sh = 56;
        this.sofa.clear();
        // Shadow
        this.sofa.ellipse(sx + sw / 2, sy + sh + 4, sw * 0.45, 6).fill({ color: 0x000000, alpha: 0.2 });
        // Base
        this.sofa.roundRect(sx, sy + 20, sw, sh - 6, 8).fill(0x6a85b5);
        // Back rest
        this.sofa.roundRect(sx + 4, sy - 18, sw - 8, 50, 10).fill(0x7a95c5);
        // Cushions (3)
        const cw = (sw - 16) / 3;
        for (let i = 0; i < 3; i++) {
            this.sofa.roundRect(sx + 8 + i * cw, sy + 16, cw - 4, 22, 6).fill(0x8aa5d5);
            this.sofa.roundRect(sx + 8 + i * cw, sy + 16, cw - 4, 22, 6)
                .stroke({ color: 0x000000, width: 0.8, alpha: 0.18 });
        }
        // Throw pillows
        this.sofa.roundRect(sx + 14, sy - 8, 20, 18, 4).fill(0xff7eb3);
        this.sofa.roundRect(sx + sw - 34, sy - 8, 20, 18, 4).fill(0xffd84a);
        // Armrests
        this.sofa.roundRect(sx - 8, sy + 6, 14, 38, 6).fill(0x6a85b5);
        this.sofa.roundRect(sx + sw - 6, sy + 6, 14, 38, 6).fill(0x6a85b5);

        // Side table (left of sofa)
        const stX = width * 0.18, stY = floorY - 12;
        this.sideTable.clear();
        this.sideTable.roundRect(stX, stY, 36, 22, 3).fill(0x8c5a35);
        this.sideTable.rect(stX, stY + 22, 4, 22).fill(0x6e4a30);
        this.sideTable.rect(stX + 32, stY + 22, 4, 22).fill(0x6e4a30);
        // Mug on the table
        this.sideTable.rect(stX + 12, stY - 10, 12, 14).fill(0xffffff);
        this.sideTable.rect(stX + 12, stY - 10, 12, 4).fill(0xa66e42);  // coffee
        // Mug handle
        this.sideTable.circle(stX + 26, stY - 4, 3).fill(0xffffff);
        this.sideTable.circle(stX + 26, stY - 4, 1.4).fill(0x6e4a30);

        // Houseplant (right of sofa, between TV and sofa)
        const px = width * 0.62, py = floorY - 4;
        this.plant.clear();
        // Pot
        this.plant.poly([px - 14, py + 30, px + 14, py + 30, px + 11, py + 12, px - 11, py + 12]).fill(0x8c5a35);
        this.plant.ellipse(px, py + 12, 11, 3).fill(0x6e4a30);
        // Leaves
        for (let i = -2; i <= 2; i++) {
            const angle = -Math.PI / 2 + i * 0.4;
            const len = 22 + Math.abs(i) * 4;
            const ex = px + Math.cos(angle) * len * 0.2;
            const ey = py + 8 + Math.sin(angle) * len * 0.6;
            this.plant.ellipse(ex, ey - len * 0.4, 6, len * 0.45).fill(0x4a8038);
            this.plant.ellipse(ex, ey - len * 0.4, 6, len * 0.45)
                .stroke({ color: 0x2a5018, width: 0.8 });
        }
    }

    private drawPicture(g: Graphics, x: number, y: number, w: number, h: number, accent: number): void {
        g.clear();
        // Frame
        g.roundRect(x, y, w, h, 3).fill(0x6e4a30);
        g.roundRect(x + 3, y + 3, w - 6, h - 6, 2).fill(0xfff5e0);
        // Subject — abstract scene
        g.rect(x + 6, y + 6, w - 12, (h - 12) * 0.5).fill(accent);
        g.rect(x + 6, y + 6 + (h - 12) * 0.5, w - 12, (h - 12) * 0.5).fill(0xc5d8be);
        // Tiny "sun" or focal element
        g.circle(x + w * 0.7, y + h * 0.3, 4).fill(0xffd84a);
    }
}
