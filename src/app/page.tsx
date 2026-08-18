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
    isReadOnly,
    tournaments,
    currentTournamentId,
    setCurrentTournamentId,
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col justify-center">
        {!currentTournamentId ? (
          <div className="max-w-4xl w-full mx-auto">
            <h1 className="font-display text-3xl font-black tracking-tight uppercase mb-2">
              Campeonatos <span className="text-gradient-electric">Disponíveis</span>
            </h1>
            <p className="text-brand-text-muted text-sm mb-8">
              Selecione um torneio abaixo para acompanhar a árvore de chaveamento e os placares em tempo real.
            </p>

            {tournaments.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[300px] text-center p-8 glass-panel border border-brand-border/40 rounded-2xl w-full">
                <h2 className="text-xl font-bold text-[#3b342e] dark:text-neutral-300 mb-2 uppercase tracking-wider">
                  Nenhum campeonato disponível
                </h2>
                <p className="text-stone-500 dark:text-brand-text-muted text-sm">
                  Não há nenhum torneio cadastrado no momento. Por favor, volte mais tarde.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {tournaments.map((tour) => {
                  const isActive = tour.status === "ATIVO";
                  return (
                    <div
                      key={tour.id}
                      onClick={() => setCurrentTournamentId(tour.id)}
                      className="glass-panel border border-brand-border/40 rounded-2xl p-6 hover:border-brand-electric/60 hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between group"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${
                            isActive
                              ? "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                              : "bg-stone-100 text-stone-600 border-stone-200 dark:bg-stone-500/10 dark:text-stone-400 dark:border-stone-500/20"
                          }`}>
                            {isActive ? "Em Andamento" : "Finalizado"}
                          </span>
                          <span className="text-[10px] text-stone-500 dark:text-neutral-500 font-medium">
                            {new Date(tour.createdAt).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                        <h2 className="text-xl font-black text-[#3b342e] dark:text-white font-display uppercase tracking-wider group-hover:text-brand-electric transition-colors">
                          {tour.name}
                        </h2>
                      </div>
                      <div className="mt-6 flex items-center gap-1 text-xs font-black uppercase tracking-wider text-brand-electric group-hover:translate-x-1 transition-transform">
                        <span>Acompanhar Torneio</span>
                        <span>→</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="w-full">
            <button
              onClick={() => setCurrentTournamentId(null)}
              className="mb-6 flex items-center gap-1.5 text-stone-500 hover:text-stone-700 dark:text-neutral-400 dark:hover:text-white text-xs font-bold uppercase transition-colors cursor-pointer"
            >
              <span>← Voltar para a lista de campeonatos</span>
            </button>

            <TournamentBracket
              matches={matches}
              teams={teams}
              onUpdateMatch={handleUpdateMatch}
              onSwapTeams={handleSwapTeams}
              onReplaceTeam={handleReplaceTeam}
              onDeclareWO={handleDeclareWO}
              isAdmin={isAdmin}
              isReadOnly={isReadOnly}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-brand-border/40 py-6 text-center text-xs text-brand-text-muted">
        <div>Torneio SportConnect • Dominó em Duplas</div>
      </footer>
    </div>
  );
}
