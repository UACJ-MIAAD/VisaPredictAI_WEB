// AZ3b — one-off icon pipeline. Derives every site icon from the master logo
// (public/LogoVisaPredictAI.png, 358×360 with alpha) so the 256 KB original is
// never shipped at 28 px again. Outputs are COMMITTED (run manually after a
// logo change; not part of prebuild because the logo never changes per build):
//
//   public/logo-64.png            64×64   nav/footer-size render (~3 kB)
//   public/apple-touch-icon.png   180×180 flattened on white (iOS ignores alpha)
//   public/icon-192.png           192×192 transparent, purpose "any"
//   public/icon-512.png           512×512 transparent, clean extended canvas
//   public/icon-maskable-192.png  192×192 white full-bleed, logo in 80% safe zone
//   public/icon-maskable-512.png  512×512 idem
//   app/favicon.ico               32×32 PNG-in-ICO (Next serves it at /favicon.ico)
//
// The logo's marks are red/navy → maskable + apple variants sit on WHITE
// (they would drown on the dark theme color).
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const SRC = join(root, "public", "LogoVisaPredictAI.png");
const PUB = (f) => join(root, "public", f);

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

// Square "contain" render of the logo at `inner` px, returned as a raw buffer.
const logoAt = (inner) =>
  sharp(SRC)
    .resize(inner, inner, { fit: "contain", background: TRANSPARENT })
    .png()
    .toBuffer();

async function onCanvas(size, inner, background, out) {
  const logo = await logoAt(inner);
  const pad = Math.round((size - inner) / 2);
  await sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: logo, left: pad, top: pad }])
    .png({ compressionLevel: 9, palette: true, quality: 90 }) // flat-color logo → indexed PNG is ~5× smaller
    .toFile(PUB(out));
  console.log(`  ✓ public/${out} (${size}×${size})`);
}

// ── transparent "any" icons: logo fills the canvas (clean extension, no crop)
await onCanvas(64, 64, TRANSPARENT, "logo-64.png");
await onCanvas(192, 192, TRANSPARENT, "icon-192.png");
await onCanvas(512, 512, TRANSPARENT, "icon-512.png");

// ── apple touch icon: solid white, slight breathing room (iOS rounds corners)
await onCanvas(180, 150, WHITE, "apple-touch-icon.png");

// ── maskable: full-bleed white background, logo inside the 80% safe zone
await onCanvas(192, Math.round(192 * 0.72), WHITE, "icon-maskable-192.png");
await onCanvas(512, Math.round(512 * 0.72), WHITE, "icon-maskable-512.png");

// ── favicon.ico: single 32×32 entry, PNG-payload ICO (supported everywhere
// since Vista) — replaces the old 100 KB multi-res file.
const png32 = await sharp(SRC)
  .resize(32, 32, { fit: "contain", background: TRANSPARENT })
  .png({ compressionLevel: 9 })
  .toBuffer();
const header = Buffer.alloc(6 + 16);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // 1 image
header.writeUInt8(32, 6); // width
header.writeUInt8(32, 7); // height
header.writeUInt8(0, 8); // palette
header.writeUInt8(0, 9); // reserved
header.writeUInt16LE(1, 10); // color planes
header.writeUInt16LE(32, 12); // bits per pixel
header.writeUInt32LE(png32.length, 14); // payload size
header.writeUInt32LE(22, 18); // payload offset
await writeFile(join(root, "app", "favicon.ico"), Buffer.concat([header, png32]));
console.log(`  ✓ app/favicon.ico (32×32, ${((6 + 16 + png32.length) / 1024).toFixed(1)} kB)`);
