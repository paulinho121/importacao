import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const svg = readFileSync(path.join(dir, "icon-source.svg"));
const publicDir = path.join(dir, "..", "public");

const targets = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "apple-icon.png", size: 180 },
  { file: "favicon-32.png", size: 32 },
];

for (const t of targets) {
  await sharp(svg).resize(t.size, t.size).png().toFile(path.join(publicDir, t.file));
  console.log("gerado", t.file);
}

// versao maskable: mesmo desenho mas com margem de seguranca (fundo ocupa
// a area toda, conteudo fica dentro dos ~80% centrais) pra nao cortar o
// navio quando o SO aplicar mascara circular/squircle no icone
const maskableSvg = svg.toString("utf-8").replace(
  '<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">',
  '<svg width="512" height="512" viewBox="-51 -51 614 614" xmlns="http://www.w3.org/2000/svg"><rect x="-51" y="-51" width="614" height="614" fill="#1d4ed8"/>',
);
await sharp(Buffer.from(maskableSvg)).resize(512, 512).png().toFile(path.join(publicDir, "icon-maskable-512.png"));
console.log("gerado icon-maskable-512.png");
