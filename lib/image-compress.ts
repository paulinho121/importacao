import sharp from "sharp";

// Redução das fotos de produto antes de irem para o Storage: o Supabase cobra
// espaço de arquivos separado do banco, e PNGs de produto passavam de 350 KB
// em média. Em amostra real, WebP de até 1200 px (qualidade 80) ficou ~89%
// menor — e as fotos aparecem pequenas no sistema, então a diferença visual é
// praticamente nula.

export const PHOTO_MAX_SIDE = 1200;
export const PHOTO_QUALITY = 80;

export type CompressedImage = { buffer: Buffer; contentType: "image/webp"; ext: "webp" };

// Converte para WebP com no máximo PHOTO_MAX_SIDE px no maior lado (sem
// ampliar), respeitando a orientação EXIF. Mantém transparência de PNG.
export async function compressPhoto(input: Buffer | ArrayBuffer | Uint8Array): Promise<CompressedImage> {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input as ArrayBuffer);
  const buffer = await sharp(buf)
    .rotate()
    .resize({ width: PHOTO_MAX_SIDE, height: PHOTO_MAX_SIDE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: PHOTO_QUALITY })
    .toBuffer();
  return { buffer, contentType: "image/webp", ext: "webp" };
}
