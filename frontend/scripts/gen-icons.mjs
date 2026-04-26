/**
 * Generate PWA icons from public/favicon.svg.
 * Run via: npm run icons
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const svg = await readFile(resolve(root, "public/favicon.svg"));

const targets = [
    { name: "icon-192.png",          size: 192 },
    { name: "icon-512.png",          size: 512 },
    { name: "icon-512-maskable.png", size: 512, padding: 96 },
    { name: "apple-touch-icon.png",  size: 180 },
];

for (const t of targets) {
    let pipe = sharp(svg).resize(t.size, t.size);
    if (t.padding) {
        // Maskable icons need safe-zone padding so the OS can apply
        // its own clip mask.
        pipe = sharp({
            create: {
                width: t.size, height: t.size,
                channels: 4,
                background: { r: 26, g: 18, b: 48, alpha: 1 },
            },
        }).composite([
            {
                input: await sharp(svg)
                    .resize(t.size - t.padding * 2, t.size - t.padding * 2)
                    .png().toBuffer(),
                top: t.padding,
                left: t.padding,
            },
        ]);
    }
    const buf = await pipe.png().toBuffer();
    await writeFile(resolve(root, "public", t.name), buf);
    console.log("wrote", t.name, t.size);
}
