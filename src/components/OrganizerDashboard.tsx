"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Clock,
  Wallet,
  Users,
  Network,
  ClipboardList,
  ChevronRight,
  MapPin,
  Calendar,
  Trophy,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Layers,
  MoreVertical,
  Trash2,
  Ban,
  UserPlus,
  Shield,
  ShieldAlert,
  Building2,
  ExternalLink,
  Lock,
  Unlock,
  Swords,
} from "lucide-react";
import { Tournament, Team, Match, SportType } from "@/types";
import { useTournament } from "@/context/TournamentContext";
import { useAuth } from "@/context/AuthProvider";
import { supabase } from "@/lib/supabase";
import CreateTournamentModal from "@/components/CreateTournamentModal";
import TeamRegistration from "@/components/TeamRegistration";
import RegistrationManagement from "@/components/RegistrationManagement";
import TournamentBracket from "@/components/TournamentBracket";
import RefereePanel from "@/components/RefereePanel";
import ShareTournamentModal from "@/components/ShareTournamentModal";
import BracketViewer from "@/components/BracketViewer";
import { generateBracket } from "@/app/actions/bracket";
import { useTournamentPermissions } from "@/hooks/useTournamentPermissions";

export type DashboardView = "overview" | "teams" | "bracket" | "referee";

interface OrganizerDashboardProps {
  tournament?: Tournament | null;
  teams?: Team[];
  matches?: Match[];
  onBack?: () => void;
  onNavigateTab?: (tab: "teams" | "bracket" | "referee") => void;
  initialView?: DashboardView;
}

