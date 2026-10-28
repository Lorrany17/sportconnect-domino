"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Trophy,
  Users,
  Calendar,
  MapPin,
  Plus,
  Compass,
  ArrowRight,
  LogOut,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertCircle,
  LayoutDashboard,
  Shield,
  Loader2,
  RefreshCw,
  ExternalLink,
  Ban,
  ShieldCheck,
  CreditCard,
  AlertTriangle,
  X,
  Lock,
} from "lucide-react";
import { useAuth } from "@/context/AuthProvider";
import { useTournament } from "@/context/TournamentContext";
import { supabase } from "@/lib/supabase";
import { Tournament, SportType } from "@/types";
import CreateTournamentModal from "@/components/CreateTournamentModal";
import PixCheckoutForm from "@/components/PixCheckoutForm";
import { cancelRegistration } from "@/app/actions/registration";

export interface MyRegistration {
  id: string; // Team ID
  name: string; // Team/Dupla Name
  player1?: string;
  player2?: string;
  manager_name?: string;
  payment_status: "APPROVED" | "PAID" | "WAITING_PIX" | "WAITING_APPROVAL" | "PENDING" | string;
  payout_status?: "COMPLETED" | "FAILED_TRANSFER" | "PENDING" | string;
  payment_proof_url?: string | null;
  status?: string;
  cancellation_status?: string;
  created_at?: string;
  tournament_id?: string;
  tournament?: Tournament | null;
}

export interface MyOrganizedTournament extends Tournament {
  teamsCount: number;
  approvedTeamsCount: number;
  staffRole?: string;
}

const SPORT_META: Record<string, { label: string; icon: string; color: string }> = {
  DOMINO: { label: "Dominó", icon: "🁓", color: "text-amber-400" },
  PING_PONG: { label: "Ping Pong", icon: "🏓", color: "text-blue-400" },
  FUTSAL: { label: "Futsal", icon: "⚽", color: "text-emerald-400" },
  VOLEI: { label: "Vôlei", icon: "🏐", color: "text-orange-400" },
};

