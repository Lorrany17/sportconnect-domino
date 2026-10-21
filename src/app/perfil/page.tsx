"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Trophy,
  ShieldCheck,
  MapPin,
  Phone,
  Mail,
  Pencil,
  Camera,
  UploadCloud,
  Link as LinkIcon,
  Sparkles,
  Flame,
  Target,
  Crown,
  CheckCircle2,
  Award,
  Users,
  ChevronRight,
  X,
  Loader2,
  ArrowLeft,
  Star,
  Zap,
  Shield,
  ImageIcon,
  Check,
  Calendar,
  Layers,
  Lock,
} from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import PublicHeader from "@/components/PublicHeader";
import { useAuth } from "@/context/AuthProvider";
import { supabase } from "@/lib/supabase";
import { Profile, Team, SportType } from "@/types";

// Avatares em Emoji (esportivos e animais nativos)
export const EMOJI_AVATARS = [
  "🦁",
  "🦊",
  "🦅",
  "🦈",
  "🦍",
  "🐉",
  "⚽",
  "🏓",
  "🎮",
  "🁓",
  "🏐",
  "🔥",
  "👑",
  "⚡",
  "🏆",
  "🎯",
  "🥊",
  "🥋",
];
export const DEFAULT_AVATAR = "🦁";
export const SYSTEM_AVATARS = EMOJI_AVATARS;

// Conquistas do Atleta (Bloqueadas para contas novas até atingir metas)
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

// Tipos para dados enriquecidos do Atleta
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

// Formatador amigável da modalidade esportiva
export const formatSportLabel = (type?: string) => {
  if (!type) return "Modalidade";
  switch (type.toUpperCase()) {
    case "DOMINO":
      return "Dominó";
    case "PING_PONG":
      return "Ping Pong";
    case "FUTSAL":
      return "Futsal";
    case "VOLEI":
      return "Vôlei";
    default:
      return type;
  }
};

// Título baseado no Nível gamificado
export const getAthleteRankTitle = (level: number) => {
  if (level >= 10) return "Lenda da Arena";
  if (level >= 7) return "Atleta Veterano";
  if (level >= 4) return "Atleta Competidor";
  if (level >= 2) return "Atleta Aspirante";
  return "Atleta Iniciante";
};

// Emojis temáticos dos esportes
export const SPORT_EMOJIS: Record<string, string> = {
  "Ping Pong": "🏓",
  "Dominó": "🁓",
  "Futsal": "⚽",
  "Vôlei": "🏐",
};

