"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Trophy,
  ShieldCheck,
  MapPin,
  Mail,
  Phone,
  Pencil,
  Sparkles,
  Flame,
  Crown,
  CheckCircle2,
  Award,
  Users,
  ChevronRight,
  ArrowLeft,
  Zap,
  Shield,
  Calendar,
  Lock,
  Share2,
  Check,
  Loader2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import PublicHeader from "@/components/PublicHeader";
import { useAuth } from "@/context/AuthProvider";
import { supabase } from "@/lib/supabase";
import { Profile, Team, SportType } from "@/types";
import {
  formatSportLabel,
  getAthleteRankTitle,
  SPORT_EMOJIS,
  DEFAULT_AVATAR,
  formatPhoneBR,
  InstagramIcon,
  TikTokIcon,
  getSocialLink,
  getSocialDisplayHandle,
} from "@/app/perfil/page";

// Conquistas Base do Atleta
const ACHIEVEMENTS = [
  {
    id: "mvp",
    title: "MVP da Temporada",
    description: "Eleito melhor atleta em 3 campeonatos oficiais",
    icon: Trophy,
    color: "from-amber-400 to-yellow-500",
    bg: "bg-amber-500/10 border-amber-500/30 text-amber-400",
    date: "Out 2026",
    unlocked: false,
  },
  {
    id: "striker",
    title: "Mestre do Ponto",
    description: "Mais de 100 pontos marcados em súmulas oficiais",
    icon: Flame,
    color: "from-orange-400 to-red-500",
    bg: "bg-orange-500/10 border-orange-500/30 text-orange-400",
    date: "Set 2026",
    unlocked: false,
  },
  {
    id: "carroca",
    title: "Carroça de Ouro",
    description: "Fechamento duplo invicto em 5 partidas seguidas",
    icon: Sparkles,
    color: "from-yellow-400 to-amber-600",
    bg: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
    date: "Ago 2026",
    unlocked: false,
  },
  {
    id: "defense",
    title: "Muralha Defensiva",
    description: "Melhor saldo de sets em fases de mata-mata",
    icon: Shield,
    color: "from-blue-400 to-indigo-500",
    bg: "bg-blue-500/10 border-blue-500/30 text-blue-400",
    date: "Jul 2026",
    unlocked: false,
  },
  {
    id: "champion",
    title: "Rei da Arena",
    description: "Campeão invicto na divisão principal SportConnect",
    icon: Crown,
    color: "from-purple-400 to-pink-500",
    bg: "bg-purple-500/10 border-purple-500/30 text-purple-400",
    date: "Jun 2026",
    unlocked: false,
  },
  {
    id: "verified",
    title: "Atleta Verificado",
    description: "Documentação e histórico esportivo aprovados",
    icon: CheckCircle2,
    color: "from-emerald-400 to-teal-500",
    bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
    date: "2026",
    unlocked: false,
  },
];

export interface AthleteTeam extends Team {
  tournamentName?: string;
  sportType?: SportType | string;
}

export interface AthleteMatch {
  id: string;
  tournamentId?: string;
  tournamentName: string;
  sportType?: SportType | string;
  phase: string;
  scoreDisplay: string;
  userScore: number;
  opponentScore: number;
  userTeamSide: "A" | "B";
  userTeamName: string;
  opponentName: string;
  result: "WIN" | "LOSS" | "DRAW";
  date: string;
}

