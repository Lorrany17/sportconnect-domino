"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Trophy,
  Activity,
  Calendar,
  MapPin,
  Loader2,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  Network,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Tournament, Match, Team, SportType } from "@/types";
import { useTournament } from "@/context/TournamentContext";
import PublicHeader from "@/components/PublicHeader";
import TournamentBracket from "@/components/TournamentBracket";

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
          end_date: tourData.end_date,
          rules: tourData.rules,
          format: tourData.format,
          cover_url: tourData.cover_url,
          sponsors: tourData.sponsors || [],
        });
      }

      // Sincroniza com contexto
      context.setCurrentTournamentId(effectiveTournamentId);

      // 2. Equipes
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
        user_id: t.user_id,
      }));
      setTeams(mappedTeams);

      // 3. Partidas
      const { data: matchesData, error: matchesError } = await supabase
        .from("matches")
        .select("*")
        .eq("tournament_id", effectiveTournamentId);

      if (matchesError) throw matchesError;

      if (matchesData && matchesData.length > 0) {
        // Mapeia partidas usando dados do Supabase
        const mappedMatches: Match[] = matchesData.map((m: any) => {
          const teamA = mappedTeams.find((t) => t.id === m.team_a_id) || {
            id: m.team_a_id || "placeholder-a",
            name: m.team_a_id === "bye" ? "BYE" : "Aguardando Vencedor",
            players: [],
            createdAt: new Date().toISOString(),
          };

          const teamB = mappedTeams.find((t) => t.id === m.team_b_id) || {
            id: m.team_b_id || "placeholder-b",
            name: m.team_b_id === "bye" ? "BYE" : "Aguardando Vencedor",
            players: [],
            createdAt: new Date().toISOString(),
          };

          return {
            id: m.id,
            phase: m.phase || "Fase Eliminatória",
            status: (m.status as Match["status"]) || "SCHEDULED",
            teamA,
            teamB,
            scoreA: m.score_a || 0,
            scoreB: m.score_b || 0,
            setsA: m.sets_a || 0,
            setsB: m.sets_b || 0,
            detailedScore: { rounds: [] },
            tableNumber: m.table_number || 1,
            winnerId: m.winner_id,
            sourceMatchAId: m.source_match_a_id,
            sourceMatchBId: m.source_match_b_id,
          };
        });

        setMatches(mappedMatches);
      } else {
        // Fallback: se o contexto tiver matches em cache
        if (context.matches.length > 0) {
          setMatches(context.matches);
        } else {
          setMatches([]);
        }
      }
    } catch (err: any) {
      console.error("Erro ao carregar chaveamento no BracketViewer:", err);
      setErrorMessage(err.message || "Erro ao carregar dados do chaveamento.");
      if (context.matches.length > 0) {
        setMatches(context.matches);
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [effectiveTournamentId, context]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData();
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

  const activeMatches = matches.filter((m) => m.status === "LIVE");
  const completedMatches = matches.filter((m) => m.status === "COMPLETED");

  const sportLabel = tournament?.sport_type
    ? SPORT_LABELS[tournament.sport_type] || "Torneio Esportivo"
    : "Torneio Esportivo";

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-[#e4e4e7] flex flex-col justify-between selection:bg-[#00a2ff]/30 selection:text-white">
      <div>
        {showPublicHeader && <PublicHeader activePage="chaveamento" />}

        <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {/* Barra Superior de Navegação & Breadcrumb */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#27272a] pb-4">
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1e1e1e] hover:bg-zinc-800 border border-[#27272a] text-xs font-bold text-[#e4e4e7] hover:text-white transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <ArrowLeft className="h-4 w-4 text-[#00a2ff]" />
              <span>Voltar à Página do Torneio</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1e1e1e] hover:bg-zinc-800 border border-[#27272a] text-xs font-bold text-zinc-300 hover:text-white transition-all cursor-pointer"
                title="Atualizar placares em tempo real"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${
                    isRefreshing ? "animate-spin text-[#00a2ff]" : "text-zinc-400"
                  }`}
                />
                <span className="hidden sm:inline">Atualizar Placares</span>
              </button>

              {activeMatches.length > 0 && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>{activeMatches.length} Partidas Ao Vivo</span>
                </div>
              )}
            </div>
          </div>

          {/* Header do Torneio */}
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
                    <span className="text-xs font-bold text-emerald-400">
                      Chaveamento Oficial
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/60 text-xs font-bold text-zinc-200 hover:text-white transition-all cursor-pointer shadow-sm"
                  >
                    <span>Ver Inscrições</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Árvore de Confrontos ou Empty State */}
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
                  Chaveamento em Definição
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  As chaves e confrontos deste torneio ainda não foram gerados pelo organizador. Assim que as inscrições forem encerradas e o chaveamento for sorteado, os confrontos serão exibidos aqui em tempo real.
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
            <div className="w-full">
              <TournamentBracket
                matches={matches}
                teams={teams}
                onUpdateMatch={() => {}}
                onSwapTeams={() => {}}
                onReplaceTeam={() => {}}
                onDeclareWO={() => {}}
                isAdmin={false}
                isReadOnly={true}
              />
            </div>
          )}
        </main>
      </div>

      {/* Faixa Discreta de Patrocinadores Oficiais no Rodapé */}
      {tournament?.sponsors && tournament.sponsors.length > 0 && (
        <section className="w-full border-t border-[#27272a] bg-[#121214]/90 backdrop-blur-md py-3.5 px-4 sm:px-6">
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
                      href={sponsor.link.startsWith("http") ? sponsor.link : `https://${sponsor.link}`}
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
      <footer className="border-t border-[#27272a] py-6 text-center text-xs text-zinc-500">
        <div>SportConnect • Plataforma de Gestão Esportiva</div>
      </footer>
    </div>
  );
}
