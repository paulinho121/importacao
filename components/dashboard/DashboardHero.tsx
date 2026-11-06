import Image from "next/image";
import Link from "next/link";
import { ArrowRight, FileText, Plus } from "lucide-react";

// Banner de abertura do Dashboard: foto do porto/avião ao fundo, degradê
// escuro para o texto ficar legível e os dois atalhos principais.
// No celular o texto fica embaixo (a foto aparece inteira em cima) e os botões
// ocupam a largura toda; do tablet pra cima o texto fica à esquerda.
// As cores são fixas (a foto é escura nos dois temas).
export function DashboardHero() {
  return (
    <section className="relative isolate overflow-hidden rounded-2xl bg-[#071a22] shadow-xl shadow-black/25 ring-1 ring-white/10 print:hidden">
      <Image
        src="/banner-hero.jpg"
        alt=""
        fill
        priority
        sizes="(min-width: 1024px) 80vw, 100vw"
        className="-z-20 object-cover object-[82%_top] sm:object-[70%_center]"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-t from-[#06151c] via-[#06151c]/80 via-45% to-[#06151c]/0 sm:bg-gradient-to-r sm:from-[#06151c] sm:via-[#06151c]/85 sm:via-40% sm:to-[#06151c]/10"
      />
      {/* brilho suave de acabamento no canto */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-24 -z-10 h-64 w-64 rounded-full bg-[#2abf9c]/15 blur-3xl"
      />

      <div className="flex min-h-[380px] flex-col justify-end gap-5 px-5 pb-6 pt-24 sm:min-h-[320px] sm:justify-center sm:px-10 sm:py-10 lg:px-14">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7fddc3] backdrop-blur-md sm:text-[11px]">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2abf9c] opacity-60 motion-reduce:hidden" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#2abf9c]" />
          </span>
          Logística Global &amp; Alfândega
        </span>

        <div className="max-w-2xl space-y-3">
          <h1 className="text-[28px] font-extrabold uppercase leading-[1.05] tracking-tight text-white drop-shadow-sm min-[400px]:text-3xl sm:text-4xl lg:text-5xl">
            Sistema Integrado
            <br />
            de{" "}
            <span className="bg-gradient-to-r from-[#2abf9c] to-[#7fddc3] bg-clip-text text-transparent">
              Importação
            </span>
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
            <strong className="font-semibold text-white">
              Conectando o Mundo por Mar e Ar.
            </strong>{" "}
            Gestão completa de fretes, despachos aduaneiros, invoice e tracking
            em tempo real.
          </p>
        </div>

        <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:flex-wrap">
          <Link
            href="/processos/novo"
            className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#2abf9c] px-5 text-sm font-semibold text-[#06151c] shadow-lg shadow-[#2abf9c]/20 transition active:scale-[0.98] hover:bg-[#35d1ad] sm:h-11"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Novo Processo de Importação
            <ArrowRight
              className="hidden h-4 w-4 -translate-x-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100 sm:block"
              aria-hidden
            />
          </Link>
          <Link
            href="/relatorio-operacoes"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/5 px-5 text-sm font-semibold text-white backdrop-blur-md transition active:scale-[0.98] hover:bg-white/15 sm:h-11"
          >
            <FileText className="h-4 w-4" aria-hidden />
            Relatório de Operações
          </Link>
        </div>
      </div>
    </section>
  );
}