export default function PublicAthleteProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const athleteId = (params?.id as string) || "";

  // Estados do perfil público
  const [loading, setLoading] = useState(true);
  const [athleteProfile, setAthleteProfile] = useState<Profile | null>(null);
  const [userTeams, setUserTeams] = useState<AthleteTeam[]>([]);
  const [recentMatches, setRecentMatches] = useState<AthleteMatch[]>([]);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Verificação de Propriedade: apenas o dono pode editar
  const isOwner = Boolean(user && user.id === athleteId);

  // 1. Fetch de Dados do Atleta baseado em params.id
  useEffect(() => {
    let mounted = true;

    async function loadAthletePublicData() {
      if (!athleteId) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // A. Fetch do Perfil na tabela profiles
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", athleteId)
          .maybeSingle();

        if (profileError) {
          console.warn("Aviso ao carregar perfil público do atleta:", profileError);
        }

        if (mounted) {
          setAthleteProfile(profileData || null);
        }

        // B. Fetch de Status de Organizador (se o atleta possui torneios cadastrados)
        const { data: orgData } = await supabase
          .from("tournaments")
          .select("id")
          .eq("owner_id", athleteId)
          .limit(1);

        if (mounted) {
          setIsOrganizer(Boolean(orgData && orgData.length > 0));
        }

        // C. Fetch de Times do Atleta via team_members (com fallback para teams onde user_id = athleteId)
        const { data: memberRows, error: memberError } = await supabase
          .from("team_members")
          .select("team_id, teams(*, tournaments(name, sport_type))")
          .eq("user_id", athleteId);

        if (memberError) {
          console.warn("Aviso ao carregar team_members do atleta:", memberError);
        }

        const teamsMap: Record<string, any> = {};

        (memberRows || []).forEach((row: any) => {
          const t = Array.isArray(row.teams) ? row.teams[0] : row.teams;
          if (t && t.id) {
            teamsMap[t.id] = t;
          }
        });

        const { data: directTeams } = await supabase
          .from("teams")
          .select("*, tournaments(name, sport_type)")
          .eq("user_id", athleteId)
          .order("created_at", { ascending: false });

        (directTeams || []).forEach((t: any) => {
          if (t && t.id && !teamsMap[t.id]) {
            teamsMap[t.id] = t;
          }
        });

        const rawTeams = Object.values(teamsMap).sort((a: any, b: any) => {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateB - dateA;
        });

        // Fallback para buscar torneios caso a junção direta não tenha preenchido
        const missingTournIds = rawTeams
          .filter(
            (t: any) =>
              (!t.tournaments ||
                (Array.isArray(t.tournaments) && t.tournaments.length === 0)) &&
              t.tournament_id
          )
          .map((t: any) => t.tournament_id);

        const fallbackTournMap: Record<string, any> = {};
        if (missingTournIds.length > 0) {
          const { data: fbData } = await supabase
            .from("tournaments")
            .select("id, name, sport_type")
            .in("id", missingTournIds);

          if (fbData) {
            fbData.forEach((fb: any) => {
              fallbackTournMap[fb.id] = fb;
            });
          }
        }

        const mappedTeams: AthleteTeam[] = rawTeams.map((dbT: any) => {
          const rawTourn = Array.isArray(dbT.tournaments)
            ? dbT.tournaments[0]
            : dbT.tournaments;
          const finalTourn = rawTourn || fallbackTournMap[dbT.tournament_id] || null;

          return {
            id: dbT.id,
            name: dbT.name,
            players: [dbT.player1, dbT.player2].filter(Boolean),
            roster: dbT.roster,
            createdAt: dbT.created_at || new Date().toISOString(),
            status: dbT.status,
            tournamentId: dbT.tournament_id,
            tournamentName: finalTourn?.name || "Torneio Oficial",
            sportType: finalTourn?.sport_type || "DOMINO",
            payment_status: dbT.payment_status,
            manager_name: dbT.manager_name || dbT.player1,
            category: dbT.category || "Geral",
            user_id: dbT.user_id,
          };
        });

        if (mounted) {
          setUserTeams(mappedTeams);
        }

        // D. Fetch do Histórico Recente de Partidas
        const userTeamIds = rawTeams.map((t: any) => t.id).filter(Boolean);

        if (userTeamIds.length === 0) {
          if (mounted) setRecentMatches([]);
          return;
        }

        const teamsNameMap: Record<string, string> = {};
        rawTeams.forEach((t: any) => {
          teamsNameMap[t.id] = t.name;
        });

        const tournamentsMap: Record<string, any> = { ...fallbackTournMap };
        rawTeams.forEach((t: any) => {
          if (t.tournament_id) {
            const rawTourn = Array.isArray(t.tournaments) ? t.tournaments[0] : t.tournaments;
            if (rawTourn) tournamentsMap[t.tournament_id] = rawTourn;
          }
        });

        let matchesRaw: any[] = [];
        try {
          const userTeamIdsFilter = userTeamIds.join(",");
          const { data: matchesData, error: matchesError } = await supabase
            .from("matches")
            .select("*")
            .or(`team_a_id.in.(${userTeamIdsFilter}),team_b_id.in.(${userTeamIdsFilter})`)
            .order("created_at", { ascending: false })
            .limit(5);

          if (matchesError) {
            if (matchesError.code === "42703" || matchesError.message?.includes("created_at")) {
              const { data: fbMatches } = await supabase
                .from("matches")
                .select("*")
                .or(`team_a_id.in.(${userTeamIdsFilter}),team_b_id.in.(${userTeamIdsFilter})`)
                .limit(5);
              if (fbMatches) matchesRaw = fbMatches;
            }
          } else if (matchesData) {
            matchesRaw = matchesData;
          }
        } catch (err) {
          console.warn("Exceção ao buscar partidas do atleta:", err);
        }

        if (matchesRaw.length > 0) {
          const missingOpponentTeamIds = matchesRaw
            .flatMap((m: any) => [m.team_a_id, m.team_b_id])
            .filter((tid: any) => tid && !teamsNameMap[tid] && tid !== "bye");

          if (missingOpponentTeamIds.length > 0) {
            const { data: oppTeams } = await supabase
              .from("teams")
              .select("id, name")
              .in("id", missingOpponentTeamIds);

            if (oppTeams) {
              oppTeams.forEach((ot: any) => {
                teamsNameMap[ot.id] = ot.name;
              });
            }
          }

          const missingMatchTournIds = matchesRaw
            .map((m: any) => m.tournament_id)
            .filter((mtid: any) => mtid && !tournamentsMap[mtid]);

          if (missingMatchTournIds.length > 0) {
            const { data: mtData } = await supabase
              .from("tournaments")
              .select("id, name, sport_type")
              .in("id", missingMatchTournIds);

            if (mtData) {
              mtData.forEach((mt: any) => {
                tournamentsMap[mt.id] = mt;
              });
            }
          }

          const mappedMatches: AthleteMatch[] = matchesRaw.map((m: any) => {
            const isTeamA = userTeamIds.includes(m.team_a_id);
            const userSide: "A" | "B" = isTeamA ? "A" : "B";

            const userTeamName = isTeamA
              ? teamsNameMap[m.team_a_id] || "Seu Time"
              : teamsNameMap[m.team_b_id] || "Seu Time";

            const oppTeamId = isTeamA ? m.team_b_id : m.team_a_id;
            const oppTeamName =
              oppTeamId === "bye"
                ? "BYE"
                : teamsNameMap[oppTeamId] || "Adversário";

            const scoreA = Number(m.score_a) || 0;
            const scoreB = Number(m.score_b) || 0;

            const userScore = userSide === "A" ? scoreA : scoreB;
            const oppScore = userSide === "A" ? scoreB : scoreA;

            let result: "WIN" | "LOSS" | "DRAW" = "DRAW";
            if (userScore > oppScore) {
              result = "WIN";
            } else if (userScore < oppScore) {
              result = "LOSS";
            } else {
              result = "DRAW";
            }

            const tourn = tournamentsMap[m.tournament_id];
            const tournamentName = tourn?.name || "Torneio Oficial";
            const sportType = tourn?.sport_type;

            let formattedDate = "Recente";
            if (m.created_at) {
              try {
                formattedDate = new Date(m.created_at).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                });
              } catch {
                formattedDate = "Recente";
              }
            }

            return {
              id: m.id,
              tournamentId: m.tournament_id,
              tournamentName,
              sportType,
              phase: m.phase || "Fase Eliminatória",
              scoreDisplay: `${scoreA} x ${scoreB}`,
              userScore,
              opponentScore: oppScore,
              userTeamSide: userSide,
              userTeamName,
              opponentName: oppTeamName,
              result,
              date: formattedDate,
            };
          });

          if (mounted) {
            setRecentMatches(mappedMatches);
          }
        } else {
          if (mounted) setRecentMatches([]);
        }
      } catch (err) {
        console.warn("Aviso ao carregar perfil público:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadAthletePublicData();

    return () => {
      mounted = false;
    };
  }, [athleteId]);

  // Gamificação: Nível & XP
  const xpData = useMemo(() => {
    const teamsCount = userTeams.length;
    const matchesCount = recentMatches.length;

    const xpFromTeams = teamsCount * 50;
    const xpFromMatches = matchesCount * 20;
    const totalXP = xpFromTeams + xpFromMatches;

    const currentLevel = Math.floor(totalXP / 100) + 1;
    const progressPercentage = totalXP % 100;
    const xpForNextLevel = 100 - (totalXP % 100);

    return {
      totalXP,
      xpFromTeams,
      xpFromMatches,
      currentLevel,
      progressPercentage,
      xpForNextLevel,
    };
  }, [userTeams.length, recentMatches.length]);

  // Estatísticas do Atleta
  const athleteStats = useMemo(() => {
    const tournamentsCount = userTeams.length;
    const winsCount = recentMatches.filter((m) => m.result === "WIN").length;
    const totalMatches = recentMatches.length;
    const winRate = totalMatches > 0 ? Math.round((winsCount / totalMatches) * 100) : 0;

    let streak = 0;
    for (const m of recentMatches) {
      if (m.result === "WIN") {
        streak++;
      } else {
        break;
      }
    }

    return {
      tournamentsCount,
      winsCount,
      winRate,
      streak,
    };
  }, [userTeams, recentMatches]);

  // Conquistas com emblema de organizador
  const achievements = useMemo(() => {
    const architectBadge = {
      id: "architect",
      title: "Arquiteto de Arenas",
      description: "Organizou pelo menos um campeonato oficial no SportConnect.",
      icon: Crown,
      color: "from-purple-500 to-indigo-600",
      bg: isOrganizer
        ? "bg-purple-500/20 border-purple-500/50 text-purple-300 shadow-purple-500/20 shadow-md"
        : "bg-purple-500/10 border-purple-500/30 text-purple-400",
      date: isOrganizer ? "Organizador" : "",
      unlocked: isOrganizer,
    };

    return [architectBadge, ...ACHIEVEMENTS];
  }, [isOrganizer]);

  const unlockedAchievementsCount = useMemo(() => {
    return achievements.filter((a) => a.unlocked).length;
  }, [achievements]);

  // Ação de Compartilhar Link Público do Perfil
  const handleShareProfile = async () => {
    if (typeof window !== "undefined") {
      try {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(window.location.href);
          setCopiedLink(true);
          setTimeout(() => setCopiedLink(false), 3000);
        }
      } catch (err) {
        console.warn("Aviso ao copiar link do perfil:", err);
      }
    }
  };

  // Carregando estado
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] text-[#e4e4e7] flex flex-col selection:bg-amber-500/30">
        <PublicHeader />
        <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-4">
          <Loader2 className="h-10 w-10 text-amber-400 animate-spin" />
          <p className="text-xs font-black uppercase tracking-wider text-zinc-400">
            Carregando Perfil do Atleta...
          </p>
        </div>
      </div>
    );
  }

  // Atleta não encontrado
  if (!athleteProfile && userTeams.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] text-[#e4e4e7] flex flex-col selection:bg-amber-500/30">
        <PublicHeader />
        <div className="flex-1 max-w-md w-full mx-auto px-4 flex flex-col items-center justify-center text-center p-6 space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-lg">
            <AlertCircle className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-white font-display uppercase tracking-tight">
              Atleta Não Encontrado
            </h1>
            <p className="text-xs text-zinc-400">
              O perfil que está a tentar visualizar não existe ou foi desativado.
            </p>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2.5 rounded-xl border border-[#27272a] text-xs font-bold text-zinc-300 hover:text-white transition-all cursor-pointer"
            >
              Voltar
            </button>
            <Link
              href="/explorar"
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-amber-500/20"
            >
              Explorar Torneios
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const displayName = athleteProfile?.full_name || "Atleta";
  const displayAvatar = athleteProfile?.avatar_url || DEFAULT_AVATAR;
  const displayLocation = athleteProfile?.location || "Picos, PI";
  const displayBio = athleteProfile?.bio || "";
  const displayFavoriteSport =
    athleteProfile?.favorite_sport && athleteProfile.favorite_sport !== "Nenhum"
      ? athleteProfile.favorite_sport
      : null;

  const isProVerified = Boolean(
    athleteProfile?.is_admin || (userTeams && userTeams.length >= 10)
  );

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-[#e4e4e7] flex flex-col selection:bg-amber-500/30 selection:text-white">
      {/* Cabeçalho Público */}
      <PublicHeader />

      {/* Toast de Link Copiado */}
      {copiedLink && (
        <div className="fixed top-24 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-bold animate-fadeIn border border-emerald-400/40">
          <CheckCircle2 className="h-4 w-4" />
          <span>Link do perfil público copiado!</span>
        </div>
      )}

      {/* Sub-barra com Botão Voltar */}
      <div className="w-full border-b border-[#27272a] bg-[#141416]/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1e1e1e] hover:bg-zinc-800 border border-[#27272a] text-xs font-bold text-[#e4e4e7] hover:text-white transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <ArrowLeft className="h-4 w-4 text-amber-400" />
            <span>Voltar</span>
          </button>
        </div>
      </div>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8 animate-fadeIn">
        {/* ========================================================= */}
        {/* 1. HEADER DO PERFIL PÚBLICO GAMIFICADO */}
        {/* ========================================================= */}
        <section className="relative rounded-3xl bg-gradient-to-br from-[#18181b] via-[#121214] to-[#0c0c0e] border border-[#27272a] p-6 sm:p-8 overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            {/* Lado Esquerdo: Avatar + Nome + Badges */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start md:items-center gap-5 text-center sm:text-left">
              {/* Foto em Destaque */}
              <div className="relative group shrink-0">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-[#1e1e24] p-1 border-2 border-amber-400/60 shadow-xl shadow-amber-500/10 overflow-hidden relative flex items-center justify-center">
                  {displayAvatar &&
                  !displayAvatar.startsWith("http") &&
                  !displayAvatar.startsWith("data:") ? (
                    <div className="w-full h-full rounded-2xl bg-gradient-to-br from-[#24242c] via-[#1a1a20] to-amber-950/20 flex items-center justify-center select-none shadow-inner">
                      <span className="text-5xl sm:text-6xl">{displayAvatar}</span>
                    </div>
                  ) : (
                    <img
                      src={displayAvatar}
                      alt={displayName}
                      className="w-full h-full object-cover rounded-2xl"
                    />
                  )}
                </div>

                {/* Badge Nível */}
                <div
                  className="absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-black text-[11px] uppercase tracking-wider shadow-lg border border-black/40 flex items-center gap-1 font-display"
                  title="Nível de Atleta na Plataforma"
                >
                  <Zap className="h-3 w-3 fill-current text-black" />
                  <span>NV. {xpData.currentLevel}</span>
                </div>
              </div>

              {/* Detalhes do Atleta */}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                  <h1 className="text-2xl sm:text-3xl font-black text-white font-display tracking-tight">
                    {displayName}
                  </h1>

                  {/* Badge PRO VERIFICADO */}
                  {isProVerified && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-[11px] font-black uppercase tracking-wider shadow-sm">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                      <span>PRO VERIFICADO</span>
                    </span>
                  )}

                  {/* Badge Esporte Favorito */}
                  {displayFavoriteSport && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/40 text-blue-300 text-[11px] font-black uppercase tracking-wider shadow-sm">
                      <span>{SPORT_EMOJIS[displayFavoriteSport] || "🏅"}</span>
                      <span>{displayFavoriteSport}</span>
                    </span>
                  )}
                </div>

                {/* Localização & Contatos (Privacidade respeitada) */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-zinc-400">
                  <span className="flex items-center gap-1 font-medium">
                    <MapPin className="h-3.5 w-3.5 text-orange-400" />
                    <span>{displayLocation}</span>
                  </span>

                  {/* Apenas exibe email ou telefone se o utilizador for o dono */}
                  {isOwner && user?.email && (
                    <>
                      <span className="text-zinc-600 hidden sm:inline">•</span>
                      <span className="flex items-center gap-1 font-medium">
                        <Mail className="h-3.5 w-3.5 text-zinc-400" />
                        <span>{user.email}</span>
                      </span>
                    </>
                  )}

                  {athleteProfile?.phone && (isOwner || athleteProfile.show_phone !== false) && (
                    <>
                      <span className="text-zinc-600 hidden sm:inline">•</span>
                      <span className="flex items-center gap-1.5 font-medium">
                        <Phone className="h-3.5 w-3.5 text-emerald-400" />
                        <span>{formatPhoneBR(athleteProfile.phone)}</span>
                        {isOwner && athleteProfile.show_phone === false && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-zinc-800/90 border border-zinc-700/80 text-[10px] font-semibold text-zinc-400 select-none"
                            title="Este telefone está oculto para outros atletas no perfil público"
                          >
                            <Lock className="h-2.5 w-2.5 text-amber-400" />
                            <span>Privado</span>
                          </span>
                        )}
                      </span>
                    </>
                  )}
                </div>

                {/* Bio curta (sem fallback artificial) */}
                {displayBio && (
                  <p className="text-xs text-zinc-300 max-w-xl leading-relaxed pt-1">
                    {displayBio}
                  </p>
                )}

                {/* Redes Sociais do Atleta (Instagram & TikTok) */}
                {(athleteProfile?.instagram || athleteProfile?.tiktok) && (
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-2">
                    {athleteProfile?.instagram && (
                      <a
                        href={getSocialLink(athleteProfile.instagram, "instagram")}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-amber-500/10 hover:from-pink-500/20 hover:via-purple-500/20 hover:to-amber-500/20 border border-pink-500/30 hover:border-pink-500/60 text-xs font-bold text-pink-300 hover:text-white transition-all shadow-sm group cursor-pointer"
                        title={`Instagram: ${athleteProfile.instagram}`}
                      >
                        <InstagramIcon className="h-3.5 w-3.5 text-pink-400 group-hover:scale-110 transition-transform" />
                        <span>{getSocialDisplayHandle(athleteProfile.instagram)}</span>
                      </a>
                    )}

                    {athleteProfile?.tiktok && (
                      <a
                        href={getSocialLink(athleteProfile.tiktok, "tiktok")}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/80 hover:border-cyan-400/50 text-xs font-bold text-zinc-200 hover:text-white transition-all shadow-sm group cursor-pointer"
                        title={`TikTok: ${athleteProfile.tiktok}`}
                      >
                        <TikTokIcon className="h-3.5 w-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
                        <span>{getSocialDisplayHandle(athleteProfile.tiktok)}</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Lado Direito: Ações */}
            <div className="flex items-center justify-center sm:justify-end shrink-0 gap-2">
              {/* Se for o dono do perfil, exibe botão para Editar Perfil */}
              {isOwner ? (
                <Link
                  href="/perfil"
                  className="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 active:scale-95 flex items-center gap-2 cursor-pointer"
                >
                  <Pencil className="h-4 w-4" />
                  <span>Editar Meu Perfil</span>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={handleShareProfile}
                  className="px-4 py-3 rounded-2xl bg-[#1e1e24] hover:bg-zinc-800 border border-[#27272a] text-xs font-bold text-zinc-200 hover:text-white transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer"
                >
                  <Share2 className="h-4 w-4 text-amber-400" />
                  <span>Compartilhar</span>
                </button>
              )}
            </div>
          </div>

          {/* ========================================================= */}
          {/* BARRA DE PROGRESSO & XP (GAMIFICAÇÃO) */}
          {/* ========================================================= */}
          <div className="mt-8 pt-6 border-t border-[#27272a]/70 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-black text-amber-400 uppercase tracking-wider flex items-center gap-1">
                  <Award className="h-4 w-4 text-amber-400" />
                  <span>Nível {xpData.currentLevel} • {getAthleteRankTitle(xpData.currentLevel)}</span>
                </span>
                <span className="text-[11px] text-zinc-500 font-bold hidden sm:inline">
                  (Temporada 2026)
                </span>
              </div>

              <div className="text-xs text-zinc-400 font-mono">
                <span className="text-amber-300 font-bold">{xpData.totalXP}</span> /{" "}
                {xpData.currentLevel * 100} XP{" "}
                <span className="text-zinc-500">
                  ({Math.round(xpData.progressPercentage)}%)
                </span>
              </div>
            </div>

            {/* Barra Glow Amarela de XP */}
            <div className="w-full h-3.5 bg-zinc-900/90 rounded-full border border-zinc-800 p-0.5 overflow-hidden shadow-inner relative">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-400 shadow-md shadow-amber-500/40 transition-all duration-700"
                style={{
                  width: `${Math.min(100, Math.max(xpData.progressPercentage, xpData.totalXP > 0 ? 5 : 0))}%`,
                }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-zinc-500">
              <span>⚡ +50 XP por time inscrito • +20 XP por partida jogada</span>
              <span>Faltam {xpData.xpForNextLevel} XP para o Nível {xpData.currentLevel + 1}</span>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* STATS RÁPIDAS DO ATLETA (KPIs) */}
        {/* ========================================================= */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-[#121214] border border-[#27272a] space-y-1 shadow-md">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">
              Times Inscritos
            </span>
            <div className="text-2xl font-black text-white font-display">
              {athleteStats.tournamentsCount}
            </div>
            <span className="text-[10px] text-zinc-500 block">Equipes vinculadas</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#121214] border border-[#27272a] space-y-1 shadow-md">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">
              Títulos & Vitórias
            </span>
            <div className="text-2xl font-black text-amber-400 font-display">
              {athleteStats.winsCount}
            </div>
            <span className="text-[10px] text-amber-400/70 block">
              {athleteStats.winsCount === 1 ? "1 Vitória registrada" : `${athleteStats.winsCount} Vitórias registradas`}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-[#121214] border border-[#27272a] space-y-1 shadow-md">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">
              Taxa de Vitória
            </span>
            <div className="text-2xl font-black text-emerald-400 font-display">
              {athleteStats.winRate}%
            </div>
            <span className="text-[10px] text-emerald-400/70 block">
              {recentMatches.length > 0 ? "Aproveitamento geral" : "Sem partidas"}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-[#121214] border border-[#27272a] space-y-1 shadow-md">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">
              Sequência Atual
            </span>
            <div className="text-2xl font-black text-orange-400 font-display">
              {athleteStats.streak > 0 ? `🔥 ${athleteStats.streak}W` : "0W"}
            </div>
            <span className="text-[10px] text-orange-400/70 block">
              {athleteStats.streak > 0 ? "Vitórias consecutivas" : "Inicie uma sequência"}
            </span>
          </div>
        </div>

        {/* ========================================================= */}
        {/* SEÇÕES INFERIORES: Conquistas, Histórico e Times */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Conquistas e Histórico (2 Colunas) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-200 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-400" />
                <span>Conquistas e Emblemas ({achievements.length})</span>
              </h3>
              <span
                className={`text-[11px] font-bold flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
                  unlockedAchievementsCount > 0
                    ? "text-emerald-400 bg-emerald-500/15 border-emerald-500/35"
                    : "text-zinc-500 bg-zinc-900/80 border-zinc-800"
                }`}
              >
                {unlockedAchievementsCount > 0 ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    <span>
                      {unlockedAchievementsCount}{" "}
                      {unlockedAchievementsCount === 1 ? "Desbloqueada" : "Desbloqueadas"}
                    </span>
                  </>
                ) : (
                  <>
                    <Lock className="h-3 w-3 text-zinc-500" />
                    <span>0 Desbloqueadas</span>
                  </>
                )}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {achievements.map((ach) => {
                const Icon = ach.icon;
                const isUnlocked = ach.unlocked;

                return (
                  <div
                    key={ach.id}
                    className={`p-4 rounded-2xl bg-[#121214] border transition-all flex items-start gap-3.5 shadow-md group ${
                      isUnlocked
                        ? "border-purple-500/40 bg-gradient-to-br from-[#16161a] via-[#121214] to-purple-950/20 hover:border-purple-400/60 shadow-lg shadow-purple-500/5 opacity-100"
                        : "border-[#27272a] opacity-50 grayscale hover:grayscale-0 hover:opacity-75"
                    }`}
                  >
                    <div
                      className={`w-11 h-11 rounded-2xl ${ach.bg} border flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4
                          className={`text-xs font-bold transition-colors truncate ${
                            isUnlocked
                              ? "text-white group-hover:text-purple-300"
                              : "text-white group-hover:text-amber-300"
                          }`}
                        >
                          {ach.title}
                        </h4>
                        {isUnlocked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase tracking-wider shrink-0 shadow-sm">
                            <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />
                            <span>Desbloqueado</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500 font-bold shrink-0">
                            <Lock className="h-2.5 w-2.5" />
                            <span>Bloqueado</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-tight">
                        {ach.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Histórico Recente de Partidas */}
            <div className="pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-200 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#00a2ff]" />
                  <span>Histórico Recente de Partidas ({recentMatches.length})</span>
                </h3>
                <span className="text-[11px] text-zinc-500">Últimos confrontos</span>
              </div>

              {recentMatches.length === 0 ? (
                <div className="p-6 rounded-2xl bg-[#121214] border border-dashed border-[#27272a] text-center space-y-2">
                  <Calendar className="h-8 w-8 text-zinc-600 mx-auto" />
                  <p className="text-xs font-bold text-zinc-400">Nenhuma partida registrada ainda</p>
                  <p className="text-[11px] text-zinc-600">
                    As partidas oficiais e resultados de súmula deste atleta aparecerão aqui automaticamente.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {recentMatches.map((m) => {
                    const isWin = m.result === "WIN";
                    const isLoss = m.result === "LOSS";

                    const badgeClass = isWin
                      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                      : isLoss
                      ? "text-red-400 bg-red-500/10 border-red-500/30"
                      : "text-zinc-400 bg-zinc-500/10 border-zinc-500/30";

                    const badgeText = isWin
                      ? "Vitória 🏆"
                      : isLoss
                      ? "Derrota ❌"
                      : "Empate ⚖️";

                    return (
                      <div
                        key={m.id}
                        className="p-3.5 rounded-2xl bg-[#121214] border border-[#27272a] flex items-center justify-between gap-4 shadow-sm hover:border-zinc-700 transition-all"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <span className="text-xs font-bold text-white block truncate">
                            {m.tournamentName}
                          </span>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                            <span className="text-[#00a2ff] font-semibold">{m.phase}</span>
                            <span>•</span>
                            <span className="text-zinc-300 truncate">vs {m.opponentName}</span>
                            {m.sportType && (
                              <>
                                <span className="text-zinc-600">•</span>
                                <span className="text-zinc-400 font-medium">
                                  {formatSportLabel(m.sportType)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <span className="text-sm font-black text-white font-mono block">
                              {m.scoreDisplay}
                            </span>
                            <span
                              className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border inline-block ${badgeClass}`}
                            >
                              {badgeText}
                            </span>
                          </div>
                          <span className="text-[10px] text-zinc-500 hidden sm:inline">
                            {m.date}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Times Atuais (1 Coluna) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-200 flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-400" />
                <span>Times e Inscrições ({userTeams.length})</span>
              </h3>
              {isOwner ? (
                <Link
                  href="/explorar"
                  className="text-[11px] text-[#00a2ff] hover:underline font-bold"
                >
                  Inscrever-se
                </Link>
              ) : (
                <Link
                  href="/explorar"
                  className="text-[11px] text-[#00a2ff] hover:underline font-bold"
                >
                  Ver Torneios
                </Link>
              )}
            </div>

            {userTeams.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#121214] border border-dashed border-[#27272a] text-center space-y-2">
                <Users className="h-8 w-8 text-zinc-600 mx-auto" />
                <p className="text-xs font-bold text-zinc-400">
                  Nenhum time inscrito no momento.
                </p>
                <p className="text-[11px] text-zinc-600">
                  Os campeonatos e equipes onde o atleta está registrado serão exibidos aqui.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {userTeams.map((team) => (
                  <div
                    key={team.id}
                    className="p-4 rounded-2xl bg-[#121214] border border-[#27272a] space-y-2.5 hover:border-zinc-700 transition-all shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <h4 className="text-xs font-black text-white">{team.name}</h4>
                        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                          <Trophy className="h-3 w-3 text-amber-400 shrink-0" />
                          <span className="font-semibold text-zinc-300">
                            {team.tournamentName || "Torneio"}
                          </span>
                          {team.sportType && (
                            <>
                              <span className="text-zinc-600">•</span>
                              <span className="text-[#00a2ff] font-medium">
                                {formatSportLabel(team.sportType)}
                              </span>
                            </>
                          )}
                        </div>
                        {team.category && (
                          <span className="text-[10px] text-zinc-500 block">
                            Categoria: {team.category}
                          </span>
                        )}
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[10px] font-black uppercase tracking-wider shrink-0">
                        {team.status || "Ativo"}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-[#27272a]/60 flex items-center justify-between text-[11px] text-zinc-500">
                      <span>
                        {team.players?.[0] && `Capitão: ${team.players[0]}`}
                      </span>
                      {team.tournamentId && (
                        <Link
                          href={`/torneio/${team.tournamentId}`}
                          className="text-[#00a2ff] hover:underline flex items-center gap-0.5 font-medium"
                        >
                          <span>Ver Torneio</span>
                          <ChevronRight className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
