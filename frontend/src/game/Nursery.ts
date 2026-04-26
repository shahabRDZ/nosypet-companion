/**
 * Nursery scene: the soft pastel space we use for the youngest stage.
 * Crib, mobile that gently swings, alphabet rug, stacked blocks,
 * shelf with picture books, and a teddy bear in the corner.
 */
import { Container, Graphics } from "pixi.js";

export interface NurseryLayout {
    width: number;
    height: number;
    floorY: number;
    cribPos: { x: number; y: number };
}

export class Nursery {
    public readonly container: Container;
    public readonly bgLayer: Container;
    public readonly fgLayer: Container;
    public readonly fxLayer: Container;

    private wall: Graphics;
    private wainscot: Graphics;
    private window: Graphics;
    private floor: Graphics;
    private rug: Graphics;
    private crib: Graphics;
    private mobile: Container;
    private mobileBar: Graphics;
    private mobileShapes: Graphics;
    private blocks: Graphics;
    private shelf: Graphics;
    private books: Graphics;
    private bear: Graphics;
    private elapsed = 0;

    constructor(public readonly layout: NurseryLayout) {
        this.container = new Container();
        this.container.sortableChildren = true;
        this.bgLayer = new Container(); this.bgLayer.zIndex = 0;
        this.fgLayer = new Container(); this.fgLayer.zIndex = 10;
        this.fxLayer = new Container(); this.fxLayer.zIndex = 20;
        this.container.addChild(this.bgLayer, this.fgLayer, this.fxLayer);

        this.wall = new Graphics();
        this.wainscot = new Graphics();
        this.window = new Graphics();
        this.floor = new Graphics();
        this.rug = new Graphics();
        this.crib = new Graphics();
        this.mobile = new Container();
        this.mobileBar = new Graphics();
        this.mobileShapes = new Graphics();
        this.mobile.addChild(this.mobileBar, this.mobileShapes);
        this.shelf = new Graphics();
        this.books = new Graphics();
        this.blocks = new Graphics();
        this.bear = new Graphics();

        this.bgLayer.addChild(
            this.wall, this.wainscot, this.window,
            this.shelf, this.books,
            this.floor, this.rug,
        );
        this.fgLayer.addChild(this.crib, this.mobile, this.blocks, this.bear);

        this.draw();
    }

    public update(deltaMs: number): void {
        this.elapsed += deltaMs;
        // Gentle mobile swing.
        this.mobile.rotation = Math.sin(this.elapsed / 1000) * 0.06;
    }