export default function HubCentral() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const { logout, setCurrentTournamentId } = useTournament();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Estados com os dados reais do usuário
  const [myTournaments, setMyTournaments] = useState<MyOrganizedTournament[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<MyRegistration[]>([]);

  // Estados para retomada de pagamento e cancelamento pós-pagamento
  const [checkoutRegistration, setCheckoutRegistration] = useState<MyRegistration | null>(null);
  const [cancellingPaidReg, setCancellingPaidReg] = useState<MyRegistration | null>(null);
  const [isCancellingId, setIsCancellingId] = useState<string | null>(null);

  // Nome do usuário formatado
  const userName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Atleta";

  // Busca simultânea no Supabase: Torneios do Organizador e Inscrições do Atleta
  const fetchUserData = useCallback(async () => {
    if (!user?.id) return;

    try {
      // 1. Torneios Organizados: SELECT * FROM tournaments WHERE owner_id = [user.id]
      const { data: tournamentsData, error: tournError } = await supabase
        .from("tournaments")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

      if (tournError) {
        console.warn("Aviso ao carregar torneios organizados:", tournError);
      }

      // 1.1 Torneios Compartilhados (Equipe via RBAC)
      const userEmail = user.email?.toLowerCase().trim();
      let sharedTournIds: { id: string; role: string }[] = [];
      if (userEmail) {
        try {
          const { data: staffData } = await supabase
            .from("tournament_staff")
            .select("tournament_id, role")
            .or(`user_id.eq.${user.id},email.eq.${userEmail}`);

          if (staffData && staffData.length > 0) {
            sharedTournIds = staffData
              .filter((s: any) => s.tournament_id)
              .map((s: any) => ({ id: s.tournament_id, role: s.role }));
          }
        } catch (staffErr) {
          console.warn("Aviso ao consultar tournament_staff:", staffErr);
        }
      }

      // Torneios compartilhados que não são de propriedade do próprio usuário
      const ownedIds = new Set((tournamentsData || []).map((t) => t.id));
      const missingSharedIds = sharedTournIds.filter((s) => !ownedIds.has(s.id));

      let allTournaments = [...(tournamentsData || [])];
      if (missingSharedIds.length > 0) {
        try {
          const { data: sharedTourns } = await supabase
            .from("tournaments")
            .select("*")
            .in("id", missingSharedIds.map((s) => s.id));

          if (sharedTourns && sharedTourns.length > 0) {
            allTournaments = [...allTournaments, ...sharedTourns];
          }
        } catch (stErr) {
          console.warn("Aviso ao carregar torneios compartilhados:", stErr);
        }
      }

      // 2. Minhas Inscrições (Atleta): SELECT *, tournaments(*) FROM teams WHERE user_id = [user.id]
      const { data: teamsData, error: teamsError } = await supabase
        .from("teams")
        .select("*, tournaments(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (teamsError) {
        console.warn("Aviso ao carregar inscrições do atleta:", teamsError);
      }

      // Processar Torneios e contagem de vagas preenchidas
      if (allTournaments.length > 0) {
        const tournIds = allTournaments.map((t) => t.id);
        const teamCounts: Record<string, { total: number; approved: number }> = {};

        if (tournIds.length > 0) {
          const { data: teamRows } = await supabase
            .from("teams")
            .select("id, tournament_id, payment_status, status")
            .in("tournament_id", tournIds);

          if (teamRows) {
            teamRows.forEach((r) => {
              if (!teamCounts[r.tournament_id]) {
                teamCounts[r.tournament_id] = { total: 0, approved: 0 };
              }
              teamCounts[r.tournament_id].total++;
              if (
                r.payment_status === "PAID" ||
                r.payment_status === "APPROVED" ||
                r.status === "CONFIRMED" ||
                r.status === "PAID"
              ) {
                teamCounts[r.tournament_id].approved++;
              }
            });
          }
        }

        const staffRoleMap: Record<string, string> = {};
        sharedTournIds.forEach((s) => {
          staffRoleMap[s.id] = s.role;
        });

        const mappedTournaments: MyOrganizedTournament[] = allTournaments.map((t) => ({
          id: t.id,
          name: t.name,
          status: t.status,
          createdAt: t.created_at,
          sport_type: (t.sport_type as SportType) || "DOMINO",
          format: t.format,
          owner_id: t.owner_id,
          max_teams: t.max_teams ? Number(t.max_teams) : 16,
          entry_fee: t.entry_fee ? Number(t.entry_fee) : 0,
          location: t.location,
          start_date: t.start_date,
          end_date: t.end_date,
          rules: t.rules,
          cover_url: t.cover_url,
          organizer_pix_key: t.organizer_pix_key,
          teamsCount: teamCounts[t.id]?.total || 0,
          approvedTeamsCount: teamCounts[t.id]?.approved || 0,
          staffRole: t.owner_id === user.id ? undefined : staffRoleMap[t.id],
        }));

        setMyTournaments(mappedTournaments);
      } else {
        setMyTournaments([]);
      }

      // Processar Minhas Inscrições
      if (teamsData) {
        // Fallback para buscar torneios caso a junção direta não tenha preenchido
        const missingTournIds = teamsData
          .filter((t) => !t.tournaments && t.tournament_id)
          .map((t) => t.tournament_id);

        const fallbackMap: Record<string, any> = {};
        if (missingTournIds.length > 0) {
          const { data: fbData } = await supabase
            .from("tournaments")
            .select("*")
            .in("id", missingTournIds);

          if (fbData) {
            fbData.forEach((fb) => {
              fallbackMap[fb.id] = fb;
            });
          }
        }

        const mappedRegistrations: MyRegistration[] = teamsData.map((t) => {
          const rawTourn = Array.isArray(t.tournaments) ? t.tournaments[0] : t.tournaments;
          const finalTourn = rawTourn || fallbackMap[t.tournament_id] || null;

          return {
            id: t.id,
            name: t.name,
            player1: t.player1,
            player2: t.player2,
            manager_name: t.manager_name,
            payment_status: t.payment_status || (t.status === "CONFIRMED" || t.status === "PAID" ? "PAID" : "PENDING"),
            payout_status: t.payout_status,
            payment_proof_url: t.payment_proof_url || null,
            status: t.status,
            cancellation_status: t.cancellation_status,
            created_at: t.created_at,
            tournament_id: t.tournament_id,
            tournament: finalTourn
              ? {
                id: finalTourn.id,
                name: finalTourn.name,
                status: finalTourn.status,
                createdAt: finalTourn.created_at,
                sport_type: (finalTourn.sport_type as SportType) || "DOMINO",
                format: finalTourn.format,
                location: finalTourn.location,
                start_date: finalTourn.start_date,
                end_date: finalTourn.end_date,
                cover_url: finalTourn.cover_url,
                entry_fee: finalTourn.entry_fee ? Number(finalTourn.entry_fee) : 0,
                max_teams: finalTourn.max_teams ? Number(finalTourn.max_teams) : 16,
              }
              : null,
          };
        });

        setMyRegistrations(mappedRegistrations);
      }
    } catch (err) {
      console.error("Exceção ao buscar dados da dashboard:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchUserData();
  };

  const handleLogout = async () => {
    logout();
    await signOut();
    router.push("/login");
  };

  // Ação de Cancelamento de Inscrição pelo Atleta
  const handleRequestCancellation = (reg: MyRegistration) => {
    if (reg.tournament?.status && reg.tournament.status !== "OPEN") {
      alert("Não é possível cancelar a inscrição: o chaveamento do torneio já foi gerado.");
      return;
    }

    const isPaid = reg.status === "PAID" || reg.payment_status === "PAID" || reg.payment_status === "APPROVED";

    if (isPaid) {
      // Abre o Modal de Aviso de Cancelamento Pós-Pagamento
      setCancellingPaidReg(reg);
      return;
    }

    if (!window.confirm("Deseja realmente cancelar sua inscrição nesta competição?")) {
      return;
    }

    executeCancellation(reg.id, "REQUESTED_BY_ATHLETE");
  };

  const executeCancellation = async (teamId: string, status: "REQUESTED_BY_ATHLETE" | "REFUND_REQUESTED") => {
    setIsCancellingId(teamId);
    try {
      const res = await cancelRegistration(teamId, status);

      if (!res.success) {
        console.error("Erro ao solicitar cancelamento via Server Action:", res.error);
        alert(res.error || "Erro ao solicitar cancelamento.");
        return;
      }

      setMyRegistrations((prev) =>
        prev.map((reg) =>
          reg.id === teamId
            ? { ...reg, cancellation_status: status }
            : reg
        )
      );

      setCancellingPaidReg(null);
    } catch (err: any) {
      console.error("Exceção ao solicitar cancelamento:", err);
      alert(err?.message || "Erro ao solicitar cancelamento da inscrição.");
    } finally {
      setIsCancellingId(null);
    }
  };

  const formatDate = (dateString?: string, timeString?: string) => {
    if (!dateString) return "Data a definir";
    try {
      let d: Date;
      if (typeof dateString === "string" && dateString.includes("-")) {
        const datePart = dateString.split("T")[0];
        const parts = datePart.split("-").map(Number);
        if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
          d = new Date(parts[0], parts[1] - 1, parts[2]);
        } else {
          d = new Date(dateString);
        }
      } else {
        d = new Date(dateString);
      }
      if (isNaN(d.getTime())) return "Data a definir";
      const formatted = d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      if (timeString && timeString.trim()) {
        return `${formatted} às ${timeString.trim()}`;
      }
      return formatted;
    } catch {
      return "Data a definir";
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-[#e4e4e7] flex flex-col justify-between selection:bg-[#00a2ff]/30 selection:text-white">
      {/* 1. Header de Navegação Global */}
      <header className="w-full border-b border-[#27272a] bg-[#141416]/95 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          {/* Esquerda: Logotipo SportConnect */}
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/hub" className="flex items-center gap-2 group">
              <Image
                src="/logo.png"
                alt="SportConnect Logo"
                width={140}
                height={36}
                priority
                className="h-8 w-auto object-contain group-hover:opacity-90 transition-opacity"
              />
            </Link>
            <span className="hidden lg:inline-block px-2.5 py-0.5 rounded-full bg-[#00a2ff]/10 text-[#00a2ff] border border-[#00a2ff]/20 text-[10px] font-black uppercase tracking-wider">
              Dashboard
            </span>
          </div>

          {/* Centro: Links de Navegação */}
          <nav className="flex items-center gap-1.5 sm:gap-2">
            <Link
              href="/hub"
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#1e1e1e] text-white border border-[#27272a] shadow-sm flex items-center gap-1.5 transition-all"
            >
              <span className="w-2 h-2 rounded-full bg-[#00a2ff] animate-pulse" />
              <span>Início</span>
            </Link>
            <Link
              href="/explorar"
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:bg-[#1a1a1a] transition-all flex items-center gap-1.5"
            >
              <Compass className="h-3.5 w-3.5 text-zinc-400" />
              <span>Explorar Torneios</span>
            </Link>
          </nav>

          {/* Direita: Botão Novo Torneio + Menu do Usuário */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {isAdmin && (
              <Link
                href="/admin"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600/15 hover:bg-purple-600/25 border border-purple-500/30 text-purple-300 hover:text-white font-bold text-xs uppercase tracking-wider transition-all shadow-sm active:scale-95"
              >
                <ShieldCheck className="h-4 w-4 text-purple-400" />
                <span>⚙️ Central do Sistema</span>
              </Link>
            )}

            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#00a2ff] to-blue-600 hover:from-blue-500 hover:to-blue-600 text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Novo Torneio</span>
            </button>

            {/* Perfil do Usuário com link para /perfil */}
            <Link
              href="/perfil"
              className="flex items-center gap-2 pl-2 sm:border-l border-zinc-800 hover:opacity-85 transition-opacity group cursor-pointer"
              title="Acessar Meu Perfil"
            >
              {profile?.avatar_url ? (
                profile.avatar_url && !profile.avatar_url.startsWith("http") && !profile.avatar_url.startsWith("data:") ? (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500/25 via-[#1c1c20] to-zinc-800 flex items-center justify-center text-sm select-none border border-zinc-700/80 shadow-inner shrink-0 group-hover:border-[#00a2ff] transition-colors">
                    <span>{profile.avatar_url}</span>
                  </div>
                ) : (
                  <img
                    src={profile.avatar_url}
                    alt={userName}
                    className="w-8 h-8 rounded-xl object-cover border border-zinc-700/80 shadow-inner shrink-0 group-hover:border-[#00a2ff] transition-colors"
                  />
                )
              ) : (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-xs flex items-center justify-center uppercase shadow-inner shrink-0 group-hover:from-blue-500 group-hover:to-indigo-500 transition-all">
                  {userName.charAt(0)}
                </div>
              )}
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-bold text-white group-hover:text-[#00a2ff] transition-colors truncate max-w-[140px] leading-tight">
                  {userName}
                </span>
                <span className="text-[10px] text-zinc-500 truncate max-w-[140px]">
                  {user?.email}
                </span>
              </div>
            </Link>

            {/* Logout */}
            <button
              type="button"
              onClick={handleLogout}
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-red-600/10 border border-red-500/20 hover:bg-red-600/20 text-xs font-bold text-red-500 hover:text-red-400 transition-all cursor-pointer shadow-sm active:scale-95 flex items-center gap-1.5"
              title="Encerrar sessão"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Conteúdo Principal da Dashboard */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-12">
        {/* Banner de Saudação e Resumo */}
        <section className="bg-gradient-to-r from-[#18181b] via-[#141416] to-[#121214] border border-[#27272a] rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#00a2ff]/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00a2ff]/10 border border-[#00a2ff]/20 text-[#00a2ff] text-xs font-black uppercase tracking-wider">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Painel de Competições</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black text-white font-display tracking-tight">
                Olá, <span className="text-[#00a2ff]">{userName}</span>! 👋
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Acompanhe o andamento das suas inscrições como atleta e gerencie os campeonatos oficiais que você organizou na plataforma.
              </p>
            </div>

            {/* Ações do Topo */}
            <div className="flex items-center gap-3 shrink-0 self-start md:self-auto">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/60 text-xs font-bold text-zinc-300 hover:text-white transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-[#00a2ff]" : ""}`} />
                <span>Atualizar</span>
              </button>
            </div>
          </div>

          {/* Cards de Métricas Rápidas */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mt-8 pt-6 border-t border-zinc-800/80">
            <div className="bg-[#101012] border border-zinc-800/80 rounded-2xl p-4">
              <div className="flex items-center justify-between text-zinc-500 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Inscrições Ativas</span>
                <Users className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-white font-display">
                {myRegistrations.length}
              </div>
              <span className="text-[10px] text-zinc-500">Como atleta ou capitão</span>
            </div>

            <div className="bg-[#101012] border border-zinc-800/80 rounded-2xl p-4">
              <div className="flex items-center justify-between text-zinc-500 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Meus Campeonatos</span>
                <Trophy className="h-4 w-4 text-blue-400" />
              </div>
              <div className="text-2xl font-black text-white font-display">
                {myTournaments.length}
              </div>
              <span className="text-[10px] text-zinc-500">Torneios criados</span>
            </div>

            <div className="col-span-2 sm:col-span-1 bg-[#101012] border border-zinc-800/80 rounded-2xl p-4">
              <div className="flex items-center justify-between text-zinc-500 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Modalidades</span>
                <Shield className="h-4 w-4 text-amber-400" />
              </div>
              <div className="text-xs font-bold text-zinc-300 flex items-center gap-2 mt-1">
                <span>🁓 Dominó</span>
                <span>•</span>
                <span>🏓 Ping Pong</span>
                <span>•</span>
                <span>⚽ Futsal</span>
                <span>•</span>
                <span>🏐 Vôlei</span>
              </div>
              <span className="text-[10px] text-zinc-500 block mt-1">Multiesportes integrado</span>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="py-20 text-center space-y-3">
            <Loader2 className="h-8 w-8 text-[#00a2ff] animate-spin mx-auto" />
            <p className="text-xs font-bold text-zinc-400">Carregando seus campeonatos e inscrições...</p>
          </div>
        ) : (
          <div className="space-y-12">
            {/* ======================================================== */}
            {/* SEÇÃO 1: MINHAS INSCRIÇÕES (VISÃO ATLETA) */}
            {/* ======================================================== */}
            <section className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#27272a] pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white font-display tracking-tight flex items-center gap-2">
                      <span>Minhas Inscrições</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black">
                        {myRegistrations.length}
                      </span>
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Competições nas quais você inscreveu sua equipe ou dupla.
                    </p>
                  </div>
                </div>

                {myRegistrations.length > 0 && (
                  <Link
                    href="/explorar"
                    className="text-xs font-bold text-[#00a2ff] hover:text-blue-400 flex items-center gap-1 self-start sm:self-auto transition-colors"
                  >
                    <span>Inscrever-se em outro campeonato</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>

              {/* Renderização de Inscrições ou Empty State */}
              {myRegistrations.length === 0 ? (
                <div className="border-2 border-dashed border-zinc-800 bg-[#141416]/50 rounded-3xl p-10 text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-700/80 text-zinc-400 flex items-center justify-center mx-auto shadow-md">
                    <Compass className="h-7 w-7 text-emerald-400" />
                  </div>
                  <div className="space-y-1 max-w-md mx-auto">
                    <h3 className="text-base font-bold text-white">
                      Ainda não estás a participar em nenhum campeonato.
                    </h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Explore as arenas com inscrições abertas, encontre sua modalidade favorita e coloque sua equipe na disputa!
                    </p>
                  </div>
                  <div className="pt-2">
                    <Link
                      href="/explorar"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-600/20 active:scale-95"
                    >
                      <Compass className="h-4 w-4" />
                      <span>Explorar Torneios</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {myRegistrations.map((reg) => {
                    const sportType = reg.tournament?.sport_type || "DOMINO";
                    const sportInfo = SPORT_META[sportType] || SPORT_META.DOMINO;
                    const tournamentId = reg.tournament?.id || reg.tournament_id || "";

                    const isPaid = reg.status === "PAID" || reg.payment_status === "PAID";
                    const isApproved = isPaid || reg.payment_status === "APPROVED" || reg.status === "CONFIRMED";
                    const isWaitingApproval = !isApproved && (reg.payment_status === "WAITING_APPROVAL" || Boolean(reg.payment_proof_url));
                    const isWaitingPix = !isApproved && !isWaitingApproval && reg.payment_status === "WAITING_PIX";
                    const isPending = !isApproved && !isWaitingApproval && !isWaitingPix;
                    const isTournamentNotOpen = Boolean(reg.tournament?.status && reg.tournament.status !== "OPEN");

                    return (
                      <div
                        key={reg.id}
                        onClick={() => {
                          if (tournamentId) router.push(`/torneio/${tournamentId}`);
                        }}
                        className="bg-[#1a1a1a] border border-[#27272a] hover:border-[#00a2ff]/60 rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 shadow-xl hover:shadow-[#00a2ff]/10 cursor-pointer group relative overflow-hidden"
                      >
                        {/* Linha decorativa superior sutil */}
                        <div
                          className={`absolute top-0 left-0 right-0 ${
                            isPaid
                              ? "h-1.5 bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400 shadow-[0_0_12px_rgba(16,185,129,0.7)]"
                              : isApproved
                                ? "h-1 bg-emerald-500"
                                : isWaitingApproval
                                  ? "h-1 bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                                  : isWaitingPix
                                    ? "h-1 bg-orange-500"
                                    : "h-1 bg-yellow-500"
                          }`}
                        />

                        <div className="space-y-3.5">
                          {/* Topo do Mini Card: Modalidade & Status do Pagamento */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#121214] border border-zinc-800 text-[11px] font-bold text-zinc-300">
                              <span>{sportInfo.icon}</span>
                              <span>{sportInfo.label}</span>
                            </span>

                            {/* Badge de Status de Pagamento e Cancelamento */}
                            {reg.cancellation_status === "REFUND_REQUESTED" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-black uppercase tracking-wider">
                                <AlertTriangle className="h-3 w-3" />
                                <span>Reembolso Solicitado</span>
                              </span>
                            ) : reg.cancellation_status === "REQUESTED_BY_ATHLETE" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-black uppercase tracking-wider">
                                <Clock className="h-3 w-3 animate-pulse" />
                                <span>Cancelamento Solicitado</span>
                              </span>
                            ) : reg.cancellation_status === "REFUNDED" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/25 text-red-400 text-[10px] font-black uppercase tracking-wider">
                                <Ban className="h-3 w-3" />
                                <span>Cancelado / Estornado</span>
                              </span>
                            ) : (
                              <>
                                {isPaid ? (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400 text-emerald-300 text-[11px] font-black uppercase tracking-wider shadow-[0_0_15px_rgba(16,185,129,0.4)] animate-pulse">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                    <span>Inscrição Confirmada! ✅</span>
                                  </span>
                                ) : isApproved ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                                    <CheckCircle2 className="h-3 w-3 shrink-0" />
                                    <span>Inscrição Confirmada! ✅</span>
                                  </span>
                                ) : isWaitingApproval ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 text-[10px] font-black uppercase tracking-wider">
                                    <Clock className="h-3 w-3 animate-pulse" />
                                    <span>Em Análise</span>
                                  </span>
                                ) : isWaitingPix ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/25 text-orange-400 text-[10px] font-black uppercase tracking-wider">
                                    <Clock className="h-3 w-3 animate-pulse" />
                                    <span>Aguardando Pix</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/25 text-yellow-400 text-[10px] font-black uppercase tracking-wider">
                                    <AlertCircle className="h-3 w-3" />
                                    <span>Pendente</span>
                                  </span>
                                )}
                              </>
                            )}
                          </div>

                          {/* Nome do Torneio */}
                          <div>
                            <h3 className="text-base font-black text-white font-display tracking-tight group-hover:text-[#00a2ff] transition-colors line-clamp-1">
                              {reg.tournament?.name || "Campeonato Oficial"}
                            </h3>
                            {reg.tournament?.location && (
                              <p className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5">
                                <MapPin className="h-3 w-3 text-zinc-500 shrink-0" />
                                <span className="truncate">{reg.tournament.location}</span>
                              </p>
                            )}
                          </div>

                          {/* Feedback de Confirmação para Inscrição Paga */}
                          {isPaid && (
                            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-[11px] font-medium flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                              <span>Vaga confirmada! Você está oficialmente no torneio.</span>
                            </div>
                          )}

                          {/* Feedback de Comprovante em Análise */}
                          {isWaitingApproval && (
                            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[11px] font-medium flex items-center gap-2">
                              <Clock className="h-3.5 w-3.5 text-blue-400 shrink-0 animate-pulse" />
                              <span>Comprovante em análise • O organizador foi notificado.</span>
                            </div>
                          )}

                          {/* Dados da Equipe / Dupla Registrada */}
                          <div className="p-3 rounded-xl bg-[#121214] border border-zinc-800/80 space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                              Minha Equipe / Dupla
                            </span>
                            <div className="text-xs font-bold text-zinc-100 truncate">
                              {reg.name}
                            </div>
                            {(reg.player1 || reg.player2) && (
                              <div className="text-[10px] text-zinc-400 truncate">
                                {[reg.player1, reg.player2].filter(Boolean).join(" • ")}
                              </div>
                            )}
                          </div>

                          {/* Alerta de Cancelamento Solicitado ou Botões de Ação */}
                          {reg.cancellation_status === "REFUND_REQUESTED" ? (
                            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] font-medium flex items-center gap-2">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                              <span>Cancelamento pós-pagamento solicitado • O reembolso deve ser negociado diretamente com a organização.</span>
                            </div>
                          ) : reg.cancellation_status === "REQUESTED_BY_ATHLETE" ? (
                            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] font-medium flex items-center gap-2">
                              <Clock className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                              <span>Cancelamento solicitado • O organizador foi notificado.</span>
                            </div>
                          ) : (
                            <div className="pt-1 space-y-2">
                              {/* Botão de Ação Primária: Finalizar Pagamento (se PENDING ou WAITING_PIX e sem comprovante em análise) */}
                              {(isWaitingPix || isPending) && !isWaitingApproval && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCheckoutRegistration(reg);
                                  }}
                                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-500 hover:from-orange-400 hover:to-amber-300 text-neutral-950 text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-orange-500/20 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                                  title="Finalizar pagamento e anexar comprovante"
                                >
                                  <CreditCard className="h-3.5 w-3.5" />
                                  <span>Finalizar Pagamento</span>
                                </button>
                              )}

                              {/* Botão Cancelar Minha Inscrição */}
                              <button
                                type="button"
                                disabled={isTournamentNotOpen}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isTournamentNotOpen) return;
                                  handleRequestCancellation(reg);
                                }}
                                className={`w-full py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm ${
                                  isTournamentNotOpen
                                    ? "border-zinc-800 bg-zinc-900/50 text-zinc-600 cursor-not-allowed opacity-60"
                                    : "border-red-500/30 hover:border-red-500/60 bg-red-500/5 hover:bg-red-500/15 text-red-400 hover:text-red-300 cursor-pointer active:scale-95"
                                }`}
                                title={
                                  isTournamentNotOpen
                                    ? "Cancelamento indisponível após o fechamento das chaves."
                                    : "Solicitar cancelamento da inscrição"
                                }
                              >
                                {isTournamentNotOpen ? (
                                  <Lock className="h-3.5 w-3.5 text-zinc-600" />
                                ) : (
                                  <Ban className="h-3.5 w-3.5 text-red-400" />
                                )}
                                <span>Cancelar Minha Inscrição</span>
                              </button>

                              {isTournamentNotOpen && (
                                <p className="text-[10px] text-zinc-500 text-center font-medium mt-1 flex items-center justify-center gap-1">
                                  <Lock className="h-3 w-3 shrink-0 text-zinc-500" />
                                  <span>Cancelamento indisponível após o fechamento das chaves.</span>
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Rodapé do Mini Card */}
                        <div className="pt-3 mt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs font-bold text-zinc-400 group-hover:text-white transition-colors">
                          <span className="text-[11px] text-zinc-500">
                            {formatDate(reg.tournament?.start_date || reg.created_at)}
                          </span>
                          <span className="flex items-center gap-1 text-[#00a2ff] text-[11px]">
                            <span>Ver Página</span>
                            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ======================================================== */}
            {/* SEÇÃO 2: MEUS CAMPEONATOS (VISÃO ORGANIZADOR) */}
            {/* ======================================================== */}
            <section className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#27272a] pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-[#00a2ff]/10 border border-[#00a2ff]/20 text-[#00a2ff]">
                    <Trophy className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white font-display tracking-tight flex items-center gap-2">
                      <span>Meus Campeonatos</span>
                      <span className="px-2 py-0.5 rounded-full bg-[#00a2ff]/10 text-[#00a2ff] border border-[#00a2ff]/20 text-[10px] font-black">
                        {myTournaments.length}
                      </span>
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Torneios criados e administrados por você com controle total de súmula e chaveamento.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/60 text-xs font-bold text-zinc-200 hover:text-white transition-all self-start sm:self-auto cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 text-[#00a2ff]" />
                  <span>Novo Campeonato</span>
                </button>
              </div>

              {/* Renderização de Campeonatos Criados ou Empty State */}
              {myTournaments.length === 0 ? (
                <div className="border-2 border-dashed border-zinc-800 bg-[#141416]/50 rounded-3xl p-10 text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-700/80 text-zinc-400 flex items-center justify-center mx-auto shadow-md">
                    <Trophy className="h-7 w-7 text-[#00a2ff]" />
                  </div>
                  <div className="space-y-1 max-w-md mx-auto">
                    <h3 className="text-base font-bold text-white">
                      Você ainda não criou nenhum campeonato.
                    </h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Monte seu torneio personalizado em minutos com chaveamento mata-mata automático, súmula digital e pagamentos via Pix.
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(true)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00a2ff] hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-blue-500/20 active:scale-95 cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Criar Meu Primeiro Torneio</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {myTournaments.map((tourn) => {
                    const sportType = tourn.sport_type || "DOMINO";
                    const sportInfo = SPORT_META[sportType] || SPORT_META.DOMINO;
                    const maxVagas = tourn.max_teams || 16;
                    const preenchidas = tourn.teamsCount;
                    const pct = Math.min(100, Math.round((preenchidas / maxVagas) * 100));

                    const isFinalizado = tourn.status === "FINALIZADO";

                    return (
                      <div
                        key={tourn.id}
                        onClick={() => {
                          setCurrentTournamentId(tourn.id);
                          router.push(`/dashboard/${tourn.id}`);
                        }}
                        className="bg-[#1a1a1a] border border-[#27272a] hover:border-[#00a2ff]/60 rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 shadow-xl hover:shadow-[#00a2ff]/10 cursor-pointer group relative overflow-hidden"
                      >
                        {/* Linha decorativa superior azul */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#00a2ff] to-indigo-500" />

                        <div className="space-y-4">
                          {/* Topo do Card: Modalidade & Status do Torneio */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#121214] border border-zinc-800 text-[11px] font-bold text-zinc-300">
                              <span>{sportInfo.icon}</span>
                              <span>{sportInfo.label}</span>
                              {tourn.format && (
                                <>
                                  <span className="text-zinc-600">•</span>
                                  <span className="text-zinc-400 capitalize">{tourn.format}</span>
                                </>
                              )}
                            </span>

                            <div className="flex items-center gap-1.5">
                              {tourn.staffRole && (
                                <span className="px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 text-[10px] font-bold uppercase tracking-wider">
                                  {tourn.staffRole === "ADMIN"
                                    ? "Admin"
                                    : tourn.staffRole === "REFEREE"
                                    ? "Árbitro"
                                    : "Mesário"}
                                </span>
                              )}

                              {isFinalizado ? (
                                <span className="px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 text-[10px] font-bold uppercase tracking-wider">
                                  Finalizado
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  <span>Ativo</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Nome do Torneio */}
                          <div>
                            <h3 className="text-base font-black text-white font-display tracking-tight group-hover:text-[#00a2ff] transition-colors line-clamp-1">
                              {tourn.name}
                            </h3>
                            <div className="flex items-center gap-3 text-[11px] text-zinc-400 mt-1">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-zinc-500 shrink-0" />
                                <span>{formatDate(tourn.start_date, tourn.start_time)}</span>
                              </span>
                              {tourn.location && (
                                <span className="flex items-center gap-1 truncate max-w-[130px]">
                                  <MapPin className="h-3 w-3 text-zinc-500 shrink-0" />
                                  <span className="truncate">{tourn.location}</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Estatísticas Rápidas: Vagas Preenchidas & Taxa */}
                          <div className="p-3 rounded-xl bg-[#121214] border border-zinc-800/80 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-zinc-500 font-medium">Vagas Ocupadas:</span>
                              <span className="font-bold text-white">
                                <strong className="text-[#00a2ff]">{preenchidas}</strong> / {maxVagas} equipes
                              </span>
                            </div>

                            {/* Barra de Progresso de Ocupação */}
                            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-[#00a2ff] to-blue-500 rounded-full transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>

                            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-zinc-800/50">
                              <span className="text-zinc-500">Inscrição:</span>
                              <span className="font-bold text-emerald-400">
                                {tourn.entry_fee && tourn.entry_fee > 0
                                  ? `R$ ${tourn.entry_fee.toFixed(2).replace(".", ",")}`
                                  : "Gratuito"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Botão de Ação / Rodapé */}
                        <div className="pt-3 mt-4 border-t border-zinc-800/80">
                          <button
                            type="button"
                            className="w-full py-2 px-3 rounded-xl bg-zinc-900 group-hover:bg-[#00a2ff] text-zinc-300 group-hover:text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            <LayoutDashboard className="h-3.5 w-3.5" />
                            <span>Gerenciar Painel</span>
                            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* 3. Rodapé Minimalista */}
      <footer className="border-t border-[#27272a] py-6 text-center text-xs text-zinc-500 bg-[#141416]/50">
        <div>SportConnect Hub • Plataforma de Gestão Esportiva Multimodal</div>
      </footer>

      {/* Modal de Criação de Torneio */}
      <CreateTournamentModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          fetchUserData();
        }}
      />

      {/* MODAL: FINALIZAR PAGAMENTO (RETOMAR CHECKOUT PIX) */}
      {checkoutRegistration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto animate-fadeIn">
          <PixCheckoutForm
            tournamentId={checkoutRegistration.tournament?.id || checkoutRegistration.tournament_id || ""}
            tournamentName={checkoutRegistration.tournament?.name || "Torneio Oficial"}
            teamId={checkoutRegistration.id}
            teamName={checkoutRegistration.name}
            captainName={checkoutRegistration.manager_name || checkoutRegistration.player1 || userName}
            totalAmount={checkoutRegistration.tournament?.entry_fee ? Number(checkoutRegistration.tournament.entry_fee) : 0}
            sportType={checkoutRegistration.tournament?.sport_type}
            email={user?.email || undefined}
            onClose={() => setCheckoutRegistration(null)}
            onSuccess={() => {
              setCheckoutRegistration(null);
              fetchUserData();
              router.refresh();
            }}
          />
        </div>
      )}

      {/* MODAL DE AVISO: CANCELAMENTO PÓS-PAGAMENTO */}
      {cancellingPaidReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-[#141416] border border-red-500/40 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl relative space-y-5 animate-scaleUp">
            {/* Linha superior vermelha de aviso */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-600 via-amber-500 to-red-500 rounded-t-3xl" />

            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-black font-display text-white">
                    Aviso de Cancelamento
                  </h3>
                  <p className="text-xs text-zinc-400 truncate max-w-[240px]">
                    {cancellingPaidReg.tournament?.name || "Campeonato Oficial"} • {cancellingPaidReg.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCancellingPaidReg(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-red-950/30 border border-red-900/40 text-xs text-zinc-200 leading-relaxed space-y-2.5">
              <p className="font-semibold text-red-300">
                O seu pagamento já foi processado e transferido para o organizador.
              </p>
              <p className="text-zinc-300">
                Ao cancelar, a sua vaga será perdida. O reembolso deve ser negociado diretamente com a organização do evento.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCancellingPaidReg(null)}
                className="py-2.5 px-4 rounded-xl border border-zinc-700 hover:border-zinc-500 bg-zinc-800/80 text-xs font-bold text-zinc-300 hover:text-white transition-all cursor-pointer"
              >
                Voltar / Manter Vaga
              </button>
              <button
                type="button"
                disabled={
                  isCancellingId === cancellingPaidReg.id ||
                  (Boolean(cancellingPaidReg.tournament?.status) &&
                    cancellingPaidReg.tournament?.status !== "OPEN")
                }
                onClick={() => executeCancellation(cancellingPaidReg.id, "REFUND_REQUESTED")}
                className="py-2.5 px-5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-red-600/30 flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  cancellingPaidReg.tournament?.status !== "OPEN"
                    ? "Cancelamento indisponível após o fechamento das chaves."
                    : undefined
                }
              >
                {isCancellingId === cancellingPaidReg.id ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Cancelando...</span>
                  </>
                ) : (
                  <>
                    <Ban className="h-3.5 w-3.5" />
                    <span>Confirmar Cancelamento</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
