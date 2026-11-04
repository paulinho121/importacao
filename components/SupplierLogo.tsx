import Image from "next/image";

// Logo do fornecedor numa "etiqueta" de tamanho fixo (2x mais larga que alta;
// `size` é a altura), com fundo branco: as logos vêm com fundos e proporções
// diferentes (transparente, branco, escuro) e, soltas, ficavam desalinhadas e
// sumiam no tema escuro. Assim todas ocupam o mesmo espaço e o nome que vem
// ao lado começa sempre no mesmo ponto.
export default function SupplierLogo({
  logoUrl,
  name,
  size = 28,
}: {
  logoUrl: string | null;
  name: string;
  size?: number;
}) {
  const box = { width: size * 2, height: size };
  if (!logoUrl) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-md border border-outline-variant/60 bg-surface-container-high font-bold text-on-surface-variant"
        style={{ ...box, fontSize: size * 0.45 }}
        aria-hidden
      >
        {name.charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-outline-variant/60 bg-white"
      style={box}
    >
      <Image
        src={logoUrl}
        alt={`Logo ${name}`}
        width={size * 2}
        height={size}
        className="object-contain"
        style={{ maxWidth: "calc(100% - 6px)", maxHeight: "calc(100% - 6px)" }}
        unoptimized
      />
    </span>
  );
}
