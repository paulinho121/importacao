import Image from "next/image";

// A caixa é 2x mais larga que alta: a maioria das logos de marca é
// horizontal e ficava minúscula num quadrado. `size` é a altura.
export default function SupplierLogo({
  logoUrl,
  name,
  size = 28,
}: {
  logoUrl: string | null;
  name: string;
  size?: number;
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center"
      style={{ width: size * 2, height: size }}
    >
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt={`Logo ${name}`}
          width={size * 2}
          height={size}
          className="rounded object-contain"
          style={{ maxWidth: "100%", maxHeight: "100%" }}
          unoptimized
        />
      ) : (
        <span
          className="flex items-center justify-center rounded bg-surface-container-high text-on-surface-variant font-bold"
          style={{ width: size, height: size, fontSize: size * 0.45 }}
          aria-hidden
        >
          {name.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}
