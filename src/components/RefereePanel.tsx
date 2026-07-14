/* eslint-disable react-hooks/set-state-in-effect */
import React, { useState } from "react";
import { Match, Round } from "@/types";
import { Award, ClipboardCheck, History, Trophy, Clock, CheckCircle, Play, Lock } from "lucide-react";

interface RefereePanelProps {
  matches: Match[];
  onUpdateScore: (matchId: string, teamAScore: number, teamBScore: number) => void;
  onAddRound: (matchId: string, round: Round, limit: number) => void;
  onStartMatch: (matchId: string) => void;
  onFinishMatch: (matchId: string, winnerId: string) => void;
}

export default function RefereePanel({
  matches,
  onAddRound,
  onStartMatch,
  onFinishMatch,
}: RefereePanelProps) {
  const TARGET_SCORE = 4;
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  const [doublePoints, setDoublePoints] = useState<boolean>(false);

  const activeMatches = matches.filter((m) => m.status === "LIVE");
  const pendingMatches = matches.filter((m) => m.status === "SCHEDULED");
  const completedMatches = matches.filter((m) => m.status === "COMPLETED");

  // Auto select first live match if none selected
  React.useEffect(() => {
    if (!selectedMatchId) {
      if (activeMatches.length > 0) {
        setSelectedMatchId(activeMatches[0].id);
      } else if (pendingMatches.length > 0) {
        setSelectedMatchId(pendingMatches[0].id);
      } else if (completedMatches.length > 0) {
        setSelectedMatchId(completedMatches[0].id);
      }
    }
  }, [matches, activeMatches, pendingMatches, completedMatches, selectedMatchId]);

  const selectedMatch = matches.find((m) => m.id === selectedMatchId);

  const isBestOf3 = selectedMatch ? selectedMatch.phase.toLowerCase() === "semifinal" : false;
  const scoreA = selectedMatch ? selectedMatch.scoreA : 0;
  const scoreB = selectedMatch ? selectedMatch.scoreB : 0;
  const setsA = selectedMatch ? selectedMatch.setsA || 0 : 0;
  const setsB = selectedMatch ? selectedMatch.setsB || 0 : 0;

  const isMatchFinished = selectedMatch
    ? isBestOf3
      ? setsA >= 2 || setsB >= 2
      : scoreA >= TARGET_SCORE || scoreB >= TARGET_SCORE
    : false;

  const matchWinnerName = selectedMatch
    ? isBestOf3
      ? setsA >= 2
        ? selectedMatch.teamA.name
        : selectedMatch.teamB.name
      : scoreA >= TARGET_SCORE
      ? selectedMatch.teamA.name
      : selectedMatch.teamB.name
    : "";

  const matchWinnerId = selectedMatch
    ? isBestOf3
      ? setsA >= 2
        ? selectedMatch.teamA.id
        : selectedMatch.teamB.id
      : scoreA >= TARGET_SCORE
      ? selectedMatch.teamA.id
      : selectedMatch.teamB.id
    : "";

  // Monitor scores with useEffect to detect TARGET_SCORE completion
  React.useEffect(() => {
    if (!selectedMatch) return;
    if (scoreA >= TARGET_SCORE || scoreB >= TARGET_SCORE) {
      console.log(`Match score reached target in RefereePanel: ${scoreA} - ${scoreB}`);
    }
  }, [scoreA, scoreB, selectedMatch]);

  const handleAddPoints = (winnerTeamId: string, points: number, note?: string) => {
    if (!selectedMatch || isMatchFinished) return;
    const finalPoints = doublePoints ? points * 2 : points;
    const roundNum = (selectedMatch.detailedScore.rounds?.length || 0) + 1;
    const noteText = doublePoints
      ? note
        ? `${note} (Dobro)`
        : "Jogo Fechado (Dobro)"
      : note;

    const newRound: Round = {
      roundNumber: roundNum,
      winnerTeamId,
      pointsGenerated: finalPoints,
      note: noteText,
    };
    onAddRound(selectedMatch.id, newRound, TARGET_SCORE);
    setDoublePoints(false); // Reset double points toggle
  };

  const handleAnnulRound = () => {
    if (!selectedMatch || isMatchFinished) return;
    const roundNum = (selectedMatch.detailedScore.rounds?.length || 0) + 1;
    const newRound: Round = {
      roundNumber: roundNum,
      winnerTeamId: "", // Nulo representa anulado
      pointsGenerated: 0,
      note: "Anulada (5 Buchas)",
    };
    onAddRound(selectedMatch.id, newRound, TARGET_SCORE);
    setDoublePoints(false); // Reset double points toggle
  };

  const handleCompleteMatch = () => {
    if (!selectedMatch || !isMatchFinished) return;
    onFinishMatch(selectedMatch.id, matchWinnerId);
  };

  const getStatusBadge = (status: Match["status"]) => {
    switch (status) {
      case "LIVE":
        return (
          <span className="flex items-center gap-1 bg-red-50 border border-red-100 text-red-600 text-[10px] font-black tracking-widest uppercase px-2.5 py-1 rounded-full animate-pulse-slow dark:bg-red-900/20 dark:border-red-900/50 dark:text-red-400">
            <span className="h-1.5 w-1.5 rounded-full bg-red-600 dark:bg-brand-neon" />
            AO VIVO
          </span>
        );
      case "SCHEDULED":
        return (
          <span className="flex items-center gap-1 bg-neutral-100 border border-neutral-200 text-neutral-600 text-[10px] font-black tracking-widest uppercase px-2.5 py-1 rounded-full dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-300">
            <Clock className="h-3 w-3" />
            AGENDADA
          </span>
        );
      case "COMPLETED":
        return (
          <span className="flex items-center gap-1 bg-amber-50 border border-amber-100 text-amber-700 text-[10px] font-black tracking-widest uppercase px-2.5 py-1 rounded-full dark:bg-brand-electric/10 dark:border-brand-electric/20 dark:text-brand-electric-light">
            <Trophy className="h-3 w-3" />
            FINALIZADA
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-brand-border/40 pb-6">
        <div>
          <h1 className="font-display text-3xl font-black tracking-tight uppercase">
            Arbitragem de <span className="text-gradient-electric">Partidas</span>
          </h1>
          <p className="text-stone-500 dark:text-brand-text-muted text-sm mt-1">
            Painel do Mesário para controle de pontuação rápida, sets e anulações em tempo real.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Column: Matches Selection List */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel rounded-2xl p-5 border border-brand-border/60">
            <h3 className="text-xs font-black uppercase tracking-widest text-stone-500 dark:text-brand-text-muted mb-4">
              Confrontos do Torneio
            </h3>

            {matches.length === 0 ? (
              <div className="text-center py-8 text-neutral-600 text-xs italic">
                Nenhum confronto gerado.
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {/* Active Matches Section */}
                {activeMatches.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[9px] font-bold text-brand-neon uppercase tracking-wider pl-1">
                      Em Andamento
                    </div>
                    {activeMatches.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          setSelectedMatchId(m.id);
                          setDoublePoints(false);
                        }}
                        className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                          selectedMatchId === m.id
                            ? "bg-blue-600 border-blue-600 text-white dark:bg-blue-600 dark:border-blue-500 dark:text-white"
                            : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 dark:bg-neutral-900/50 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-900/90"
                        }`}
                      >
                        <div className={`flex justify-between items-center text-[9px] font-bold mb-1 ${
                          selectedMatchId === m.id ? "text-blue-100 dark:text-blue-100" : "text-emerald-600 dark:text-brand-text-muted"
                        }`}>
                          <span>MESA {m.tableNumber} • {m.phase}</span>
                          <span className={`font-black ${
                            selectedMatchId === m.id ? "text-white" : "text-emerald-700 dark:text-brand-neon"
                          }`}>
                            {m.scoreA}x{m.scoreB}
                            {isBestOf3 && ` (${m.setsA || 0}x${m.setsB || 0} S)`}
                          </span>
                        </div>
                        <div className={`text-xs font-bold truncate ${
                          selectedMatchId === m.id ? "text-white" : "text-emerald-950 dark:text-neutral-400"
                        }`}>
                          {m.teamA.name} vs {m.teamB.name}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Pending Matches Section */}
                {pendingMatches.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <div className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider pl-1">
                      Agendadas
                    </div>
                    {pendingMatches.map((m) => {
                      const isMatchReady = !m.teamA.id.startsWith("placeholder-") && !m.teamB.id.startsWith("placeholder-");
                      return (
                        <button
                          key={m.id}
                          onClick={() => {
                            setSelectedMatchId(m.id);
                            setDoublePoints(false);
                          }}
                          className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                            selectedMatchId === m.id
                              ? "bg-blue-600 border-blue-600 text-white dark:bg-blue-600 dark:border-blue-500 dark:text-white"
                              : isMatchReady
                              ? "bg-[#e6ddca] border-[#d8ccb4] text-stone-700 hover:bg-[#d8ccb4]/40 dark:bg-neutral-900/50 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700/50"
                              : "bg-[#e6ddca]/50 border-dashed border-[#d8ccb4]/60 text-neutral-400 cursor-not-allowed dark:bg-neutral-950/20 dark:border-brand-border/40 dark:border-dashed dark:text-neutral-600"
                          }`}
                        >
                          <div className={`flex justify-between items-center text-[9px] font-bold mb-1 ${
                            selectedMatchId === m.id ? "text-blue-100 dark:text-blue-100" : "text-neutral-500 dark:text-neutral-500"
                          }`}>
                            <span>MESA {m.tableNumber}</span>
                            <span>AGENDADA</span>
                          </div>
                          <div className={`text-xs font-semibold truncate flex items-center gap-1.5 ${
                            selectedMatchId === m.id
                              ? "text-white font-bold"
                              : isMatchReady
                              ? "text-[#3b342e] dark:text-neutral-400 font-bold"
                              : "text-neutral-400 dark:text-neutral-500"
                          }`}>
                            {!isMatchReady && <Lock className="h-3 w-3 shrink-0" />}
                            <span>{m.teamA.name}</span>
                          </div>
                          <div className={`text-xs font-semibold truncate flex items-center gap-1.5 ${
                            selectedMatchId === m.id
                              ? "text-white font-bold"
                              : isMatchReady
                              ? "text-neutral-900 dark:text-neutral-400 font-bold"
                              : "text-neutral-400 dark:text-neutral-500"
                          }`}>
                            {!isMatchReady && <Lock className="h-3 w-3 shrink-0" />}
                            <span>{m.teamB.name}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Completed Matches Section */}
                {completedMatches.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <div className="text-[9px] font-bold text-brand-electric-light uppercase tracking-wider pl-1">
                      Finalizadas
                    </div>
                    {completedMatches.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          setSelectedMatchId(m.id);
                          setDoublePoints(false);
                        }}
                        className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                          selectedMatchId === m.id
                            ? "bg-blue-600 border-blue-600 text-white dark:bg-blue-600 dark:border-blue-500 dark:text-white"
                            : "bg-[#e6ddca] border-[#d8ccb4] text-stone-700 hover:bg-[#d8ccb4]/40 dark:bg-neutral-900/50 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700/50"
                        }`}
                      >
                        <div className={`flex justify-between items-center text-[9px] font-bold mb-1 ${
                          selectedMatchId === m.id ? "text-blue-100 dark:text-blue-100" : "text-neutral-500"
                        }`}>
                          <span>MESA {m.tableNumber}</span>
                          <span className={`font-bold ${
                            selectedMatchId === m.id ? "text-white" : "text-brand-electric-light"
                          }`}>FIM</span>
                        </div>
                        <div className={`text-xs font-semibold truncate ${
                          selectedMatchId === m.id ? "text-white" : "text-[#3b342e] dark:text-neutral-400"
                        }`}>{m.teamA.name}</div>
                        <div className={`text-xs font-semibold truncate ${
                          selectedMatchId === m.id ? "text-white" : "text-[#3b342e] dark:text-neutral-400"
                        }`}>{m.teamB.name}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Digital Score Sheet Interface */}
        <div className="lg:col-span-3 space-y-6">
          {!selectedMatch ? (
            <div className="glass-panel rounded-2xl p-16 border border-brand-border/60 text-center">
              <ClipboardCheck className="h-14 w-14 text-neutral-800 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-stone-800 dark:text-white">Nenhum confronto selecionado</h3>
              <p className="text-stone-500 dark:text-brand-text-muted text-sm mt-1 max-w-sm mx-auto">
                Gere o chaveamento das duplas e selecione um confronto ao lado para iniciar a arbitragem da partida.
              </p>
            </div>
          ) : (
            <>
              {/* Match Header Info */}
              <div className="glass-panel rounded-2xl p-6 border border-brand-border/60 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <div className="text-[10px] font-bold text-brand-electric-light tracking-widest uppercase mb-1">
                    {selectedMatch.phase} • MESA {selectedMatch.tableNumber}
                  </div>
                  <h2 className="text-2xl font-black uppercase text-stone-800 dark:text-white tracking-wide">
                    SÚMULA DIGITAL
                  </h2>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2 border border-blue-100 bg-blue-50 px-3 py-1.5 rounded-xl text-xs font-bold text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/50">
                    <span>🎯 Regra: Vence quem atingir 4 pontos (Quadra)</span>
                  </div>
                  {getStatusBadge(selectedMatch.status)}
                </div>
              </div>

              {/* Victory Banner */}
              {selectedMatch.status === "LIVE" && isMatchFinished && (
                <div className="bg-amber-600 border border-amber-500 text-neutral-950 font-display font-black text-center py-4 rounded-2xl shadow-xl shadow-amber-600/20 animate-pulse uppercase tracking-wider text-sm">
                  🏆 VITÓRIA DA DUPLA: {matchWinnerName} 🏆
                </div>
              )}

              {selectedMatch.status === "SCHEDULED" ? (
                (() => {
                  const isMatchReady = !selectedMatch.teamA.id.startsWith("placeholder-") && !selectedMatch.teamB.id.startsWith("placeholder-");
                  return (
                    <div className="glass-panel rounded-2xl p-12 border border-brand-border/60 text-center flex flex-col items-center justify-center min-h-[300px]">
                      {isMatchReady ? (
                        <Clock className="h-12 w-12 text-brand-electric-light mb-4 animate-pulse-slow" />
                      ) : (
                        <Lock className="h-12 w-12 text-neutral-600 mb-4" />
                      )}
                      <h3 className="text-xl font-black text-[#3b342e] dark:text-white uppercase tracking-wider">
                        {isMatchReady ? "Confronto Agendado" : "Confronto Bloqueado"}
                      </h3>
                      <p className="text-stone-500 dark:text-brand-text-muted text-sm mt-2 max-w-sm mx-auto">
                        {isMatchReady
                          ? `Este confronto entre ${selectedMatch.teamA.name} e ${selectedMatch.teamB.name} está pronto para começar na Mesa ${selectedMatch.tableNumber}.`
                          : `Este confronto está aguardando a definição dos adversários das fases anteriores para começar na Mesa ${selectedMatch.tableNumber}.`
                        }
                      </p>
                      {isMatchReady ? (
                        <button
                          onClick={() => onStartMatch(selectedMatch.id)}
                          className="mt-6 flex items-center gap-2.5 bg-brand-electric hover:bg-brand-electric-hover text-white px-8 py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all transform hover:scale-[1.03] active:scale-95 shadow-lg shadow-brand-electric/15 cursor-pointer"
                        >
                          <Play className="h-4 w-4 fill-white" />
                          Iniciar Partida
                        </button>
                      ) : (
                        <button
                          disabled={true}
                          className="mt-6 flex items-center gap-2.5 bg-neutral-200 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-400 dark:text-neutral-500 px-8 py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all opacity-50 cursor-not-allowed"
                        >
                          <Lock className="h-4 w-4" />
                          Aguardando Definição de Adversários
                        </button>
                      )}
                    </div>
                  );
                })()
              ) : (
                <>
                  {/* Large Digital Scoreboard */}
                  <div className="grid grid-cols-1 md:grid-cols-7 gap-4 items-stretch">
                    {/* Team A Card */}
                    <div className="md:col-span-3 glass-panel rounded-2xl p-6 border border-brand-border/60 text-center flex flex-col justify-between min-h-[260px]">
                      <div>
                        <span className="text-[10px] font-black text-brand-electric-light tracking-widest uppercase block mb-1">
                          DUPLA A (CASA)
                        </span>
                        <h3 className="text-xl font-black text-[#3b342e] dark:text-white truncate">{selectedMatch.teamA.name}</h3>
                        <p className="text-[11px] text-stone-500 dark:text-brand-text-muted mt-1">
                          {selectedMatch.teamA.players[0]} & {selectedMatch.teamA.players[1]}
                        </p>
                      </div>

                      <div className="my-4 flex flex-col items-center justify-center">
                        <span className="font-display font-black text-6xl text-[#3b342e] dark:text-white select-none leading-none">
                          {scoreA}
                        </span>

                        {/* Set dots for Team A if Best of 3 */}
                        {isBestOf3 && (
                          <div className="mt-3 space-y-1.5">
                            <div className="text-[10px] font-bold text-stone-500 dark:text-brand-text-muted uppercase tracking-wider">
                               Quadras Vencidas: <span className="text-[#3b342e] dark:text-white font-black">{setsA}</span>
                            </div>
                            <div className="flex justify-center gap-1.5">
                              <span
                                className={`h-2.5 w-2.5 rounded-full border transition-all ${
                                  setsA >= 1
                                    ? "bg-brand-neon border-brand-neon shadow-sm shadow-brand-neon/45 animate-pulse"
                                    : "bg-neutral-200 dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700"
                                }`}
                                title="Set 1"
                              />
                              <span
                                className={`h-2.5 w-2.5 rounded-full border transition-all ${
                                  setsA >= 2
                                    ? "bg-brand-neon border-brand-neon shadow-sm shadow-brand-neon/45 animate-pulse"
                                    : "bg-neutral-200 dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700"
                                }`}
                                title="Set 2"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Team A Keypad */}
                      {selectedMatch.status === "LIVE" && (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleAddPoints(selectedMatch.teamA.id, 1)}
                            disabled={isMatchFinished}
                            className="py-2 px-1 text-[10px] font-black uppercase tracking-wider rounded-xl border border-[#d8ccb4] dark:border-brand-border bg-[#f2ece0] dark:bg-neutral-950 text-stone-600 dark:text-neutral-300 hover:text-[#3b342e] dark:hover:text-white hover:border-brand-electric hover:bg-brand-electric/10 transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                          >
                            +1 Ponto
                          </button>
                          <button
                            onClick={() => handleAddPoints(selectedMatch.teamA.id, 2, "Lá e Lô")}
                            disabled={isMatchFinished}
                            className="py-2 px-1 text-[10px] font-black uppercase tracking-wider rounded-xl border border-[#d8ccb4] dark:border-brand-border bg-[#f2ece0] dark:bg-neutral-950 text-brand-electric-light hover:text-brand-electric dark:hover:text-white hover:border-brand-electric hover:bg-brand-electric/10 transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                            title="Batida nas duas pontas (lá e lô)"
                          >
                            +2 Pontos
                          </button>
                        </div>
                      )}
                    </div>

                    {/* VS & Central Controls */}
                    <div className="md:col-span-1 flex flex-col items-center justify-center p-4 border border-brand-border/20 rounded-2xl bg-neutral-100/50 dark:bg-neutral-900/10 min-h-[120px]">
                      <span className="font-display font-black text-neutral-700 text-2xl select-none block mb-4">
                        VS
                      </span>

                      {selectedMatch.status === "LIVE" && !isMatchFinished && (
                        <div className="flex flex-col gap-2 w-full max-w-[120px]">
                          <button
                            type="button"
                            onClick={() => setDoublePoints(!doublePoints)}
                            className={`py-2 px-1.5 rounded-lg border font-black text-[9px] uppercase tracking-wider text-center transition-all cursor-pointer ${
                              doublePoints
                                ? "bg-brand-neon/15 border-brand-neon text-brand-neon animate-pulse"
                                : "bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-brand-border text-neutral-600 dark:text-brand-text-muted hover:border-neutral-300 dark:hover:border-neutral-700"
                            }`}
                          >
                            Dobro: {doublePoints ? "SIM" : "NÃO"}
                          </button>

                          {/* Annul Round Button */}
                          <button
                            type="button"
                            onClick={handleAnnulRound}
                            className="py-2 px-1.5 rounded-lg border border-neutral-200 dark:border-brand-border hover:border-red-500/50 bg-neutral-100 dark:bg-neutral-950 text-red-500 hover:text-red-400 hover:bg-red-500/5 text-[9px] font-black uppercase tracking-wider text-center transition-all cursor-pointer active:scale-95"
                          >
                            Anular
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Team B Card */}
                    <div className="md:col-span-3 glass-panel rounded-2xl p-6 border border-brand-border/60 text-center flex flex-col justify-between min-h-[260px]">
                      <div>
                        <span className="text-[10px] font-black text-brand-neon tracking-widest uppercase block mb-1">
                          DUPLA B (VISITANTE)
                        </span>
                        <h3 className="text-xl font-black text-[#3b342e] dark:text-white truncate">{selectedMatch.teamB.name}</h3>
                        <p className="text-[11px] text-stone-500 dark:text-brand-text-muted mt-1">
                          {selectedMatch.teamB.players[0]} & {selectedMatch.teamB.players[1]}
                        </p>
                      </div>

                      <div className="my-4 flex flex-col items-center justify-center">
                        <span className="font-display font-black text-6xl text-[#3b342e] dark:text-white select-none leading-none">
                          {scoreB}
                        </span>

                        {/* Set dots for Team B if Best of 3 */}
                        {isBestOf3 && (
                          <div className="mt-3 space-y-1.5">
                            <div className="text-[10px] font-bold text-stone-500 dark:text-brand-text-muted uppercase tracking-wider">
                               Quadras Vencidas: <span className="text-[#3b342e] dark:text-white font-black">{setsB}</span>
                            </div>
                            <div className="flex justify-center gap-1.5">
                              <span
                                className={`h-2.5 w-2.5 rounded-full border transition-all ${
                                  setsB >= 1
                                    ? "bg-brand-neon border-brand-neon shadow-sm shadow-brand-neon/45 animate-pulse"
                                    : "bg-neutral-900 border-neutral-700"
                                }`}
                                title="Set 1"
                              />
                              <span
                                className={`h-2.5 w-2.5 rounded-full border transition-all ${
                                  setsB >= 2
                                    ? "bg-brand-neon border-brand-neon shadow-sm shadow-brand-neon/45 animate-pulse"
                                    : "bg-neutral-900 border-neutral-700"
                                }`}
                                title="Set 2"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Team B Keypad */}
                      {selectedMatch.status === "LIVE" && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <button
                            onClick={() => handleAddPoints(selectedMatch.teamB.id, 1)}
                            disabled={isMatchFinished}
                            className="py-2 px-1 text-[10px] font-black uppercase tracking-wider rounded-xl border border-[#d8ccb4] dark:border-brand-border bg-[#f2ece0] dark:bg-neutral-950 text-stone-600 dark:text-neutral-300 hover:text-[#3b342e] dark:hover:text-white hover:border-brand-neon-orange hover:bg-brand-neon-orange/10 transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                          >
                            +1 Ponto
                          </button>
                          <button
                            onClick={() => handleAddPoints(selectedMatch.teamB.id, 2, "Lá e Lô")}
                            disabled={isMatchFinished}
                            className="py-2 px-1 text-[10px] font-black uppercase tracking-wider rounded-xl border border-[#d8ccb4] dark:border-brand-border bg-[#f2ece0] dark:bg-neutral-950 text-brand-neon hover:text-white hover:border-brand-neon hover:bg-brand-neon/10 transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                            title="Batida nas duas pontas (lá e lô)"
                          >
                            +2 Pontos
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Scoring Controls and Submission */}
                  {selectedMatch.status === "LIVE" && (
                    <div className="w-full">
                      {/* Validate & End Match Panel */}
                      <div className="glass-panel rounded-2xl p-5 border border-brand-border/60">
                        <h3 className="text-sm font-black uppercase tracking-wider text-stone-800 dark:text-brand-text mb-2 flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-brand-electric-light" />
                          <span>Encerramento de Partida</span>
                        </h3>
                        <p className="text-xs text-stone-500 dark:text-brand-text-muted leading-relaxed">
                          {isMatchFinished
                            ? "Partida concluída de acordo com as regras do regulamento. Envie o resultado final para oficializar na chave do torneio."
                            : "A partida está em andamento. O envio de resultados será habilitado assim que uma dupla atingir as condições de vitória."}
                        </p>

                        {isMatchFinished ? (
                          <div className="mt-4 p-3.5 rounded-xl bg-amber-600/10 border border-amber-500/20 flex items-center gap-3">
                            <Trophy className="h-5 w-5 text-amber-600 dark:text-brand-neon shrink-0 animate-bounce" />
                            <div>
                              <span className="text-[10px] text-amber-800 dark:text-brand-text-muted font-bold block uppercase">
                                VENCEDOR DA PARTIDA:
                              </span>
                              <span className="text-xs font-black text-stone-900 dark:text-white">
                                {matchWinnerName}
                                {isBestOf3 && ` (${setsA} - ${setsB} em Sets)`}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 p-3.5 rounded-xl bg-stone-100 border border-stone-200 dark:bg-neutral-950/60 dark:border-brand-border flex items-center gap-3">
                            <Trophy className="h-5 w-5 text-stone-400 dark:text-neutral-700 shrink-0" />
                            <div>
                              <span className="text-[10px] text-stone-500 dark:text-brand-text-muted font-bold block uppercase">
                                PARCIAL ATUAL:
                              </span>
                              <span className="text-xs font-black text-stone-700 dark:text-neutral-400">
                                {scoreA}x{scoreB}
                                {isBestOf3 ? ` (Sets: ${setsA}x${setsB})` : " (Set Único)"}
                              </span>
                            </div>
                          </div>
                        )}

                        <button
                          onClick={handleCompleteMatch}
                          disabled={!isMatchFinished}
                          className="w-full mt-4 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white dark:bg-brand-neon dark:hover:bg-brand-neon-hover dark:text-neutral-950 disabled:bg-stone-200 disabled:text-stone-400 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-600 disabled:border-transparent font-black text-xs uppercase tracking-widest transition-all shadow-md shadow-blue-600/15 dark:shadow-brand-neon/15 cursor-pointer disabled:cursor-not-allowed"
                        >
                          Encerrar Partida e Enviar Resultado
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Rounds History */}
              <div className="glass-panel rounded-2xl p-5 border border-brand-border/60">
                <h3 className="text-sm font-black uppercase tracking-wider text-stone-800 dark:text-brand-text mb-4 flex items-center gap-2">
                  <History className="h-4 w-4 text-stone-500 dark:text-brand-text-muted" />
                  <span>Histórico de Batidas / Súmula Detalhada</span>
                </h3>

                {!selectedMatch.detailedScore.rounds || selectedMatch.detailedScore.rounds.length === 0 ? (
                  <p className="text-xs text-neutral-600 italic py-4 pl-1">
                    Nenhuma rodada pontuada registrada detalhadamente nesta partida.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {selectedMatch.detailedScore.rounds.map((round) => {
                      const isTeamAWinner = round.winnerTeamId === selectedMatch.teamA.id;
                      const isAnnulled = round.winnerTeamId === "";
                      const winningTeamName = isAnnulled
                        ? "Rodada Anulada"
                        : isTeamAWinner
                        ? selectedMatch.teamA.name
                        : selectedMatch.teamB.name;

                      return (
                        <div
                          key={round.roundNumber}
                          className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-neutral-950/60 border border-[#d8ccb4] dark:border-brand-border shadow-sm text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <span className="h-5 w-5 rounded bg-stone-100 dark:bg-neutral-900 border border-[#d8ccb4] dark:border-brand-border text-stone-500 dark:text-brand-text-muted font-bold text-[10px] flex items-center justify-center">
                              R{round.roundNumber}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`font-bold ${
                                  isAnnulled
                                    ? "text-red-600 dark:text-red-400"
                                    : "text-stone-800 dark:text-white"
                                }`}
                              >
                                {winningTeamName}
                              </span>
                              {round.note && (
                                <span className="text-[10px] text-amber-800 bg-amber-100 border border-amber-300 dark:text-brand-neon dark:bg-brand-neon/5 dark:border-brand-neon/20 px-2 py-0.5 rounded font-medium">
                                  {round.note}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-stone-500 dark:text-brand-text-muted">Pontuação da rodada:</span>
                            <span
                              className={`font-black ${
                                isAnnulled ? "text-stone-400 dark:text-neutral-500" : "text-stone-800 dark:text-brand-electric-light"
                              }`}
                            >
                              +{round.pointsGenerated} pts
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Winner Showcase for Completed Match */}
              {selectedMatch.status === "COMPLETED" && (
                <div className="glass-panel rounded-2xl p-6 border border-brand-electric/30 bg-gradient-to-r from-brand-electric/5 to-transparent flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-brand-electric/10 border border-brand-electric/30 flex items-center justify-center text-brand-electric-light">
                      <Award className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-[10px] text-brand-electric-light font-bold uppercase tracking-widest">
                        CONFRONTO CONCLUÍDO
                      </div>
                      <h4 className="font-display font-black text-lg text-stone-900 dark:text-white">
                        Vencedor:{" "}
                        {selectedMatch.winnerId === selectedMatch.teamA.id
                          ? selectedMatch.teamA.name
                          : selectedMatch.teamB.name}
                      </h4>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-stone-500 dark:text-brand-text-muted block font-semibold">PLACAR FINAL</span>
                    <span className="font-display font-black text-2xl text-stone-900 dark:text-white">
                      {selectedMatch.scoreA} - {selectedMatch.scoreB}
                      {selectedMatch.setsA !== undefined && selectedMatch.setsB !== undefined
                        ? ` (Sets: ${selectedMatch.setsA}x${selectedMatch.setsB})`
                        : ""}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
