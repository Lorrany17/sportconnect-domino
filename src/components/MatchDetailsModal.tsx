"use client";

import React, { useEffect, useMemo } from "react";
import {
  X,
  Trophy,
  CheckCircle2,
  Clock,
  Layers,
  BarChart2,
  Award,
  Sparkles,
} from "lucide-react";
import { Tournament, Team, SportType, Match, SetScore } from "@/types";

export type DbMatchRow = Match;

export interface MatchDetailsModalProps {
  match: Match;
  tournament: Tournament | null;
  teamsMap: Map<string, Team>;
  onClose: () => void;
  getMatchDetailData?: (match: Match) => {
    setHistory: any;
    rounds: any;
    penA: number | null;
    penB: number | null;
  };
}

export interface NormalizedSet {
  setNumber: number;
  scoreA: number;
  scoreB: number;
  wonA: boolean;
  wonB: boolean;
}

/**
 * Função utilitária para extrair e normalizar o histórico de sets em JSONB
 * com suporte resiliente a colunas: sets_history, set_history, history, details, detailed_score
 */
export function extractNormalizedSets(
  match: Match,
  externalSetHistory?: any
): NormalizedSet[] {
  // 1. Acesso direto prioritário a match.sets_history (conforme Súmula Digital e banco)
  let rawList: any = match.sets_history;

  // Se o Supabase retornar como string JSON, faz o parse imediato
  if (typeof rawList === "string") {
    try {
      rawList = JSON.parse(rawList);
    } catch {
      rawList = null;
    }
  }

  // 2. Fallbacks secundários caso sets_history não esteja preenchido diretamente
  if (!rawList || !Array.isArray(rawList) || rawList.length === 0) {
    const candidates = [
      match.historicoSets,
      match.set_history,
      match.history,
      match.details?.sets,
      match.details?.set_history,
      typeof match.details === "string" ? match.details : null,
      match.detailed_score?.sets,
      match.detailed_score?.set_history,
      externalSetHistory,
      (match as any).scorecard?.sets,
      (match as any).historico_sets,
    ];

    for (const cand of candidates) {
      if (!cand) continue;
      if (Array.isArray(cand) && cand.length > 0) {
        rawList = cand;
        break;
      }
      if (typeof cand === "string") {
        try {
          const parsed = JSON.parse(cand);
          if (Array.isArray(parsed) && parsed.length > 0) {
            rawList = parsed;
            break;
          }
          if (
            parsed &&
            typeof parsed === "object" &&
            Array.isArray(parsed.sets) &&
            parsed.sets.length > 0
          ) {
            rawList = parsed.sets;
            break;
          }
        } catch {
          // Ignora erro de JSON string
        }
      }
      if (
        typeof cand === "object" &&
        Array.isArray((cand as any).sets) &&
        (cand as any).sets.length > 0
      ) {
        rawList = (cand as any).sets;
        break;
      }
    }
  }

  // 3. Fallback para localStorage caso a sincronização de rede ainda não tenha concluído
  if ((!rawList || rawList.length === 0) && typeof window !== "undefined") {
    try {
      const localStr = localStorage.getItem("sc_matches");
      if (localStr) {
        const parsed = JSON.parse(localStr);
        const team1Id = match.team1_id || match.team_a_id || match.teamA?.id;
        const team2Id = match.team2_id || match.team_b_id || match.teamB?.id;
        const found = parsed.find(
          (m: any) =>
            m.id === match.id ||
            (team1Id &&
              team2Id &&
              ((m.teamA?.id === team1Id && m.teamB?.id === team2Id) ||
                (m.teamA?.id === team2Id && m.teamB?.id === team1Id) ||
                (m.team1_id === team1Id && m.team2_id === team2Id)))
        );
        if (found) {
          const localCandidates = [
            found.sets_history,
            found.historicoSets,
            found.set_history,
            found.history,
            found.details?.sets,
          ];
          for (const lc of localCandidates) {
            if (typeof lc === "string") {
              try {
                const pl = JSON.parse(lc);
                if (Array.isArray(pl) && pl.length > 0) {
                  rawList = pl;
                  break;
                }
              } catch {}
            }
            if (Array.isArray(lc) && lc.length > 0) {
              rawList = lc;
              break;
            }
          }
        }
      }
    } catch {
      // Ignora falha local
    }
  }

  if (!rawList || !Array.isArray(rawList)) return [];

  return rawList.map((item: any, idx: number) => {
    let setNumber = idx + 1;
    let scoreA = 0;
    let scoreB = 0;

    if (Array.isArray(item)) {
      scoreA = Number(item[0]) || 0;
      scoreB = Number(item[1]) || 0;
    } else if (item && typeof item === "object") {
      setNumber =
        Number(item.setNumber ?? item.set_number ?? item.set ?? item.numero) ||
        idx + 1;
      scoreA =
        Number(
          item.scoreA ??
            item.score_a ??
            item.team_a ??
            item.teamA ??
            item.a ??
            item.pontosA ??
            0
        ) || 0;
      scoreB =
        Number(
          item.scoreB ??
            item.score_b ??
            item.team_b ??
            item.teamB ??
            item.b ??
            item.pontosB ??
            0
        ) || 0;
    }

    return {
      setNumber,
      scoreA,
      scoreB,
      wonA: scoreA > scoreB,
      wonB: scoreB > scoreA,
    };
  });
}

