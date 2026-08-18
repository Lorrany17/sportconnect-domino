"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import TeamRegistration from "@/components/TeamRegistration";
import RefereePanel from "@/components/RefereePanel";
import TournamentBracket from "@/components/TournamentBracket";
import { useTournament } from "@/context/TournamentContext";

export default function AdminPage() {
  const {
    teams,
    matches,
    isAdmin,
    isAuthLoaded,
    handleAddTeam,
    handleImportTeams,
    handleDeleteTeam,
    handleLoadMockTeams,
    handleGenerateBracket,
    handleUpdateScore,
    handleSubtractPoint,
    handleAddRound,
    handleStartMatch,
    handleFinishMatch,
    handleUpdateMatch,
    handleSwapTeams,
    handleReplaceTeam,
    handleDeclareWO,
    isReadOnly,
    currentTournamentId,
    handleFinishTournament,
    handleDeleteTournament,
  } = useTournament();

  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>("teams");

  // Redirect Guard
  useEffect(() => {
    if (isAuthLoaded && !isAdmin) {
      router.push("/login");
    }
  }, [isAdmin, isAuthLoaded, router]);

  if (!isAuthLoaded || !isAdmin) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center text-brand-text-muted text-sm font-semibold uppercase tracking-widest">
        Carregando...
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation (Admin Layout) */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isAdminLayout={true}
      />

      {/* Admin Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col justify-center">
        {!currentTournamentId ? (
          <div className="flex flex-col items-center justify-center min-h-[350px] text-center p-8 glass-panel border border-brand-border/40 rounded-2xl max-w-xl mx-auto w-full">
            <h2 className="text-2xl font-bold text-[#3b342e] dark:text-neutral-300 mb-2 font-display uppercase tracking-wider">
              Nenhum campeonato selecionado
            </h2>
            <p className="text-stone-500 dark:text-brand-text-muted mb-6 text-sm max-w-md">
              Crie um novo torneio clicando em "+ Novo" no menu superior ou selecione um existente no dropdown para começar.
            </p>
          </div>
        ) : (
          <>
            {activeTab === "teams" && (
              <TeamRegistration
                teams={teams}
                matches={matches}
                onAddTeam={handleAddTeam}
                onImportTeams={handleImportTeams}
                onDeleteTeam={handleDeleteTeam}
                onGenerateBracket={() => handleGenerateBracket(() => setActiveTab("referee"))}
                isReadOnly={isReadOnly}
                onFinishTournament={() => currentTournamentId && handleFinishTournament(currentTournamentId)}
                onDeleteTournament={currentTournamentId ? () => handleDeleteTournament(currentTournamentId) : undefined}
              />
            )}

            {activeTab === "referee" && (
              <RefereePanel
                matches={matches}
                onUpdateScore={handleUpdateScore}
                onSubtractPoint={handleSubtractPoint}
                onAddRound={handleAddRound}
                onStartMatch={handleStartMatch}
                onFinishMatch={handleFinishMatch}
                isReadOnly={isReadOnly}
              />
            )}

            {activeTab === "bracket" && (
              <TournamentBracket
                matches={matches}
                teams={teams}
                onUpdateMatch={handleUpdateMatch}
                onSwapTeams={handleSwapTeams}
                onReplaceTeam={handleReplaceTeam}
                onDeclareWO={handleDeclareWO}
                isAdmin={true}
                isReadOnly={isReadOnly}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-brand-border/40 py-6 text-center text-xs text-brand-text-muted">
        <div>Torneio SportConnect • Dominó em Duplas</div>
      </footer>
    </div>
  );
}
