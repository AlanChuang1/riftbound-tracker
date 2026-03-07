/**
 * Generates PNG icons from the SVG for PWA use.
 * Requires: npm install -D sharp
 * Usage: node scripts/generate-icons.mjs
 */
import sharp from "sharp";
import { readFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dirname, "../public/icons/icon.svg");
const outDir = join(__dirname, "../public/icons");

mkdirSync(outDir, { recursive: true });

const svg = readFileSync(svgPath);

await sharp(svg).resize(192, 192).png().toFile(join(outDir, "icon-192.png"));
console.log("Created icon-192.png");

await sharp(svg).resize(512, 512).png().toFile(join(outDir, "icon-512.png"));
console.log("Created icon-512.png");

console.log("Icons generated!");
