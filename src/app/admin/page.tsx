"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ShieldCheck,
  Trophy,
  Users,
  Search,
  Filter,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Calendar,
  MapPin,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Layers,
  Copy,
  Check,
  AlertCircle,
  MoreVertical,
  Activity,
  Phone,
  Mail,
  UserCheck,
  BarChart3,
  ChevronRight,
  Shield,
  Clock,
  CheckCircle2,
} from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthProvider";
import { supabase } from "@/lib/supabase";
import { Tournament, Profile, SportType } from "@/types";
import { DEFAULT_AVATAR, formatPhoneBR } from "@/app/perfil/page";

interface OrganizerProfile {
  id: string;
  full_name?: string;
  email?: string;
}

type AdminTab = "overview" | "tournaments" | "users";

const SPORT_META: Record<string, { label: string; icon: string; color: string }> = {
  DOMINO: { label: "Dominó", icon: "🁓", color: "text-amber-400" },
  PING_PONG: { label: "Ping Pong", icon: "🏓", color: "text-blue-400" },
  FUTSAL: { label: "Futsal", icon: "⚽", color: "text-emerald-400" },
  VOLEI: { label: "Vôlei", icon: "🏐", color: "text-orange-400" },
};

export default function AdminPage() {
  const router = useRouter();
  const { user } = useAuth();

  // Estados de Carregamento e Dados
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [usersList, setUsersList] = useState<Profile[]>([]);
  const [totalTeamsCount, setTotalTeamsCount] = useState<number>(0);
  const [organizers, setOrganizers] = useState<Record<string, OrganizerProfile>>({});

  // Aba ativa
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");

  // Estados de Interface e Feedback
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [openDropdownUserId, setOpenDropdownUserId] = useState<string | null>(null);

  // Filtros da Aba Campeonatos
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sportFilter, setSportFilter] = useState<string>("ALL");

  // Filtros da Aba Utilizadores
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<string>("ALL");

  // Fecha dropdowns de usuário ao clicar fora
  useEffect(() => {
    function handleClickOutside() {
      setOpenDropdownUserId(null);
    }
    if (openDropdownUserId) {
      window.addEventListener("click", handleClickOutside);
      return () => window.removeEventListener("click", handleClickOutside);
    }
  }, [openDropdownUserId]);

  // 1. Carregamento Geral dos Dados do SaaS (Torneios, Profiles e Teams)
  useEffect(() => {
    let mounted = true;

    async function checkAdminAndLoadData() {
      if (!user) return;

      try {
        setLoading(true);

        // A. Verificação de Super Admin
        let isSuperAdmin = Boolean(
          user.email === "admin@sportconnect.com" ||
          user.email === "santoslorrany250@gmail.com" ||
          user.id === "organizer-admin-session"
        );

        if (!isSuperAdmin) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("is_admin")
            .eq("id", user.id)
            .maybeSingle();

          if (profile?.is_admin === true) {
            isSuperAdmin = true;
          }
        }

        if (!isSuperAdmin) {
          console.warn("Acesso negado: o usuário não é Super Admin.");
          router.replace("/hub");
          return;
        }

        // B. Fetch dos Torneios
        const { data: dbTournaments, error: tournErr } = await supabase
          .from("tournaments")
          .select("*")
          .order("created_at", { ascending: false });

        if (tournErr) {
          console.error("Erro ao carregar torneios no painel admin:", tournErr);
        }

        const tournsList: Tournament[] = (dbTournaments || []).map((t: any) => ({
          id: t.id,
          name: t.name,
          status: t.status || "ATIVO",
          createdAt: t.created_at,
          sport_type: (t.sport_type as SportType) || "DOMINO",
          format: t.format,
          owner_id: t.owner_id,
          max_teams: t.max_teams ? Number(t.max_teams) : 16,
          entry_fee: t.entry_fee ? Number(t.entry_fee) : 0,
          location: t.location,
          start_date: t.start_date,
          end_date: t.end_date,
          cover_url: t.cover_url,
          rules: t.rules,
          organizer_pix_key: t.organizer_pix_key,
        }));

        // C. Fetch de todos os Perfis de Utilizadores
        const { data: dbProfiles, error: profilesErr } = await supabase
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false });

        if (profilesErr) {
          console.error("Erro ao carregar perfis de utilizadores:", profilesErr);
        }

        // D. Fetch do volume total de Equipes Inscritas
        const { count: teamsCount } = await supabase
          .from("teams")
          .select("*", { count: "exact", head: true });

        if (mounted) {
          setTournaments(tournsList);
          setUsersList(dbProfiles || []);
          setTotalTeamsCount(teamsCount || 0);

          // Constrói mapa de organizadores
          const orgMap: Record<string, OrganizerProfile> = {};
          (dbProfiles || []).forEach((p: any) => {
            orgMap[p.id] = {
              id: p.id,
              full_name: p.full_name,
              email: p.email,
            };
          });
          setOrganizers(orgMap);
        }
      } catch (err) {
        console.error("Exceção ao carregar painel Super Admin:", err);
        router.replace("/hub");
      } finally {
        if (mounted) {
          setLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    checkAdminAndLoadData();

    return () => {
      mounted = false;
    };
  }, [user, router]);

  // Atualização Manual de Dados
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const [tournRes, profRes, teamsRes] = await Promise.all([
        supabase
          .from("tournaments")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("teams")
          .select("*", { count: "exact", head: true }),
      ]);

      if (tournRes.data) {
        setTournaments(
          tournRes.data.map((t: any) => ({
            id: t.id,
            name: t.name,
            status: t.status || "ATIVO",
            createdAt: t.created_at,
            sport_type: (t.sport_type as SportType) || "DOMINO",
            format: t.format,
            owner_id: t.owner_id,
            max_teams: t.max_teams ? Number(t.max_teams) : 16,
            entry_fee: t.entry_fee ? Number(t.entry_fee) : 0,
            location: t.location,
            start_date: t.start_date,
            end_date: t.end_date,
            cover_url: t.cover_url,
          }))
        );
      }

      if (profRes.data) {
        setUsersList(profRes.data);
        const orgMap: Record<string, OrganizerProfile> = {};
        profRes.data.forEach((p: any) => {
          orgMap[p.id] = {
            id: p.id,
            full_name: p.full_name,
            email: p.email,
          };
        });
        setOrganizers(orgMap);
      }

      if (teamsRes.count !== null && teamsRes.count !== undefined) {
        setTotalTeamsCount(teamsRes.count);
      }
    } catch (err) {
      console.error("Erro ao atualizar dados do painel admin:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Copiar texto para área de transferência
  const handleCopy = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Redirecionamento "Forçar Acesso ao Painel"
  const handleForceAccess = (tournamentId: string) => {
    router.push(`/dashboard/${tournamentId}`);
  };

  // Formatador de Data Amigável
  const formatDate = (dateString?: string) => {
    if (!dateString) return "—";
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return "—";
      return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  };

  // Filtragem dos Torneios
  const filteredTournaments = useMemo(() => {
    return tournaments.filter((t) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const org = t.owner_id ? organizers[t.owner_id] : null;
        const matchesName = t.name.toLowerCase().includes(query);
        const matchesLocation = t.location ? t.location.toLowerCase().includes(query) : false;
        const matchesOwnerId = t.owner_id ? t.owner_id.toLowerCase().includes(query) : false;
        const matchesOrgName = org?.full_name ? org.full_name.toLowerCase().includes(query) : false;
        const matchesOrgEmail = org?.email ? org.email.toLowerCase().includes(query) : false;

        if (
          !matchesName &&
          !matchesLocation &&
          !matchesOwnerId &&
          !matchesOrgName &&
          !matchesOrgEmail
        ) {
          return false;
        }
      }

      if (statusFilter !== "ALL") {
        if ((t.status || "ATIVO").toUpperCase() !== statusFilter.toUpperCase()) {
          return false;
        }
      }

      if (sportFilter !== "ALL") {
        if (t.sport_type !== sportFilter) {
          return false;
        }
      }

      return true;
    });
  }, [tournaments, searchQuery, statusFilter, sportFilter, organizers]);

  // Filtragem de Utilizadores
  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      if (userSearchQuery.trim()) {
        const q = userSearchQuery.toLowerCase().trim();
        const matchesName = u.full_name ? u.full_name.toLowerCase().includes(q) : false;
        const matchesEmail = u.email ? u.email.toLowerCase().includes(q) : false;
        const matchesPhone = u.phone ? u.phone.includes(q) : false;
        const matchesLocation = u.location ? u.location.toLowerCase().includes(q) : false;
        const matchesId = u.id ? u.id.toLowerCase().includes(q) : false;

        if (!matchesName && !matchesEmail && !matchesPhone && !matchesLocation && !matchesId) {
          return false;
        }
      }

      if (userRoleFilter === "ADMIN") {
        if (!u.is_admin) return false;
      } else if (userRoleFilter === "ATHLETE") {
        if (u.is_admin) return false;
      }

      return true;
    });
  }, [usersList, userSearchQuery, userRoleFilter]);

  // KPIs Globais do SaaS
  const kpis = useMemo(() => {
    const totalUsers = usersList.length;
    const adminUsers = usersList.filter((u) => u.is_admin).length;
    const totalTournaments = tournaments.length;
    const activeTournaments = tournaments.filter(
      (t) =>
        (t.status || "ATIVO").toUpperCase() === "ATIVO" ||
        (t.status || "").toUpperCase() === "EM_ANDAMENTO"
    ).length;
    const completedTournaments = tournaments.filter(
      (t) => (t.status || "").toUpperCase() === "FINALIZADO"
    ).length;
    const totalSpots = tournaments.reduce((acc, t) => acc + (t.max_teams || 16), 0);

    return {
      totalUsers,
      adminUsers,
      totalTournaments,
      activeTournaments,
      completedTournaments,
      totalTeams: totalTeamsCount,
      totalSpots,
    };
  }, [tournaments, usersList, totalTeamsCount]);

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-[#0a0a0c] text-white flex flex-col items-center justify-center p-6">
          <Loader2 className="h-10 w-10 text-purple-500 animate-spin mb-4" />
          <h2 className="text-base font-bold text-white">Carregando Painel Super Admin...</h2>
          <p className="text-xs text-zinc-500 mt-1">Sincronizando banco de dados global do SaaS.</p>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0a0a0c] text-[#e4e4e7] flex flex-col selection:bg-purple-500/30 selection:text-white">
        {/* ========================================================= */}
        {/* HEADER SUPER ADMIN */}
        {/* ========================================================= */}
        <header className="w-full border-b border-[#27272a] bg-[#121214]/95 backdrop-blur-md sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                href="/hub"
                className="flex items-center gap-2 group transition-transform active:scale-95"
              >
                <Image
                  src="/logo.png"
                  alt="SportConnect"
                  width={130}
                  height={32}
                  priority
                  className="h-7 w-auto object-contain"
                />
              </Link>

              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-500/40 text-purple-300 text-xs font-black uppercase tracking-wider shadow-sm">
                <ShieldCheck className="h-3.5 w-3.5 text-purple-400" />
                <span>Central do Sistema • SaaS</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold text-zinc-300 hover:text-white transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
                title="Atualizar dados"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-purple-400" : ""}`} />
                <span className="hidden sm:inline">Atualizar</span>
              </button>

              <Link
                href="/hub"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-[#27272a] text-xs font-bold text-zinc-200 hover:text-white transition-all shadow-sm active:scale-95"
              >
                <ArrowLeft className="h-4 w-4 text-purple-400" />
                <span>Voltar ao Hub</span>
              </Link>
            </div>
          </div>
        </header>

        {/* ========================================================= */}
        {/* CONTEÚDO PRINCIPAL */}
        {/* ========================================================= */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8 animate-fadeIn">
          {/* Banner Hero */}
          <section className="bg-gradient-to-r from-[#16121f] via-[#121216] to-[#0f0f12] border border-purple-500/20 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div className="space-y-2 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-black uppercase tracking-wider">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Painel Master do Ecossistema</span>
                </div>
                <h1 className="text-2xl sm:text-4xl font-black text-white font-display tracking-tight">
                  Painel de Controle SaaS
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                  Gerencie utilizadores, atletas, equipes e campeonatos cadastrados no SportConnect com permissões irrestritas de administração.
                </p>
              </div>

              <div className="px-5 py-4 rounded-2xl bg-zinc-900/80 border border-purple-500/30 text-right shrink-0">
                <span className="text-[11px] text-zinc-400 uppercase tracking-wider block font-bold">
                  Sessão Super Admin
                </span>
                <span className="text-sm font-bold text-purple-300 truncate max-w-[200px] block">
                  {user?.email}
                </span>
                <span className="text-[10px] text-emerald-400 font-bold block mt-0.5">
                  ● Permissão Master Irrestrita
                </span>
              </div>
            </div>
          </section>

          {/* ========================================================= */}
          {/* 1. CARTÕES DE MÉTRICAS (KPIS GLOBAIS) */}
          {/* ========================================================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Total de Utilizadores */}
            <div className="p-5 rounded-2xl bg-[#121214] border border-[#27272a] space-y-1 shadow-md hover:border-purple-500/40 transition-all">
              <span className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Users className="h-4 w-4 text-purple-400" />
                <span>Total de Utilizadores</span>
              </span>
              <div className="text-3xl font-black text-white font-display">
                {kpis.totalUsers}
              </div>
              <p className="text-[11px] text-zinc-500">
                Atletas cadastrados • {kpis.adminUsers} {kpis.adminUsers === 1 ? "Admin" : "Admins"}
              </p>
            </div>

            {/* KPI 2: Total de Campeonatos */}
            <div className="p-5 rounded-2xl bg-[#121214] border border-[#27272a] space-y-1 shadow-md hover:border-amber-500/40 transition-all">
              <span className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Trophy className="h-4 w-4 text-amber-400" />
                <span>Total de Campeonatos</span>
              </span>
              <div className="text-3xl font-black text-amber-400 font-display">
                {kpis.totalTournaments}
              </div>
              <p className="text-[11px] text-zinc-500">
                {kpis.activeTournaments} Ativos • {kpis.completedTournaments} Finalizados
              </p>
            </div>

            {/* KPI 3: Total de Equipas Inscritas */}
            <div className="p-5 rounded-2xl bg-[#121214] border border-[#27272a] space-y-1 shadow-md hover:border-emerald-500/40 transition-all">
              <span className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-emerald-400" />
                <span>Equipas Inscritas</span>
              </span>
              <div className="text-3xl font-black text-emerald-400 font-display">
                {kpis.totalTeams}
              </div>
              <p className="text-[11px] text-zinc-500">
                Volume de participações ativas
              </p>
            </div>

            {/* KPI 4: Vagas Oferecidas */}
            <div className="p-5 rounded-2xl bg-[#121214] border border-[#27272a] space-y-1 shadow-md hover:border-blue-500/40 transition-all">
              <span className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-blue-400" />
                <span>Vagas Totais</span>
              </span>
              <div className="text-3xl font-black text-blue-400 font-display">
                {kpis.totalSpots}
              </div>
              <p className="text-[11px] text-zinc-500">
                Capacidade nos campeonatos
              </p>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 2. NAVEGAÇÃO POR ABAS (TABS) */}
          {/* ========================================================= */}
          <div className="border-b border-[#27272a] flex items-center gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={`px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === "overview"
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/25 border border-purple-400/30"
                  : "bg-[#141416] text-zinc-400 hover:text-white hover:bg-zinc-800 border border-[#27272a]"
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              <span>Visão Geral</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("tournaments")}
              className={`px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === "tournaments"
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/25 border border-purple-400/30"
                  : "bg-[#141416] text-zinc-400 hover:text-white hover:bg-zinc-800 border border-[#27272a]"
              }`}
            >
              <Trophy className="h-4 w-4" />
              <span>Gestão de Campeonatos ({tournaments.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("users")}
              className={`px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === "users"
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/25 border border-purple-400/30"
                  : "bg-[#141416] text-zinc-400 hover:text-white hover:bg-zinc-800 border border-[#27272a]"
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Gestão de Utilizadores ({usersList.length})</span>
            </button>
          </div>

          {/* ========================================================= */}
          {/* CONTEÚDO DA ABA 1: VISÃO GERAL */}
          {/* ========================================================= */}
          {activeTab === "overview" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Box de Campeonatos Recentes */}
                <div className="bg-[#121214] border border-[#27272a] rounded-3xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-[#27272a] pb-3">
                    <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-amber-400" />
                      <span>Campeonatos Recentes</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab("tournaments")}
                      className="text-[11px] text-purple-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <span>Ver Todos</span>
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {tournaments.slice(0, 5).map((t) => {
                      const sportMeta = SPORT_META[t.sport_type || "DOMINO"] || {
                        label: "Esporte",
                        icon: "🏆",
                        color: "text-zinc-400",
                      };
                      return (
                        <div
                          key={t.id}
                          className="p-3 rounded-2xl bg-[#18181b] border border-[#27272a] flex items-center justify-between gap-3 hover:border-zinc-700 transition-all"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-sm shrink-0">
                              {sportMeta.icon}
                            </div>
                            <div className="space-y-0.5 min-w-0">
                              <h4 className="text-xs font-bold text-white truncate">
                                {t.name}
                              </h4>
                              <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                                <span>{sportMeta.label}</span>
                                <span>•</span>
                                <span>{formatDate(t.createdAt)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleForceAccess(t.id)}
                              className="px-2.5 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/35 border border-purple-500/40 text-purple-200 text-[10px] font-bold uppercase transition-all"
                            >
                              Painel
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Box de Utilizadores Recentes */}
                <div className="bg-[#121214] border border-[#27272a] rounded-3xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-[#27272a] pb-3">
                    <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                      <Users className="h-4 w-4 text-purple-400" />
                      <span>Utilizadores Recentes</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab("users")}
                      className="text-[11px] text-purple-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <span>Ver Todos</span>
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {usersList.slice(0, 5).map((u) => {
                      const avatar = u.avatar_url || DEFAULT_AVATAR;
                      return (
                        <div
                          key={u.id}
                          className="p-3 rounded-2xl bg-[#18181b] border border-[#27272a] flex items-center justify-between gap-3 hover:border-zinc-700 transition-all"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-sm shrink-0 overflow-hidden">
                              {avatar.startsWith("http") || avatar.startsWith("data:") ? (
                                <img src={avatar} alt={u.full_name || "Avatar"} className="w-full h-full object-cover" />
                              ) : (
                                <span>{avatar}</span>
                              )}
                            </div>
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <h4 className="text-xs font-bold text-white truncate">
                                  {u.full_name || "Atleta Sem Nome"}
                                </h4>
                                {u.is_admin && (
                                  <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 text-[9px] font-black uppercase">
                                    Admin
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-zinc-500 block truncate">
                                {u.email || "Sem e-mail"}
                              </span>
                            </div>
                          </div>

                          <Link
                            href={`/atleta/${u.id}`}
                            className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[10px] font-bold uppercase transition-all flex items-center gap-1"
                          >
                            <span>Perfil</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* CONTEÚDO DA ABA 2: GESTÃO DE CAMPEONATOS */}
          {/* ========================================================= */}
          {activeTab === "tournaments" && (
            <div className="space-y-4 animate-fadeIn">
              {/* Barra de Busca e Filtros */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-[#121214] border border-[#27272a] rounded-2xl">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por nome do torneio, local, organizador ou ID..."
                    className="w-full pl-10 pr-4 py-2.5 bg-[#18181b] border border-[#27272a] focus:border-purple-500 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-600 outline-none transition-all"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2.5 bg-[#18181b] border border-[#27272a] focus:border-purple-500 rounded-xl text-xs text-zinc-200 outline-none transition-all cursor-pointer"
                  >
                    <option value="ALL">Todos os Status</option>
                    <option value="ATIVO">Inscrições Abertas (Ativo)</option>
                    <option value="EM_ANDAMENTO">Em Andamento</option>
                    <option value="FINALIZADO">Finalizados</option>
                    <option value="CANCELADO">Cancelados</option>
                  </select>

                  <select
                    value={sportFilter}
                    onChange={(e) => setSportFilter(e.target.value)}
                    className="px-3 py-2.5 bg-[#18181b] border border-[#27272a] focus:border-purple-500 rounded-xl text-xs text-zinc-200 outline-none transition-all cursor-pointer"
                  >
                    <option value="ALL">Todas Modalidades</option>
                    <option value="DOMINO">Dominó</option>
                    <option value="PING_PONG">Ping Pong</option>
                    <option value="FUTSAL">Futsal</option>
                    <option value="VOLEI">Vôlei</option>
                  </select>
                </div>
              </div>

              {/* Tabela de Torneios */}
              <div className="bg-[#121214] border border-[#27272a] rounded-3xl overflow-hidden shadow-2xl">
                <div className="px-6 py-4 border-b border-[#27272a] flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-white">
                      Lista de Torneios do Sistema ({filteredTournaments.length})
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Visão consolidada de todas as competições hospedadas na SportConnect.
                    </p>
                  </div>
                </div>

                {filteredTournaments.length === 0 ? (
                  <div className="py-16 text-center space-y-3">
                    <AlertCircle className="h-10 w-10 text-zinc-600 mx-auto" />
                    <p className="text-sm text-zinc-400 font-bold">Nenhum torneio encontrado.</p>
                    <p className="text-xs text-zinc-600">Tente ajustar os termos da busca ou filtros selecionados.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#18181b] border-b border-[#27272a] text-zinc-400 font-black uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="py-3.5 px-6">Torneio & Modalidade</th>
                          <th className="py-3.5 px-6">Organizador</th>
                          <th className="py-3.5 px-6">Status</th>
                          <th className="py-3.5 px-6">Vagas & Valor</th>
                          <th className="py-3.5 px-6 text-right">Ação Super Admin</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#27272a]/60">
                        {filteredTournaments.map((t) => {
                          const sportMeta = SPORT_META[t.sport_type || "DOMINO"] || {
                            label: t.sport_type || "Esporte",
                            icon: "🏆",
                            color: "text-zinc-400",
                          };
                          const org = t.owner_id ? organizers[t.owner_id] : null;
                          const rawStatus = (t.status || "ATIVO").toUpperCase();

                          return (
                            <tr
                              key={t.id}
                              className="hover:bg-zinc-800/40 transition-colors group"
                            >
                              <td className="py-4 px-6">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-lg shrink-0 shadow-inner">
                                    {sportMeta.icon}
                                  </div>
                                  <div className="space-y-0.5">
                                    <Link
                                      href={`/torneio/${t.id}`}
                                      target="_blank"
                                      className="font-bold text-white group-hover:text-purple-300 transition-colors hover:underline text-sm flex items-center gap-1.5"
                                    >
                                      <span>{t.name}</span>
                                      <ExternalLink className="h-3 w-3 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </Link>
                                    <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                                      <span className={`font-semibold ${sportMeta.color}`}>
                                        {sportMeta.label}
                                      </span>
                                      {t.format && (
                                        <>
                                          <span>•</span>
                                          <span>{t.format}</span>
                                        </>
                                      )}
                                      {t.location && (
                                        <>
                                          <span>•</span>
                                          <span className="truncate max-w-[140px]">{t.location}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td className="py-4 px-6">
                                <div className="space-y-1">
                                  {org ? (
                                    <div>
                                      <span className="font-bold text-white block">
                                        {org.full_name || "Organizador"}
                                      </span>
                                      <span className="text-[11px] text-zinc-400 block truncate max-w-[180px]">
                                        {org.email || "Sem e-mail"}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-zinc-500 italic block">
                                      {t.owner_id ? "Perfil não sincronizado" : "Sem proprietário"}
                                    </span>
                                  )}

                                  {t.owner_id && (
                                    <div className="flex items-center gap-1.5 pt-0.5">
                                      <code className="text-[10px] text-zinc-500 font-mono bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                                        {t.owner_id.slice(0, 8)}...{t.owner_id.slice(-4)}
                                      </code>
                                      <button
                                        type="button"
                                        onClick={(e) => handleCopy(t.owner_id!, e)}
                                        className="text-zinc-500 hover:text-white transition-colors cursor-pointer p-0.5"
                                        title="Copiar ID do Organizador"
                                      >
                                        {copiedText === t.owner_id ? (
                                          <Check className="h-3 w-3 text-emerald-400" />
                                        ) : (
                                          <Copy className="h-3 w-3" />
                                        )}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </td>

                              <td className="py-4 px-6">
                                {rawStatus === "ATIVO" ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    <span>Inscrições Abertas</span>
                                  </span>
                                ) : rawStatus === "EM_ANDAMENTO" ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-black uppercase tracking-wider">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                                    <span>Em Andamento</span>
                                  </span>
                                ) : rawStatus === "CANCELADO" ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] font-black uppercase tracking-wider">
                                    <span>Cancelado</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 text-[10px] font-black uppercase tracking-wider">
                                    <span>Finalizado</span>
                                  </span>
                                )}
                              </td>

                              <td className="py-4 px-6">
                                <div className="space-y-0.5">
                                  <span className="font-bold text-white block">
                                    {t.max_teams || 16} vagas
                                  </span>
                                  <span className="text-[11px] text-zinc-500 block">
                                    {t.entry_fee && Number(t.entry_fee) > 0
                                      ? `R$ ${Number(t.entry_fee).toFixed(2).replace(".", ",")}`
                                      : "Gratuito"}
                                  </span>
                                </div>
                              </td>

                              <td className="py-4 px-6 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleForceAccess(t.id)}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/35 border border-purple-500/40 text-purple-200 hover:text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
                                  title="Acessar o painel deste campeonato como Super Admin"
                                >
                                  <ShieldCheck className="h-3.5 w-3.5 text-purple-400" />
                                  <span>Forçar Acesso ao Painel</span>
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* CONTEÚDO DA ABA 3: GESTÃO DE UTILIZADORES */}
          {/* ========================================================= */}
          {activeTab === "users" && (
            <div className="space-y-4 animate-fadeIn">
              {/* Barra de Busca e Filtros de Utilizadores */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-[#121214] border border-[#27272a] rounded-2xl">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Buscar por nome, e-mail, telefone, local ou ID..."
                    className="w-full pl-10 pr-4 py-2.5 bg-[#18181b] border border-[#27272a] focus:border-purple-500 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-600 outline-none transition-all"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={userRoleFilter}
                    onChange={(e) => setUserRoleFilter(e.target.value)}
                    className="px-3 py-2.5 bg-[#18181b] border border-[#27272a] focus:border-purple-500 rounded-xl text-xs text-zinc-200 outline-none transition-all cursor-pointer"
                  >
                    <option value="ALL">Todos os Utilizadores</option>
                    <option value="ADMIN">Apenas Admins do Sistema</option>
                    <option value="ATHLETE">Apenas Atletas</option>
                  </select>
                </div>
              </div>

              {/* Tabela de Utilizadores */}
              <div className="bg-[#121214] border border-[#27272a] rounded-3xl overflow-hidden shadow-2xl">
                <div className="px-6 py-4 border-b border-[#27272a] flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-white">
                      Lista Global de Utilizadores ({filteredUsers.length})
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Atletas e administradores registados na plataforma SportConnect.
                    </p>
                  </div>
                </div>

                {filteredUsers.length === 0 ? (
                  <div className="py-16 text-center space-y-3">
                    <AlertCircle className="h-10 w-10 text-zinc-600 mx-auto" />
                    <p className="text-sm text-zinc-400 font-bold">Nenhum utilizador encontrado.</p>
                    <p className="text-xs text-zinc-600">Ajuste os filtros de busca para encontrar atletas.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#18181b] border-b border-[#27272a] text-zinc-400 font-black uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="py-3.5 px-6">Atleta & Identidade</th>
                          <th className="py-3.5 px-6">Contacto (E-mail / Telefone)</th>
                          <th className="py-3.5 px-6">Data de Registo</th>
                          <th className="py-3.5 px-6">Status / Função</th>
                          <th className="py-3.5 px-6 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#27272a]/60">
                        {filteredUsers.map((u) => {
                          const avatar = u.avatar_url || DEFAULT_AVATAR;
                          const isDropdownOpen = openDropdownUserId === u.id;

                          return (
                            <tr
                              key={u.id}
                              className="hover:bg-zinc-800/40 transition-colors group"
                            >
                              {/* Avatar & Nome */}
                              <td className="py-4 px-6">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-lg shrink-0 overflow-hidden shadow-inner">
                                    {avatar.startsWith("http") || avatar.startsWith("data:") ? (
                                      <img src={avatar} alt={u.full_name || "Avatar"} className="w-full h-full object-cover" />
                                    ) : (
                                      <span>{avatar}</span>
                                    )}
                                  </div>
                                  <div className="space-y-0.5">
                                    <Link
                                      href={`/atleta/${u.id}`}
                                      className="font-bold text-white group-hover:text-purple-300 transition-colors hover:underline text-sm flex items-center gap-1.5"
                                    >
                                      <span>{u.full_name || "Atleta Sem Nome"}</span>
                                      <ExternalLink className="h-3 w-3 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </Link>
                                    <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                                      {u.location ? (
                                        <span className="flex items-center gap-1">
                                          <MapPin className="h-3 w-3 text-orange-400" />
                                          <span>{u.location}</span>
                                        </span>
                                      ) : (
                                        <span>Local não informado</span>
                                      )}
                                      <span>•</span>
                                      <div className="flex items-center gap-1">
                                        <code className="text-[10px] text-zinc-500 font-mono bg-zinc-900 px-1 py-0.5 rounded border border-zinc-800">
                                          {u.id.slice(0, 8)}...
                                        </code>
                                        <button
                                          type="button"
                                          onClick={(e) => handleCopy(u.id, e)}
                                          className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
                                          title="Copiar ID do atleta"
                                        >
                                          {copiedText === u.id ? (
                                            <Check className="h-3 w-3 text-emerald-400" />
                                          ) : (
                                            <Copy className="h-3 w-3" />
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Contacto */}
                              <td className="py-4 px-6">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5 text-zinc-200">
                                    <Mail className="h-3 w-3 text-zinc-500 shrink-0" />
                                    <span className="font-medium truncate max-w-[180px]">
                                      {u.email || "Sem e-mail cadastrado"}
                                    </span>
                                  </div>
                                  {u.phone && (
                                    <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
                                      <Phone className="h-3 w-3 text-emerald-400 shrink-0" />
                                      <span>{formatPhoneBR(u.phone)}</span>
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* Data de Registo */}
                              <td className="py-4 px-6 text-zinc-300">
                                <div className="space-y-0.5">
                                  <span className="font-medium block">{formatDate(u.created_at)}</span>
                                  <span className="text-[10px] text-zinc-500 block">Data de adesão</span>
                                </div>
                              </td>

                              {/* Status / Função */}
                              <td className="py-4 px-6">
                                {u.is_admin ? (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/40 text-purple-300 text-[10px] font-black uppercase tracking-wider shadow-sm">
                                    <ShieldCheck className="h-3.5 w-3.5 text-purple-400" />
                                    <span>Admin do Sistema</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
                                    <UserCheck className="h-3 w-3 text-zinc-500" />
                                    <span>Atleta Oficial</span>
                                  </span>
                                )}
                              </td>

                              {/* Ações com Dropdown */}
                              <td className="py-4 px-6 text-right">
                                <div className="relative inline-flex items-center justify-end gap-1.5">
                                  {/* Botão de Atalho Rápido: Ver Perfil */}
                                  <Link
                                    href={`/atleta/${u.id}`}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-600/15 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 hover:text-white text-xs font-bold transition-all shadow-sm active:scale-95"
                                    title="Acessar o perfil público deste atleta"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    <span>Ver Perfil</span>
                                  </Link>

                                  {/* Botão Trigger do Dropdown */}
                                  <div className="relative">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenDropdownUserId(isDropdownOpen ? null : u.id);
                                      }}
                                      className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer border border-transparent hover:border-zinc-700"
                                      title="Mais opções"
                                    >
                                      <MoreVertical className="h-4 w-4" />
                                    </button>

                                    {/* Menu Dropdown Suspenso */}
                                    {isDropdownOpen && (
                                      <div
                                        onClick={(e) => e.stopPropagation()}
                                        className="absolute right-0 top-full mt-1.5 w-48 rounded-2xl bg-[#18181b] border border-zinc-700/80 p-1.5 shadow-2xl z-50 text-left space-y-1 animate-fadeIn"
                                      >
                                        <Link
                                          href={`/atleta/${u.id}`}
                                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-zinc-200 hover:text-white hover:bg-zinc-800 transition-colors"
                                        >
                                          <ExternalLink className="h-3.5 w-3.5 text-purple-400" />
                                          <span>Ver Perfil Público</span>
                                        </Link>

                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            handleCopy(u.id, e);
                                            setOpenDropdownUserId(null);
                                          }}
                                          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-zinc-200 hover:text-white hover:bg-zinc-800 transition-colors text-left cursor-pointer"
                                        >
                                          <Copy className="h-3.5 w-3.5 text-zinc-400" />
                                          <span>Copiar ID do Atleta</span>
                                        </button>

                                        {u.email && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              handleCopy(u.email!, e);
                                              setOpenDropdownUserId(null);
                                            }}
                                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-zinc-200 hover:text-white hover:bg-zinc-800 transition-colors text-left cursor-pointer"
                                          >
                                            <Mail className="h-3.5 w-3.5 text-zinc-400" />
                                            <span>Copiar E-mail</span>
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
