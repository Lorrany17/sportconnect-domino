/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState } from "react";
import { Match, Round, SportType } from "@/types";
import {
  Award,
  ClipboardCheck,
  History,
  Trophy,
  Clock,
  CheckCircle,
  Play,
  Lock,
  RotateCcw,
  Shield,
  Activity,
  Layers,
} from "lucide-react";
import { useTournament } from "@/context/TournamentContext";

interface RefereePanelProps {
  matches: Match[];
  onUpdateScore: (
    matchId: string,
    teamAScore: number,
    teamBScore: number,
    extra?: { penaltiesA?: number; penaltiesB?: number }
  ) => void;
  onSubtractPoint: (matchId: string, teamId: string) => void;
  onAddRound: (matchId: string, round: Round, limit: number) => void;
  onStartMatch: (matchId: string) => void;
  onFinishMatch: (matchId: string, winnerId: string) => void;
  isReadOnly?: boolean;
  sportType?: SportType;
}

const SPORT_META: Record<
  SportType,
  { name: string; icon: string; venue: string; unit: string; rule: string }
> = {
  DOMINO: {
    name: "Dominó",
    icon: "🁓",
    venue: "Mesa",
    unit: "Pontos",
    rule: "🎯 Regra: Vence quem atingir 4 pontos (Quadra)",
  },
  FUTSAL: {
    name: "Futsal",
    icon: "⚽",
    venue: "Quadra",
    unit: "Gols",
    rule: "⚽ Regra: Contagem de Gols no tempo regulamentar • Pênaltis em caso de empate",
  },
  PING_PONG: {
    name: "Ping Pong",
    icon: "🏓",
    venue: "Mesa",
    unit: "Pontos",
    rule: "🏓 Regra: Set corrido até 11 pontos (dif. mín. de 2) • Vence quem somar 2 sets (Final até 3)",
  },
  VOLEI: {
    name: "Vôlei",
    icon: "🏐",
    venue: "Quadra",
    unit: "Pontos",
    rule: "🏐 Regra: Sets até 25 pontos (dif. de 2) • 5º set (Tie-break) até 15 pontos",
  },
};

