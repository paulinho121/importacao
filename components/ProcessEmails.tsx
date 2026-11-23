import Link from "next/link";
import ConfirmActionButton from "@/components/ConfirmActionButton";
import EmailItem from "@/components/EmailItem";
import { unlinkEmailFromProcess } from "@/app/emails/actions";
import type { EmailView } from "@/lib/process-emails";

// Seção "E-mails" da tela do processo: os e-mails vinculados a ele, com opção de
// desvincular (o e-mail volta para "E-mails não vinculados", sem ser apagado).
export default function ProcessEmails({ processId, emails }: { processId: string; emails: EmailView[] }) {
  return (
    <section className="bg-surface-container-lowest border border-outline-variant p-gutter rounded-xl shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-stack-md">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">mail</span>
          <h3 className="font-headline-sm text-headline-sm text-primary">E-mails</h3>
          {emails.length > 0 && (
            <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-xs font-bold text-on-surface-variant">
              {emails.length}
            </span>
          )}
        </div>
        <Link href="/emails" className="text-xs font-bold text-secondary hover:underline">
          E-mails não vinculados
        </Link>
      </div>

      {emails.length === 0 ? (
        <p className="text-sm text-on-surface-variant">
          Nenhum e-mail vinculado a este processo. Os e-mails com o marcador Processos aparecem em &quot;E-mails não
          vinculados&quot;, onde você confirma o processo certo.
        </p>
      ) : (
        <ul className="divide-y divide-outline-variant">
          {emails.map((email) => (
            <li key={email.id} className="py-4 first:pt-0 last:pb-0">
              <EmailItem email={email}>
                <div className="pt-1">
                  <ConfirmActionButton
                    action={unlinkEmailFromProcess.bind(null, email.id, processId)}
                    label="Desvincular"
                    message="Desvincular este e-mail do processo? Ele volta para E-mails não vinculados (nada é apagado)."
                  />
                </div>
              </EmailItem>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