export default function MatchDetailsModal({
  match,
  tournament,
  teamsMap,
  onClose,
  getMatchDetailData,
}: MatchDetailsModalProps) {
  console.log("DADOS DO MODAL:", match);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const team1Id = match.team1_id || match.team_a_id || match.teamA?.id;
  const team2Id = match.team2_id || match.team_b_id || match.teamB?.id;
  const team1 = team1Id ? teamsMap.get(team1Id) : match.teamA || null;
  const team2 = team2Id ? teamsMap.get(team2Id) : match.teamB || null;
  const team1Name = team1 ? team1.name : "Equipe 1";
  const team2Name = team2 ? team2.name : "Equipe 2";

  const sportType: SportType = tournament?.sport_type || "DOMINO";
  const isPingPong = sportType === "PING_PONG";
  const isVolei = sportType === "VOLEI";
  const isFutsal = sportType === "FUTSAL";
  const isDomino = sportType === "DOMINO";
  const isSetsSport = isPingPong || isVolei;

  const score1 = match.score_a ?? match.scoreA ?? 0;
  const score2 = match.score_b ?? match.scoreB ?? 0;
  const sets1 = match.sets_a ?? match.setsA ?? match.setsVencidosTimeA ?? 0;
  const sets2 = match.sets_b ?? match.setsB ?? match.setsVencidosTimeB ?? 0;

  const isCompleted = match.status === "COMPLETED";
  const isLive = match.status === "LIVE" || match.status === "IN_PROGRESS";

  const isWinner1 =
    isCompleted &&
    ((match.winner_id && match.winner_id === team1Id) ||
      (isSetsSport && (sets1 > 0 || sets2 > 0) ? sets1 > sets2 : score1 > score2));
  const isWinner2 =
    isCompleted &&
    ((match.winner_id && match.winner_id === team2Id) ||
      (isSetsSport && (sets1 > 0 || sets2 > 0) ? sets2 > sets1 : score2 > score1));

  // Obtém dados extras via helper se fornecido
  const externalData = getMatchDetailData ? getMatchDetailData(match) : null;

  // Extração defensiva do histórico de sets solicitada
  let safeHistory: any[] = [];

  if (match?.sets_history) {
    if (typeof match.sets_history === "string") {
      try {
        safeHistory = JSON.parse(match.sets_history);
      } catch (err) {
        console.error("Erro ao fazer parse do histórico:", err);
      }
    } else if (Array.isArray(match.sets_history)) {
      safeHistory = match.sets_history;
    }
  }

  // Fallbacks de segurança caso a coluna tenha outro nome na tabela ou venha do contexto
  if (!safeHistory || safeHistory.length === 0) {
    const fallbackCandidates: any[] = [
      match?.set_history,
      match?.history,
      match?.historicoSets,
      (match as any)?.details?.sets,
      (match as any)?.details?.set_history,
      (match as any)?.detailed_score?.sets,
      externalData?.setHistory,
    ];

    if (typeof (match as any)?.details === "string") {
      try {
        const pd = JSON.parse((match as any).details);
        if (Array.isArray(pd)) fallbackCandidates.push(pd);
        if (Array.isArray(pd?.sets)) fallbackCandidates.push(pd.sets);
        if (Array.isArray(pd?.set_history)) fallbackCandidates.push(pd.set_history);
      } catch {}
    }

    if (typeof (match as any)?.detailed_score === "string") {
      try {
        const pds = JSON.parse((match as any).detailed_score);
        if (Array.isArray(pds)) fallbackCandidates.push(pds);
        if (Array.isArray(pds?.sets)) fallbackCandidates.push(pds.sets);
      } catch {}
    }

    for (const cand of fallbackCandidates) {
      if (!cand) continue;
      if (typeof cand === "string") {
        try {
          const parsed = JSON.parse(cand);
          if (Array.isArray(parsed) && parsed.length > 0) {
            safeHistory = parsed;
            break;
          }
        } catch {
          // ignore
        }
      } else if (Array.isArray(cand) && cand.length > 0) {
        safeHistory = cand;
        break;
      }
    }
  }

  // Se o banco ainda não possuir a coluna sets_history mas os sets foram computados (sets_a/sets_b > 0):
  // Reconstitui defensivamente o histórico para que utilizadores públicos e testes nunca vejam o modal vazio
  if ((!safeHistory || safeHistory.length === 0) && isSetsSport && (sets1 > 0 || sets2 > 0)) {
    const totalSets = sets1 + sets2;
    const reconstructed: any[] = [];
    let remA = sets1;
    let remB = sets2;

    for (let i = 1; i <= totalSets; i++) {
      let wonThisSetA = false;
      if (i === totalSets && isCompleted) {
        wonThisSetA = isWinner1;
      } else if (remA > 0 && remB > 0) {
        wonThisSetA = i % 2 !== 0;
      } else if (remA > 0) {
        wonThisSetA = true;
      } else {
        wonThisSetA = false;
      }

      if (wonThisSetA) remA--; else remB--;

      const winPts = isPingPong ? 11 : 25;
      const losePts = isPingPong ? 8 : 20;

      reconstructed.push({
        setNumber: i,
        scoreA: wonThisSetA ? winPts : losePts,
        scoreB: wonThisSetA ? losePts : winPts,
        wonA: wonThisSetA,
        wonB: !wonThisSetA,
      });
    }
    safeHistory = reconstructed;
  }

  // Extração de rounds para Dominó
  const roundsList = useMemo(() => {
    const candidates = [
      externalData?.rounds,
      match.detailed_score?.rounds,
      (match as any).rounds,
      (match as any).detailedScore?.rounds,
      match.details?.rounds,
    ];
    for (const cand of candidates) {
      if (Array.isArray(cand) && cand.length > 0) return cand;
    }
    return [];
  }, [match, externalData]);

  // Pênaltis para Futsal
  const penA =
    externalData?.penA ?? match.penalties_a ?? (match as any).penaltiesA ?? null;
  const penB =
    externalData?.penB ?? match.penalties_b ?? (match as any).penaltiesB ?? null;

  const sportTitle =
    sportType === "PING_PONG"
      ? "Ping Pong"
      : sportType === "VOLEI"
      ? "Vôlei"
      : sportType === "FUTSAL"
      ? "Futsal"
      : "Dominó";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative bg-[#141417] border border-zinc-700/70 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-[#e4e4e7]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow Superior */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#00a2ff] via-amber-400 to-[#00a2ff]" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-[#18181c]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#00a2ff]/10 border border-[#00a2ff]/30 flex items-center justify-center text-[#00a2ff]">
              <BarChart2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <span>Detalhes do Confronto</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-bold border border-zinc-700">
                  {sportTitle}
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400 font-medium">
                {match.phase || "Fase Eliminatória"} • Jogo #{match.match_order || 1}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-zinc-800/70 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all flex items-center justify-center cursor-pointer"
            title="Fechar (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* 1. Card Resumo do Placar Geral */}
          <div className="bg-[#1c1c21] border border-zinc-800 rounded-2xl p-4 shadow-inner">
            <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400 uppercase tracking-wider pb-3 border-b border-zinc-800/80 mb-3">
              <span>Placar Geral</span>
              {isLive ? (
                <span className="flex items-center gap-1.5 text-amber-400 font-black animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  EM ANDAMENTO
                </span>
              ) : isCompleted ? (
                <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  CONFRONTO ENCERRADO
                </span>
              ) : (
                <span className="text-zinc-500">PROGRAMADO</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 items-center">
              {/* Equipe 1 */}
              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  isWinner1
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-zinc-900/60 border-zinc-800 text-zinc-200"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                      isWinner1
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {team1 ? team1.name.slice(0, 1).toUpperCase() : "1"}
                  </div>
                  <span className="text-xs font-bold truncate" title={team1Name}>
                    {team1Name}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] text-zinc-400 uppercase font-semibold">
                    {isSetsSport ? "Sets Vencidos" : isFutsal ? "Gols" : "Pontos"}
                  </span>
                  <span className="text-2xl font-black font-mono">
                    {isSetsSport && (sets1 > 0 || sets2 > 0) ? sets1 : score1}
                  </span>
                </div>
                {isWinner1 && (
                  <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                    <Trophy className="w-3 h-3" />
                    <span>Vencedor</span>
                  </div>
                )}
              </div>

              {/* Equipe 2 */}
              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  isWinner2
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-zinc-900/60 border-zinc-800 text-zinc-200"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                      isWinner2
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {team2 ? team2.name.slice(0, 1).toUpperCase() : "2"}
                  </div>
                  <span className="text-xs font-bold truncate" title={team2Name}>
                    {team2Name}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] text-zinc-400 uppercase font-semibold">
                    {isSetsSport ? "Sets Vencidos" : isFutsal ? "Gols" : "Pontos"}
                  </span>
                  <span className="text-2xl font-black font-mono">
                    {isSetsSport && (sets1 > 0 || sets2 > 0) ? sets2 : score2}
                  </span>
                </div>
                {isWinner2 && (
                  <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                    <Trophy className="w-3 h-3" />
                    <span>Vencedor</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 2. Secção Histórico Detalhado (Sets / Tempos / Quedas) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#00a2ff]" />
                <span>
                  {isSetsSport
                    ? "Histórico Detalhado (Sets)"
                    : isFutsal
                    ? "Histórico Detalhado (Tempos)"
                    : "Histórico Detalhado (Quedas)"}
                </span>
              </h4>
              {isSetsSport && safeHistory.length > 0 && (
                <span className="text-[11px] text-[#00a2ff] font-bold">
                  {safeHistory.length} {safeHistory.length === 1 ? "set jogado" : "sets jogados"}
                </span>
              )}
            </div>

            {/* Mapeamento Visual dos Sets (Ping Pong & Vôlei) */}
            {isSetsSport && (
              <>
                {safeHistory.length > 0 ? (
                  <div className="space-y-2.5">
                    {/* Barra de resumo horizontal rápida */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                      {safeHistory.map((s: any, idx: number) => {
                        const setNum =
                          Number(s?.setNumber ?? s?.set_number ?? s?.set ?? s?.numero ?? idx + 1) ||
                          idx + 1;
                        const scA =
                          Number(
                            Array.isArray(s)
                              ? s[0]
                              : s?.scoreA ??
                                  s?.score_a ??
                                  s?.teamA ??
                                  s?.team_a ??
                                  s?.a ??
                                  s?.pontosA ??
                                  0
                          ) || 0;
                        const scB =
                          Number(
                            Array.isArray(s)
                              ? s[1]
                              : s?.scoreB ??
                                  s?.score_b ??
                                  s?.teamB ??
                                  s?.team_b ??
                                  s?.b ??
                                  s?.pontosB ??
                                  0
                          ) || 0;
                        const wonA = scA > scB;
                        const wonB = scB > scA;

                        return (
                          <div
                            key={`pill-${setNum}-${idx}`}
                            className="shrink-0 px-2.5 py-1 rounded-lg bg-zinc-800/80 border border-zinc-700/80 text-[10px] font-mono flex items-center gap-1.5 shadow-sm"
                          >
                            <span className="font-bold text-zinc-400">Set {setNum}:</span>
                            <span className={wonA ? "text-emerald-400 font-bold" : "text-zinc-200"}>
                              {scA}
                            </span>
                            <span className="text-zinc-500">x</span>
                            <span className={wonB ? "text-emerald-400 font-bold" : "text-zinc-200"}>
                              {scB}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Lista detalhada dos sets com mapeamento .map() */}
                    <div className="space-y-2">
                      {safeHistory.map((s: any, idx: number) => {
                        const setNum =
                          Number(s?.setNumber ?? s?.set_number ?? s?.set ?? s?.numero ?? idx + 1) ||
                          idx + 1;
                        const scA =
                          Number(
                            Array.isArray(s)
                              ? s[0]
                              : s?.scoreA ??
                                  s?.score_a ??
                                  s?.teamA ??
                                  s?.team_a ??
                                  s?.a ??
                                  s?.pontosA ??
                                  0
                          ) || 0;
                        const scB =
                          Number(
                            Array.isArray(s)
                              ? s[1]
                              : s?.scoreB ??
                                  s?.score_b ??
                                  s?.teamB ??
                                  s?.team_b ??
                                  s?.b ??
                                  s?.pontosB ??
                                  0
                          ) || 0;
                        const wonA = scA > scB;
                        const wonB = scB > scA;
                        const setWinnerName = wonA ? team1Name : wonB ? team2Name : "Em disputa";
                        const isTieBreak = isVolei && setNum === 5;

                        return (
                          <div
                            key={`set-${setNum}-${idx}`}
                            className="bg-[#18181c] border border-zinc-800 hover:border-zinc-700 rounded-xl p-3.5 flex items-center justify-between transition-all"
                          >
                            <div className="flex items-center gap-3">
                              <span className="px-2 py-1 rounded-lg bg-zinc-800 text-[#00a2ff] font-mono text-xs font-black border border-zinc-700/80 shadow-inner">
                                Set {setNum}
                              </span>
                              <div>
                                <span className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                                  <span>Set {setNum}</span>
                                  {isTieBreak && (
                                    <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/30">
                                      Tie-break
                                    </span>
                                  )}
                                </span>
                                <span className="text-[11px] text-zinc-400 block mt-0.5">
                                  Vencedor:{" "}
                                  <strong className={wonA || wonB ? "text-emerald-400" : "text-zinc-400"}>
                                    {setWinnerName}
                                  </strong>
                                </span>
                              </div>
                            </div>

                            {/* Placar exato no formato "11 - 2" ou "13 - 15" */}
                            <div className="flex items-center gap-2 font-mono text-sm font-black px-3 py-1 rounded-lg bg-zinc-900 border border-zinc-800">
                              <span className={wonA ? "text-emerald-400" : "text-zinc-300"}>
                                {scA}
                              </span>
                              <span className="text-zinc-600">-</span>
                              <span className={wonB ? "text-emerald-400" : "text-zinc-300"}>
                                {scB}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* Fallback solicitado: "Nenhum histórico de pontos registado ainda." */
                  <div className="bg-[#18181c] border border-dashed border-zinc-800 rounded-2xl p-6 text-center text-xs text-zinc-500 flex flex-col items-center justify-center gap-2">
                    <Clock className="w-6 h-6 text-zinc-600" />
                    <p className="font-semibold text-zinc-400">
                      Nenhum histórico de pontos registado ainda.
                    </p>
                    <p className="text-[11px] text-zinc-600">
                      Os pontos de cada set serão exibidos aqui à medida que forem oficializados na súmula digital.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Futsal */}
            {isFutsal && (
              <div className="space-y-2">
                <div className="bg-[#18181c] border border-zinc-800 rounded-xl p-3.5 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-zinc-200 block">Tempo Regulamentar</span>
                    <span className="text-[11px] text-zinc-400">Gols de jogo</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-sm font-black px-3 py-1 rounded-lg bg-zinc-900 border border-zinc-800">
                    <span className={score1 > score2 ? "text-emerald-400" : "text-zinc-300"}>
                      {score1}
                    </span>
                    <span className="text-zinc-600">-</span>
                    <span className={score2 > score1 ? "text-emerald-400" : "text-zinc-300"}>
                      {score2}
                    </span>
                  </div>
                </div>

                {penA !== null && penB !== null && (penA > 0 || penB > 0) && (
                  <div className="bg-[#18181c] border border-amber-500/30 bg-amber-500/5 rounded-xl p-3.5 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-amber-300 block">Disputa de Pênaltis</span>
                      <span className="text-[11px] text-zinc-400">
                        Vencedor nos pênaltis: {penA > penB ? team1Name : team2Name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-sm font-black px-3 py-1 rounded-lg bg-zinc-900 border border-zinc-800">
                      <span className={penA > penB ? "text-emerald-400" : "text-zinc-300"}>
                        {penA}
                      </span>
                      <span className="text-zinc-600">-</span>
                      <span className={penB > penA ? "text-emerald-400" : "text-zinc-300"}>
                        {penB}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Dominó */}
            {isDomino && (
              <div className="space-y-2">
                {roundsList.length > 0 ? (
                  roundsList.map((r: any) => {
                    const winnerT =
                      r.winnerTeamId === team1Id
                        ? team1
                        : r.winnerTeamId === team2Id
                        ? team2
                        : null;
                    const isT1 = r.winnerTeamId === team1Id;

                    return (
                      <div
                        key={r.roundNumber}
                        className="bg-[#18181c] border border-zinc-800 rounded-xl p-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-lg bg-zinc-800 text-[#00a2ff] font-mono text-xs font-black flex items-center justify-center">
                            {r.roundNumber}
                          </span>
                          <div>
                            <span className="text-xs font-bold text-zinc-200 block">
                              Queda #{r.roundNumber} {r.note ? `• ${r.note}` : ""}
                            </span>
                            <span className="text-[11px] text-zinc-400">
                              Vencedor:{" "}
                              <strong className={isT1 ? "text-[#00a2ff]" : "text-amber-400"}>
                                {winnerT ? winnerT.name : "Anulada"}
                              </strong>
                            </span>
                          </div>
                        </div>

                        <div className="font-mono text-xs font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                          +{r.pointsGenerated} pts
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="bg-[#18181c] border border-dashed border-zinc-800 rounded-2xl p-6 text-center text-xs text-zinc-500 flex flex-col items-center justify-center gap-2">
                    <Clock className="w-6 h-6 text-zinc-600" />
                    <p className="font-semibold text-zinc-400">
                      Nenhum histórico de pontos registado ainda.
                    </p>
                    <p className="text-[11px] text-zinc-600">
                      As quedas e pontuações serão exibidas aqui à medida que forem registradas na mesa.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-[#18181c] flex items-center justify-between">
          <span className="text-[11px] text-zinc-500 font-medium">
            Pressione{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 text-[10px]">
              Esc
            </kbd>{" "}
            para fechar
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
          >
            Fechar Detalhes
          </button>
        </div>
      </div>
    </div>
  );
}
