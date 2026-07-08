"use client";

import React from "react";
import Navbar from "@/components/Navbar";
import TournamentBracket from "@/components/TournamentBracket";
import { useTournament } from "@/context/TournamentContext";

export default function Home() {
  const {
    matches,
    teams,
    isAdmin,
    isAuthLoaded,
    handleUpdateMatch,
    handleSwapTeams,
    handleReplaceTeam,
    handleDeclareWO,
  } = useTournament();

  if (!isAuthLoaded) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center text-brand-text-muted text-sm font-semibold uppercase tracking-widest">
        Carregando...
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation (Public Layout) */}
      <Navbar isAdminLayout={false} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <TournamentBracket
          matches={matches}
          teams={teams}
          onUpdateMatch={handleUpdateMatch}
          onSwapTeams={handleSwapTeams}
          onReplaceTeam={handleReplaceTeam}
          onDeclareWO={handleDeclareWO}
          isAdmin={isAdmin}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-brand-border/40 py-6 text-center text-xs text-brand-text-muted">
        <div>Torneio SportConnect • Dominó em Duplas</div>
      </footer>
    </div>
  );
}
