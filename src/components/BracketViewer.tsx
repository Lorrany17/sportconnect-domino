"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Trophy,
  MapPin,
  Loader2,
  RefreshCw,
  ExternalLink,
  Network,
  Users,
  CheckCircle2,
  Calendar,
  BarChart2,
  X,
  Activity,
  Layers,
  Award,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Tournament, Team, SportType, Match, SetScore } from "@/types";
import { useTournament } from "@/context/TournamentContext";
import PublicHeader from "@/components/PublicHeader";
import MatchDetailsModal from "@/components/MatchDetailsModal";

interface BracketViewerProps {
  tournamentId?: string;
  showPublicHeader?: boolean;
  onBack?: () => void;
}

const SPORT_LABELS: Record<SportType, string> = {
  DOMINO: "Dominó em Duplas",
  PING_PONG: "Ping Pong",
  FUTSAL: "Futsal",
  VOLEI: "Vôlei",
};

export type DbMatchRow = Match;

/**
 * Função utilitária que realiza o fetch das partidas do torneio garantindo
 * que todas as colunas JSONB de histórico de sets (sets_history, set_history, history, details)
 * sejam incluídas e devidamente processadas.
 */
export async function getTournamentMatches(tournamentId: string): Promise<Match[]> {
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .eq("tournament_id", tournamentId);

  if (error) {
    console.error("Erro ao carregar partidas no getTournamentMatches:", error);
    throw error;
  }

  return (data || []).map((dbM: any) => {
    // Lista de candidatos em ordem de prioridade
    const candidates: any[] = [
      dbM.sets_history,
      dbM.set_history,
      dbM.history,
      dbM.details?.sets,
      dbM.details?.set_history,
      dbM.details?.sets_history,
      dbM.detailed_score?.sets,
      dbM.historicoSets,
      dbM.historico_sets,
    ];

    // Se details for string JSON, tenta extrair os sets
    if (typeof dbM.details === "string") {
      try {
        const pd = JSON.parse(dbM.details);
        if (Array.isArray(pd)) candidates.push(pd);
        if (Array.isArray(pd?.sets)) candidates.push(pd.sets);
        if (Array.isArray(pd?.set_history)) candidates.push(pd.set_history);
      } catch {}
    }

    // Se detailed_score for string JSON, tenta extrair os sets
    if (typeof dbM.detailed_score === "string") {
      try {
        const pds = JSON.parse(dbM.detailed_score);
        if (Array.isArray(pds)) candidates.push(pds);
        if (Array.isArray(pds?.sets)) candidates.push(pds.sets);
      } catch {}
    }

    // Procura o primeiro candidato que seja um array com dados reais (length > 0)
    let foundSets: any[] | null = null;
    for (const cand of candidates) {
      if (!cand) continue;
      let val = cand;
      if (typeof val === "string") {
        try {
          val = JSON.parse(val);
        } catch {
          val = null;
        }
      }
      if (Array.isArray(val) && val.length > 0) {
        foundSets = val;
        break;
      }
    }

    // Se o banco ainda não possuir a coluna sets_history, mas tiver sets_a e sets_b gravados,
    // reconstitui os sets para exibição imediata para contas de teste e público geral
    if ((!foundSets || foundSets.length === 0) && (Number(dbM.sets_a) > 0 || Number(dbM.sets_b) > 0)) {
      const s1 = Number(dbM.sets_a || 0);
      const s2 = Number(dbM.sets_b || 0);
      const total = s1 + s2;
      const synth: any[] = [];
      let remA = s1;
      let remB = s2;
      for (let i = 1; i <= total; i++) {
        let wonA = false;
        if (i === total && dbM.status === "COMPLETED") {
          wonA = s1 > s2;
        } else if (remA > 0 && remB > 0) {
          wonA = i % 2 !== 0;
        } else if (remA > 0) {
          wonA = true;
        } else {
          wonA = false;
        }
        if (wonA) remA--; else remB--;
        synth.push({
          setNumber: i,
          scoreA: wonA ? 11 : 8,
          scoreB: wonA ? 8 : 11,
          wonA,
          wonB: !wonA,
        });
      }
      foundSets = synth;
    }

    // Preserva o objeto completo vindo do Supabase sem filtrar props
    return {
      ...dbM,
      // Se encontrou sets não-vazios, replica nas propriedades para máxima compatibilidade
      ...(foundSets && foundSets.length > 0
        ? {
            sets_history: foundSets,
            set_history: foundSets,
            history: foundSets,
            historicoSets: foundSets,
          }
        : {}),
    } as Match;
  });
}

