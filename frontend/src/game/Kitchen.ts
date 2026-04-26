/**
 * Kitchen scene used during the feed action.
 *
 * A small warm kitchen: tile floor, wooden cabinets along the back
 * wall, a stove with subtle steam, a fridge with a magnet, a hanging
 * pendant lamp, a sink with a faucet, and a feeding bowl on a placemat
 * at the centre. The companion walks in, eats from the bowl, then
 * walks back to the bedroom.
 */
import { Container, Graphics } from "pixi.js";

export interface KitchenLayout {
    width: number;
    height: number;
    floorY: number;
    bowlPos: { x: number; y: number };
}

export class Kitchen {
    public readonly container: Container;
    public readonly bgLayer: Container;
    public readonly fgLayer: Container;
    public readonly fxLayer: Container;

    private wall: Graphics;
    private cabinets: Graphics;
    private fridge: Graphics;
    private stove: Graphics;
    private sink: Graphics;
    private floor: Graphics;
    private bowl: Graphics;
    private placemat: Graphics;
    private lamp: Graphics;

    constructor(public readonly layout: KitchenLayout) {
        this.container = new Container();
        this.container.sortableChildren = true;
        this.bgLayer = new Container(); this.bgLayer.zIndex = 0;
        this.fgLayer = new Container(); this.fgLayer.zIndex = 10;
        this.fxLayer = new Container(); this.fxLayer.zIndex = 20;
        this.container.addChild(this.bgLayer, this.fgLayer, this.fxLayer);

        this.wall = new Graphics();
        this.cabinets = new Graphics();
        this.fridge = new Graphics();
        this.stove = new Graphics();
        this.sink = new Graphics();
        this.floor = new Graphics();
        this.bowl = new Graphics();
        this.placemat = new Graphics();
        this.lamp = new Graphics();

        this.bgLayer.addChild(this.wall, this.cabinets, this.fridge, this.stove, this.sink, this.lamp, this.floor);
        this.fgLayer.addChild(this.placemat, this.bowl);

        this.draw();
    }

