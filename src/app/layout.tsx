import type { Metadata } from "next";
import { Montserrat, Outfit } from "next/font/google";
import { TournamentProvider } from "@/context/TournamentContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

const outfit = Outfit({
  variable: "--font-sport",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700", "900"],
});

export const metadata: Metadata = {
  title: "SportConnect | Tournament Engine (Dominó em Duplas)",
  description: "Motor operacional para torneios de Dominó em Duplas do ecossistema SportConnect. Gerenciamento de partidas, súmula digital e chaveamento em tempo real.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${montserrat.variable} ${outfit.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <TournamentProvider>
            {children}
          </TournamentProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