    private draw(): void {
        const { width, height, floorY, cribPos } = this.layout;

        // Wall: soft cloud blue with cloud silhouettes.
        this.wall.clear();
        this.wall.rect(0, 0, width, floorY).fill(0xd6e8f8);
        // Dotted polka pattern
        for (let x = 24; x < width; x += 36) {
            for (let y = 24; y < floorY - 40; y += 36) {
                this.wall.circle(x, y, 1.6).fill({ color: 0xffffff, alpha: 0.45 });
            }
        }

        // Wainscot — pale pink
        const wainH = 36;
        this.wainscot.clear();
        this.wainscot.rect(0, floorY - wainH, width, wainH).fill(0xffd6e8);
        this.wainscot.rect(0, floorY - wainH, width, 2).fill({ color: 0x000000, alpha: 0.18 });

        // Window with curtains
        const wx = width * 0.7, wy = floorY * 0.18;
        const ww = 110, wh = 90;
        this.window.clear();
        this.window.rect(wx - 4, wy - 4, ww + 8, wh + 8).fill(0xffd6e8);
        this.window.rect(wx, wy, ww, wh).fill(0xfff5d6);
        this.window.rect(wx + ww / 2 - 2, wy, 4, wh).fill(0xffd6e8);
        // Curtains
        for (let i = 0; i < 3; i++) {
            this.window.poly([
                wx - 8 - i * 3, wy - 4,
                wx + 8 - i * 3, wy - 4,
                wx + 6 - i * 3, wy + wh + 8,
                wx - 10 - i * 3, wy + wh + 8,
            ]).fill({ color: 0xff7eb3, alpha: 0.7 - i * 0.15 });
        }
        for (let i = 0; i < 3; i++) {
            this.window.poly([
                wx + ww - 8 + i * 3, wy - 4,
                wx + ww + 8 + i * 3, wy - 4,
                wx + ww + 10 + i * 3, wy + wh + 8,
                wx + ww - 6 + i * 3, wy + wh + 8,
            ]).fill({ color: 0xff7eb3, alpha: 0.7 - i * 0.15 });
        }

        // Shelf with books on the left
        const shY = floorY * 0.32;
        this.shelf.clear();
        this.shelf.rect(width * 0.06, shY, width * 0.18, 8).fill(0x8c5a35);
        // Brackets
        this.shelf.poly([width * 0.06, shY + 8, width * 0.08, shY + 14, width * 0.06, shY + 14])
            .fill(0x6e4a30);
        this.shelf.poly([width * 0.24 - 6, shY + 8, width * 0.24, shY + 14, width * 0.24 - 6, shY + 14])
            .fill(0x6e4a30);
        // Books
        this.books.clear();
        const bookColors = [0xff7eb3, 0xffd84a, 0x6dd3ff, 0xc084fc, 0x68a058, 0xff7e58];
        let bx = width * 0.07;
        for (let i = 0; i < 6; i++) {
            const bh = 22 + (i % 3) * 4;
            this.books.rect(bx, shY - bh, 9, bh).fill(bookColors[i]);
            this.books.rect(bx + 1, shY - bh + 4, 7, 1).fill({ color: 0x000000, alpha: 0.3 });
            this.books.rect(bx + 1, shY - bh + 8, 7, 1).fill({ color: 0x000000, alpha: 0.3 });
            bx += 11;
        }

        // Floor
        this.floor.clear();
        this.floor.rect(0, floorY, width, height - floorY).fill(0xc8a888);
        for (let x = 0; x < width; x += 50) {
            this.floor.rect(x, floorY, 1, height - floorY).fill({ color: 0x000000, alpha: 0.08 });
        }

        // Rug — pastel circular patches
        const rugW = 240, rugH = 80;
        const rugX = width / 2 - rugW / 2;
        const rugY = floorY + 16;
        this.rug.clear();
        this.rug.roundRect(rugX, rugY, rugW, rugH, 12).fill(0xfff5d6);
        this.rug.roundRect(rugX, rugY, rugW, rugH, 12).stroke({ color: 0xc8a888, width: 2 });
        const dots = [0xff7eb3, 0xffd84a, 0x6dd3ff, 0xc084fc, 0x68a058];
        for (let i = 0; i < 12; i++) {
            const dx = rugX + 20 + (i * 19 % (rugW - 40));
            const dy = rugY + 20 + ((i * 11) % (rugH - 40));
            this.rug.circle(dx, dy, 6).fill(dots[i % dots.length]);
        }

        // Crib (centre)
        const crX = cribPos.x - 80;
        const crY = cribPos.y - 40;
        const crW = 160;
        const crH = 60;
        this.crib.clear();
        // Mattress
        this.crib.roundRect(crX + 6, crY + 14, crW - 12, crH - 18, 4).fill(0xfff5d6);
        // Blanket
        this.crib.roundRect(crX + 14, crY + 22, crW - 28, crH - 30, 3).fill(0xff7eb3);
        this.crib.roundRect(crX + 14, crY + 22, crW - 28, crH - 30, 3)
            .stroke({ color: 0xfae3c1, width: 1.5 });
        // Bars
        const barColor = 0xfae3c1;
        for (let i = 0; i <= 8; i++) {
            const bx = crX + 6 + i * ((crW - 12) / 8);
            this.crib.rect(bx, crY - 16, 2, 30).fill(barColor);
        }
        // Top rail
        this.crib.rect(crX, crY - 18, crW, 5).fill(0x8c5a35);
        // Bottom rail
        this.crib.rect(crX, crY + crH - 4, crW, 6).fill(0x8c5a35);
        this.crib.stroke({ color: 0x4a2818, width: 1.2 });
        // Legs
        this.crib.rect(crX + 4, crY + crH + 2, 6, 18).fill(0x6e4a30);
        this.crib.rect(crX + crW - 10, crY + crH + 2, 6, 18).fill(0x6e4a30);

        // Mobile (hangs from above the crib)
        this.mobile.x = cribPos.x;
        this.mobile.y = crY - 40;
        this.mobileBar.clear();
        this.mobileBar.rect(-30, -2, 60, 3).fill(0x8c5a35);
        // Strings
        for (let i = 0; i < 3; i++) {
            const sx = -25 + i * 25;
            this.mobileBar.moveTo(sx, 1).lineTo(sx, 12)
                .stroke({ color: 0x4a2818, width: 1 });
        }
        this.mobileShapes.clear();
        this.mobileShapes.poly([-30, 18, -22, 18, -26, 26]).fill(0xffd84a);  // star
        this.mobileShapes.circle(0, 22, 6).fill(0x6dd3ff);                     // moon
        this.mobileShapes.circle(0 + 1, 20, 4).fill(0xfff5d6);                 // moon dent
        this.mobileShapes.poly([22, 18, 30, 18, 26, 26]).fill(0xff7eb3);     // heart-ish

        // Stacked blocks
        this.blocks.clear();
        const blkX = width * 0.78;
        const blkY = floorY + 18;
        const drawBlock = (x: number, y: number, color: number, letter: string) => {
            this.blocks.roundRect(x, y, 22, 22, 2).fill(color);
            this.blocks.roundRect(x, y, 22, 22, 2)
                .stroke({ color: 0x000000, width: 1, alpha: 0.25 });
            // Letter mock-up: a small inset square
            this.blocks.rect(x + 6, y + 6, 10, 10).fill({ color: 0xffffff, alpha: 0.35 });
            void letter;  // letters drawn via Pixi Text would inflate atlas
        };
        drawBlock(blkX, blkY + 30, 0xff7eb3, "A");
        drawBlock(blkX + 26, blkY + 30, 0xffd84a, "B");
        drawBlock(blkX + 13, blkY + 6, 0x6dd3ff, "C");

        // Teddy bear
        const tbX = width * 0.08;
        const tbY = floorY + 22;
        this.bear.clear();
        // Shadow
        this.bear.ellipse(tbX, tbY + 22, 22, 4).fill({ color: 0x000000, alpha: 0.25 });
        // Body
        this.bear.ellipse(tbX, tbY + 6, 18, 16).fill(0xc69065);
        // Belly
        this.bear.ellipse(tbX, tbY + 10, 11, 9).fill(0xe8c8a0);
        // Head
        this.bear.circle(tbX, tbY - 14, 14).fill(0xc69065);
        // Ears
        this.bear.circle(tbX - 11, tbY - 22, 5).fill(0xc69065);
        this.bear.circle(tbX + 11, tbY - 22, 5).fill(0xc69065);
        this.bear.circle(tbX - 11, tbY - 22, 2.5).fill(0xe8c8a0);
        this.bear.circle(tbX + 11, tbY - 22, 2.5).fill(0xe8c8a0);
        // Snout
        this.bear.ellipse(tbX, tbY - 10, 5, 4).fill(0xe8c8a0);
        // Eyes
        this.bear.circle(tbX - 4, tbY - 16, 1.5).fill(0x000000);
        this.bear.circle(tbX + 4, tbY - 16, 1.5).fill(0x000000);
        // Nose
        this.bear.circle(tbX, tbY - 11, 1.4).fill(0x000000);
        // Smile
        this.bear.moveTo(tbX - 2, tbY - 8).quadraticCurveTo(tbX, tbY - 6, tbX + 2, tbY - 8)
            .stroke({ color: 0x000000, width: 1, cap: "round" });
    }
}
