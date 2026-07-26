import Image from "next/image";

export default function SupplierLogo({
  logoUrl,
  name,
  size = 28,
}: {
  logoUrl: string | null;
  name: string;
  size?: number;
}) {
  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt={`Logo ${name}`}
        width={size}
        height={size}
        className="rounded object-contain shrink-0"
        style={{ width: size, height: size }}
        unoptimized
      />
    );
  }

  return (
    <span
      className="flex items-center justify-center rounded bg-surface-container-high text-on-surface-variant font-bold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
      aria-hidden
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