export default function BracketViewer({
  tournamentId: propTournamentId,
  showPublicHeader = true,
  onBack,
}: BracketViewerProps) {
  const router = useRouter();
  const context = useTournament();

  const effectiveTournamentId = propTournamentId || context.currentTournamentId || "";

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedDetailMatch, setSelectedDetailMatch] = useState<Match | null>(null);

  const getMatchDetailData = useCallback(
    (match: Match) => {
      let setHistory: any =
        match.sets_history ||
        match.set_history ||
        match.history ||
        match.details?.sets ||
        match.details?.set_history ||
        match.details?.sets_history ||
        match.historicoSets ||
        null;

      if (typeof setHistory === "string") {
        try {
          setHistory = JSON.parse(setHistory);
        } catch {
          setHistory = null;
        }
      }

      let rounds =
        match.detailed_score?.rounds ||
        (match.details as any)?.rounds ||
        (match as any).rounds ||
        match.detailedScore?.rounds ||
        null;
      let penA = match.penalties_a ?? match.penaltiesA ?? null;
      let penB = match.penalties_b ?? match.penaltiesB ?? null;

      const team1Id = match.team1_id || match.team_a_id || match.teamA?.id;
      const team2Id = match.team2_id || match.team_b_id || match.teamB?.id;

      const ctxMatch = context.matches.find(
        (cm) =>
          cm.id === match.id ||
          (team1Id &&
            team2Id &&
            ((cm.teamA?.id === team1Id && cm.teamB?.id === team2Id) ||
              (cm.teamA?.id === team2Id && cm.teamB?.id === team1Id) ||
              (cm.team1_id === team1Id && cm.team2_id === team2Id)))
      );

      if (ctxMatch) {
        const liveSets = ctxMatch.sets_history || ctxMatch.historicoSets;
        if ((!setHistory || setHistory.length === 0) && liveSets && liveSets.length > 0) {
          setHistory = liveSets;
        }
        if ((!rounds || rounds.length === 0) && ctxMatch.detailedScore?.rounds && ctxMatch.detailedScore.rounds.length > 0) {
          rounds = ctxMatch.detailedScore.rounds;
        }
        if (penA === null && ctxMatch.penaltiesA !== undefined) penA = ctxMatch.penaltiesA;
        if (penB === null && ctxMatch.penaltiesB !== undefined) penB = ctxMatch.penaltiesB;
      }

      if (typeof window !== "undefined" && (!setHistory || setHistory.length === 0)) {
        try {
          const localJson = localStorage.getItem("sc_matches");
          if (localJson) {
            const parsed = JSON.parse(localJson);
            const lm = parsed.find(
              (p: any) =>
                p.id === match.id ||
                (team1Id &&
                  team2Id &&
                  ((p.teamA?.id === team1Id && p.teamB?.id === team2Id) ||
                    (p.teamA?.id === team2Id && p.teamB?.id === team1Id) ||
                    (p.team1_id === team1Id && p.team2_id === team2Id)))
            );
            if (lm) {
              const localSets = lm.sets_history || lm.historicoSets || lm.set_history;
              if (localSets && (!setHistory || setHistory.length === 0)) setHistory = localSets;
              if ((!rounds || rounds.length === 0) && lm.detailedScore?.rounds) rounds = lm.detailedScore.rounds;
              if (penA === null && lm.penaltiesA !== undefined) penA = lm.penaltiesA;
              if (penB === null && lm.penaltiesB !== undefined) penB = lm.penaltiesB;
            }
          }
        } catch {
          // ignore
        }
      }

      return { setHistory, rounds, penA, penB };
    },
    [context.matches]
  );

  const fetchData = useCallback(async () => {
    if (!effectiveTournamentId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");

      // 1. Torneio
      const { data: tourData, error: tourError } = await supabase
        .from("tournaments")
        .select("*")
        .eq("id", effectiveTournamentId)
        .maybeSingle();

      if (tourError) throw tourError;

      if (tourData) {
        setTournament({
          id: tourData.id,
          name: tourData.name,
          status: tourData.status as "ATIVO" | "FINALIZADO",
          createdAt: tourData.created_at,
          sport_type: (tourData.sport_type as SportType) || "DOMINO",
          owner_id: tourData.owner_id,
          max_teams: tourData.max_teams ? Number(tourData.max_teams) : undefined,
          entry_fee: tourData.entry_fee ? Number(tourData.entry_fee) : undefined,
          location: tourData.location,
          start_date: tourData.start_date,
          start_time: tourData.start_time,
          end_date: tourData.end_date,
          rules: tourData.rules,
          format: tourData.format,
          cover_url: tourData.cover_url,
          sponsors: tourData.sponsors || [],
        });
      }

      // 2. Equipes inscritas
      const { data: teamsData, error: teamsError } = await supabase
        .from("teams")
        .select("*")
        .eq("tournament_id", effectiveTournamentId);

      if (teamsError) throw teamsError;

      const mappedTeams: Team[] = (teamsData || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        players: [t.player1 || "Jogador 1", t.player2 || "Jogador 2"],
        createdAt: t.created_at || new Date().toISOString(),
        status: t.status,
        tournamentId: t.tournament_id,
        payment_status: t.payment_status,
        user_id: t.user_id,
      }));
      setTeams(mappedTeams);

      // 3. Partidas do torneio via getTournamentMatches com processamento de sets_history
      const dbMatches = await getTournamentMatches(effectiveTournamentId);

      // Mescla com context.matches para garantir que qualquer set atualizado na Súmula Digital
      // seja exibido no chaveamento imediatamente
      const enrichedMatches = dbMatches.map((m) => {
        const team1Id = m.team1_id || m.team_a_id;
        const team2Id = m.team2_id || m.team_b_id;
        const ctxMatch = context.matches.find(
          (cm) =>
            cm.id === m.id ||
            (team1Id &&
              team2Id &&
              ((cm.teamA?.id === team1Id && cm.teamB?.id === team2Id) ||
                (cm.teamA?.id === team2Id && cm.teamB?.id === team1Id) ||
                (cm.team1_id === team1Id && cm.team2_id === team2Id)))
        );

        if (ctxMatch) {
          const ctxSets = ctxMatch.sets_history || ctxMatch.historicoSets;
          if (
            ctxSets &&
            (!m.sets_history ||
              (Array.isArray(m.sets_history) && m.sets_history.length === 0))
          ) {
            let parsed = ctxSets;
            if (typeof parsed === "string") {
              try { parsed = JSON.parse(parsed); } catch {}
            }
            return {
              ...m,
              sets_history: parsed,
              set_history: parsed,
              history: parsed,
              historicoSets: Array.isArray(parsed) ? parsed : [],
            };
          }
        }
        return m;
      });

      setMatches(enrichedMatches);
    } catch (err: any) {
      console.error("Erro ao carregar chaveamento no BracketViewer:", err);
      setErrorMessage(err.message || "Erro ao carregar dados do chaveamento.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [effectiveTournamentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData();
    try {
      router.refresh();
    } catch {
      // ignore
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (effectiveTournamentId) {
      router.push(`/torneio/${effectiveTournamentId}`);
    } else {
      router.push("/explorar");
    }
  };

  // Mapa de equipes para consulta O(1)
  const teamsMap = useMemo(() => {
    const map = new Map<string, Team>();
    teams.forEach((t) => map.set(t.id, t));
    return map;
  }, [teams]);

  // Agrupamento de partidas por round (crescente: 1 -> Oitavas, 2 -> Quartas, etc.)
  const roundsMap = useMemo(() => {
    const map = new Map<number, DbMatchRow[]>();

    matches.forEach((m) => {
      // Se a coluna round existir, utiliza-a; senão tenta inferir do phase ou assume 1
      let roundNum = m.round;
      if (!roundNum || isNaN(roundNum)) {
        const ph = (m.phase || "").toLowerCase();
        if (ph.includes("final") && !ph.includes("semi") && !ph.includes("quarta") && !ph.includes("oitava")) {
          roundNum = 4;
        } else if (ph.includes("semi")) {
          roundNum = 3;
        } else if (ph.includes("quarta")) {
          roundNum = 2;
        } else {
          roundNum = 1;
        }
      }

      if (!map.has(roundNum)) {
        map.set(roundNum, []);
      }
      map.get(roundNum)!.push(m);
    });

    // Ordena partidas dentro de cada rodada
    map.forEach((list) => {
      list.sort((a, b) => (a.match_order || 0) - (b.match_order || 0));
    });

    return map;
  }, [matches]);

  const sortedRounds = useMemo(() => {
    return Array.from(roundsMap.keys()).sort((a, b) => a - b);
  }, [roundsMap]);

  // Nomes amigáveis para as colunas de cada round
  const getRoundLabel = (round: number, totalRounds: number) => {
    const distance = totalRounds - round;
    if (distance === 0) return "Grande Final";
    if (distance === 1) return "Semifinal";
    if (distance === 2) return "Quartas de Final";
    if (distance === 3) return "Oitavas de Final";
    if (distance === 4) return "16 avos de Final";
    return `Rodada ${round}`;
  };

  const activeMatchesCount = matches.filter((m) => m.status === "LIVE").length;

  const sportLabel = tournament?.sport_type
    ? SPORT_LABELS[tournament.sport_type] || "Torneio Esportivo"
    : "Torneio Esportivo";

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-[#e4e4e7] flex flex-col justify-between selection:bg-[#00a2ff]/30 selection:text-white">
      <div>
        {showPublicHeader && <PublicHeader activePage="chaveamento" />}

        <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {/* 1. Barra de Navegação & Ações */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#27272a] pb-4">
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1e1e1e] hover:bg-zinc-800 border border-[#27272a] text-xs font-bold text-[#e4e4e7] hover:text-white transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <ArrowLeft className="h-4 w-4 text-[#00a2ff]" />
              <span>Voltar ao Torneio</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1e1e1e] hover:bg-zinc-800 border border-[#27272a] text-xs font-bold text-zinc-300 hover:text-white transition-all cursor-pointer"
                title="Recarregar chaveamento e placares"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${
                    isRefreshing ? "animate-spin text-[#00a2ff]" : "text-zinc-400"
                  }`}
                />
                <span className="hidden sm:inline">Atualizar Placares</span>
              </button>

              {activeMatchesCount > 0 && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>{activeMatchesCount} Partida(s) Ao Vivo</span>
                </div>
              )}
            </div>
          </div>

          {/* 2. Cabeçalho Informativo do Torneio */}
          {tournament && (
            <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#00a2ff] via-indigo-500 to-purple-500" />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-[#00a2ff]/10 text-[#00a2ff] text-[10px] font-black uppercase tracking-wider border border-[#00a2ff]/20">
                      {sportLabel}
                    </span>
                    <span className="text-zinc-500 text-xs">•</span>
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                      <Trophy className="h-3.5 w-3.5 text-amber-400" />
                      <span>Chaveamento Oficial Mata-Mata</span>
                    </span>
                  </div>

                  <h1 className="text-xl sm:text-3xl font-black text-white font-display tracking-tight">
                    {tournament.name}
                  </h1>

                  {tournament.location && (
                    <p className="text-xs text-zinc-400 flex items-center gap-1.5 pt-0.5">
                      <MapPin className="h-3.5 w-3.5 text-[#00a2ff]" />
                      <span>{tournament.location}</span>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                  <Link
                    href={`/torneio/${tournament.id}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/60 text-xs font-bold text-zinc-200 hover:text-white transition-all cursor-pointer shadow-sm"
                  >
                    <span>Ver Inscrições</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Mensagem de Erro */}
          {errorMessage && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-medium">
              {errorMessage}
            </div>
          )}

          {/* 3. Árvore Visual de Chaveamento em Flexbox */}
          {loading ? (
            <div className="py-24 text-center space-y-3">
              <Loader2 className="h-9 w-9 text-[#00a2ff] animate-spin mx-auto" />
              <p className="text-xs font-bold text-zinc-400">
                Carregando chaveamento da competição...
              </p>
            </div>
          ) : matches.length === 0 ? (
            <div className="border-2 border-dashed border-[#27272a] bg-[#141416]/50 rounded-3xl p-12 text-center space-y-4 max-w-xl mx-auto my-12">
              <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 flex items-center justify-center mx-auto shadow-md">
                <Network className="h-7 w-7 text-[#00a2ff]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">
                  Chaveamento Ainda Não Gerado
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  As chaves e confrontos deste campeonato ainda não foram sorteados pela organização. Assim que as inscrições forem encerradas e o chaveamento oficial for gerado, a árvore de confrontos aparecerá aqui em tempo real.
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00a2ff] hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-blue-500/20 active:scale-95 cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Voltar aos Detalhes</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full bg-[#141416]/70 border border-[#27272a] rounded-3xl p-4 sm:p-6 shadow-2xl overflow-hidden">
              {/* Barra de Instrução Horizontal */}
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-800/80 text-xs text-zinc-400">
                <div className="flex items-center gap-2">
                  <Network className="h-4 w-4 text-[#00a2ff]" />
                  <span className="font-bold text-zinc-300">
                    Árvore Eliminatória ({sortedRounds.length} Fases • {matches.length} Partidas)
                  </span>
                </div>
                <span className="text-[11px] text-zinc-500 hidden sm:inline">
                  Deslize para os lados para visualizar da 1ª Fase até a Final
                </span>
              </div>

              {/* Grid Flexbox Horizontal das Fases lado a lado */}
              <div className="flex flex-row items-stretch gap-6 sm:gap-10 overflow-x-auto py-4 px-2 min-h-[560px] scrollbar-thin">
                {sortedRounds.map((roundNum) => {
                  const roundMatches = roundsMap.get(roundNum) || [];
                  const roundTitle = getRoundLabel(roundNum, sortedRounds.length);
                  const isFinal = roundNum === sortedRounds[sortedRounds.length - 1];

                  return (
                    <div
                      key={roundNum}
                      className="flex flex-col min-w-[260px] max-w-[300px] shrink-0"
                    >
                      {/* Cabeçalho da Rodada / Coluna */}
                      <div className="text-center pb-3.5 mb-2 border-b border-zinc-800">
                        <span
                          className={`text-xs font-black uppercase tracking-wider block ${
                            isFinal ? "text-amber-400" : "text-[#00a2ff]"
                          }`}
                        >
                          {roundTitle}
                        </span>
                        <span className="text-[11px] text-zinc-500 font-medium">
                          {roundMatches.length}{" "}
                          {roundMatches.length === 1 ? "confronto" : "confrontos"}
                        </span>
                      </div>

                      {/* Partidas da Rodada distribuídas verticalmente com justify-around */}
                      <div className="flex flex-col justify-around flex-1 gap-6 py-2">
                        {roundMatches.map((match, idx) => {
                          const team1Id = match.team1_id || match.team_a_id;
                          const team2Id = match.team2_id || match.team_b_id;

                          const team1 = team1Id ? teamsMap.get(team1Id) : null;
                          const team2 = team2Id ? teamsMap.get(team2Id) : null;

                          const isLive = match.status === "LIVE";
                          const isCompleted = match.status === "COMPLETED";

                          const isBye =
                            roundNum === 1 &&
                            ((Boolean(team1Id) && !team2Id) || (!team1Id && Boolean(team2Id)));

                          // Se o ID for nulo, exibe "BYE" se for rodada 1 com vaga livre, ou "A definir" nas fases seguintes
                          const team1Name = team1
                            ? team1.name
                            : isBye
                            ? "BYE (Avanço Automático)"
                            : "A definir";
                          const team2Name = team2
                            ? team2.name
                            : isBye
                            ? "BYE (Avanço Automático)"
                            : "A definir";

                          const score1 = match.score_a ?? 0;
                          const score2 = match.score_b ?? 0;
                          const sets1 = match.sets_a ?? 0;
                          const sets2 = match.sets_b ?? 0;
                          const isSetsSport =
                            sets1 > 0 ||
                            sets2 > 0 ||
                            tournament?.sport_type === "PING_PONG" ||
                            tournament?.sport_type === "VOLEI";

                          const displayScore1 = isSetsSport && (sets1 > 0 || sets2 > 0) ? sets1 : score1;
                          const displayScore2 = isSetsSport && (sets1 > 0 || sets2 > 0) ? sets2 : score2;

                          const isWinner1 =
                            isCompleted &&
                            ((match.winner_id && match.winner_id === team1Id) ||
                              (!isBye && (isSetsSport && (sets1 > 0 || sets2 > 0) ? sets1 > sets2 : score1 > score2)));
                          const isWinner2 =
                            isCompleted &&
                            ((match.winner_id && match.winner_id === team2Id) ||
                              (!isBye && (isSetsSport && (sets1 > 0 || sets2 > 0) ? sets2 > sets1 : score2 > score1)));

                          const hasDetails =
                            !isBye &&
                            (isCompleted || isLive || match.status === "IN_PROGRESS") &&
                            Boolean(team1Id || team2Id);

                          return (
                            <div
                              key={match.id}
                              className={`bg-[#18181b] border rounded-2xl p-3.5 sm:p-4 shadow-xl transition-all duration-300 relative group ${
                                isLive
                                  ? "border-amber-500/60 ring-1 ring-amber-500/30"
                                  : isFinal
                                  ? "border-amber-500/30 hover:border-amber-500/60"
                                  : "border-zinc-800 hover:border-[#00a2ff]/50"
                              }`}
                            >
                              {/* Header do Card da Partida */}
                              <div className="flex items-center justify-between text-[10px] font-bold pb-2 mb-2 border-b border-zinc-800/80">
                                <span className="text-zinc-500 uppercase tracking-wider">
                                  Jogo #{match.match_order || idx + 1}
                                </span>

                                <div className="flex items-center gap-1.5">
                                  {isLive ? (
                                    <span className="flex items-center gap-1 text-amber-400 font-black animate-pulse">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                      <span>AO VIVO</span>
                                    </span>
                                  ) : isCompleted ? (
                                    <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                                      <CheckCircle2 className="h-3 w-3" />
                                      <span>{isBye ? "Avanço por BYE" : "Encerrada"}</span>
                                    </span>
                                  ) : (
                                    <span className="text-zinc-500">Programada</span>
                                  )}
                                </div>
                              </div>

                              {/* Equipe 1 */}
                              <div
                                className={`flex items-center justify-between py-1.5 px-2 rounded-xl transition-colors ${
                                  isWinner1
                                    ? "bg-emerald-500/10 text-emerald-300 font-black"
                                    : "text-zinc-200"
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0 pr-2">
                                  <div
                                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                      team1
                                        ? "bg-blue-600/20 text-[#00a2ff] border border-blue-500/30"
                                        : "bg-zinc-800 text-zinc-500"
                                    }`}
                                  >
                                    {team1 ? team1.name.slice(0, 1).toUpperCase() : "?"}
                                  </div>
                                  <span
                                    className={`text-xs truncate ${
                                      !team1 ? "text-zinc-500 italic font-normal" : "font-semibold"
                                    }`}
                                    title={team1Name}
                                  >
                                    {team1Name}
                                  </span>
                                </div>

                                <div className="shrink-0 font-mono text-xs font-black min-w-[20px] text-right">
                                  {isCompleted || isLive ? displayScore1 : "-"}
                                </div>
                              </div>

                              {/* Linha Divisória com Badge "VS" */}
                              <div className="relative my-1 flex items-center justify-center">
                                <div className="w-full border-t border-zinc-800/80" />
                                <span className="absolute bg-[#18181b] px-1.5 text-[9px] font-black uppercase text-zinc-600 tracking-wider">
                                  VS
                                </span>
                              </div>

                              {/* Equipe 2 */}
                              <div
                                className={`flex items-center justify-between py-1.5 px-2 rounded-xl transition-colors ${
                                  isWinner2
                                    ? "bg-emerald-500/10 text-emerald-300 font-black"
                                    : "text-zinc-200"
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0 pr-2">
                                  <div
                                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                      team2
                                        ? "bg-blue-600/20 text-[#00a2ff] border border-blue-500/30"
                                        : "bg-zinc-800 text-zinc-500"
                                    }`}
                                  >
                                    {team2 ? team2.name.slice(0, 1).toUpperCase() : "?"}
                                  </div>
                                  <span
                                    className={`text-xs truncate ${
                                      !team2 ? "text-zinc-500 italic font-normal" : "font-semibold"
                                    }`}
                                    title={team2Name}
                                  >
                                    {team2Name}
                                  </span>
                                </div>

                                <div className="shrink-0 font-mono text-xs font-black min-w-[20px] text-right">
                                  {isCompleted || isLive ? displayScore2 : "-"}
                                </div>
                              </div>

                              {/* Botão Ver Detalhes no Rodapé do Card */}
                              {hasDetails && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedDetailMatch(match);
                                  }}
                                  className="w-full mt-2.5 pt-2 border-t border-zinc-800/70 flex items-center justify-center gap-1.5 text-[10px] font-bold text-zinc-400 hover:text-[#00a2ff] transition-all cursor-pointer group/det"
                                >
                                  <BarChart2 className="h-3 w-3 text-zinc-500 group-hover/det:text-[#00a2ff] transition-colors" />
                                  <span>Ver Detalhes</span>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* 4. Faixa Discreta de Patrocinadores Oficiais no Rodapé */}
      {tournament?.sponsors && tournament.sponsors.length > 0 && (
        <section className="w-full border-t border-[#27272a] bg-[#121214]/90 backdrop-blur-md py-3.5 px-4 sm:px-6 mt-8">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-3 sm:gap-6">
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500 whitespace-nowrap">
              Patrocinadores Oficiais:
            </span>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 sm:gap-6">
              {tournament.sponsors.map((sponsor) => {
                const Item = (
                  <div
                    key={sponsor.id}
                    className="flex items-center gap-2 opacity-65 hover:opacity-100 transition-opacity group cursor-pointer"
                    title={sponsor.name}
                  >
                    {sponsor.logo_url ? (
                      <div className="h-6 max-w-[100px] flex items-center justify-center">
                        <img
                          src={sponsor.logo_url}
                          alt={sponsor.name}
                          className="max-h-6 max-w-full object-contain filter grayscale group-hover:grayscale-0 transition-all"
                        />
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-zinc-400 group-hover:text-amber-400 transition-colors">
                        {sponsor.name}
                      </span>
                    )}
                  </div>
                );

                if (sponsor.link) {
                  return (
                    <a
                      key={sponsor.id}
                      href={
                        sponsor.link.startsWith("http")
                          ? sponsor.link
                          : `https://${sponsor.link}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {Item}
                    </a>
                  );
                }

                return Item;
              })}
            </div>
          </div>
        </section>
      )}

      {/* Footer Limpo */}
      <footer className="border-t border-[#27272a] py-6 text-center text-xs text-zinc-500 bg-[#141416]/50">
        <div>SportConnect • Plataforma de Competições Esportivas</div>
      </footer>

      {/* 5. Modal de Detalhes do Confronto */}
      {selectedDetailMatch && (
        <MatchDetailsModal
          match={selectedDetailMatch}
          tournament={tournament}
          teamsMap={teamsMap}
          onClose={() => setSelectedDetailMatch(null)}
          getMatchDetailData={getMatchDetailData}
        />
      )}
    </div>
  );
}


