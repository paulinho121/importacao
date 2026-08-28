// Anexa uma mensagem de sucesso à URL de um redirect() já existente, sem
// precisar reescrever a Server Action (ela já redireciona no fluxo
// normal — só completamos o destino). components/layout/FlashToast.tsx lê
// esse parâmetro uma vez, dispara o toast (sonner) e limpa a URL.
export function withFlash(path: string, message: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}flash=${encodeURIComponent(message)}`;
}
