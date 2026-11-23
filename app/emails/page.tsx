import { redirect } from "next/navigation";
import { desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { gmailConnections, processEmails, processes, suppliers } from "@/db/schema";
import { getCurrentUser } from "@/lib/supabase-server";
import { loadEmails } from "@/lib/process-emails";
import { loadSuggestionIndex, suggestProcess } from "@/lib/email-suggestions";
import { formatDateTime } from "@/lib/quote-events";
import { GMAIL_LABEL } from "@/lib/gmail";
import EmailItem from "@/components/EmailItem";
import ConfirmActionButton from "@/components/ConfirmActionButton";
import SubmitButton from "@/components/SubmitButton";
import { disconnectGmailAction, linkEmailToProcess, syncGmailNowAction } from "@/app/emails/actions";

export const dynamic = "force-dynamic";
// A sincronização manual (ação desta página) pode levar até 40 s.
export const maxDuration = 60;

const LIST_LIMIT = 100;

export default async function EmailsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [connection] = await db.select().from(gmailConnections).where(eq(gmailConnections.userId, user.id));

  const [emails, index, processOptions] = await Promise.all([
    loadEmails(isNull(processEmails.processId), LIST_LIMIT),
    loadSuggestionIndex(),
    db
      .select({
        id: processes.id,
        processNumber: processes.processNumber,
        externalReference: processes.externalReference,
        supplierName: suppliers.name,
      })
      .from(processes)
      .innerJoin(suppliers, eq(processes.supplierId, suppliers.id))
      .orderBy(desc(processes.createdAt)),
  ]);

  return (
    <div className="p-4 sm:p-4 sm:p-6 md:p-10 max-w-[1440px] mx-auto w-full space-y-6">
      <div>
        <h2 className="font-display-lg text-display-lg text-primary">E-mails não vinculados</h2>
        <p className="text-on-surface-variant font-body-md text-body-md mt-1">
          E-mails do Gmail com o marcador <strong>{GMAIL_LABEL}</strong> que ainda não estão ligados a um processo.
          Confira a sugestão e vincule. Nada é apagado: quem fica sem vínculo continua aqui.
        </p>
      </div>

      <section className="bg-surface-container-lowest border border-outline-variant p-gutter rounded-xl shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <span className="material-symbols-outlined text-primary mt-0.5">mail</span>
            <div className="min-w-0">
              <h3 className="font-headline-sm text-headline-sm text-primary">Conta do Gmail</h3>
              {connection ? (
                <>
                  <p className="text-sm text-on-surface break-all">Conectada: {connection.googleEmail}</p>
                  <p className="text-xs text-on-surface-variant">
                    Última sincronização:{" "}
                    {connection.lastSyncedAt
                      ? formatDateTime(connection.lastSyncedAt.toISOString())
                      : "ainda não sincronizada"}
                  </p>
                  {connection.lastSyncError && (
                    <p className="text-xs text-error mt-1">{connection.lastSyncError}</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-on-surface-variant">
                  Conecte sua conta do Gmail (somente leitura) para importar os e-mails marcados como{" "}
                  <strong>{GMAIL_LABEL}</strong>. Cada pessoa conecta a própria conta.
                </p>
              )}
            </div>
          </div>

          {connection ? (
            <div className="flex flex-wrap items-center gap-3">
              <form action={syncGmailNowAction}>
                <SubmitButton className="px-4 py-2 rounded-lg bg-secondary text-white font-label-md text-label-md hover:opacity-90 transition-all flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">sync</span>
                  Sincronizar agora
                </SubmitButton>
              </form>
              <ConfirmActionButton
                action={disconnectGmailAction}
                label="Desconectar"
                message="Desconectar o Gmail desta conta? Os e-mails já importados continuam salvos."
              />
            </div>
          ) : (
            <a
              href="/api/gmail/connect"
              className="px-4 py-2 rounded-lg bg-secondary text-white font-label-md text-label-md hover:opacity-90 transition-all flex items-center gap-2 self-start"
            >
              <span className="material-symbols-outlined text-[18px]">link</span>
              Conectar Gmail
            </a>
          )}
        </div>
      </section>

      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
        <div className="px-gutter py-4 bg-surface-container flex items-center justify-between">
          <h3 className="font-label-md text-label-md text-primary uppercase tracking-wider">
            Aguardando vínculo ({emails.length})
          </h3>
          {emails.length === LIST_LIMIT && (
            <span className="text-xs text-on-surface-variant">Mostrando os {LIST_LIMIT} mais recentes</span>
          )}
        </div>

        {emails.length === 0 ? (
          <p className="px-gutter py-8 text-center text-on-surface-variant text-sm">
            Nenhum e-mail aguardando vínculo.
          </p>
        ) : (
          <ul className="divide-y divide-outline-variant">
            {emails.map((email) => {
              const suggestion = suggestProcess(index, { subject: email.subject, bodyText: email.bodyText ?? "" });
              const linkAction = linkEmailToProcess.bind(null, email.id);
              return (
                <li key={email.id} className="p-gutter space-y-3">
                  <EmailItem email={email} />
                  <div className="flex flex-col lg:flex-row lg:items-center gap-3 rounded-lg bg-surface-container-low/60 p-3">
                    <div className="min-w-0 flex-1 text-xs text-on-surface-variant">
                      {suggestion ? (
                        <p>
                          <span className="font-bold text-primary">Sugestão: processo #{suggestion.processNumber}</span>{" "}
                          · encontrado: {suggestion.matchedKeys.join(", ")}
                          {suggestion.otherCandidates > 0 && (
                            <span> · outros {suggestion.otherCandidates} processo(s) também citados, confira</span>
                          )}
                        </p>
                      ) : (
                        <p>Sem sugestão automática. Escolha o processo.</p>
                      )}
                    </div>
                    <form action={linkAction} className="flex flex-col sm:flex-row gap-2 sm:items-center">
                      <select
                        name="processId"
                        required
                        defaultValue={suggestion?.processId ?? ""}
                        className="min-w-0 sm:w-80 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm"
                        aria-label="Processo para vincular"
                      >
                        <option value="" disabled>
                          Escolha o processo…
                        </option>
                        {processOptions.map((p) => (
                          <option key={p.id} value={p.id}>
                            #{p.processNumber}
                            {p.externalReference ? ` · ${p.externalReference}` : ""} · {p.supplierName}
                          </option>
                        ))}
                      </select>
                      <SubmitButton className="px-4 py-2 rounded-lg bg-secondary text-white font-label-md text-label-md hover:opacity-90 transition-all whitespace-nowrap">
                        Vincular
                      </SubmitButton>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
