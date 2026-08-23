import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "ImportFlow TMS",
  description: "Sistema de gestão de processos de importação",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full dark`}>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full bg-background text-on-surface antialiased">
        {/* Tema escuro é o padrão; só remove a classe se o usuário já tiver
            escolhido claro explicitamente (evita flash: roda antes do body
            pintar, então nunca aparece um frame no tema errado).
            next/script com beforeInteractive precisa ficar dentro do <body>
            (documentação do Next) — dentro do <head> causava erro de
            hidratação, porque o React tentava reconciliar o script como um
            nó normal da árvore junto com o gerenciamento próprio do <head>. */}
        <Script id="theme-init" strategy="beforeInteractive">
          {"try{if(localStorage.getItem('theme')==='light'){document.documentElement.classList.remove('dark')}}catch(e){}"}
        </Script>
        {children}
      </body>
    </html>
  );
}
