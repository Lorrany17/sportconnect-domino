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
    handleAddRound,
    handleStartMatch,
    handleFinishMatch,
    handleUpdateMatch,
    handleSwapTeams,
    handleReplaceTeam,
    handleDeclareWO,
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "teams" && (
          <TeamRegistration
            teams={teams}
            onAddTeam={handleAddTeam}
            onImportTeams={handleImportTeams}
            onDeleteTeam={handleDeleteTeam}
            onGenerateBracket={() => handleGenerateBracket(() => setActiveTab("referee"))}
          />
        )}

        {activeTab === "referee" && (
          <RefereePanel
            matches={matches}
            onUpdateScore={handleUpdateScore}
            onAddRound={handleAddRound}
            onStartMatch={handleStartMatch}
            onFinishMatch={handleFinishMatch}
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
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-brand-border/40 py-6 text-center text-xs text-brand-text-muted">
        <div>Torneio SportConnect • Dominó em Duplas</div>
      </footer>
    </div>
  );
}
