import type { Metadata, Viewport } from "next";
import { Carlito } from "next/font/google";
import AppFrame from "@/components/layout/AppFrame";
import "./globals.css";

// Calibri é fonte da Microsoft (não vem em Mac/Linux/Android). Carlito é o
// clone métrico dela: quem não tem Calibri instalada recebe a Carlito, com
// as mesmas medidas — ver --font-app em globals.css.
const carlito = Carlito({
  variable: "--font-carlito",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "ImportFlow TMS",
  description: "Sistema de gestão de processos de importação",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ImportFlow",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${carlito.variable} h-full dark`}>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full bg-background text-on-surface antialiased">
        <AppFrame>{children}</AppFrame>
      </body>
    </html>
  );
}