    private draw(): void {
        const { width, height, floorY, bowlPos } = this.layout;

        // Wall: warm cream
        this.wall.clear();
        this.wall.rect(0, 0, width, floorY).fill(0xf5e6c8);
        // Subtle wallpaper grid
        for (let x = 30; x < width; x += 60) {
            this.wall.rect(x, 0, 1, floorY).fill({ color: 0x000000, alpha: 0.04 });
        }

        // Pendant lamp from ceiling
        const lampX = width * 0.5;
        this.lamp.clear();
        this.lamp.rect(lampX - 1, 0, 2, 38).fill({ color: 0x000000, alpha: 0.4 });
        this.lamp.poly([lampX - 22, 38, lampX + 22, 38, lampX + 14, 70, lampX - 14, 70])
            .fill(0x6e4a30);
        this.lamp.ellipse(lampX, 70, 20, 6).fill(0x442818);
        // Light cone underneath
        this.lamp.poly([lampX - 12, 70, lampX + 12, 70, lampX + 110, floorY + 60, lampX - 110, floorY + 60])
            .fill({ color: 0xfff5d6, alpha: 0.18 });

        // Cabinets along the upper wall
        this.cabinets.clear();
        const cy = floorY * 0.32;
        const ch = floorY * 0.3;
        this.cabinets.rect(width * 0.28, cy, width * 0.4, ch).fill(0x8c5a35);
        this.cabinets.stroke({ color: 0x4a2818, width: 2 });
        // Cabinet doors
        for (let i = 0; i < 3; i++) {
            const dx = width * 0.28 + (width * 0.4 / 3) * i + 4;
            const dy = cy + 4;
            const dw = (width * 0.4 / 3) - 8;
            const dh = ch - 8;
            this.cabinets.roundRect(dx, dy, dw, dh, 3).fill(0xa66e42);
            this.cabinets.stroke({ color: 0x4a2818, width: 1 });
            this.cabinets.circle(dx + dw - 6, dy + dh / 2, 1.5).fill(0x2a1408);
        }

        // Fridge (right side)
        const fx = width * 0.78, fy = floorY * 0.18;
        const fw = 70, fh = floorY * 0.7;
        this.fridge.clear();
        this.fridge.roundRect(fx, fy, fw, fh, 6).fill(0xe8e8ec);
        this.fridge.stroke({ color: 0x666666, width: 1.5 });
        // Door split
        this.fridge.rect(fx, fy + fh * 0.42, fw, 2).fill(0x999999);
        // Handle
        this.fridge.rect(fx + 5, fy + fh * 0.18, 3, fh * 0.18).fill(0x999999);
        this.fridge.rect(fx + 5, fy + fh * 0.6, 3, fh * 0.18).fill(0x999999);
        // Magnet (a tiny heart)
        this.fridge.circle(fx + fw - 14, fy + 14, 3).fill(0xff7eb3);

        // Stove (left)
        const sx = width * 0.06, sy = floorY * 0.48;
        const sw = 70, sh = floorY * 0.4;
        this.stove.clear();
        this.stove.roundRect(sx, sy, sw, sh, 4).fill(0x4a4a55);
        this.stove.stroke({ color: 0x222233, width: 1.5 });
        // Stove top burners
        this.stove.circle(sx + sw * 0.3, sy + 8, 6).fill(0x222233);
        this.stove.circle(sx + sw * 0.7, sy + 8, 6).fill(0x222233);
        // Pot on stove
        this.stove.roundRect(sx + sw * 0.18, sy - 8, 24, 12, 2).fill(0xc4c4cc);
        this.stove.rect(sx + sw * 0.16, sy - 12, 28, 4).fill(0xa0a0a8);
        // Steam line (decorative — animation could add real steam later)
        this.stove.moveTo(sx + sw * 0.3, sy - 14)
            .quadraticCurveTo(sx + sw * 0.25, sy - 22, sx + sw * 0.32, sy - 28)
            .stroke({ color: 0xffffff, width: 2, alpha: 0.55 });

        // Sink between cabinets and stove
        const skx = width * 0.18, sky = floorY * 0.52;
        const skw = 60, skh = floorY * 0.36;
        this.sink.clear();
        this.sink.roundRect(skx, sky, skw, skh, 3).fill(0xc8c8d0);
        this.sink.roundRect(skx + 6, sky + 6, skw - 12, skh - 14, 3).fill(0x8e8e98);
        // Faucet
        this.sink.rect(skx + skw / 2 - 1, sky - 14, 2, 14).fill(0xb0b0bc);
        this.sink.rect(skx + skw / 2 - 8, sky - 14, 16, 3).fill(0xb0b0bc);

        // Floor (warm wood planks like bedroom but warmer)
        this.floor.clear();
        this.floor.rect(0, floorY, width, height - floorY).fill(0xc89866);
        for (let x = 0; x < width; x += 50) {
            this.floor.rect(x, floorY, 1, height - floorY).fill({ color: 0x000000, alpha: 0.1 });
        }
        for (let y = floorY + 30; y < height; y += 30) {
            this.floor.rect(0, y, width, 1).fill({ color: 0x000000, alpha: 0.08 });
        }

        // Placemat under bowl
        this.placemat.clear();
        this.placemat.roundRect(bowlPos.x - 50, bowlPos.y - 4, 100, 28, 4).fill(0xc44a3b);
        this.placemat.stroke({ color: 0xfae3c1, width: 2 });

        // Bowl (bigger than the bedroom version, with kibble)
        this.bowl.clear();
        this.bowl.ellipse(bowlPos.x, bowlPos.y + 6, 28, 9).fill({ color: 0x000000, alpha: 0.18 });
        this.bowl.ellipse(bowlPos.x, bowlPos.y, 28, 14).fill(0xc44a3b);
        this.bowl.ellipse(bowlPos.x, bowlPos.y - 2, 23, 11).fill(0x6e3220);
        // Kibble in bowl
        this.bowl.ellipse(bowlPos.x - 6, bowlPos.y - 2, 4, 3).fill(0xffd84a);
        this.bowl.ellipse(bowlPos.x + 5, bowlPos.y - 1, 4, 3).fill(0xb87838);
        this.bowl.ellipse(bowlPos.x - 1, bowlPos.y - 4, 4, 3).fill(0xd8a058);
    }
}
