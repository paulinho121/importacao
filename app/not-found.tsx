import Link from "next/link";
import { Compass } from "lucide-react";

// Cai aqui pra qualquer rota/registro inexistente (ex: link antigo,
// ID apagado) — antes disso o Next mostrava a mensagem genérica dele,
// sem identidade visual nem caminho de volta.
export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Compass className="h-7 w-7" />
      </div>
      <div>
        <h1 className="font-display-lg text-display-lg text-primary">Página não encontrada</h1>
        <p className="mt-1 max-w-sm text-on-surface-variant font-body-md text-body-md">
          O que você está procurando não existe ou foi removido. Confira o link ou volte para o
          Dashboard.
        </p>
      </div>
      <Link
        href="/"
        className="mt-2 px-6 py-2.5 rounded-lg bg-secondary text-white font-label-md text-label-md hover:opacity-90 transition-all"
      >
        Voltar para o Dashboard
      </Link>
    </div>
  );
}