export default function PerfilPage() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [userTeams, setUserTeams] = useState<AthleteTeam[]>([]);
  const [recentMatches, setRecentMatches] = useState<AthleteMatch[]>([]);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Estados do Formulário de Edição
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formBio, setFormBio] = useState("");
  const [formFavoriteSport, setFormFavoriteSport] = useState("Nenhum");
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState("");
  const [avatarTab, setAvatarTab] = useState<"upload" | "url" | "presets">("upload");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [customUrlInput, setCustomUrlInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // =========================================================================
  // 3. MOTOR BÁSICO DE NÍVEL E XP (GAMIFICAÇÃO)
  // Regra: 50 XP por cada equipa/torneio inscrito + 20 XP por cada partida jogada
  // Nível atual = Math.floor(totalXP / 100) + 1
  // Progresso = (totalXP % 100) / 100 * 100
  // =========================================================================
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

  // Estatísticas do Atleta calculadas a partir dos dados reais do Supabase
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

  // Conquistas com injeção do troféu dinâmico "Arquiteto de Arenas" na 1ª posição
  const achievements = useMemo(() => {
    const architectBadge = {
      id: "architect",
      title: "Arquiteto de Arenas",
      description: "Organizaste o teu primeiro campeonato oficial no SportConnect.",
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

  // =========================================================================
  // 1 & 2. FETCH DINÂMICO DE TIMES ATUAIS E HISTÓRICO DE PARTIDAS
  // =========================================================================
  useEffect(() => {
    let mounted = true;

    async function loadAthleteData() {
      if (!user) return;

      try {
        setLoading(true);

        // Fetch do Status de Administrador da tabela profiles
        const { data: profileData } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", user.id)
          .maybeSingle();

        if (mounted && profileData) {
          setIsAdmin(Boolean(profileData.is_admin));
        } else if (mounted && profile?.is_admin !== undefined) {
          setIsAdmin(Boolean(profile.is_admin));
        }

        // Fetch de Status de Organizador (verifica se o utilizador é dono de algum torneio)
        const { data: orgData } = await supabase
          .from("tournaments")
          .select("id")
          .eq("owner_id", user.id)
          .limit(1);

        if (mounted) {
          setIsOrganizer(Boolean(orgData && orgData.length > 0));
        }

        // 1. Fetch Dinâmico de "Times Atuais"
        // Query à tabela teams onde user_id = user.id, trazendo junto tournaments(name, sport_type)
        const { data: teamsData, error: teamsError } = await supabase
          .from("teams")
          .select("*, tournaments(name, sport_type)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (teamsError) {
          console.warn("Aviso ao carregar times do atleta:", teamsError);
        }

        const rawTeams = teamsData || [];

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
          };
        });

        if (mounted) {
          setUserTeams(mappedTeams);
        }

        // 2. Fetch de "Histórico Recente de Partidas"
        // Extrai um array com os IDs dessas equipas (userTeamIds)
        const userTeamIds = rawTeams.map((t: any) => t.id).filter(Boolean);

        if (userTeamIds.length === 0) {
          if (mounted) setRecentMatches([]);
          return;
        }

        // Mapa de nomes de equipes conhecidas
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

        // Query à tabela matches buscando partidas concluídas onde o usuário participou
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
            // Fallback resiliente caso a coluna created_at não exista na tabela matches
            if (matchesError.code === "42703" || matchesError.message?.includes("created_at")) {
              const { data: fbMatches, error: fbMatchesErr } = await supabase
                .from("matches")
                .select("*")
                .or(`team_a_id.in.(${userTeamIdsFilter}),team_b_id.in.(${userTeamIdsFilter})`)
                .limit(5);

              if (!fbMatchesErr && fbMatches) {
                matchesRaw = fbMatches;
              }
            } else {
              console.warn("Aviso ao buscar partidas do atleta:", matchesError);
            }
          } else if (matchesData) {
            matchesRaw = matchesData;
          }
        } catch (err) {
          console.warn("Exceção ao buscar partidas:", err);
        }

        // Se houver partidas, resolve nomes dos adversários e torneios faltantes
        if (matchesRaw.length > 0) {
          const missingOpponentTeamIds = matchesRaw
            .flatMap((m: any) => [m.team_a_id, m.team_b_id])
            .filter((id: any) => id && !teamsNameMap[id] && id !== "bye");

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
            .filter((id: any) => id && !tournamentsMap[id]);

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

          // Mapeia partidas identificando o lado do usuário e comparando scores
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
          if (mounted) {
            setRecentMatches([]);
          }
        }
      } catch (err) {
        console.warn("Aviso ao carregar dados do atleta:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadAthleteData();

    return () => {
      mounted = false;
    };
  }, [user]);

  // Mantém o estado isAdmin sincronizado com o perfil caso atualizado
  useEffect(() => {
    if (profile?.is_admin !== undefined) {
      setIsAdmin(Boolean(profile.is_admin));
    }
  }, [profile?.is_admin]);

  // Sincroniza dados iniciais do modal quando o perfil estiver carregado
  const openEditModal = () => {
    setFormName(
      profile?.full_name ||
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      displayName ||
      ""
    );
    setFormPhone(profile?.phone || "");
    setFormLocation(profile?.location || displayLocation || "Picos, PI");
    setFormBio(
      profile?.bio ||
      displayBio ||
      "Atleta competitivo do SportConnect. Foco em dominó, esportes de mesa e torneios oficiais."
    );
    setFormFavoriteSport(profile?.favorite_sport || "Nenhum");
    const currentAvatar =
      profile?.avatar_url ||
      user?.user_metadata?.avatar_url ||
      DEFAULT_AVATAR;
    setSelectedAvatarUrl(currentAvatar);
    setCustomUrlInput(
      currentAvatar.startsWith("http") ? currentAvatar : ""
    );
    if (!currentAvatar.startsWith("http") && !currentAvatar.startsWith("data:")) {
      setAvatarTab("presets");
    } else {
      setAvatarTab("upload");
    }
    setUploadFile(null);
    setUploadPreview(null);
    setErrorMessage("");
    setIsEditModalOpen(true);
  };

  // Manipulador de upload de arquivo local
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Por favor, selecione um arquivo de imagem válido (PNG, JPG, WEBP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("A imagem deve ter no máximo 5MB.");
      return;
    }

    if (uploadPreview) {
      URL.revokeObjectURL(uploadPreview);
    }

    setUploadFile(file);
    const preview = URL.createObjectURL(file);
    setUploadPreview(preview);
    setSelectedAvatarUrl(preview);
    setErrorMessage("");
  };

  // Salvar alterações de perfil no Supabase
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const trimmedName = formName.trim();
    if (!trimmedName) {
      setErrorMessage("O Nome do usuário não pode ficar em branco.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      let finalAvatarUrl = selectedAvatarUrl;

      // 1. Se foi selecionado upload de arquivo novo:
      if (avatarTab === "upload" && uploadFile) {
        const cleanFileName = uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const uniqueFileName = `${user.id}_${Date.now()}_${cleanFileName}`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(uniqueFileName, uploadFile, {
            cacheControl: "3600",
            upsert: true,
          });

        if (uploadError) {
          console.error("Erro ao fazer upload do avatar:", uploadError);
          throw new Error(`Falha no upload da foto: ${uploadError.message}`);
        }

        const { data: publicData } = supabase.storage
          .from("avatars")
          .getPublicUrl(uniqueFileName);

        if (publicData?.publicUrl) {
          finalAvatarUrl = publicData.publicUrl;
        }
      } else if (avatarTab === "url") {
        const trimmedUrl = customUrlInput.trim();
        if (trimmedUrl) {
          finalAvatarUrl = trimmedUrl;
        }
      }

      // 2. Atualizar explicitamente na tabela profiles do Supabase apenas os campos editáveis
      // (NUNCA envie a coluna email para não violar a not-null constraint)
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: trimmedName,
          avatar_url: finalAvatarUrl,
          phone: formPhone.trim() || null,
          location: formLocation.trim() || null,
          bio: formBio.trim() || null,
          favorite_sport:
            formFavoriteSport && formFavoriteSport !== "Nenhum"
              ? formFavoriteSport
              : null,
        })
        .eq("id", user.id);

      if (profileError) {
        console.error("Erro ao atualizar perfil no Supabase:", profileError);
        throw profileError;
      }

      // 3. Atualiza também metadata do Auth para manter sincronizado
      await supabase.auth.updateUser({
        data: {
          full_name: trimmedName,
          avatar_url: finalAvatarUrl,
        },
      });

      // 4. Atualiza contexto global
      await refreshProfile();

      setIsEditModalOpen(false);
      setSuccessToast("Perfil atualizado com sucesso!");
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (err: unknown) {
      console.error("Exceção ao salvar perfil:", err);
      const msg = err instanceof Error ? err.message : "Erro ao atualizar dados do perfil.";
      setErrorMessage(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const displayName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Atleta";

  const displayAvatar =
    profile?.avatar_url ||
    user?.user_metadata?.avatar_url ||
    DEFAULT_AVATAR;

  const displayLocation = profile?.location || "Picos, PI";
  const displayPhone = profile?.phone || "(89) 99999-9999";
  const displayBio =
    profile?.bio ||
    "Atleta oficial do ecossistema SportConnect. Focado em competições oficiais de Dominó, Ping Pong, Futsal e Vôlei.";
  const displayFavoriteSport =
    profile?.favorite_sport && profile.favorite_sport !== "Nenhum"
      ? profile.favorite_sport
      : null;

  // Lógica de Liberação do Selo "PRO VERIFICADO"
  // Visível apenas para administradores ou atletas com pelo menos 10 participações em torneios
  const teams = userTeams;
  const isProVerified = isAdmin || (teams && teams.length >= 10);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0a0a0c] text-[#e4e4e7] flex flex-col selection:bg-amber-500/30 selection:text-white">
        <PublicHeader />

        {/* Notificação Toast */}
        {successToast && (
          <div className="fixed top-24 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-bold animate-fadeIn border border-emerald-400/40">
            <CheckCircle2 className="h-4 w-4" />
            <span>{successToast}</span>
          </div>
        )}

        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8 animate-fadeIn">
          {/* ========================================================= */}
          {/* 1. HEADER DO PERFIL GAMIFICADO (MOCKUP ESTILO ESPORTS) */}
          {/* ========================================================= */}
          <section className="relative rounded-3xl bg-gradient-to-br from-[#18181b] via-[#121214] to-[#0c0c0e] border border-[#27272a] p-6 sm:p-8 overflow-hidden shadow-2xl">
            {/* Brilhos de Fundo */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              {/* Lado Esquerdo: Avatar em Destaque + Identidade */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start md:items-center gap-5 text-center sm:text-left">
                {/* Foto em Destaque com Moldura Dourada & Badge Nível */}
                <div className="relative group shrink-0">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-[#1e1e24] p-1 border-2 border-amber-400/60 shadow-xl shadow-amber-500/10 overflow-hidden relative flex items-center justify-center">
                    {displayAvatar &&
                    !displayAvatar.startsWith("http") &&
                    !displayAvatar.startsWith("data:") ? (
                      <div className="w-full h-full rounded-2xl bg-gradient-to-br from-[#24242c] via-[#1a1a20] to-amber-950/20 flex items-center justify-center select-none shadow-inner">
                        <span className="text-5xl sm:text-6xl transition-transform group-hover:scale-110">
                          {displayAvatar}
                        </span>
                      </div>
                    ) : (
                      <img
                        src={displayAvatar}
                        alt={displayName}
                        className="w-full h-full object-cover rounded-2xl transition-transform group-hover:scale-105"
                      />
                    )}
                  </div>

                  {/* Badge Nível Dinâmico sobreposta */}
                  <div
                    className="absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-black text-[11px] uppercase tracking-wider shadow-lg border border-black/40 flex items-center gap-1 font-display"
                    title="Nível de Atleta na Plataforma"
                  >
                    <Zap className="h-3 w-3 fill-current text-black" />
                    <span>NV. {xpData.currentLevel}</span>
                  </div>
                </div>

                {/* Detalhes do Usuário */}
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                    <h1 className="text-2xl sm:text-3xl font-black text-white font-display tracking-tight">
                      {displayName}
                    </h1>

                    {/* Badge PRO VERIFICADO (Verde) - apenas se for admin ou tiver >= 10 torneios */}
                    {isProVerified && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-[11px] font-black uppercase tracking-wider shadow-sm">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                        <span>PRO VERIFICADO</span>
                      </span>
                    )}

                    {/* Badge Esporte Favorito (se escolhido e diferente de "Nenhum") */}
                    {displayFavoriteSport && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/40 text-blue-300 text-[11px] font-black uppercase tracking-wider shadow-sm">
                        <span>{SPORT_EMOJIS[displayFavoriteSport] || "🏅"}</span>
                        <span>{displayFavoriteSport}</span>
                      </span>
                    )}
                  </div>

                  {/* Localização & Contato */}
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-zinc-400">
                    <span className="flex items-center gap-1 font-medium">
                      <MapPin className="h-3.5 w-3.5 text-orange-400" />
                      <span>{displayLocation}</span>
                    </span>

                    <span className="text-zinc-600 hidden sm:inline">•</span>

                    <span className="flex items-center gap-1 font-medium">
                      <Mail className="h-3.5 w-3.5 text-zinc-400" />
                      <span>{user?.email}</span>
                    </span>

                    {profile?.phone && (
                      <>
                        <span className="text-zinc-600 hidden sm:inline">•</span>
                        <span className="flex items-center gap-1 font-medium">
                          <Phone className="h-3.5 w-3.5 text-emerald-400" />
                          <span>{displayPhone}</span>
                        </span>
                      </>
                    )}
                  </div>

                  {/* Bio curta */}
                  <p className="text-xs text-zinc-300 max-w-xl leading-relaxed pt-1">
                    {displayBio}
                  </p>
                </div>
              </div>

              {/* Lado Direito: Botão Editar Perfil */}
              <div className="flex items-center justify-center sm:justify-end shrink-0">
                <button
                  type="button"
                  onClick={openEditModal}
                  className="px-5 py-3 rounded-2xl bg-[#1e1e24] hover:bg-zinc-800 border border-[#27272a] hover:border-amber-400/40 text-xs font-black uppercase tracking-wider text-white transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer group"
                >
                  <Pencil className="h-4 w-4 text-amber-400 group-hover:scale-110 transition-transform" />
                  <span>Editar Perfil</span>
                </button>
              </div>
            </div>

            {/* ========================================================= */}
            {/* 2. BARRA DE PROGRESSO & GAMIFICAÇÃO (NÍVEL DINÂMICO XP) */}
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

              {/* Barra Amarela de XP com Efeito Glow */}
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
          {/* STATS RÁPIDAS DO ATLETA (KPIs Gamificados) */}
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
          {/* SEÇÕES INFERIORES: Conquistas, Times e Histórico */}
          {/* ========================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 3.1 Seção: Conquistas (Achievements) */}
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

              {/* 3.2 Seção: Histórico Recente de Partidas */}
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
                      Suas partidas oficiais e resultados de súmula aparecerão aqui automaticamente.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {recentMatches.map((m) => {
                      const isWin = m.result === "WIN";
                      const isLoss = m.result === "LOSS";

                      // Badge de resultado com cor apropriada: Verde (Vitória), Vermelho (Derrota), Cinzento (Empate)
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

            {/* 3.3 Coluna Direita: Times Atuais (Tabela teams do Supabase) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-200 flex items-center gap-2">
                  <Users className="h-4 w-4 text-emerald-400" />
                  <span>Times Atuais ({userTeams.length})</span>
                </h3>
                <Link
                  href="/explorar"
                  className="text-[11px] text-[#00a2ff] hover:underline font-bold"
                >
                  Inscrever-se
                </Link>
              </div>

              {userTeams.length === 0 ? (
                <div className="p-6 rounded-2xl bg-[#121214] border border-dashed border-[#27272a] text-center space-y-2">
                  <Users className="h-8 w-8 text-zinc-600 mx-auto" />
                  <p className="text-xs font-bold text-zinc-400">
                    Ainda não estás inscrito em nenhum time.
                  </p>
                  <p className="text-[11px] text-zinc-600">
                    Explore os campeonatos disponíveis e inscreva sua dupla ou equipe oficial.
                  </p>
                  <Link
                    href="/explorar"
                    className="inline-block px-3 py-1.5 rounded-xl bg-[#00a2ff]/15 hover:bg-[#00a2ff]/25 border border-[#00a2ff]/30 text-[#00a2ff] text-xs font-bold"
                  >
                    Explorar Torneios
                  </Link>
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

        {/* ========================================================= */}
        {/* MODAL DE EDIÇÃO DE PERFIL COM LÓGICA TRIPLA DE AVATAR */}
        {/* ========================================================= */}
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto animate-fadeIn">
            <div className="bg-[#121214] border border-[#27272a] rounded-3xl p-6 sm:p-8 max-w-xl w-full text-white shadow-2xl relative max-h-[92vh] overflow-y-auto selection:bg-amber-500/30">
              {/* Fechar */}
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="absolute top-5 right-5 p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Fechar"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="space-y-1 mb-6">
                <h3 className="text-xl font-black font-display uppercase tracking-tight text-white flex items-center gap-2">
                  <Pencil className="h-5 w-5 text-amber-400" />
                  <span>Editar Perfil do Atleta</span>
                </h3>
                <p className="text-xs text-zinc-400">
                  Atualize suas informações pessoais e personalize sua foto de perfil.
                </p>
              </div>

              {errorMessage && (
                <div className="p-3.5 mb-5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium">
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="space-y-5">
                {/* 1. SELEÇÃO DA FOTO DE PERFIL (LÓGICA TRIPLA) */}
                <div className="p-4 rounded-2xl bg-[#0a0a0c] border border-[#27272a] space-y-4">
                  <div className="flex items-center gap-3">
                    {/* Prévia da Foto */}
                    <div className="w-16 h-16 rounded-2xl bg-zinc-900 border-2 border-amber-400/80 p-0.5 shadow-lg shrink-0 overflow-hidden flex items-center justify-center">
                      {selectedAvatarUrl &&
                      !selectedAvatarUrl.startsWith("http") &&
                      !selectedAvatarUrl.startsWith("data:") ? (
                        <div className="w-full h-full rounded-xl bg-gradient-to-br from-[#24242c] via-[#1a1a20] to-amber-950/30 flex items-center justify-center select-none">
                          <span className="text-3xl">{selectedAvatarUrl}</span>
                        </div>
                      ) : (
                        <img
                          src={selectedAvatarUrl || DEFAULT_AVATAR}
                          alt="Prévia do Avatar"
                          className="w-full h-full object-cover rounded-xl"
                        />
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">
                        Foto de Perfil do Atleta
                      </span>
                      <span className="text-[11px] text-zinc-400 block">
                        Escolha como deseja definir sua foto de perfil:
                      </span>
                    </div>
                  </div>

                  {/* Tabs / Seletores da Foto de Perfil */}
                  <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#18181b] border border-[#27272a]">
                    <button
                      type="button"
                      onClick={() => setAvatarTab("upload")}
                      className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        avatarTab === "upload"
                          ? "bg-amber-500 text-black shadow-md font-black"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      <UploadCloud className="h-3.5 w-3.5" />
                      <span>Fazer Upload</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAvatarTab("url")}
                      className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        avatarTab === "url"
                          ? "bg-amber-500 text-black shadow-md font-black"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      <LinkIcon className="h-3.5 w-3.5" />
                      <span>Link da Web</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAvatarTab("presets")}
                      className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        avatarTab === "presets"
                          ? "bg-amber-500 text-black shadow-md font-black"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Avatares</span>
                    </button>
                  </div>

                  {/* Conteúdo da Tab 1: Fazer Upload */}
                  {avatarTab === "upload" && (
                    <div className="space-y-2 animate-fadeIn">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png, image/jpeg, image/webp"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="p-4 rounded-xl border border-dashed border-zinc-700 hover:border-amber-400/60 bg-[#121214] hover:bg-zinc-900 text-center cursor-pointer transition-all space-y-1.5"
                      >
                        <Camera className="h-6 w-6 text-amber-400 mx-auto" />
                        <p className="text-xs font-bold text-white">
                          {uploadFile ? uploadFile.name : "Clique para selecionar uma foto do seu dispositivo"}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          PNG, JPG ou WEBP (máximo 5MB). Salvo com segurança no bucket oficial.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Conteúdo da Tab 2: Usar Link da Web */}
                  {avatarTab === "url" && (
                    <div className="space-y-2 animate-fadeIn">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                        URL Direta da Imagem
                      </label>
                      <input
                        type="url"
                        value={customUrlInput}
                        onChange={(e) => {
                          setCustomUrlInput(e.target.value);
                          if (e.target.value.trim().startsWith("http")) {
                            setSelectedAvatarUrl(e.target.value.trim());
                          }
                        }}
                        placeholder="https://exemplo.com/sua-foto.jpg"
                        className="w-full px-3.5 py-2.5 bg-[#141416] border border-[#27272a] focus:border-amber-400 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-600 outline-none transition-all"
                      />
                      <p className="text-[10px] text-zinc-500">
                        Cole uma URL de imagem pública. A prévia atualizará automaticamente.
                      </p>
                    </div>
                  )}

                  {/* Conteúdo da Tab 3: Avatares do Sistema (Emojis) */}
                  {avatarTab === "presets" && (
                    <div className="space-y-2 animate-fadeIn">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                        Escolha um Emoji de Avatar
                      </label>
                      <div className="grid grid-cols-6 gap-2">
                        {EMOJI_AVATARS.map((emoji) => {
                          const isSelected = selectedAvatarUrl === emoji;
                          return (
                            <button
                              type="button"
                              key={emoji}
                              onClick={() => setSelectedAvatarUrl(emoji)}
                              className={`aspect-square rounded-2xl border-2 transition-all cursor-pointer relative bg-zinc-900/90 hover:bg-zinc-800 flex items-center justify-center select-none text-4xl ${
                                isSelected
                                  ? "border-amber-400 bg-amber-500/10 ring-2 ring-amber-400/40 scale-105"
                                  : "border-zinc-800 hover:border-zinc-600"
                              }`}
                              title={`Avatar ${emoji}`}
                            >
                              <span>{emoji}</span>
                              {isSelected && (
                                <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-amber-400 text-black flex items-center justify-center shadow-sm">
                                  <Check className="h-2.5 w-2.5 stroke-[3]" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. DADOS BÁSICOS (NOME, TELEFONE, LOCALIZAÇÃO) */}
                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-black uppercase tracking-wider text-zinc-300 block">
                      Nome Completo <span className="text-amber-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="Seu nome oficial de atleta"
                      className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#27272a] focus:border-amber-400 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-all shadow-inner"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-black uppercase tracking-wider text-zinc-300 block">
                        Telefone / WhatsApp
                      </label>
                      <input
                        type="text"
                        value={formPhone}
                        onChange={(e) => setFormPhone(e.target.value)}
                        placeholder="(89) 99999-9999"
                        className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#27272a] focus:border-amber-400 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-all shadow-inner"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-black uppercase tracking-wider text-zinc-300 block">
                        Localização (Cidade, UF)
                      </label>
                      <input
                        type="text"
                        value={formLocation}
                        onChange={(e) => setFormLocation(e.target.value)}
                        placeholder="Ex: Picos, PI"
                        className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#27272a] focus:border-amber-400 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-all shadow-inner"
                      />
                    </div>
                  </div>

                  {/* Campo Esporte Favorito (Dropdown) */}
                  <div className="space-y-1">
                    <label className="text-xs font-black uppercase tracking-wider text-zinc-300 block flex items-center justify-between">
                      <span>Esporte Favorito</span>
                      <span className="text-[10px] text-zinc-500 font-normal">
                        Destaque temático no seu perfil
                      </span>
                    </label>
                    <select
                      value={formFavoriteSport}
                      onChange={(e) => setFormFavoriteSport(e.target.value)}
                      className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#27272a] focus:border-amber-400 rounded-xl text-sm text-zinc-100 outline-none transition-all shadow-inner cursor-pointer"
                    >
                      <option value="Nenhum">Nenhum</option>
                      <option value="Ping Pong">🏓 Ping Pong</option>
                      <option value="Dominó">🁓 Dominó</option>
                      <option value="Futsal">⚽ Futsal</option>
                      <option value="Vôlei">🏐 Vôlei</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-black uppercase tracking-wider text-zinc-300 block">
                      Biografia / Sobre o Atleta
                    </label>
                    <textarea
                      rows={3}
                      value={formBio}
                      onChange={(e) => setFormBio(e.target.value)}
                      placeholder="Conte um pouco sobre sua trajetória esportiva, títulos ou modalidade favorita..."
                      className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#27272a] focus:border-amber-400 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-all resize-y shadow-inner"
                    />
                  </div>
                </div>

                {/* BOTÕES DE AÇÃO */}
                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-3 rounded-xl border border-[#27272a] text-xs font-bold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-black" />
                        <span>Salvando Alterações...</span>
                      </>
                    ) : (
                      <span>Salvar Perfil 💾</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