export default function RefereePanel({
  matches,
  onUpdateScore,
  onSubtractPoint,
  onAddRound,
  onStartMatch,
  onFinishMatch,
  isReadOnly = false,
  sportType,
}: RefereePanelProps) {
  const TARGET_SCORE = 4;
  const context = useTournament();
  const currentSportType: SportType = sportType || context?.currentSportType || "DOMINO";
  const handleScorePoint = context?.handleScorePoint;

  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  const [doublePoints, setDoublePoints] = useState<boolean>(false);

  const meta = SPORT_META[currentSportType] || SPORT_META.DOMINO;

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
  const setsA = selectedMatch ? selectedMatch.setsVencidosTimeA ?? selectedMatch.setsA ?? 0 : 0;
  const setsB = selectedMatch ? selectedMatch.setsVencidosTimeB ?? selectedMatch.setsB ?? 0 : 0;
  const penA = selectedMatch ? selectedMatch.penaltiesA ?? 0 : 0;
  const penB = selectedMatch ? selectedMatch.penaltiesB ?? 0 : 0;

  const currentSetNumber = selectedMatch
    ? (selectedMatch.historicoSets?.length || 0) + 1
    : 1;

  const isTieBreak = currentSportType === "VOLEI" && (setsA + setsB === 4);

  // Determinação de vitória baseada no desporto ativo
  let isMatchFinished = false;
  let matchWinnerName = "";
  let matchWinnerId = "";

  if (selectedMatch) {
    switch (currentSportType) {
      case "FUTSAL": {
        const hasGoalDiff = scoreA !== scoreB;
        const hasPenDiff = (penA > 0 || penB > 0) && penA !== penB;
        isMatchFinished = hasGoalDiff || hasPenDiff;

        if (hasGoalDiff) {
          matchWinnerId = scoreA > scoreB ? selectedMatch.teamA.id : selectedMatch.teamB.id;
          matchWinnerName = scoreA > scoreB ? selectedMatch.teamA.name : selectedMatch.teamB.name;
        } else if (hasPenDiff) {
          matchWinnerId = penA > penB ? selectedMatch.teamA.id : selectedMatch.teamB.id;
          matchWinnerName = penA > penB ? selectedMatch.teamA.name : selectedMatch.teamB.name;
        }
        break;
      }

      case "PING_PONG": {
        const requiredSets = 2;
        isMatchFinished = setsA >= requiredSets || setsB >= requiredSets;
        if (isMatchFinished) {
          matchWinnerId = setsA > setsB ? selectedMatch.teamA.id : selectedMatch.teamB.id;
          matchWinnerName = setsA > setsB ? selectedMatch.teamA.name : selectedMatch.teamB.name;
        }
        break;
      }

      case "VOLEI": {
        const requiredSets = 2;
        isMatchFinished = setsA >= requiredSets || setsB >= requiredSets;
        if (isMatchFinished) {
          matchWinnerId = setsA > setsB ? selectedMatch.teamA.id : selectedMatch.teamB.id;
          matchWinnerName = setsA > setsB ? selectedMatch.teamA.name : selectedMatch.teamB.name;
        }
        break;
      }

      case "DOMINO":
      default: {
        isMatchFinished = isBestOf3
          ? setsA >= 2 || setsB >= 2
          : scoreA >= TARGET_SCORE || scoreB >= TARGET_SCORE;

        if (isMatchFinished) {
          matchWinnerId = isBestOf3
            ? setsA >= 2
              ? selectedMatch.teamA.id
              : selectedMatch.teamB.id
            : scoreA >= TARGET_SCORE
            ? selectedMatch.teamA.id
            : selectedMatch.teamB.id;
          matchWinnerName = isBestOf3
            ? setsA >= 2
              ? selectedMatch.teamA.name
              : selectedMatch.teamB.name
            : scoreA >= TARGET_SCORE
            ? selectedMatch.teamA.name
            : selectedMatch.teamB.name;
        }
        break;
      }
    }
  }

  // Multi-sport Point Handler (Gols, Pênaltis, Sets, Pontos corridos)
  const handlePointClick = (slot: "A" | "B", delta: number, isPenalty: boolean = false) => {
    if (!selectedMatch || isMatchFinished) return;

    if (handleScorePoint) {
      handleScorePoint(selectedMatch.id, slot, delta, isPenalty);
      return;
    }

    if (currentSportType === "FUTSAL") {
      if (isPenalty) {
        const nextPenA = slot === "A" ? Math.max(0, (selectedMatch.penaltiesA || 0) + delta) : selectedMatch.penaltiesA || 0;
        const nextPenB = slot === "B" ? Math.max(0, (selectedMatch.penaltiesB || 0) + delta) : selectedMatch.penaltiesB || 0;
        onUpdateScore(selectedMatch.id, selectedMatch.scoreA, selectedMatch.scoreB, {
          penaltiesA: nextPenA,
          penaltiesB: nextPenB,
        });
      } else {
        const nextScoreA = slot === "A" ? Math.max(0, selectedMatch.scoreA + delta) : selectedMatch.scoreA;
        const nextScoreB = slot === "B" ? Math.max(0, selectedMatch.scoreB + delta) : selectedMatch.scoreB;
        onUpdateScore(selectedMatch.id, nextScoreA, nextScoreB);
      }
    } else if (currentSportType === "PING_PONG" || currentSportType === "VOLEI") {
      const nextScoreA = slot === "A" ? Math.max(0, selectedMatch.scoreA + delta) : selectedMatch.scoreA;
      const nextScoreB = slot === "B" ? Math.max(0, selectedMatch.scoreB + delta) : selectedMatch.scoreB;
      onUpdateScore(selectedMatch.id, nextScoreA, nextScoreB);
    } else {
      // Domino
      const teamId = slot === "A" ? selectedMatch.teamA.id : selectedMatch.teamB.id;
      if (delta < 0) {
        onSubtractPoint(selectedMatch.id, teamId);
      } else {
        handleAddPoints(teamId, delta);
      }
    }
  };

  // Domino specific round handler
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
    setDoublePoints(false);
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
    setDoublePoints(false);
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
          <span className="flex items-center gap-1 bg-neutral-100 border border-neutral-200 text-neutral-600 text-[10px] font-black tracking-widest uppercase px-2.5 py-1 rounded-full dark:bg-[#1e1e1e] dark:border-neutral-800 dark:text-[#e4e4e7]">
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
    <div className="space-y-8 animate-fadeIn text-[#3b342e] dark:text-[#e4e4e7]">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#d8ccb4] dark:border-neutral-800 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xl">{meta.icon}</span>
            <span className="px-2.5 py-0.5 rounded-full bg-brand-electric/10 border border-brand-electric/20 text-brand-electric dark:text-blue-400 text-[10px] font-black uppercase tracking-wider">
              Modalidade: {meta.name}
            </span>
          </div>
          <h1 className="font-display text-3xl font-black tracking-tight uppercase text-stone-900 dark:text-[#e4e4e7]">
            Arbitragem de <span className="text-brand-electric dark:text-blue-500">Partidas</span>
          </h1>
          <p className="text-stone-500 dark:text-neutral-400 text-sm mt-1">
            Painel Oficial do Árbitro / Mesário para controle de pontuação, sets e súmula digital multiesportes.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Column: Matches Selection List */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel rounded-2xl p-5 border border-[#d8ccb4] dark:border-[#1e1e1e] bg-[#e6ddca] dark:bg-[#1e1e1e]">
            <h3 className="text-xs font-black uppercase tracking-widest text-stone-600 dark:text-neutral-400 mb-4">
              Confrontos do Torneio
            </h3>

            {matches.length === 0 ? (
              <div className="text-center py-8 text-neutral-500 text-xs italic">
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
                    {activeMatches.map((m) => {
                      const curSetsA = m.setsVencidosTimeA ?? m.setsA ?? 0;
                      const curSetsB = m.setsVencidosTimeB ?? m.setsB ?? 0;
                      return (
                        <button
                          key={m.id}
                          onClick={() => {
                            setSelectedMatchId(m.id);
                            setDoublePoints(false);
                          }}
                          className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                            selectedMatchId === m.id
                              ? "bg-brand-electric border-brand-electric text-white shadow-md shadow-brand-electric/25"
                              : "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100 dark:bg-[#0f0f0f] dark:border-neutral-800 dark:text-[#e4e4e7] dark:hover:bg-[#262626]"
                          }`}
                        >
                          <div
                            className={`flex justify-between items-center text-[9px] font-bold mb-1 ${
                              selectedMatchId === m.id
                                ? "text-blue-100"
                                : "text-emerald-700 dark:text-neutral-400"
                            }`}
                          >
                            <span>
                              {meta.venue.toUpperCase()} {m.tableNumber} • {m.phase}
                            </span>
                            <span className="font-black">
                              {currentSportType === "FUTSAL" ? (
                                <>
                                  {m.scoreA}x{m.scoreB}
                                  {(m.penaltiesA || m.penaltiesB) ? ` (${m.penaltiesA || 0}x${m.penaltiesB || 0} P)` : ""}
                                </>
                              ) : currentSportType === "PING_PONG" || currentSportType === "VOLEI" ? (
                                <>
                                  {curSetsA}x{curSetsB} Sets ({m.scoreA}x{m.scoreB})
                                </>
                              ) : (
                                <>
                                  {m.scoreA}x{m.scoreB}
                                  {isBestOf3 && ` (${m.setsA || 0}x${m.setsB || 0} S)`}
                                </>
                              )}
                            </span>
                          </div>
                          <div
                            className={`text-xs font-bold truncate ${
                              selectedMatchId === m.id ? "text-white" : "text-stone-900 dark:text-[#e4e4e7]"
                            }`}
                          >
                            {m.teamA.name} vs {m.teamB.name}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Pending Matches Section */}
                {pendingMatches.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <div className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider pl-1">
                      Agendadas
                    </div>
                    {pendingMatches.map((m) => {
                      const isMatchReady =
                        !m.teamA.id.startsWith("placeholder-") &&
                        !m.teamB.id.startsWith("placeholder-") &&
                        m.teamA.id !== "bye" &&
                        m.teamB.id !== "bye";
                      return (
                        <button
                          key={m.id}
                          onClick={() => {
                            setSelectedMatchId(m.id);
                            setDoublePoints(false);
                          }}
                          className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                            selectedMatchId === m.id
                              ? "bg-brand-electric border-brand-electric text-white"
                              : isMatchReady
                              ? "bg-white/80 border-[#d8ccb4] text-stone-700 hover:bg-[#d8ccb4]/40 dark:bg-[#0f0f0f] dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-[#262626]"
                              : "bg-white/30 border-dashed border-[#d8ccb4]/60 text-neutral-400 cursor-not-allowed dark:bg-[#0f0f0f]/40 dark:border-neutral-800/50"
                          }`}
                        >
                          <div
                            className={`flex justify-between items-center text-[9px] font-bold mb-1 ${
                              selectedMatchId === m.id ? "text-blue-100" : "text-neutral-500"
                            }`}
                          >
                            <span>
                              {meta.venue.toUpperCase()} {m.tableNumber}
                            </span>
                            <span>AGENDADA</span>
                          </div>
                          <div
                            className={`text-xs font-semibold truncate flex items-center gap-1.5 ${
                              selectedMatchId === m.id
                                ? "text-white font-bold"
                                : isMatchReady
                                ? "text-stone-800 dark:text-[#e4e4e7] font-bold"
                                : "text-neutral-400 dark:text-neutral-500"
                            }`}
                          >
                            {!isMatchReady && <Lock className="h-3 w-3 shrink-0" />}
                            <span>{m.teamA.name}</span>
                          </div>
                          <div
                            className={`text-xs font-semibold truncate flex items-center gap-1.5 ${
                              selectedMatchId === m.id
                                ? "text-white font-bold"
                                : isMatchReady
                                ? "text-stone-800 dark:text-[#e4e4e7] font-bold"
                                : "text-neutral-400 dark:text-neutral-500"
                            }`}
                          >
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
                            ? "bg-brand-electric border-brand-electric text-white"
                            : "bg-white/80 border-[#d8ccb4] text-stone-700 hover:bg-[#d8ccb4]/40 dark:bg-[#0f0f0f] dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-[#262626]"
                        }`}
                      >
                        <div
                          className={`flex justify-between items-center text-[9px] font-bold mb-1 ${
                            selectedMatchId === m.id ? "text-blue-100" : "text-neutral-500"
                          }`}
                        >
                          <span>
                            {meta.venue.toUpperCase()} {m.tableNumber}
                          </span>
                          <span
                            className={`font-bold ${
                              selectedMatchId === m.id ? "text-white" : "text-brand-electric-light"
                            }`}
                          >
                            FIM
                          </span>
                        </div>
                        <div
                          className={`text-xs font-semibold truncate ${
                            selectedMatchId === m.id ? "text-white" : "text-stone-800 dark:text-[#e4e4e7]"
                          }`}
                        >
                          {m.teamA.name}
                        </div>
                        <div
                          className={`text-xs font-semibold truncate ${
                            selectedMatchId === m.id ? "text-white" : "text-stone-800 dark:text-[#e4e4e7]"
                          }`}
                        >
                          {m.teamB.name}
                        </div>
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
            <div className="glass-panel rounded-2xl p-16 border border-[#d8ccb4] dark:border-[#1e1e1e] bg-[#e6ddca] dark:bg-[#1e1e1e] text-center">
              <ClipboardCheck className="h-14 w-14 text-neutral-400 dark:text-neutral-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-stone-800 dark:text-[#e4e4e7]">
                Nenhum confronto selecionado
              </h3>
              <p className="text-stone-500 dark:text-neutral-400 text-sm mt-1 max-w-sm mx-auto">
                Selecione um confronto na lista ao lado para iniciar a arbitragem da partida.
              </p>
            </div>
          ) : (
            <>
              {/* Match Header Info */}
              <div className="glass-panel rounded-2xl p-6 border border-[#d8ccb4] dark:border-[#1e1e1e] bg-[#e6ddca] dark:bg-[#1e1e1e] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <div className="text-[10px] font-bold text-brand-electric-light tracking-widest uppercase mb-1">
                    {selectedMatch.phase} • {meta.venue.toUpperCase()} {selectedMatch.tableNumber}
                  </div>
                  <h2 className="text-2xl font-black uppercase text-stone-800 dark:text-[#e4e4e7] tracking-wide flex items-center gap-2">
                    <span>SÚMULA DIGITAL</span>
                    <span className="text-xs px-2.5 py-1 rounded-lg bg-brand-electric/10 text-brand-electric border border-brand-electric/20 font-bold">
                      {meta.name}
                    </span>
                  </h2>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5 border border-blue-200 bg-blue-50 px-3 py-1.5 rounded-xl text-xs font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50">
                    <span>{meta.rule}</span>
                  </div>
                  {getStatusBadge(selectedMatch.status)}
                </div>
              </div>

              {/* Victory Banner */}
              {selectedMatch.status === "LIVE" && isMatchFinished && (
                <div className="bg-amber-500 border border-amber-400 text-neutral-950 font-display font-black text-center py-4 rounded-2xl shadow-xl shadow-amber-500/20 animate-pulse uppercase tracking-wider text-sm flex items-center justify-center gap-2">
                  <Trophy className="h-5 w-5" />
                  <span>VITÓRIA DE: {matchWinnerName}</span>
                </div>
              )}

              {selectedMatch.status === "SCHEDULED" ? (
                (() => {
                  const isMatchReady =
                    !selectedMatch.teamA.id.startsWith("placeholder-") &&
                    !selectedMatch.teamB.id.startsWith("placeholder-");
                  return (
                    <div className="glass-panel rounded-2xl p-12 border border-[#d8ccb4] dark:border-[#1e1e1e] bg-[#e6ddca] dark:bg-[#1e1e1e] text-center flex flex-col items-center justify-center min-h-[300px]">
                      {isMatchReady ? (
                        <Clock className="h-12 w-12 text-brand-electric-light mb-4 animate-pulse-slow" />
                      ) : (
                        <Lock className="h-12 w-12 text-neutral-500 mb-4" />
                      )}
                      <h3 className="text-xl font-black text-stone-800 dark:text-[#e4e4e7] uppercase tracking-wider">
                        {isMatchReady ? "Confronto Agendado" : "Confronto Bloqueado"}
                      </h3>
                      <p className="text-stone-500 dark:text-neutral-400 text-sm mt-2 max-w-sm mx-auto">
                        {isMatchReady
                          ? `Este confronto entre ${selectedMatch.teamA.name} e ${selectedMatch.teamB.name} está pronto para começar no(a) ${meta.venue} ${selectedMatch.tableNumber}.`
                          : `Este confronto está aguardando a definição dos adversários das fases anteriores para começar no(a) ${meta.venue} ${selectedMatch.tableNumber}.`}
                      </p>
                      {isMatchReady && !isReadOnly ? (
                        <button
                          onClick={() => onStartMatch(selectedMatch.id)}
                          className="mt-6 flex items-center gap-2.5 bg-brand-electric hover:bg-brand-electric-hover text-white px-8 py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all transform hover:scale-[1.03] active:scale-95 shadow-lg shadow-brand-electric/20 cursor-pointer"
                        >
                          <Play className="h-4 w-4 fill-white" />
                          Iniciar Partida
                        </button>
                      ) : (
                        <button
                          disabled={true}
                          className="mt-6 flex items-center gap-2.5 bg-neutral-200 dark:bg-[#0f0f0f] border border-neutral-300 dark:border-neutral-800 text-neutral-400 dark:text-neutral-500 px-8 py-4 rounded-xl font-black text-sm uppercase tracking-widest opacity-50 cursor-not-allowed"
                        >
                          <Lock className="h-4 w-4" />
                          {isReadOnly
                            ? "Modo Histórico (Leitura)"
                            : "Aguardando Definição de Adversários"}
                        </button>
                      )}
                    </div>
                  );
                })()
              ) : (
                <>
                  {/* Banner de Set Atual para Ping Pong e Vôlei */}
                  {(currentSportType === "PING_PONG" || currentSportType === "VOLEI") && (
                    <div className="glass-panel rounded-2xl p-4 border border-brand-electric/40 bg-white/70 dark:bg-[#1e1e1e] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-brand-electric text-white font-black text-sm flex items-center justify-center">
                          <Layers className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-brand-electric-light uppercase tracking-widest">
                            {meta.name} • Andamento dos Sets
                          </div>
                          <div className="text-lg font-black text-stone-900 dark:text-[#e4e4e7] uppercase">
                            SET ATUAL: <span className="text-brand-electric dark:text-blue-400">SET {currentSetNumber}</span>{" "}
                            {isTieBreak && (
                              <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 font-black">
                                TIE-BREAK (15 PTS)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Placar de Sets Vencidos */}
                      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-100 dark:bg-[#0f0f0f] border border-stone-200 dark:border-neutral-800">
                        <span className="text-xs font-bold text-stone-500 dark:text-neutral-400 uppercase tracking-wider">
                          Sets Vencidos:
                        </span>
                        <div className="flex items-center gap-1.5 font-black text-base">
                          <span className="px-2 py-0.5 rounded bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            {setsA}
                          </span>
                          <span className="text-stone-400">x</span>
                          <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            {setsB}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Large Digital Scoreboard */}
                  <div className="grid grid-cols-1 md:grid-cols-7 gap-4 items-stretch">
                    {/* Team A Card */}
                    <div className="md:col-span-3 glass-panel rounded-2xl p-6 border border-[#d8ccb4] dark:border-[#1e1e1e] bg-[#e6ddca] dark:bg-[#1e1e1e] text-center flex flex-col justify-between min-h-[260px]">
                      <div>
                        <span className="text-[10px] font-black text-brand-electric-light tracking-widest uppercase block mb-1">
                          {currentSportType === "FUTSAL" ? "EQUIPE A (MANDANTE)" : "TIME A / JOGADOR 1"}
                        </span>
                        <h3 className="text-xl font-black text-stone-900 dark:text-[#e4e4e7] truncate">
                          {selectedMatch.teamA.name}
                        </h3>
                        <p className="text-[11px] text-stone-500 dark:text-neutral-400 mt-1">
                          {selectedMatch.teamA.players[0]}
                          {selectedMatch.teamA.players[1] && ` & ${selectedMatch.teamA.players[1]}`}
                        </p>
                      </div>

                      <div className="my-4 flex flex-col items-center justify-center">
                        <span className="font-display font-black text-6xl text-stone-900 dark:text-[#e4e4e7] select-none leading-none">
                          {scoreA}
                        </span>
                        <span className="text-[11px] font-bold text-stone-500 dark:text-neutral-400 uppercase tracking-wider mt-1">
                          {currentSportType === "FUTSAL"
                            ? "Gols"
                            : currentSportType === "PING_PONG" || currentSportType === "VOLEI"
                            ? "Pontos no Set"
                            : "Pontos"}
                        </span>

                        {/* Futsal: Penalties Counter */}
                        {currentSportType === "FUTSAL" && (
                          <div className="mt-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                            Pênaltis convertidos: <span className="font-black text-sm">{penA}</span>
                          </div>
                        )}

                        {/* Ping Pong / Volei / Domino Best-of-3 Sets Indicator */}
                        {currentSportType !== "FUTSAL" && (
                          <div className="mt-3 flex items-center justify-center gap-2">
                            <span className="text-[10px] font-bold text-stone-500 dark:text-neutral-400 uppercase">
                              Sets Vencidos:
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-brand-electric/15 text-brand-electric dark:text-blue-400 font-black text-xs border border-brand-electric/30">
                              {setsA}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Team A Keypad Controls */}
                      {selectedMatch.status === "LIVE" && !isReadOnly && (
                        <div>
                          {currentSportType === "FUTSAL" ? (
                            /* FUTSAL CONTROLS */
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              <button
                                onClick={() => handlePointClick("A", 1, false)}
                                disabled={isMatchFinished}
                                className="py-2.5 px-2 text-xs font-black uppercase tracking-wider rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-all active:scale-95 disabled:opacity-30 cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                              >
                                <span>⚽</span>
                                <span>+1 Gol</span>
                              </button>
                              <button
                                onClick={() => handlePointClick("A", -1, false)}
                                disabled={isMatchFinished || scoreA <= 0}
                                className="py-2.5 px-2 text-xs font-bold uppercase tracking-wider rounded-xl border border-stone-300 dark:border-neutral-700 bg-white dark:bg-[#0f0f0f] text-stone-600 dark:text-[#e4e4e7] hover:text-red-500 dark:hover:text-red-400 transition-all active:scale-95 disabled:opacity-30 cursor-pointer"
                              >
                                -1 Gol
                              </button>
                              <button
                                onClick={() => handlePointClick("A", 1, true)}
                                disabled={isMatchFinished}
                                className="col-span-2 py-2 px-2 text-xs font-black uppercase tracking-wider rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 transition-all active:scale-95 disabled:opacity-30 cursor-pointer flex items-center justify-center gap-1.5"
                              >
                                <span>🥅</span>
                                <span>Pênalti (+1)</span>
                                {penA > 0 && (
                                  <span className="ml-1 px-1.5 py-0.2 rounded bg-amber-500 text-black text-[10px] font-black">
                                    {penA}
                                  </span>
                                )}
                              </button>
                              {penA > 0 && (
                                <button
                                  onClick={() => handlePointClick("A", -1, true)}
                                  className="col-span-2 text-[10px] text-stone-500 dark:text-neutral-400 hover:text-red-500 cursor-pointer text-center"
                                >
                                  Desfazer Pênalti (-1)
                                </button>
                              )}
                            </div>
                          ) : currentSportType === "PING_PONG" || currentSportType === "VOLEI" ? (
                            /* PING PONG & VOLEI CONTROLS */
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              <button
                                onClick={() => handlePointClick("A", 1, false)}
                                disabled={isMatchFinished}
                                className="py-3 px-2 text-sm font-black uppercase tracking-wider rounded-xl bg-brand-electric hover:bg-brand-electric-hover text-white transition-all active:scale-95 disabled:opacity-30 cursor-pointer shadow-md shadow-brand-electric/20 flex items-center justify-center gap-1"
                              >
                                +1
                              </button>
                              <button
                                onClick={() => handlePointClick("A", -1, false)}
                                disabled={isMatchFinished || scoreA <= 0}
                                className="py-3 px-2 text-sm font-bold uppercase tracking-wider rounded-xl border border-stone-300 dark:border-neutral-700 bg-white dark:bg-[#0f0f0f] text-stone-600 dark:text-[#e4e4e7] hover:text-red-500 dark:hover:text-red-400 transition-all active:scale-95 disabled:opacity-30 cursor-pointer"
                              >
                                -1
                              </button>
                            </div>
                          ) : (
                            /* DOMINO CONTROLS */
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => handleAddPoints(selectedMatch.teamA.id, 1)}
                                disabled={isMatchFinished}
                                className="py-2 px-1 text-[10px] font-black uppercase tracking-wider rounded-xl border border-[#d8ccb4] dark:border-neutral-700 bg-white dark:bg-[#0f0f0f] text-stone-600 dark:text-[#e4e4e7] hover:border-brand-electric hover:bg-brand-electric/10 transition-all active:scale-95 disabled:opacity-30 cursor-pointer"
                              >
                                +1 Ponto
                              </button>
                              <button
                                onClick={() => handleAddPoints(selectedMatch.teamA.id, 2, "Lá e Lô")}
                                disabled={isMatchFinished}
                                className="py-2 px-1 text-[10px] font-black uppercase tracking-wider rounded-xl border border-[#d8ccb4] dark:border-neutral-700 bg-white dark:bg-[#0f0f0f] text-brand-electric-light hover:border-brand-electric hover:bg-brand-electric/10 transition-all active:scale-95 disabled:opacity-30 cursor-pointer"
                                title="Batida nas duas pontas (lá e lô)"
                              >
                                +2 Pontos
                              </button>
                              <button
                                onClick={() => onSubtractPoint(selectedMatch.id, selectedMatch.teamA.id)}
                                disabled={isMatchFinished || scoreA <= 0}
                                className="col-span-2 py-1.5 px-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg border border-stone-300 dark:border-neutral-700 bg-stone-100 dark:bg-[#0f0f0f] text-stone-500 dark:text-neutral-400 hover:text-red-600 transition-all active:scale-95 disabled:opacity-30 cursor-pointer flex items-center justify-center gap-1.5 mt-1"
                              >
                                <RotateCcw className="h-3 w-3" />
                                Desfazer / -1 Ponto
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* VS & Central Controls */}
                    <div className="md:col-span-1 flex flex-col items-center justify-center p-4 border border-[#d8ccb4] dark:border-[#1e1e1e] rounded-2xl bg-white/40 dark:bg-[#0f0f0f] min-h-[120px]">
                      <span className="font-display font-black text-neutral-400 dark:text-neutral-600 text-2xl select-none block mb-2">
                        VS
                      </span>

                      {/* Display Futsal Penalty State */}
                      {currentSportType === "FUTSAL" && (penA > 0 || penB > 0) && (
                        <div className="text-center p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 mb-2">
                          <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
                            Pênaltis
                          </span>
                          <span className="text-xs font-black text-stone-900 dark:text-white">
                            {penA} x {penB}
                          </span>
                        </div>
                      )}

                      {/* Domino Central Special Controls */}
                      {currentSportType === "DOMINO" &&
                        selectedMatch.status === "LIVE" &&
                        !isMatchFinished &&
                        !isReadOnly && (
                          <div className="flex flex-col gap-2 w-full max-w-[120px]">
                            <button
                              type="button"
                              onClick={() => setDoublePoints(!doublePoints)}
                              className={`py-2 px-1.5 rounded-lg border font-black text-[9px] uppercase tracking-wider text-center transition-all cursor-pointer ${
                                doublePoints
                                  ? "bg-brand-neon/15 border-brand-neon text-brand-neon animate-pulse"
                                  : "bg-white dark:bg-[#1e1e1e] border-stone-300 dark:border-neutral-700 text-stone-600 dark:text-neutral-300"
                              }`}
                            >
                              Dobro: {doublePoints ? "SIM" : "NÃO"}
                            </button>

                            <button
                              type="button"
                              onClick={handleAnnulRound}
                              className="py-2 px-1.5 rounded-lg border border-red-300 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-[9px] font-black uppercase tracking-wider text-center transition-all cursor-pointer active:scale-95"
                            >
                              Anular Rodada
                            </button>
                          </div>
                        )}
                    </div>

                    {/* Team B Card */}
                    <div className="md:col-span-3 glass-panel rounded-2xl p-6 border border-[#d8ccb4] dark:border-[#1e1e1e] bg-[#e6ddca] dark:bg-[#1e1e1e] text-center flex flex-col justify-between min-h-[260px]">
                      <div>
                        <span className="text-[10px] font-black text-brand-neon tracking-widest uppercase block mb-1">
                          {currentSportType === "FUTSAL" ? "EQUIPE B (VISITANTE)" : "TIME B / JOGADOR 2"}
                        </span>
                        <h3 className="text-xl font-black text-stone-900 dark:text-[#e4e4e7] truncate">
                          {selectedMatch.teamB.name}
                        </h3>
                        <p className="text-[11px] text-stone-500 dark:text-neutral-400 mt-1">
                          {selectedMatch.teamB.players[0]}
                          {selectedMatch.teamB.players[1] && ` & ${selectedMatch.teamB.players[1]}`}
                        </p>
                      </div>

                      <div className="my-4 flex flex-col items-center justify-center">
                        <span className="font-display font-black text-6xl text-stone-900 dark:text-[#e4e4e7] select-none leading-none">
                          {scoreB}
                        </span>
                        <span className="text-[11px] font-bold text-stone-500 dark:text-neutral-400 uppercase tracking-wider mt-1">
                          {currentSportType === "FUTSAL"
                            ? "Gols"
                            : currentSportType === "PING_PONG" || currentSportType === "VOLEI"
                            ? "Pontos no Set"
                            : "Pontos"}
                        </span>

                        {/* Futsal: Penalties Counter */}
                        {currentSportType === "FUTSAL" && (
                          <div className="mt-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                            Pênaltis convertidos: <span className="font-black text-sm">{penB}</span>
                          </div>
                        )}

                        {/* Ping Pong / Volei / Domino Best-of-3 Sets Indicator */}
                        {currentSportType !== "FUTSAL" && (
                          <div className="mt-3 flex items-center justify-center gap-2">
                            <span className="text-[10px] font-bold text-stone-500 dark:text-neutral-400 uppercase">
                              Sets Vencidos:
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-brand-neon/15 text-brand-neon dark:text-amber-400 font-black text-xs border border-brand-neon/30">
                              {setsB}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Team B Keypad Controls */}
                      {selectedMatch.status === "LIVE" && !isReadOnly && (
                        <div>
                          {currentSportType === "FUTSAL" ? (
                            /* FUTSAL CONTROLS */
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              <button
                                onClick={() => handlePointClick("B", 1, false)}
                                disabled={isMatchFinished}
                                className="py-2.5 px-2 text-xs font-black uppercase tracking-wider rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-all active:scale-95 disabled:opacity-30 cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                              >
                                <span>⚽</span>
                                <span>+1 Gol</span>
                              </button>
                              <button
                                onClick={() => handlePointClick("B", -1, false)}
                                disabled={isMatchFinished || scoreB <= 0}
                                className="py-2.5 px-2 text-xs font-bold uppercase tracking-wider rounded-xl border border-stone-300 dark:border-neutral-700 bg-white dark:bg-[#0f0f0f] text-stone-600 dark:text-[#e4e4e7] hover:text-red-500 dark:hover:text-red-400 transition-all active:scale-95 disabled:opacity-30 cursor-pointer"
                              >
                                -1 Gol
                              </button>
                              <button
                                onClick={() => handlePointClick("B", 1, true)}
                                disabled={isMatchFinished}
                                className="col-span-2 py-2 px-2 text-xs font-black uppercase tracking-wider rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 transition-all active:scale-95 disabled:opacity-30 cursor-pointer flex items-center justify-center gap-1.5"
                              >
                                <span>🥅</span>
                                <span>Pênalti (+1)</span>
                                {penB > 0 && (
                                  <span className="ml-1 px-1.5 py-0.2 rounded bg-amber-500 text-black text-[10px] font-black">
                                    {penB}
                                  </span>
                                )}
                              </button>
                              {penB > 0 && (
                                <button
                                  onClick={() => handlePointClick("B", -1, true)}
                                  className="col-span-2 text-[10px] text-stone-500 dark:text-neutral-400 hover:text-red-500 cursor-pointer text-center"
                                >
                                  Desfazer Pênalti (-1)
                                </button>
                              )}
                            </div>
                          ) : currentSportType === "PING_PONG" || currentSportType === "VOLEI" ? (
                            /* PING PONG & VOLEI CONTROLS */
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              <button
                                onClick={() => handlePointClick("B", 1, false)}
                                disabled={isMatchFinished}
                                className="py-3 px-2 text-sm font-black uppercase tracking-wider rounded-xl bg-brand-neon hover:bg-brand-neon-hover text-black transition-all active:scale-95 disabled:opacity-30 cursor-pointer shadow-md shadow-brand-neon/20 flex items-center justify-center gap-1"
                              >
                                +1
                              </button>
                              <button
                                onClick={() => handlePointClick("B", -1, false)}
                                disabled={isMatchFinished || scoreB <= 0}
                                className="py-3 px-2 text-sm font-bold uppercase tracking-wider rounded-xl border border-stone-300 dark:border-neutral-700 bg-white dark:bg-[#0f0f0f] text-stone-600 dark:text-[#e4e4e7] hover:text-red-500 dark:hover:text-red-400 transition-all active:scale-95 disabled:opacity-30 cursor-pointer"
                              >
                                -1
                              </button>
                            </div>
                          ) : (
                            /* DOMINO CONTROLS */
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => handleAddPoints(selectedMatch.teamB.id, 1)}
                                disabled={isMatchFinished}
                                className="py-2 px-1 text-[10px] font-black uppercase tracking-wider rounded-xl border border-[#d8ccb4] dark:border-neutral-700 bg-white dark:bg-[#0f0f0f] text-stone-600 dark:text-[#e4e4e7] hover:border-brand-neon-orange hover:bg-brand-neon-orange/10 transition-all active:scale-95 disabled:opacity-30 cursor-pointer"
                              >
                                +1 Ponto
                              </button>
                              <button
                                onClick={() => handleAddPoints(selectedMatch.teamB.id, 2, "Lá e Lô")}
                                disabled={isMatchFinished}
                                className="py-2 px-1 text-[10px] font-black uppercase tracking-wider rounded-xl border border-[#d8ccb4] dark:border-neutral-700 bg-white dark:bg-[#0f0f0f] text-brand-neon hover:border-brand-neon hover:bg-brand-neon/10 transition-all active:scale-95 disabled:opacity-30 cursor-pointer"
                                title="Batida nas duas pontas (lá e lô)"
                              >
                                +2 Pontos
                              </button>
                              <button
                                onClick={() => onSubtractPoint(selectedMatch.id, selectedMatch.teamB.id)}
                                disabled={isMatchFinished || scoreB <= 0}
                                className="col-span-2 py-1.5 px-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg border border-stone-300 dark:border-neutral-700 bg-stone-100 dark:bg-[#0f0f0f] text-stone-500 dark:text-neutral-400 hover:text-red-600 transition-all active:scale-95 disabled:opacity-30 cursor-pointer flex items-center justify-center gap-1.5 mt-1"
                              >
                                <RotateCcw className="h-3 w-3" />
                                Desfazer / -1 Ponto
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Histórico de Sets Concluídos (Ping Pong e Vôlei) */}
                  {(currentSportType === "PING_PONG" || currentSportType === "VOLEI") && (
                    <div className="glass-panel rounded-2xl p-5 border border-[#d8ccb4] dark:border-[#1e1e1e] bg-[#e6ddca] dark:bg-[#1e1e1e]">
                      <h3 className="text-sm font-black uppercase tracking-wider text-stone-800 dark:text-[#e4e4e7] mb-3 flex items-center gap-2">
                        <History className="h-4 w-4 text-brand-electric-light" />
                        <span>Histórico de Sets da Partida</span>
                      </h3>

                      {!selectedMatch.historicoSets || selectedMatch.historicoSets.length === 0 ? (
                        <p className="text-xs text-stone-500 dark:text-neutral-400 italic py-2 pl-1">
                          Nenhum set finalizado até o momento. O primeiro set está em andamento.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                          {selectedMatch.historicoSets.map((s) => {
                            const isWinnerA = s.scoreA > s.scoreB;
                            return (
                              <div
                                key={s.setNumber}
                                className="p-3.5 rounded-xl bg-white dark:bg-[#0f0f0f] border border-[#d8ccb4] dark:border-neutral-800 flex items-center justify-between shadow-sm"
                              >
                                <div>
                                  <span className="text-[10px] font-black uppercase tracking-wider text-stone-400 block">
                                    SET {s.setNumber}
                                  </span>
                                  <span className="text-xs font-bold text-stone-700 dark:text-neutral-300">
                                    {isWinnerA ? selectedMatch.teamA.name : selectedMatch.teamB.name}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span className="font-display font-black text-lg text-stone-900 dark:text-white">
                                    <span className={isWinnerA ? "text-brand-electric" : "text-stone-400"}>
                                      {s.scoreA}
                                    </span>
                                    <span className="mx-1 text-stone-400">-</span>
                                    <span className={!isWinnerA ? "text-brand-neon" : "text-stone-400"}>
                                      {s.scoreB}
                                    </span>
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Dominó: Histórico de Rodadas */}
                  {currentSportType === "DOMINO" && (
                    <div className="glass-panel rounded-2xl p-5 border border-[#d8ccb4] dark:border-[#1e1e1e] bg-[#e6ddca] dark:bg-[#1e1e1e]">
                      <h3 className="text-sm font-black uppercase tracking-wider text-stone-800 dark:text-[#e4e4e7] mb-4 flex items-center gap-2">
                        <History className="h-4 w-4 text-stone-500 dark:text-neutral-400" />
                        <span>Histórico de Batidas / Súmula Detalhada</span>
                      </h3>

                      {!selectedMatch.detailedScore.rounds ||
                      selectedMatch.detailedScore.rounds.length === 0 ? (
                        <p className="text-xs text-neutral-500 italic py-4 pl-1">
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
                                className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-[#0f0f0f] border border-[#d8ccb4] dark:border-neutral-800 shadow-sm text-xs"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="h-5 w-5 rounded bg-stone-100 dark:bg-neutral-900 border border-[#d8ccb4] dark:border-neutral-800 text-stone-500 dark:text-neutral-400 font-bold text-[10px] flex items-center justify-center">
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
                                  <span className="text-[10px] text-stone-500 dark:text-neutral-400">
                                    Pontuação da rodada:
                                  </span>
                                  <span
                                    className={`font-black ${
                                      isAnnulled
                                        ? "text-stone-400 dark:text-neutral-500"
                                        : "text-stone-800 dark:text-brand-electric-light"
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
                  )}

                  {/* Scoring Controls and Submission */}
                  {selectedMatch.status === "LIVE" && !isReadOnly && (
                    <div className="w-full">
                      <div className="glass-panel rounded-2xl p-5 border border-[#d8ccb4] dark:border-[#1e1e1e] bg-[#e6ddca] dark:bg-[#1e1e1e]">
                        <h3 className="text-sm font-black uppercase tracking-wider text-stone-800 dark:text-[#e4e4e7] mb-2 flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-brand-electric-light" />
                          <span>Encerramento de Partida</span>
                        </h3>
                        <p className="text-xs text-stone-500 dark:text-neutral-400 leading-relaxed">
                          {isMatchFinished
                            ? `Partida concluída de acordo com as regras de ${meta.name}. Envie o resultado final para oficializar na chave do torneio.`
                            : `A partida está em andamento. O envio de resultados será habilitado assim que as condições de vitória do ${meta.name} forem atingidas.`}
                        </p>

                        {isMatchFinished ? (
                          <div className="mt-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-3">
                            <Trophy className="h-5 w-5 text-amber-600 dark:text-brand-neon shrink-0 animate-bounce" />
                            <div>
                              <span className="text-[10px] text-amber-800 dark:text-amber-400 font-bold block uppercase">
                                VENCEDOR DEFINIDO:
                              </span>
                              <span className="text-xs font-black text-stone-900 dark:text-white">
                                {matchWinnerName}
                                {currentSportType === "FUTSAL" &&
                                  (penA > 0 || penB > 0
                                    ? ` (${scoreA}x${scoreB} gols, ${penA}x${penB} nos pênaltis)`
                                    : ` (${scoreA}x${scoreB} gols)`)}
                                {(currentSportType === "PING_PONG" || currentSportType === "VOLEI") &&
                                  ` (${setsA}x${setsB} em Sets)`}
                                {currentSportType === "DOMINO" &&
                                  (isBestOf3 ? ` (${setsA}x${setsB} em Sets)` : ` (${scoreA}x${scoreB} pts)`)}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 p-3.5 rounded-xl bg-white/70 border border-stone-200 dark:bg-[#0f0f0f] dark:border-neutral-800 flex items-center gap-3">
                            <Clock className="h-5 w-5 text-stone-400 dark:text-neutral-600 shrink-0" />
                            <div>
                              <span className="text-[10px] text-stone-500 dark:text-neutral-400 font-bold block uppercase">
                                PARCIAL ATUAL:
                              </span>
                              <span className="text-xs font-black text-stone-700 dark:text-neutral-300">
                                {currentSportType === "FUTSAL" && (
                                  <>
                                    {scoreA}x{scoreB} gols
                                    {(penA > 0 || penB > 0) && ` (Pênaltis: ${penA}x${penB})`}
                                  </>
                                )}
                                {(currentSportType === "PING_PONG" || currentSportType === "VOLEI") && (
                                  <>
                                    Sets: {setsA}x{setsB} • Set {currentSetNumber}: {scoreA}x{scoreB} pts
                                  </>
                                )}
                                {currentSportType === "DOMINO" && (
                                  <>
                                    {scoreA}x{scoreB} pts
                                    {isBestOf3 ? ` (Sets: ${setsA}x${setsB})` : " (Set Único)"}
                                  </>
                                )}
                              </span>
                            </div>
                          </div>
                        )}

                        <button
                          onClick={handleCompleteMatch}
                          disabled={!isMatchFinished}
                          className="w-full mt-4 py-3.5 rounded-xl bg-brand-electric hover:bg-brand-electric-hover text-white dark:bg-brand-neon dark:hover:bg-brand-neon-hover dark:text-neutral-950 disabled:bg-stone-200 disabled:text-stone-400 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-600 disabled:border-transparent font-black text-xs uppercase tracking-widest transition-all shadow-md shadow-brand-electric/15 dark:shadow-brand-neon/15 cursor-pointer disabled:cursor-not-allowed"
                        >
                          Encerrar Partida e Oficializar Resultado
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Winner Showcase for Completed Match */}
              {selectedMatch.status === "COMPLETED" && (
                <div className="glass-panel rounded-2xl p-6 border border-brand-electric/30 bg-gradient-to-r from-brand-electric/5 to-transparent flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-brand-electric/10 border border-brand-electric/30 flex items-center justify-center text-brand-electric-light">
                      <Award className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-[10px] text-brand-electric-light font-bold uppercase tracking-widest">
                        CONFRONTO CONCLUÍDO ({meta.name.toUpperCase()})
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
                    <span className="text-[10px] text-stone-500 dark:text-neutral-400 block font-semibold">
                      PLACAR FINAL
                    </span>
                    <span className="font-display font-black text-2xl text-stone-900 dark:text-white">
                      {currentSportType === "FUTSAL" ? (
                        <>
                          {selectedMatch.scoreA} - {selectedMatch.scoreB} (Gols)
                          {selectedMatch.penaltiesA || selectedMatch.penaltiesB ? (
                            <span className="text-sm font-normal text-amber-500 block">
                              Pênaltis: {selectedMatch.penaltiesA || 0} - {selectedMatch.penaltiesB || 0}
                            </span>
                          ) : null}
                        </>
                      ) : currentSportType === "PING_PONG" || currentSportType === "VOLEI" ? (
                        `${selectedMatch.finalSetsA ?? selectedMatch.setsVencidosTimeA ?? selectedMatch.setsA ?? 0} - ${selectedMatch.finalSetsB ?? selectedMatch.setsVencidosTimeB ?? selectedMatch.setsB ?? 0} (em Sets)`
                      ) : (
                        (selectedMatch.setsA !== undefined && selectedMatch.setsA > 0) ||
                        (selectedMatch.setsB !== undefined && selectedMatch.setsB > 0) ||
                        selectedMatch.phase.toLowerCase() === "semifinal" ||
                        selectedMatch.phase.toLowerCase() === "final" ? (
                          `${selectedMatch.setsA || 0} - ${selectedMatch.setsB || 0} (em Sets)`
                        ) : (
                          `${selectedMatch.scoreA} - ${selectedMatch.scoreB}`
                        )
                      )}
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
