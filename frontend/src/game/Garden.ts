/**
 * Garden scene used during the play action.
 *
 * Outdoor scene: sky gradient, distant hills, grassy ground with grass
 * blades, scattered flowers, a small tree, and a butterfly. The
 * companion plays here with their toy.
 */
import { Container, Graphics } from "pixi.js";

export interface GardenLayout {
    width: number;
    height: number;
    floorY: number;
    toyPos: { x: number; y: number };
}

export class Garden {
    public readonly container: Container;
    public readonly bgLayer: Container;
    public readonly fgLayer: Container;
    public readonly fxLayer: Container;

    private sky: Graphics;
    private hillsBack: Graphics;
    private hillsFront: Graphics;
    private grass: Graphics;
    private grassBlades: Graphics;
    private flowers: Graphics;
    private tree: Graphics;
    private butterfly: Graphics;
    private toy: Graphics;
    private elapsed = 0;

    constructor(public readonly layout: GardenLayout) {
        this.container = new Container();
        this.container.sortableChildren = true;
        this.bgLayer = new Container(); this.bgLayer.zIndex = 0;
        this.fgLayer = new Container(); this.fgLayer.zIndex = 10;
        this.fxLayer = new Container(); this.fxLayer.zIndex = 20;
        this.container.addChild(this.bgLayer, this.fgLayer, this.fxLayer);

        this.sky = new Graphics();
        this.hillsBack = new Graphics();
        this.hillsFront = new Graphics();
        this.grass = new Graphics();
        this.grassBlades = new Graphics();
        this.flowers = new Graphics();
        this.tree = new Graphics();
        this.butterfly = new Graphics();
        this.toy = new Graphics();

        this.bgLayer.addChild(this.sky, this.hillsBack, this.hillsFront, this.grass, this.grassBlades, this.flowers, this.tree);
        this.fgLayer.addChild(this.toy);
        this.fxLayer.addChild(this.butterfly);

        this.draw();
    }

    public update(deltaMs: number): void {
        this.elapsed += deltaMs;
        // Butterfly drifts in a figure-eight pattern.
        const t = this.elapsed / 1000;
        const cx = this.layout.width * 0.7;
        const cy = this.layout.floorY - 40;
        this.butterfly.x = cx + Math.sin(t * 0.8) * 80;
        this.butterfly.y = cy + Math.sin(t * 1.6) * 30;
    }

    private draw(): void {
        const { width, height, floorY, toyPos } = this.layout;

        // Sky gradient (blue to peach near the horizon)
        this.sky.clear();
        this.sky.rect(0, 0, width, floorY).fill(0xb8e0ff);
        // Soft horizon glow
        for (let i = 0; i < 30; i++) {
            this.sky.rect(0, floorY - i * 4, width, 4)
                .fill({ color: 0xffd6a8, alpha: 0.04 + i * 0.005 });
        }

        // Distant hills (background)
        this.hillsBack.clear();
        this.hillsBack.moveTo(0, floorY);
        this.hillsBack.bezierCurveTo(width * 0.1, floorY - 60, width * 0.3, floorY - 80, width * 0.4, floorY - 30);
        this.hillsBack.bezierCurveTo(width * 0.55, floorY - 50, width * 0.7, floorY - 90, width * 0.85, floorY - 20);
        this.hillsBack.lineTo(width, floorY - 30);
        this.hillsBack.lineTo(width, floorY);
        this.hillsBack.closePath();
        this.hillsBack.fill(0x88b078);

        // Mid hills
        this.hillsFront.clear();
        this.hillsFront.moveTo(0, floorY);
        this.hillsFront.bezierCurveTo(width * 0.15, floorY - 30, width * 0.35, floorY - 50, width * 0.5, floorY - 10);
        this.hillsFront.bezierCurveTo(width * 0.65, floorY - 30, width * 0.8, floorY - 60, width, floorY - 10);
        this.hillsFront.lineTo(width, floorY);
        this.hillsFront.closePath();
        this.hillsFront.fill(0x6ca65c);

        // Grass ground
        this.grass.clear();
        this.grass.rect(0, floorY, width, height - floorY).fill(0x68a058);
        // Subtle texture stripes
        for (let y = floorY; y < height; y += 8) {
            const alpha = 0.04 + (y / height) * 0.06;
            this.grass.rect(0, y, width, 1).fill({ color: 0x000000, alpha });
        }

        // Individual grass blades for depth (random along the foreground)
        this.grassBlades.clear();
        for (let i = 0; i < 30; i++) {
            const x = (i * 37 + 13) % width;
            const baseY = floorY + 4 + (i % 5) * 6;
            const tipY = baseY - 6 - (i % 3) * 3;
            const sway = ((i * 7) % 5) - 2;
            this.grassBlades.moveTo(x, baseY).quadraticCurveTo(x + sway, (baseY + tipY) / 2, x + sway * 1.5, tipY)
                .stroke({ color: 0x4a8038, width: 1.4, cap: "round" });
        }

        // Flowers
        this.flowers.clear();
        const flowerSpots = [
            { x: width * 0.12, y: floorY + 18, color: 0xff7eb3 },
            { x: width * 0.32, y: floorY + 32, color: 0xffd84a },
            { x: width * 0.85, y: floorY + 22, color: 0xc084fc },
            { x: width * 0.6, y: floorY + 40, color: 0xff7eb3 },
            { x: width * 0.45, y: floorY + 50, color: 0xffd84a },
        ];
        for (const f of flowerSpots) {
            // Stem
            this.flowers.moveTo(f.x, f.y + 6).lineTo(f.x, f.y + 14)
                .stroke({ color: 0x4a8038, width: 1.5 });
            // 5 petals
            for (let p = 0; p < 5; p++) {
                const a = (p / 5) * Math.PI * 2;
                this.flowers.circle(f.x + Math.cos(a) * 3, f.y + Math.sin(a) * 3, 2.5).fill(f.color);
            }
            this.flowers.circle(f.x, f.y, 1.5).fill(0xffd84a);
        }

        // Tree on the right
        const tx = width * 0.88, ty = floorY - 10;
        this.tree.clear();
        // Trunk
        this.tree.rect(tx - 4, ty - 8, 8, 50).fill(0x6e4a30);
        this.tree.stroke({ color: 0x4a2818, width: 1.5 });
        // Foliage clusters
        this.tree.circle(tx, ty - 30, 22).fill(0x4a8038);
        this.tree.circle(tx - 14, ty - 22, 16).fill(0x4a8038);
        this.tree.circle(tx + 14, ty - 22, 16).fill(0x4a8038);
        this.tree.circle(tx, ty - 40, 14).fill(0x68a058);
        // Highlight
        this.tree.circle(tx - 6, ty - 36, 6).fill({ color: 0xffffff, alpha: 0.18 });

        // Butterfly (two wings)
        this.butterfly.clear();
        this.butterfly.ellipse(-4, 0, 4, 5).fill(0xffd84a);
        this.butterfly.ellipse(4, 0, 4, 5).fill(0xffd84a);
        this.butterfly.circle(0, 0, 1.4).fill(0x000000);

        // Toy ball on the grass
        this.toy.clear();
        this.toy.circle(toyPos.x, toyPos.y + 5, 7).fill({ color: 0x000000, alpha: 0.2 });
        this.toy.circle(toyPos.x, toyPos.y, 9).fill(0xff7eb3);
        this.toy.circle(toyPos.x - 2, toyPos.y - 2, 2.5).fill({ color: 0xffffff, alpha: 0.6 });
    }
}
