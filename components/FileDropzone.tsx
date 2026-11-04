"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

const MAX_TOTAL_BYTES = 4 * 1024 * 1024; // mesmo teto das Server Actions (next.config.ts)

function Overlay() {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-surface-container-lowest/80 text-sm font-bold text-primary">
      Enviando…
    </div>
  );
}

// Área de arrastar e soltar (ou clicar para escolher). Assim que os arquivos
// entram, o formulário é enviado.
export default function FileDropzone({
  action,
  accept,
  label = "Arraste os arquivos aqui ou clique para escolher",
}: {
  action: (formData: FormData) => void;
  accept?: string;
  label?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function submitFiles(files: FileList | null) {
    const input = inputRef.current;
    if (!files || files.length === 0 || !input) return;
    const total = Array.from(files).reduce((n, f) => n + f.size, 0);
    if (total > MAX_TOTAL_BYTES) {
      toast.error("Os arquivos passam de 4 MB. Envie menos arquivos por vez ou reduza o tamanho.");
      input.value = "";
      return;
    }
    input.files = files;
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={action} className="relative">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          submitFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
          dragging ? "border-secondary bg-secondary/10" : "border-outline-variant hover:border-secondary hover:bg-surface-container-low"
        }`}
      >
        <span className="material-symbols-outlined text-3xl text-on-surface-variant">upload_file</span>
        <span className="text-body-sm font-body-sm font-medium text-primary">{label}</span>
        <span className="text-xs text-on-surface-variant">PDF, Excel, CSV ou imagem · até 4 MB</span>
        <input
          ref={inputRef}
          type="file"
          name="file"
          multiple
          accept={accept}
          className="sr-only"
          onChange={(e) => submitFiles(e.target.files)}
        />
      </label>
      <Overlay />
    </form>
  );
}
