import Image from "next/image";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";

// Banner de abertura do Dashboard: foto do porto/avião ao fundo, degradê
// escuro à esquerda para o texto ficar legível e os dois atalhos principais.
// As cores são fixas (a foto é escura nos dois temas).
export function DashboardHero() {
  return (
    <section className="relative isolate overflow-hidden rounded-card border border-border bg-[#071a22] print:hidden">
      <Image
        src="/banner-hero.jpg"
        alt=""
        fill
        priority
        sizes="(min-width: 1024px) 80vw, 100vw"
        className="-z-20 object-cover object-[70%_center]"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-r from-[#06151c] via-[#06151c]/85 to-[#06151c]/10 max-md:from-[#06151c]/90 max-md:via-[#06151c]/80 max-md:to-[#06151c]/55"
      />

      <div className="flex min-h-[260px] flex-col justify-center gap-5 px-6 py-10 sm:px-10 md:min-h-[320px] lg:px-14">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7fddc3] backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-[#2abf9c]" aria-hidden />
          Logística Global &amp; Alfândega
        </span>

        <div className="max-w-2xl space-y-3">
          <h1 className="text-3xl font-extrabold uppercase leading-[1.05] tracking-tight text-white sm:text-4xl lg:text-5xl">
            Sistema Integrado
            <br />
            de <span className="text-[#2abf9c]">Importação</span>
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-slate-200 sm:text-base">
            <strong className="font-semibold text-white">Conectando o Mundo por Mar e Ar.</strong> Gestão completa de
            fretes, despachos aduaneiros, invoice e tracking em tempo real.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 pt-1">
          <Link
            href="/processos/novo"
            className="inline-flex items-center gap-2 rounded-lg bg-[#2abf9c] px-5 py-2.5 text-sm font-semibold text-[#06151c] shadow-lg shadow-black/20 transition hover:bg-[#35d1ad]"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Novo Processo de Importação
          </Link>
          <Link
            href="/relatorio-operacoes"
            className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
          >
            <FileText className="h-4 w-4" aria-hidden />
            Relatório de Operações
          </Link>
        </div>
      </div>
    </section>
  );
}
