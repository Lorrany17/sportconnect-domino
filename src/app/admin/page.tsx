"use client";

import React, { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthProvider";
import { supabase } from "@/lib/supabase";
import { Tournament, SportType } from "@/types";

interface OrganizerProfile {
  id: string;
  full_name?: string;
  email?: string;
}

const SPORT_META: Record<string, { label: string; icon: string; color: string }> = {
  DOMINO: { label: "Dominó", icon: "🁓", color: "text-amber-400" },
  PING_PONG: { label: "Ping Pong", icon: "🏓", color: "text-blue-400" },
  FUTSAL: { label: "Futsal", icon: "⚽", color: "text-emerald-400" },
  VOLEI: { label: "Vôlei", icon: "🏐", color: "text-orange-400" },
};

export default function AdminPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [organizers, setOrganizers] = useState<Record<string, OrganizerProfile>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sportFilter, setSportFilter] = useState<string>("ALL");

  // 1. Verificação de Permissão Super Admin e Carregamento Global de Torneios
  useEffect(() => {
    let mounted = true;

    async function checkAdminAndLoadTournaments() {
      if (!user) return;

      try {
        setLoading(true);

        // A. Verifica se o usuário atual é Super Admin (is_admin === true na tabela profiles)
        let isSuperAdmin = Boolean(
          user.email === "admin@sportconnect.com" ||
          user.email === "santoslorrany250@gmail.com" ||
          user.id === "organizer-admin-session"
        );

        if (!isSuperAdmin) {
          const { data: profile, error: profileErr } = await supabase
            .from("profiles")
            .select("is_admin")
            .eq("id", user.id)
            .maybeSingle();

          if (profileErr) {
            console.warn("Aviso ao consultar profiles:", profileErr.message);
          }

          if (profile?.is_admin === true) {
            isSuperAdmin = true;
          }
        }

        // Se for false ou nulo, redireciona imediatamente para o Hub Central
        if (!isSuperAdmin) {
          console.warn("Acesso negado: o usuário não é Super Admin.");
          router.replace("/hub");
          return;
        }

        // B. Faz o SELECT * FROM tournaments (RLS do Supabase traz todos os torneios para Super Admin)
        const { data: dbTournaments, error: tournErr } = await supabase
          .from("tournaments")
          .select("*")
          .order("created_at", { ascending: false });

        if (tournErr) {
          console.error("Erro ao buscar torneios no painel admin:", tournErr);
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

        if (mounted) {
          setTournaments(tournsList);
        }

        // C. Busca perfis dos organizadores para exibir e-mail e nome correspondentes ao owner_id
        const ownerIds = Array.from(
          new Set(tournsList.map((t) => t.owner_id).filter(Boolean))
        ) as string[];

        if (ownerIds.length > 0) {
          try {
            const { data: profilesData } = await supabase
              .from("profiles")
              .select("id, full_name, email")
              .in("id", ownerIds);

            if (profilesData && mounted) {
              const orgMap: Record<string, OrganizerProfile> = {};
              profilesData.forEach((p: any) => {
                orgMap[p.id] = {
                  id: p.id,
                  full_name: p.full_name,
                  email: p.email,
                };
              });
              setOrganizers(orgMap);
            }
          } catch (pErr) {
            console.warn("Aviso ao buscar profiles de organizadores:", pErr);
          }
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

    checkAdminAndLoadTournaments();

    return () => {
      mounted = false;
    };
  }, [user, router]);

  // Recarregar dados manualmente
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const { data: dbTournaments } = await supabase
        .from("tournaments")
        .select("*")
        .order("created_at", { ascending: false });

      if (dbTournaments) {
        setTournaments(
          dbTournaments.map((t: any) => ({
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
    } catch (err) {
      console.error("Erro ao atualizar lista de torneios:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Copiar ID do Organizador para a área de transferência
  const handleCopyId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Redirecionamento "Forçar Acesso ao Painel"
  const handleForceAccess = (tournamentId: string) => {
    router.push(`/dashboard/${tournamentId}`);
  };

  // Filtragem dos torneios
  const filteredTournaments = useMemo(() => {
    return tournaments.filter((t) => {
      // Filtro de Texto
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

      // Filtro de Status
      if (statusFilter !== "ALL") {
        if ((t.status || "ATIVO").toUpperCase() !== statusFilter.toUpperCase()) {
          return false;
        }
      }

      // Filtro de Modalidade
      if (sportFilter !== "ALL") {
        if (t.sport_type !== sportFilter) {
          return false;
        }
      }

      return true;
    });
  }, [tournaments, searchQuery, statusFilter, sportFilter, organizers]);

  // KPIs Administrativos
  const stats = useMemo(() => {
    const total = tournaments.length;
    const active = tournaments.filter(
      (t) => (t.status || "ATIVO").toUpperCase() === "ATIVO" || (t.status || "").toUpperCase() === "EM_ANDAMENTO"
    ).length;
    const completed = tournaments.filter(
      (t) => (t.status || "").toUpperCase() === "FINALIZADO"
    ).length;
    const totalSpots = tournaments.reduce((acc, t) => acc + (t.max_teams || 16), 0);
    const uniqueOrganizers = new Set(tournaments.map((t) => t.owner_id).filter(Boolean)).size;

    return { total, active, completed, totalSpots, uniqueOrganizers };
  }, [tournaments]);

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-[#0a0a0c] text-white flex flex-col items-center justify-center p-6">
          <Loader2 className="h-10 w-10 text-purple-500 animate-spin mb-4" />
          <h2 className="text-base font-bold text-white">Carregando Painel Super Admin...</h2>
          <p className="text-xs text-zinc-500 mt-1">Verificando permissões de sócio e sincronizando campeonatos.</p>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0a0a0c] text-[#e4e4e7] flex flex-col selection:bg-purple-500/30 selection:text-white">
        {/* Barra Superior do Super Admin */}
        <header className="w-full border-b border-[#27272a] bg-[#121214]/95 backdrop-blur-md sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
            {/* Lado Esquerdo: Logo & Badge */}
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
                <span>Painel Super Admin</span>
              </div>
            </div>

            {/* Lado Direito: Ações */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold text-zinc-300 hover:text-white transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
                title="Atualizar lista"
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

        {/* Conteúdo Principal */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
          {/* Banner de Boas-Vindas & Central dos Sócios */}
          <section className="bg-gradient-to-r from-[#16121f] via-[#121216] to-[#0f0f12] border border-purple-500/20 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div className="space-y-2 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-black uppercase tracking-wider">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Central do Sistema • Visão dos Sócios</span>
                </div>
                <h1 className="text-2xl sm:text-4xl font-black text-white font-display tracking-tight">
                  Controle Global de Torneios
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                  Gerencie qualquer campeonato cadastrado na plataforma SportConnect independentemente do organizador. Você possui bypass total de edição, chaves e financeiro.
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
                  ● Permissão Irrestrita Ativa
                </span>
              </div>
            </div>
          </section>

          {/* Cards de Métricas Globais */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-[#121214] border border-[#27272a] space-y-1 shadow-md">
              <span className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5 text-purple-400" />
                <span>Total de Torneios</span>
              </span>
              <div className="text-2xl sm:text-3xl font-black text-white font-display">
                {stats.total}
              </div>
              <p className="text-[11px] text-zinc-500">Registrados na base de dados</p>
            </div>

            <div className="p-5 rounded-2xl bg-[#121214] border border-[#27272a] space-y-1 shadow-md">
              <span className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Torneios Ativos</span>
              </span>
              <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-display">
                {stats.active}
              </div>
              <p className="text-[11px] text-zinc-500">Inscrições abertas ou em jogo</p>
            </div>

            <div className="p-5 rounded-2xl bg-[#121214] border border-[#27272a] space-y-1 shadow-md">
              <span className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-blue-400" />
                <span>Organizadores Únicos</span>
              </span>
              <div className="text-2xl sm:text-3xl font-black text-white font-display">
                {stats.uniqueOrganizers}
              </div>
              <p className="text-[11px] text-zinc-500">Criadores de torneio cadastrados</p>
            </div>

            <div className="p-5 rounded-2xl bg-[#121214] border border-[#27272a] space-y-1 shadow-md">
              <span className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-amber-400" />
                <span>Vagas Oferecidas</span>
              </span>
              <div className="text-2xl sm:text-3xl font-black text-amber-400 font-display">
                {stats.totalSpots}
              </div>
              <p className="text-[11px] text-zinc-500">Vagas totais de atletas/equipes</p>
            </div>
          </div>

          {/* Barra de Busca e Filtros */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-[#121214] border border-[#27272a] rounded-2xl">
            {/* Input de Busca */}
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
              {/* Filtro de Status */}
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

              {/* Filtro de Esporte */}
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

          {/* Tabela Administrativa de Torneios */}
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
                          {/* Coluna 1: Nome do Torneio */}
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

                          {/* Coluna 2: ID do Organizador & Perfil */}
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
                                    onClick={(e) => handleCopyId(t.owner_id!, e)}
                                    className="text-zinc-500 hover:text-white transition-colors cursor-pointer p-0.5"
                                    title="Copiar ID do Organizador"
                                  >
                                    {copiedId === t.owner_id ? (
                                      <Check className="h-3 w-3 text-emerald-400" />
                                    ) : (
                                      <Copy className="h-3 w-3" />
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Coluna 3: Status */}
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

                          {/* Coluna 4: Vagas & Taxa */}
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

                          {/* Coluna 5: Ação Super Admin */}
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
        </main>
      </div>
    </ProtectedRoute>
  );
}