export default function OrganizerDashboard({
  tournament: propTournament,
  teams: propTeams,
  matches: propMatches,
  onBack,
  onNavigateTab,
  initialView = "overview",
}: OrganizerDashboardProps) {
  const router = useRouter();
  const context = useTournament();
  const { user } = useAuth();

  // Estados locais de visualização e modais
  const [currentView, setCurrentView] = useState<DashboardView>(initialView);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Estados de dados reais vindos do Supabase
  const [dbTournament, setDbTournament] = useState<Tournament | null>(null);
  const [dbTeams, setDbTeams] = useState<Team[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [canManage, setCanManage] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [hasDbMatches, setHasDbMatches] = useState<boolean | null>(null);
  const [isGeneratingBracket, setIsGeneratingBracket] = useState(false);
  const [dbConfirmedCount, setDbConfirmedCount] = useState<number | null>(null);
  const [showCloseRegistrationsModal, setShowCloseRegistrationsModal] = useState(false);
  const [isClosingRegistrations, setIsClosingRegistrations] = useState(false);

  // Determina o ID do torneio em foco para RBAC
  const targetTournamentId =
    propTournament?.id ||
    context.currentTournamentId ||
    dbTournament?.id;

  // Hook genérico de permissões RBAC
  const permissions = useTournamentPermissions(targetTournamentId);

  // Permissões granulares computadas
  const canEditSettings = isSuperAdmin || permissions.canEditSettings;
  const canManageFinances = isSuperAdmin || permissions.canManageFinances;
  const canEditScores = isSuperAdmin || permissions.canEditScores;
  const canShare = isSuperAdmin || permissions.isOwner || permissions.isAdmin;

  // Lê parâmetros da URL caso o usuário recarregue na aba de um módulo específico
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam === "teams" || tabParam === "bracket" || tabParam === "referee") {
        setCurrentView(tabParam);
      }
    }
  }, []);

  // 1. Fetch de Dados Reais do Torneio e Verificação de Super Admin
  const fetchTournamentData = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // A. Consulta na tabela profiles para verificar se o utilizador logado é Super Admin
      let superAdmin = false;
      if (user.id === "organizer-admin-session") {
        superAdmin = true;
      } else {
        try {
          const { data: profile, error: profileErr } = await supabase
            .from("profiles")
            .select("is_admin")
            .eq("id", user.id)
            .maybeSingle();

          if (!profileErr && profile?.is_admin === true) {
            superAdmin = true;
          }
        } catch (profileError) {
          console.warn("Aviso ao consultar is_admin em profiles:", profileError);
        }
      }
      setIsSuperAdmin(superAdmin);

      // B. Determina o ID do torneio a buscar (apenas o torneio em foco, sem buscar todos)
      const targetTourId =
        propTournament?.id ||
        context.currentTournamentId;

      if (targetTourId) {
        // Fetch do torneio específico diretamente da tabela tournaments
        const { data: tourData, error: tourErr } = await supabase
          .from("tournaments")
          .select("*")
          .eq("id", targetTourId)
          .maybeSingle();

        let mappedTour: Tournament | null = null;
        if (!tourErr && tourData) {
          mappedTour = {
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
            format: tourData.format,
            rules: tourData.rules,
            cover_url: tourData.cover_url,
            gender_category: tourData.gender_category,
            organizer_pix_key: tourData.organizer_pix_key,
            sponsors: tourData.sponsors || [],
            custom_registration_fields: tourData.custom_registration_fields,
            prize_first: tourData.prize_first,
            prize_second: tourData.prize_second,
            prize_third: tourData.prize_third,
            min_players: tourData.min_players,
            max_players: tourData.max_players,
            min_age: tourData.min_age,
            max_age: tourData.max_age,
          };
          setDbTournament(mappedTour);
        } else {
          // Fallback ao torneio fornecido por props
          mappedTour = propTournament || null;
          setDbTournament(mappedTour);
        }

        // C. Validação de permissões: dono (owner_id === user.id) OU Super Admin (is_admin === true)
        if (mappedTour) {
          const isOwner = Boolean(user.id && mappedTour.owner_id === user.id);
          const hasAdminAccess = Boolean(superAdmin);
          const allowed = hasAdminAccess || isOwner;

          // Se não for dono nem Super Admin, checa se é membro da equipe (RBAC)
          if (!allowed && mappedTour.owner_id) {
            const userEmail = user.email?.toLowerCase().trim();
            const { data: staffData } = await supabase
              .from("tournament_staff")
              .select("id")
              .eq("tournament_id", targetTourId)
              .or(`user_id.eq.${user.id},email.eq.${userEmail}`)
              .maybeSingle();

            if (!staffData) {
              alert("Acesso restrito. Apenas o organizador proprietário ou Super Administradores podem acessar este painel.");
              router.replace("/hub");
              return;
            }
          }

          setCanManage(Boolean(allowed));
        }

        // D. Fetch das equipes diretamente do Supabase vinculadas a este torneio
        const { data: teamsData, error: teamsErr } = await supabase
          .from("teams")
          .select("*")
          .eq("tournament_id", targetTourId);

        if (!teamsErr && teamsData) {
          const mappedTeams: Team[] = teamsData.map((dbT: any) => ({
            id: dbT.id,
            name: dbT.name,
            players: [dbT.player1 || "Jogador 1", dbT.player2 || "Jogador 2"],
            createdAt: dbT.created_at || new Date().toISOString(),
            status: dbT.status,
            payment_status:
              dbT.payment_status ||
              (dbT.status === "CONFIRMED" || dbT.status === "PAID"
                ? "PAID"
                : "PENDING"),
            tournamentId: dbT.tournament_id,
          }));
          setDbTeams(mappedTeams);
        }

        // D2. Contagem direta de vagas ocupadas (confirmadas / pagas) no Supabase
        const { count: paidApprovedCount } = await supabase
          .from("teams")
          .select("id", { count: "exact", head: true })
          .eq("tournament_id", targetTourId)
          .in("payment_status", ["PAID", "APPROVED"]);

        if (paidApprovedCount !== null && paidApprovedCount !== undefined) {
          setDbConfirmedCount(paidApprovedCount);
        }

        // E. Checa se existem partidas geradas para este torneio na tabela matches
        const { count: matchesCount } = await supabase
          .from("matches")
          .select("id", { count: "exact", head: true })
          .eq("tournament_id", targetTourId);

        setHasDbMatches(matchesCount !== null && matchesCount > 0);
      }
    } catch (err) {
      console.error("Erro ao carregar dados do torneio no OrganizerDashboard:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user, propTournament, context.currentTournamentId]);

  useEffect(() => {
    fetchTournamentData();
  }, [fetchTournamentData]);

  // Torneio, Equipes e Partidas Ativas
  const currentTour = useMemo(() => {
    return dbTournament || propTournament || null;
  }, [dbTournament, propTournament]);

  const currentTeams = useMemo(() => {
    if (dbTeams.length > 0) return dbTeams;
    if (propTeams && propTeams.length > 0) return propTeams;
    return context.teams;
  }, [dbTeams, propTeams, context.teams]);

  const currentMatches = useMemo(() => {
    if (propMatches && propMatches.length > 0) return propMatches;
    return context.matches;
  }, [propMatches, context.matches]);

  // Ação 1: Cancelar Torneio
  const handleCancelTournament = async () => {
    if (!currentTour?.id || !canEditSettings) return;
    setShowOptionsMenu(false);

    const isAlreadyCanceled = currentTour.status === "CANCELLED" || currentTour.status === "CANCELADO";
    const confirmMsg = isAlreadyCanceled
      ? "Deseja reativar este torneio para o status ATIVO?"
      : "Tem a certeza que deseja cancelar este torneio? O status será alterado para CANCELADO.";

    if (!window.confirm(confirmMsg)) return;

    setIsCanceling(true);
    try {
      const nextStatus = isAlreadyCanceled ? "ATIVO" : "CANCELLED";
      const { error } = await supabase
        .from("tournaments")
        .update({ status: nextStatus })
        .eq("id", currentTour.id);

      if (error) {
        console.error("Erro ao cancelar torneio:", JSON.stringify(error, null, 2));
        alert(`Erro ao alterar status do torneio: ${error.message}`);
        return;
      }

      setDbTournament((prev) => (prev ? { ...prev, status: nextStatus } : null));
      alert(`Torneio ${isAlreadyCanceled ? "reativado" : "cancelado"} com sucesso.`);
      fetchTournamentData();
    } catch (err: unknown) {
      console.error("Exceção ao alterar status do torneio:", err);
      alert("Ocorreu um erro ao atualizar o status do torneio.");
    } finally {
      setIsCanceling(false);
    }
  };

  // Ação 2: Excluir Torneio (Ação Destrutiva com Validação de Inscrições Ativas)
  const handleDeleteTournament = async () => {
    if (!currentTour?.id || !canEditSettings) return;
    setShowOptionsMenu(false);

    try {
      setIsDeleting(true);

      // 1. Valida se existem equipes inscritas no campeonato
      const { data: teamsData, error: teamsError, count } = await supabase
        .from("teams")
        .select("id, payment_status, status", { count: "exact" })
        .eq("tournament_id", currentTour.id);

      if (teamsError) {
        console.error("Erro ao verificar equipes do torneio:", teamsError);
      }

      const totalTeams = count ?? teamsData?.length ?? 0;

      // Se houver equipes inscritas com pagamentos confirmados ou pendentes
      if (totalTeams > 0) {
        alert(
          "Não é possível excluir um torneio com inscrições ativas. Cancele o torneio ou remova as inscrições primeiro."
        );
        return;
      }

      // 2. Confirmação do utilizador
      if (
        !window.confirm(
          "Tem a certeza que deseja excluir permanentemente este torneio? Esta ação não pode ser desfeita."
        )
      ) {
        return;
      }

      // 3. Exclusão no Supabase
      const { error: delError } = await supabase
        .from("tournaments")
        .delete()
        .eq("id", currentTour.id);

      if (delError) {
        console.error("Erro fatal ao excluir torneio:", delError);
        alert(`Erro ao excluir o torneio: ${delError.message}`);
        return;
      }

      alert("Torneio excluído com sucesso.");
      router.push("/hub");
    } catch (err: unknown) {
      console.error("Exceção ao excluir torneio:", err);
      alert("Ocorreu um erro ao tentar excluir o torneio.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Ação: Encerrar Inscrições Manualmente
  const handleCloseRegistrations = async () => {
    if (!currentTour?.id || isClosingRegistrations) return;
    setIsClosingRegistrations(true);
    try {
      const { error } = await supabase
        .from("tournaments")
        .update({ status: "CLOSED" })
        .eq("id", currentTour.id);

      if (error) {
        console.error("Erro ao encerrar inscrições:", error);
        alert(`Erro ao encerrar inscrições: ${error.message}`);
        return;
      }

      setDbTournament((prev) => (prev ? { ...prev, status: "CLOSED" } : null));
      context.setTournaments((prev) =>
        prev.map((t) => (t.id === currentTour.id ? { ...t, status: "CLOSED" } : t))
      );
      setShowCloseRegistrationsModal(false);
      alert("Inscrições encerradas com sucesso! Nenhuma nova equipe poderá se registrar ou pagar.");
      await fetchTournamentData();
    } catch (err: any) {
      console.error("Exceção ao encerrar inscrições:", err);
      alert("Ocorreu um erro ao encerrar as inscrições.");
    } finally {
      setIsClosingRegistrations(false);
    }
  };

  // Ação: Reabrir Inscrições Manualmente
  const handleReopenRegistrations = async () => {
    if (!currentTour?.id || isClosingRegistrations) return;
    if (!window.confirm("Deseja reabrir as inscrições deste torneio na vitrine pública?")) return;
    setIsClosingRegistrations(true);
    try {
      const { error } = await supabase
        .from("tournaments")
        .update({ status: "OPEN" })
        .eq("id", currentTour.id);

      if (error) {
        console.error("Erro ao reabrir inscrições:", error);
        alert(`Erro ao reabrir inscrições: ${error.message}`);
        return;
      }

      setDbTournament((prev) => (prev ? { ...prev, status: "OPEN" } : null));
      context.setTournaments((prev) =>
        prev.map((t) => (t.id === currentTour.id ? { ...t, status: "OPEN" } : t))
      );
      alert("Inscrições reabertas com sucesso!");
      await fetchTournamentData();
    } catch (err: any) {
      console.error("Exceção ao reabrir inscrições:", err);
      alert("Ocorreu um erro ao reabrir as inscrições.");
    } finally {
      setIsClosingRegistrations(false);
    }
  };

  // Modalidade Esportiva
  const sportType: SportType = currentTour?.sport_type || context.currentSportType || "DOMINO";

  const sportLabels: Record<SportType, string> = {
    DOMINO: "Dominó em Duplas",
    PING_PONG: "Ping Pong",
    FUTSAL: "Futsal",
    VOLEI: "Vôlei",
  };

  const defaultLocations: Record<SportType, string> = {
    DOMINO: "Salão Nobre • Clube de Dominó",
    PING_PONG: "Arena Poliesportiva • Mesa Principal",
    FUTSAL: "Ginásio Poliesportivo Central • Quadra Principal",
    VOLEI: "Arena de Vôlei • Quadra Central",
  };

  const sportLabel = sportLabels[sportType] || "Torneio Esportivo";
  const venueLocation = currentTour?.location || defaultLocations[sportType];

  // Cálculos de Vagas e Inscrições Reais
  const maxSpots = currentTour?.max_teams || 16;
  const confirmedTeams = currentTeams.filter(
    (t) =>
      t.payment_status === "PAID" ||
      t.payment_status === "APPROVED" ||
      t.status === "CONFIRMED" ||
      t.status === "PAID" ||
      t.status?.toLowerCase() === "confirmado" ||
      t.status?.toLowerCase() === "ativo" ||
      t.status?.toLowerCase() === "confirmed" ||
      t.status?.toLowerCase() === "paid"
  );
  const confirmedTeamsCount =
    dbConfirmedCount !== null && dbConfirmedCount > confirmedTeams.length
      ? dbConfirmedCount
      : (confirmedTeams.length > 0 ? confirmedTeams.length : currentTeams.length);
  const spotsPercent = Math.min(Math.round((confirmedTeamsCount / maxSpots) * 100), 100);
  const remainingSpots = Math.max(maxSpots - confirmedTeamsCount, 0);

  // Inscrições Pendentes
  const pendingCount = currentTeams.filter(
    (t) => t.status?.toLowerCase() === "pendente" || t.status?.toLowerCase() === "pending"
  ).length;

  // Equipes com status de pagamento confirmado / aprovado
  const approvedPaidTeams = useMemo(() => {
    return currentTeams.filter(
      (t) =>
        t.payment_status === "PAID" ||
        t.payment_status === "APPROVED" ||
        t.status === "CONFIRMED" ||
        t.status === "PAID"
    );
  }, [currentTeams]);

  // Condição para exibir o botão de destaque:
  // Só deve aparecer se o torneio tiver equipas aprovadas e se ainda não existir nenhum registo na tabela matches para este tournament_id
  const canGenerateBracket = useMemo(() => {
    const matchesExist =
      hasDbMatches === true || (currentMatches && currentMatches.length > 0);
    return !matchesExist && approvedPaidTeams.length >= 2;
  }, [hasDbMatches, currentMatches, approvedPaidTeams.length]);

  // Handler de Geração do Chaveamento Oficial
  const handleGenerateBracket = async () => {
    if (!currentTour?.id || isGeneratingBracket) return;

    if (
      !window.confirm(
        `Deseja gerar o chaveamento oficial da competição agora? As ${approvedPaidTeams.length} equipes confirmadas serão sorteadas aleatoriamente na árvore eliminatória mata-mata.`
      )
    ) {
      return;
    }

    setIsGeneratingBracket(true);
    try {
      const { data: authData } = await supabase.auth.getSession();
      const token = authData.session?.access_token;

      const res = await generateBracket(currentTour.id, token);

      if (!res.success) {
        alert(`Erro ao gerar chaveamento: ${res.error}`);
        return;
      }

      alert(res.message || "Chaveamento oficial gerado com sucesso!");
      setHasDbMatches(true);
      await fetchTournamentData();
      handleShortcutClick("bracket");
    } catch (err: any) {
      console.error("Exceção ao gerar chaveamento:", err);
      alert("Ocorreu um erro ao gerar o chaveamento.");
    } finally {
      setIsGeneratingBracket(false);
    }
  };

  // Cálculos Financeiros Reais
  const feePerTeam = currentTour?.entry_fee ?? 100.0;
  const grossRevenue = confirmedTeamsCount * feePerTeam;
  const platformFee = grossRevenue * 0.05; // Taxa de 5% da SportConnect
  const netRevenue = grossRevenue - platformFee;

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Data Formatada do Torneio
  const formattedDate = useMemo(() => {
    if (!currentTour?.start_date) {
      return "Data a definir";
    }

    try {
      let d: Date;
      if (typeof currentTour.start_date === "string" && currentTour.start_date.includes("-")) {
        const datePart = currentTour.start_date.split("T")[0];
        const parts = datePart.split("-").map(Number);
        if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
          d = new Date(parts[0], parts[1] - 1, parts[2]);
        } else {
          d = new Date(currentTour.start_date);
        }
      } else {
        d = new Date(currentTour.start_date);
      }

      if (isNaN(d.getTime())) {
        return "Data a definir";
      }

      const formatted = d.toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      if (currentTour.start_time && currentTour.start_time.trim()) {
        return `${formatted} às ${currentTour.start_time.trim()}`;
      }

      return formatted;
    } catch {
      return "Data a definir";
    }
  }, [currentTour?.start_date, currentTour?.start_time]);

  // Formato da Competição (dinâmico da base de dados)
  const competitionFormat = useMemo(() => {
    const baseFormat = currentTour?.format || "Mata-mata";
    if (currentMatches.length > 0) {
      return `${baseFormat} • ${currentMatches.length} jogos`;
    }
    return baseFormat;
  }, [currentTour?.format, currentMatches.length]);

  // Pill de Status do Torneio
  const statusPill = useMemo(() => {
    const rawStatus = (currentTour?.status || "ATIVO").toUpperCase();
    const hasActiveMatches =
      currentMatches.length > 0 &&
      currentMatches.some((m) => m.status === "LIVE" || m.status === "COMPLETED");

    if (rawStatus === "FINALIZADO" || rawStatus === "CONCLUIDO") {
      return {
        label: "Finalizado",
        pillClass: "bg-zinc-800/80 border-zinc-700 text-zinc-400",
        dotClass: "bg-zinc-500",
      };
    }

    if (rawStatus === "EM_ANDAMENTO" || hasActiveMatches) {
      return {
        label: "Em Andamento",
        pillClass: "bg-blue-500/10 border-blue-500/25 text-[#00a2ff]",
        dotClass: "bg-[#00a2ff] animate-pulse",
      };
    }

    return {
      label: "Inscrições Abertas",
      pillClass: "bg-emerald-500/10 border-emerald-500/25 text-emerald-400",
      dotClass: "bg-emerald-400 animate-pulse",
    };
  }, [currentTour?.status, currentMatches]);

  // Navegação do Botão Voltar (Hub Central)
  const handleBackNavigation = () => {
    if (onBack) {
      onBack();
    } else {
      router.push("/hub");
    }
  };

  // Navegação interna dos Atalhos de Gestão
  const handleShortcutClick = (tab: "teams" | "bracket" | "referee") => {
    setCurrentView(tab);
    if (onNavigateTab) {
      onNavigateTab(tab);
    }
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState({}, "", url.toString());
    }
  };

  const handleReturnToOverview = () => {
    setCurrentView("overview");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("tab");
      window.history.replaceState({}, "", url.toString());
    }
  };

  // ==========================================
  // RENDERIZAÇÃO DOS MÓDULOS CLÁSSICOS (SUB-VIEWS)
  // ==========================================

  if (currentView !== "overview") {
    return (
      <div className="space-y-6 max-w-7xl mx-auto w-full text-[#e4e4e7] animate-fadeIn pb-16">
        {/* Barra Superior Unificada dos Módulos */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#27272a] pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleReturnToOverview}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1e1e1e] hover:bg-zinc-800 border border-[#27272a] text-xs font-bold text-[#e4e4e7] hover:text-white transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <ArrowLeft className="h-4 w-4 text-[#00a2ff]" />
              <span>Voltar ao Painel Geral</span>
            </button>

            <span className="text-zinc-600 hidden sm:inline">•</span>

            <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs font-bold text-white truncate max-w-[200px]">
                {currentTour?.name || "Campeonato"}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-[#00a2ff]/10 text-[#00a2ff] text-[10px] font-black uppercase tracking-wider border border-[#00a2ff]/20">
                {sportLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Badge Super Admin nos submódulos */}
            {isSuperAdmin && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-600/25 to-indigo-600/25 border border-purple-500/40 text-purple-300 text-xs font-black uppercase tracking-wider shadow-sm">
                <ShieldCheck className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                <span>SUPER ADMIN</span>
              </div>
            )}

            {/* Botão Compartilhar Acesso rápido nos submódulos */}
            {canShare && (
              <button
                type="button"
                onClick={() => setShowShareModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#00a2ff]/10 hover:bg-[#00a2ff]/20 border border-[#00a2ff]/30 text-xs font-bold text-[#00a2ff] hover:text-white transition-all cursor-pointer shadow-sm active:scale-95"
                title="Compartilhar acesso com a equipe do torneio"
              >
                <UserPlus className="h-3.5 w-3.5 text-[#00a2ff]" />
                <span className="hidden sm:inline">Compartilhar</span>
              </button>
            )}

            {/* Roteador interno rápido entre os três módulos */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#1e1e1e] border border-[#27272a]">
              <button
                onClick={() => handleShortcutClick("teams")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${currentView === "teams"
                    ? "bg-[#00a2ff] text-white shadow-md shadow-blue-500/20"
                    : "text-zinc-400 hover:text-white"
                  }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>Inscrições</span>
              </button>

              <button
                onClick={() => handleShortcutClick("bracket")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${currentView === "bracket"
                    ? "bg-[#00a2ff] text-white shadow-md shadow-blue-500/20"
                    : "text-zinc-400 hover:text-white"
                  }`}
              >
                <Network className="h-3.5 w-3.5" />
                <span>Chaveamento</span>
              </button>

              <button
                onClick={() => handleShortcutClick("referee")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${currentView === "referee"
                    ? "bg-[#00a2ff] text-white shadow-md shadow-blue-500/20"
                    : "text-zinc-400 hover:text-white"
                  }`}
              >
                <ClipboardList className="h-3.5 w-3.5" />
                <span>Súmula</span>
              </button>
            </div>
          </div>
        </div>

        {/* Banner de permissão específico para equipe / leitura */}
        {!canEditSettings && !canEditScores && !canManageFinances && !isSuperAdmin && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold">Modo de Visualização Restrita: </span>
              <span>
                Apenas o organizador proprietário ou a equipe autorizada têm permissão para editar dados, chaves e placares.
              </span>
            </div>
          </div>
        )}

        {(permissions.isReferee || permissions.isScorekeeper) && !permissions.isAdmin && !isSuperAdmin && (
          <div className="p-3 px-4 rounded-2xl bg-blue-500/10 border border-blue-500/25 text-blue-300 text-xs flex items-center gap-3">
            <Shield className="h-4 w-4 text-[#00a2ff] shrink-0" />
            <div>
              <span className="font-bold">Acesso de Equipe ({permissions.isReferee ? "Árbitro" : "Mesário"}): </span>
              <span>
                Você tem permissão para atualizar partidas e placares da súmula em tempo real. Ações administrativas e financeiras são restritas.
              </span>
            </div>
          </div>
        )}

        {/* Renderização condicional do Módulo Selecionado */}
        {currentView === "teams" && (
          <RegistrationManagement
            teams={context.teams}
            matches={context.matches}
            onAddTeam={context.handleAddTeam}
            onImportTeams={context.handleImportTeams}
            onDeleteTeam={canManageFinances ? context.handleDeleteTeam : undefined}
            onGenerateBracket={() =>
              context.handleGenerateBracket(() => handleShortcutClick("bracket"))
            }
            canManageFinances={canManageFinances}
            isReadOnly={!canManageFinances || context.isReadOnly}
            onFinishTournament={
              currentTour?.id && canEditSettings ? () => context.handleFinishTournament(currentTour.id) : undefined
            }
            onDeleteTournament={
              currentTour?.id && canEditSettings
                ? () => {
                  context.handleDeleteTournament(currentTour.id);
                  handleReturnToOverview();
                }
                : undefined
            }
            onBack={handleReturnToOverview}
            tournamentStatus={currentTour?.status}
            onCloseRegistrations={() => setShowCloseRegistrationsModal(true)}
          />
        )}

        {currentView === "bracket" && (
          <BracketViewer
            tournamentId={currentTour?.id}
            showPublicHeader={false}
            onBack={handleReturnToOverview}
          />
        )}

        {currentView === "referee" && (
          <RefereePanel
            matches={context.matches}
            onUpdateScore={context.handleUpdateScore}
            onSubtractPoint={context.handleSubtractPoint}
            onAddRound={context.handleAddRound}
            onStartMatch={context.handleStartMatch}
            onFinishMatch={context.handleFinishMatch}
            isReadOnly={!canEditScores || context.isReadOnly}
            sportType={sportType}
          />
        )}
      </div>
    );
  }

  // ==========================================
  // RENDERIZAÇÃO DO DASHBOARD PRINCIPAL
  // ==========================================

  return (
    <div className="space-y-6 max-w-5xl mx-auto w-full text-[#e4e4e7] animate-fadeIn pb-12">
      {/* 1. Cabeçalho de Navegação com Voltar ao Hub, Super Admin Badge e Status Pill */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#27272a] pb-4">
        {/* Lado esquerdo: Botão Voltar ao Hub */}
        <button
          onClick={handleBackNavigation}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1e1e1e] hover:bg-zinc-800 border border-[#27272a] text-xs font-bold text-[#e4e4e7] hover:text-white transition-all cursor-pointer shadow-sm active:scale-95"
        >
          <ArrowLeft className="h-4 w-4 text-[#00a2ff]" />
          <span>Voltar ao Hub</span>
        </button>

        {/* Lado direito: Badges de status e botão de opções (Compartilhar/Editar/Excluir/Cancelar) */}
        <div className="flex items-center gap-2.5">
          {/* Badge Super Admin em destaque */}
          {isSuperAdmin && (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-purple-600/25 via-indigo-600/20 to-purple-600/25 border border-purple-500/50 text-purple-300 text-xs font-black uppercase tracking-wider shadow-lg shadow-purple-500/20 animate-pulse">
              <ShieldCheck className="h-4 w-4 text-purple-400 shrink-0" />
              <span>SUPER ADMIN</span>
            </div>
          )}

          {/* Badge de Staff Role se aplicável */}
          {!isSuperAdmin && !permissions.isOwner && permissions.role && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/25 text-blue-400 text-xs font-bold tracking-wide shadow-sm">
              <Shield className="h-3.5 w-3.5 text-blue-400" />
              <span>
                {permissions.role === "ADMIN"
                  ? "Administrador"
                  : permissions.role === "REFEREE"
                  ? "Árbitro"
                  : "Mesário"}
              </span>
            </div>
          )}

          {/* Pill Reativa de Status do Torneio */}
          <div
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-black uppercase tracking-wider shadow-sm ${statusPill.pillClass}`}
          >
            <span className={`w-2 h-2 rounded-full ${statusPill.dotClass}`} />
            <span>{statusPill.label}</span>
          </div>

          {/* Botão de Destaque no Topo: Gerar Chaveamento Oficial */}
          {canGenerateBracket && canEditSettings && (
            <button
              type="button"
              onClick={handleGenerateBracket}
              disabled={isGeneratingBracket}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-[#00a2ff] to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-blue-500/25 active:scale-95 cursor-pointer disabled:opacity-50"
              title="Gerar Chaveamento Oficial com as equipes confirmadas"
            >
              {isGeneratingBracket ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Network className="h-4 w-4" />
              )}
              <span>{isGeneratingBracket ? "Gerando..." : "Gerar Chaveamento Oficial"}</span>
            </button>
          )}

          {/* Botão Compartilhar Acesso ("Equipe do Torneio") */}
          {canShare && (
            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#00a2ff]/10 hover:bg-[#00a2ff]/20 border border-[#00a2ff]/30 text-xs font-bold text-[#00a2ff] hover:text-white transition-all cursor-pointer shadow-sm active:scale-95"
              title="Compartilhar acesso com a equipe do torneio"
            >
              <UserPlus className="h-3.5 w-3.5 text-[#00a2ff]" />
              <span>Compartilhar Acesso</span>
            </button>
          )}

          {/* Grupo de Ações do Torneio: Editar + Menu de Opções (Cancelar e Excluir) */}
          {canEditSettings && (
            <div className="flex items-center gap-2 relative">
              <button
                onClick={() => setShowEditModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#1e1e1e] hover:bg-zinc-800 border border-[#27272a] text-xs font-bold text-[#e4e4e7] hover:text-white transition-all cursor-pointer shadow-sm active:scale-95"
                title="Editar dados e configurações do campeonato"
              >
                <Pencil className="h-3.5 w-3.5 text-[#00a2ff]" />
                <span>Editar</span>
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowOptionsMenu((prev) => !prev)}
                  className="p-1.5 rounded-xl bg-[#1e1e1e] hover:bg-zinc-800 border border-[#27272a] text-zinc-300 hover:text-white transition-all cursor-pointer shadow-sm active:scale-95 flex items-center justify-center"
                  title="Mais opções do torneio"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>

                {showOptionsMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowOptionsMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-52 bg-[#18181b] border border-zinc-800 rounded-2xl p-1.5 shadow-2xl z-50 animate-fadeIn space-y-1">
                      <button
                        type="button"
                        onClick={handleCancelTournament}
                        disabled={isCanceling}
                        className="w-full px-3 py-2 rounded-xl text-left text-xs font-bold text-amber-400 hover:bg-amber-500/10 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Ban className="h-4 w-4 shrink-0 text-amber-400" />
                        <span>
                          {currentTour?.status === "CANCELLED" || currentTour?.status === "CANCELADO"
                            ? "Reativar Torneio"
                            : "Cancelar Torneio"}
                        </span>
                      </button>

                      <div className="border-t border-zinc-800/80 my-1" />

                      <button
                        type="button"
                        onClick={handleDeleteTournament}
                        disabled={isDeleting}
                        className="w-full px-3 py-2 rounded-xl text-left text-xs font-bold text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4 shrink-0 text-red-400" />
                        <span>Excluir Torneio</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Alerta de Permissão se o usuário não for dono nem tiver permissão de admin */}
      {!canEditSettings && !canEditScores && !canManageFinances && !isSuperAdmin && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
          <div>
            <span className="font-bold">Permissão Limitada: </span>
            <span>
              Você está visualizando este campeonato em modo leitura. Modificações são reservadas ao proprietário ou a um Super Admin.
            </span>
          </div>
        </div>
      )}

      {(permissions.isReferee || permissions.isScorekeeper) && !permissions.isAdmin && !isSuperAdmin && (
        <div className="p-3 px-4 rounded-2xl bg-blue-500/10 border border-blue-500/25 text-blue-300 text-xs flex items-center gap-3">
          <Shield className="h-4 w-4 text-[#00a2ff] shrink-0" />
          <div>
            <span className="font-bold">Acesso de Equipe ({permissions.isReferee ? "Árbitro" : "Mesário"}): </span>
            <span>
              Você pode gerenciar partidas e registrar pontuações na aba de súmula e chaveamento. Ações destrutivas e financeiras foram desativadas para o seu nível de acesso.
            </span>
          </div>
        </div>
      )}

      {/* 2. Cartão de Informação do Torneio (Topo) */}
      <div className="bg-[#1e1e1e] border border-[#27272a] rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        {/* Foto de Capa como Imagem de Fundo com Overlay Escuro para legibilidade */}
        {currentTour?.cover_url && (
          <div className="absolute inset-0 z-0 pointer-events-none">
            <img
              src={currentTour.cover_url}
              alt={currentTour.name || "Capa do Torneio"}
              className="w-full h-full object-cover object-center"
            />
            {/* Overlay escuro para manter a legibilidade do texto branco */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px]" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-black/60" />
          </div>
        )}

        {/* Faixa decorativa superior em azul SportConnect */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#00a2ff] via-blue-500 to-indigo-500 z-10" />

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 relative z-10">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-block px-3 py-1 rounded-md bg-[#00a2ff]/20 text-[#00a2ff] border border-[#00a2ff]/40 text-xs font-black uppercase tracking-wider backdrop-blur-sm shadow-sm">
                {sportLabel}
              </span>

              {(currentTour?.status === "CANCELLED" || currentTour?.status === "CANCELADO") && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-black uppercase tracking-wider animate-pulse backdrop-blur-sm">
                  <Ban className="h-3.5 w-3.5" />
                  <span>Torneio Cancelado</span>
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-white font-display tracking-tight drop-shadow-md">
              {currentTour?.name || "Copa SportConnect"}
            </h1>

            <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs text-zinc-200 pt-1 drop-shadow-sm font-medium">
              <span className="flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-lg border border-white/10 backdrop-blur-sm">
                <MapPin className="h-4 w-4 text-[#00a2ff]" />
                <span>{venueLocation}</span>
              </span>
              <span className="flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-lg border border-white/10 backdrop-blur-sm">
                <Calendar className="h-4 w-4 text-[#00a2ff]" />
                <span>{formattedDate}</span>
              </span>
              <span className="flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-lg border border-white/10 backdrop-blur-sm">
                <Trophy className="h-4 w-4 text-amber-400" />
                <span>{competitionFormat}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Banner de Destaque: Chaveamento Oficial Pendente */}
      {canGenerateBracket && canEditSettings && (
        <div className="bg-gradient-to-r from-blue-950/50 via-indigo-950/30 to-blue-900/40 border border-[#00a2ff]/40 rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-fadeIn">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#00a2ff]/15 border border-[#00a2ff]/30 text-[#00a2ff] flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
              <Network className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-white font-display">
                Chaveamento Oficial Pronto para Geração
              </h3>
              <p className="text-xs text-zinc-300 mt-0.5">
                Você possui <strong className="text-emerald-400 font-bold">{approvedPaidTeams.length} equipes confirmadas</strong> e nenhuma partida gerada. Clique ao lado para sortear a árvore mata-mata.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerateBracket}
            disabled={isGeneratingBracket}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-[#00a2ff] to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-blue-500/30 active:scale-95 cursor-pointer flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
          >
            {isGeneratingBracket ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Network className="h-4 w-4" />
            )}
            <span>{isGeneratingBracket ? "Gerando Chaveamento..." : "Gerar Chaveamento Oficial"}</span>
          </button>
        </div>
      )}

      {/* 3. Secção "Inscrições e Vagas" (Grid 1x2) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Cartão Esquerdo: Ocupação das Vagas */}
        <div className="bg-[#1e1e1e] border border-[#27272a] rounded-2xl p-6 flex flex-col justify-between shadow-xl">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-[#9ca3af]">
              Ocupação das Vagas
            </h3>
            <div className="text-4xl sm:text-5xl font-black text-white my-3 font-display">
              {confirmedTeamsCount} / {maxSpots}
            </div>
          </div>

          <div>
            <div className="w-full bg-zinc-900 h-3 rounded-full overflow-hidden border border-zinc-800">
              <div
                className="bg-gradient-to-r from-[#00a2ff] to-blue-500 h-full rounded-full transition-all duration-700 shadow-md shadow-blue-500/20"
                style={{ width: `${spotsPercent}%` }}
              />
            </div>
            <p className="text-xs text-[#9ca3af] mt-2.5 font-medium flex items-center justify-between">
              <span>{spotsPercent}% das vagas preenchidas</span>
              <span className="text-[#00a2ff] font-bold">
                {remainingSpots} {remainingSpots === 1 ? "vaga restante" : "vagas restantes"}
              </span>
            </p>

            {/* Status e Botão de Encerramento Manual de Inscrições */}
            {canEditSettings && (
              <div className="pt-3 mt-3 border-t border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                {currentTour?.status === "CLOSED" ? (
                  <>
                    <div className="flex items-center gap-1.5 text-xs text-red-400 font-bold">
                      <Lock className="h-3.5 w-3.5" />
                      <span>Inscrições Encerradas</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleReopenRegistrations}
                      disabled={isClosingRegistrations}
                      className="px-3.5 py-1.5 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-400 hover:text-blue-300 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 shadow-sm disabled:opacity-50"
                    >
                      <Unlock className="h-3.5 w-3.5" />
                      <span>Reabrir Inscrições</span>
                    </button>
                  </>
                ) : currentTour?.status === "IN_PROGRESS" ||
                  currentTour?.status === "EM_ANDAMENTO" ||
                  currentTour?.status === "LIVE" ? (
                  <div className="flex items-center gap-1.5 text-xs text-amber-400 font-bold">
                    <Swords className="h-3.5 w-3.5" />
                    <span>Torneio em Andamento (Inscrições Travadas)</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Inscrições Abertas</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCloseRegistrationsModal(true)}
                      className="px-3.5 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 hover:text-red-300 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 shadow-sm"
                      title="Encerrar inscrições para impedir novos registros ou pagamentos"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      <span>Encerrar Inscrições Manualmente</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Cartão Direito: Pendentes de Aprovação */}
        <div className="bg-[#1e1e1e] border border-[#27272a] rounded-2xl p-6 flex flex-col justify-between shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-[#9ca3af]">
              Pendentes de Aprovação
            </h3>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm">
              <Clock className="h-5 w-5" />
            </div>
          </div>

          <div className="my-3">
            <div className="text-4xl sm:text-5xl font-black text-amber-400 font-display">
              {pendingCount} {pendingCount === 1 ? "equipe" : "equipes"}
            </div>
          </div>

          <p className="text-xs text-[#9ca3af] font-medium leading-relaxed">
            Inscrições registradas que aguardam validação de comprovantes de pagamento e elenco de atletas.
          </p>
        </div>
      </div>

      {/* 4. Secção "Resumo Financeiro" */}
      <div className="bg-gradient-to-br from-[#1e1e1e] to-blue-950/20 border border-blue-500/25 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Glow decorativo sutil */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#00a2ff]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#00a2ff]/15 text-[#00a2ff] border border-[#00a2ff]/30">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white font-display tracking-wide uppercase">
                Balanço do Campeonato
              </h2>
              <p className="text-xs text-[#9ca3af] mt-0.5">
                Taxa por inscrição:{" "}
                <strong className="text-zinc-200">{formatCurrency(feePerTeam)}</strong>
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-5 border-t border-[#27272a]/80">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af]">
              Arrecadação Bruta
            </span>
            <div className="text-2xl sm:text-3xl font-black text-[#e4e4e7] font-display">
              {formatCurrency(grossRevenue)}
            </div>
            <span className="text-[10px] text-zinc-500 block">
              Total arrecadado com as inscrições
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af]">
              Taxa SportConnect (5%)
            </span>
            <div className="text-2xl sm:text-3xl font-black text-red-400 font-display">
              - {formatCurrency(platformFee)}
            </div>
            <span className="text-[10px] text-red-400/70 block">
              Tarifa de processamento e plataforma
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af]">
              Total Líquido do Organizador
            </span>
            <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-display">
              {formatCurrency(netRevenue)}
            </div>
            <span className="text-[10px] text-emerald-400/70 block font-semibold">
              Disponível para repasse ao organizador
            </span>
          </div>
        </div>
      </div>

      {/* 5. Secção "Atalhos de Gestão" (Roteadores Internos para os Módulos) */}
      <div className="space-y-3">
        <h2 className="text-xs font-black uppercase tracking-wider text-[#9ca3af] pl-1">
          Atalhos de Gestão Operacional
        </h2>

        <div className="space-y-3">
          {/* Item 1: Gerenciar Inscrições */}
          <button
            onClick={() => handleShortcutClick("teams")}
            className="w-full bg-[#1e1e1e] hover:bg-zinc-800/90 border border-[#27272a] hover:border-[#00a2ff]/50 rounded-2xl p-5 flex items-center justify-between transition-all duration-300 shadow-md group cursor-pointer text-left"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-[#00a2ff]/10 text-[#00a2ff] border border-[#00a2ff]/20 group-hover:bg-[#00a2ff] group-hover:text-white transition-colors">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-display font-black text-base text-white group-hover:text-[#00a2ff] transition-colors">
                  Gerenciar Inscrições
                </h4>
                <p className="text-xs text-[#9ca3af] mt-0.5">
                  Validar comprovantes e equipes inscritas ({confirmedTeamsCount} inscritos)
                </p>
              </div>
            </div>
            <div className="p-2 rounded-xl text-zinc-500 group-hover:text-white group-hover:translate-x-1 transition-all">
              <ChevronRight className="h-5 w-5" />
            </div>
          </button>

          {/* Item 2: Tabela & Chaveamento */}
          <button
            onClick={() => handleShortcutClick("bracket")}
            className="w-full bg-[#1e1e1e] hover:bg-zinc-800/90 border border-[#27272a] hover:border-[#00a2ff]/50 rounded-2xl p-5 flex items-center justify-between transition-all duration-300 shadow-md group cursor-pointer text-left"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-[#00a2ff]/10 text-[#00a2ff] border border-[#00a2ff]/20 group-hover:bg-[#00a2ff] group-hover:text-white transition-colors">
                <Network className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-display font-black text-base text-white group-hover:text-[#00a2ff] transition-colors">
                  Tabela & Chaveamento
                </h4>
                <p className="text-xs text-[#9ca3af] mt-0.5">
                  Gerar confrontos, chaves mata-mata e chaveamento automático
                </p>
              </div>
            </div>
            <div className="p-2 rounded-xl text-zinc-500 group-hover:text-white group-hover:translate-x-1 transition-all">
              <ChevronRight className="h-5 w-5" />
            </div>
          </button>

          {/* Item 3: Lançar Placares */}
          <button
            onClick={() => handleShortcutClick("referee")}
            className="w-full bg-[#1e1e1e] hover:bg-zinc-800/90 border border-[#27272a] hover:border-[#00a2ff]/50 rounded-2xl p-5 flex items-center justify-between transition-all duration-300 shadow-md group cursor-pointer text-left"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-[#00a2ff]/10 text-[#00a2ff] border border-[#00a2ff]/20 group-hover:bg-[#00a2ff] group-hover:text-white transition-colors">
                <ClipboardList className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-display font-black text-base text-white group-hover:text-[#00a2ff] transition-colors">
                  Lançar Placares
                </h4>
                <p className="text-xs text-[#9ca3af] mt-0.5">
                  Atualizar resultados das partidas na súmula digital em tempo real
                </p>
              </div>
            </div>
            <div className="p-2 rounded-xl text-zinc-500 group-hover:text-white group-hover:translate-x-1 transition-all">
              <ChevronRight className="h-5 w-5" />
            </div>
          </button>
        </div>
      </div>

      {/* 5. Secção de Patrocinadores Cadastrados */}
      {currentTour?.sponsors && currentTour.sponsors.length > 0 ? (
        <div className="bg-[#1e1e1e] border border-[#27272a] rounded-2xl p-6 sm:p-7 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#27272a] pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-white font-display">
                  Patrocinadores Oficiais do Evento
                </h3>
                <p className="text-xs text-[#9ca3af]">
                  Marcas e parceiros que apoiam este torneio
                </p>
              </div>
            </div>
            {canEditSettings && (
              <button
                onClick={() => setShowEditModal(true)}
                className="self-start sm:self-auto text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 cursor-pointer"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>Gerenciar Patrocinadores</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {currentTour.sponsors.map((sponsor) => {
              const CardContent = (
                <div className="h-full p-4 rounded-xl bg-[#141416] border border-[#27272a] hover:border-amber-500/40 hover:bg-zinc-900/90 transition-all flex flex-col items-center justify-center text-center gap-2 group shadow-sm">
                  {sponsor.logo_url ? (
                    <div className="w-full h-14 sm:h-16 flex items-center justify-center p-2 rounded-lg bg-zinc-900/70 border border-zinc-800/80 group-hover:scale-105 transition-transform">
                      <img
                        src={sponsor.logo_url}
                        alt={sponsor.name}
                        className="max-h-full max-w-full object-contain filter group-hover:brightness-110 transition-all"
                      />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-black text-base group-hover:scale-105 transition-transform">
                      {sponsor.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className="text-xs font-bold text-zinc-200 group-hover:text-amber-300 transition-colors line-clamp-1">
                    {sponsor.name}
                  </span>
                  {sponsor.link && (
                    <span className="text-[10px] text-zinc-500 group-hover:text-zinc-400 flex items-center gap-1">
                      <span>Acessar</span>
                      <ExternalLink className="h-2.5 w-2.5" />
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
                    className="block cursor-pointer transition-transform active:scale-95"
                    title={`Visitar ${sponsor.name}`}
                  >
                    {CardContent}
                  </a>
                );
              }

              return (
                <div key={sponsor.id}>
                  {CardContent}
                </div>
              );
            })}
          </div>
        </div>
      ) : canEditSettings ? (
        <div className="bg-[#1e1e1e] border border-[#27272a] rounded-2xl p-6 text-center shadow-xl space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Nenhum patrocinador cadastrado</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
              Adicione marcas parceiras e patrocinadores para exibir o apoio oficial no painel e na página pública do torneio.
            </p>
          </div>
          <button
            onClick={() => setShowEditModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold transition-all cursor-pointer"
          >
            <Building2 className="h-4 w-4" />
            <span>Cadastrar Patrocinadores</span>
          </button>
        </div>
      ) : null}

      {/* Modal de Edição ou Criação do Torneio */}
      <CreateTournamentModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        tournamentToEdit={currentTour}
        onTournamentUpdated={() => {
          fetchTournamentData();
        }}
      />

      {/* Modal de Compartilhamento (RBAC - Equipe do Torneio) */}
      <ShareTournamentModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        tournamentId={currentTour?.id || targetTournamentId || ""}
        tournamentName={currentTour?.name}
        ownerEmail={user?.email || ""}
        isOwnerOrAdmin={canShare}
      />

      {/* Modal de Confirmação de Encerramento Manual de Inscrições */}
      {showCloseRegistrationsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-[#1a1a1a] border border-zinc-800 rounded-3xl p-6 sm:p-7 max-w-md w-full text-white shadow-2xl relative space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center shrink-0">
                <Lock className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-black font-display uppercase tracking-tight text-white">
                  Encerrar Inscrições
                </h3>
                <p className="text-xs text-zinc-400">
                  Bloqueio manual de novas participações
                </p>
              </div>
            </div>

            <p className="text-sm text-zinc-300 leading-relaxed">
              Tem certeza que deseja encerrar as inscrições? Nenhuma nova equipa poderá registar-se ou pagar.
            </p>

            <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 flex items-center justify-between">
              <span>Equipes confirmadas:</span>
              <strong className="text-emerald-400 font-bold">{confirmedTeamsCount} de {maxSpots} vagas</strong>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCloseRegistrationsModal(false)}
                className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold text-zinc-300 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCloseRegistrations}
                disabled={isClosingRegistrations}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-red-600/30 active:scale-95 cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {isClosingRegistrations ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Encerrando...</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5" />
                    <span>Sim, Encerrar Inscrições</span>
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
