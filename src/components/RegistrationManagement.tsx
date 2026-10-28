"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Users,
  CheckCircle2,
  Clock,
  Receipt,
  Filter,
  Plus,
  Search,
  X,
  MapPin,
  Trophy,
  Trash2,
  Eye,
  AlertCircle,
  FileText,
  UserCheck,
  User,
  Shield,
  ArrowLeft,
  Loader2,
  Check,
  ExternalLink,
  RotateCcw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Mail,
  Phone,
  Lock,
} from "lucide-react";
import { Team, Match, SportType, TeamMember } from "@/types";
import { useTournament } from "@/context/TournamentContext";
import { useAuth } from "@/context/AuthProvider";
import { supabase } from "@/lib/supabase";
import { useTournamentPermissions } from "@/hooks/useTournamentPermissions";

export interface RegistrationManagementProps {
  teams: Team[];
  matches?: Match[];
  onAddTeam: (
    name: string,
    p1: string,
    p2?: string,
    roster?: string[],
    format?: "solo" | "duplas",
    paymentStatus?: string,
    category?: string
  ) => void;
  onImportTeams?: (importedTeams: Team[]) => void;
  onDeleteTeam?: (id: string) => void;
  onGenerateBracket?: () => void;
  isReadOnly?: boolean;
  canManageFinances?: boolean;
  onFinishTournament?: () => void;
  onDeleteTournament?: () => void;
  onBack?: () => void;
  tournamentStatus?: string;
  onCloseRegistrations?: () => void;
}

export default function RegistrationManagement({
  teams: propTeams,
  matches = [],
  onAddTeam,
  onImportTeams,
  onDeleteTeam,
  onGenerateBracket,
  isReadOnly = false,
  canManageFinances: canManageFinancesProp,
  onFinishTournament,
  onDeleteTournament,
  onBack,
  tournamentStatus,
  onCloseRegistrations,
}: RegistrationManagementProps) {
  const { currentSportType, currentTournamentId } = useTournament();
  const { user } = useAuth();
  const permissions = useTournamentPermissions(currentTournamentId || undefined);

  // Validação de acesso financeiro (Dono, Admin ou prop explícita)
  const hasFinancialAccess =
    canManageFinancesProp !== undefined
      ? canManageFinancesProp
      : permissions.canManageFinances;

  // Estado local das equipes para atualizações instantâneas de status
  const [localTeams, setLocalTeams] = useState<Team[]>(propTeams);

  // Sincroniza localTeams sempre que propTeams mudar
  React.useEffect(() => {
    setLocalTeams(propTeams);
  }, [propTeams]);

  // Busca direta no Supabase garantindo seleção explícita da coluna cancellation_status
  const fetchTeamsFromDb = React.useCallback(async () => {
    if (!currentTournamentId) return;
    try {
      const { data: dbTeams, error: teamsError } = await supabase
        .from("teams")
        .select("*, cancellation_status")
        .eq("tournament_id", currentTournamentId);

      if (teamsError) {
        console.error("Erro ao buscar equipes no RegistrationManagement:", teamsError);
        return;
      }

      if (dbTeams) {
        const mapped: Team[] = dbTeams.map((dbT: any) => ({
          id: dbT.id,
          name: dbT.name,
          players: [dbT.player1, dbT.player2],
          createdAt: dbT.created_at || new Date().toISOString(),
          source: "manual",
          status: dbT.status,
          tournamentId: dbT.tournament_id,
          payment_status: dbT.payment_status || (dbT.status === "CONFIRMED" || dbT.status === "PAID" ? "PAID" : "PENDING"),
          payout_status: dbT.payout_status || "PENDING",
          payout_amount: dbT.payout_amount ? Number(dbT.payout_amount) : undefined,
          payment_proof_url: dbT.payment_proof_url,
          manager_name: dbT.manager_name || dbT.player1,
          category: dbT.category || "Amador A",
          cancellation_status: dbT.cancellation_status,
          mp_payment_id: dbT.mp_payment_id,
          contact: dbT.contact,
          roster: dbT.roster,
          custom_registration_answers: dbT.custom_registration_answers,
          user_id: dbT.user_id,
        }));
        setLocalTeams(mapped);

        // Fetch de todos os membros vinculados (team_members) para os times do torneio
        const teamIds = dbTeams.map((t: any) => t.id).filter(Boolean);
        if (teamIds.length > 0) {
          try {
            const { data: membersData } = await supabase
              .from("team_members")
              .select("*")
              .in("team_id", teamIds);

            if (membersData) {
              const map: Record<string, TeamMember[]> = {};
              membersData.forEach((m: any) => {
                if (!map[m.team_id]) map[m.team_id] = [];
                map[m.team_id].push({
                  id: m.id,
                  team_id: m.team_id,
                  user_id: m.user_id,
                  name: m.name || "Atleta",
                  email: m.email || "",
                  is_captain: Boolean(m.is_captain),
                  created_at: m.created_at,
                });
              });
              setTeamMembersMap(map);
            }
          } catch (mErr) {
            console.warn("Aviso ao carregar team_members:", mErr);
          }
        }
      }
    } catch (err) {
      console.error("Exceção ao buscar equipes:", err);
    }
  }, [currentTournamentId]);

  React.useEffect(() => {
    fetchTeamsFromDb();
  }, [fetchTeamsFromDb]);

  // Filtros de busca e status
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilterBar, setShowFilterBar] = useState(false);

  // Modais e visualizadores
  const [showAddModal, setShowAddModal] = useState(false);
  const [showProofReviewModal, setShowProofReviewModal] = useState(false);
  const [viewingReceiptTeam, setViewingReceiptTeam] = useState<Team | null>(null);
  const [receiptModalSignedUrl, setReceiptModalSignedUrl] = useState<string | null>(null);
  const [loadingReceiptUrl, setLoadingReceiptUrl] = useState(false);
  const [proofSignedUrls, setProofSignedUrls] = useState<Record<string, string>>({});
  const [selectedTeamDetails, setSelectedTeamDetails] = useState<Team | null>(null);
  const [isApprovingId, setIsApprovingId] = useState<string | null>(null);
  const [isRefundingId, setIsRefundingId] = useState<string | null>(null);
  const [isDeletingTeamId, setIsDeletingTeamId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Acordeão de Elenco / Atletas da Equipe
  const [expandedRosterIds, setExpandedRosterIds] = useState<Record<string, boolean>>({});
  const [teamMembersMap, setTeamMembersMap] = useState<Record<string, TeamMember[]>>({});

  // Estados do Formulário de Adição Manual
  const [formName, setFormName] = useState("");
  const [formPlayer1, setFormPlayer1] = useState("");
  const [formPlayer2, setFormPlayer2] = useState("");
  const [formCategory, setFormCategory] = useState("Amador A");
  const [formPaymentStatus, setFormPaymentStatus] = useState<"PAID" | "PENDING">("PAID");
  const [formPingPongFormat, setFormPingPongFormat] = useState<"solo" | "duplas">("solo");
  const [formAthletes, setFormAthletes] = useState<string[]>([]);
  const [formError, setFormError] = useState("");

  // Fechar toast após 4 segundos
  React.useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Definições contextuais de acordo com o esporte (Roteador de Regras)
  const isDomino = currentSportType === "DOMINO";
  const isPingPong = currentSportType === "PING_PONG";
  const isFutsal = currentSportType === "FUTSAL";
  const isVolei = currentSportType === "VOLEI";
  const isTeamSport = isFutsal || isVolei;

  const isPingPongSolo = isPingPong && formPingPongFormat === "solo";
  const isPingPongDuplas = isPingPong && formPingPongFormat === "duplas";

  const entitySingular = isPingPongSolo
    ? "Jogador"
    : isTeamSport
    ? "Equipe"
    : "Dupla";

  // Ícone por modalidade
  const sportIcon = isDomino ? "🁓" : isPingPong ? "🏓" : isFutsal ? "⚽" : "🏐";

  // 1. Estatísticas Calculadas Dinamicamente
  const stats = useMemo(() => {
    let paid = 0;
    let pending = 0;
    let waitingPix = 0;
    let cancellations = 0;

    localTeams.forEach((t) => {
      if (t.cancellation_status === "REQUESTED_BY_ATHLETE" || t.cancellation_status === "REFUND_REQUESTED") {
        cancellations++;
      }
      const pStatus = t.payment_status || (t.status === "CONFIRMED" || t.status === "PAID" ? "APPROVED" : "PENDING");
      if (pStatus === "APPROVED" || pStatus === "PAID") {
        paid++;
      } else if (pStatus === "WAITING_PIX") {
        waitingPix++;
      } else {
        pending++;
      }
    });

    const total = localTeams.filter(
      (t) => t.cancellation_status !== "REFUNDED" && t.payment_status !== "CANCELED"
    ).length;

    return { total, paid, pending, waitingPix, cancellations };
  }, [localTeams]);

  // Cancelamentos Solicitados
  const cancellationCount = stats.cancellations;

  // Equipes que possuem comprovante anexado ou aguardam conferência Pix
  const teamsToReview = useMemo(() => {
    return localTeams.filter(
      (t) =>
        t.cancellation_status !== "REFUNDED" &&
        t.payment_status !== "CANCELED" &&
        t.status !== "CANCELED" &&
        (t.payment_status === "WAITING_PIX" || t.payment_status === "WAITING_APPROVAL" || Boolean(t.payment_proof_url))
    );
  }, [localTeams]);

  // Carregar URLs assinadas seguras (60 min) para visualização das imagens no modal de conferência
  React.useEffect(() => {
    if (!showProofReviewModal || teamsToReview.length === 0) return;

    let isMounted = true;
    async function loadSignedUrls() {
      const urls: Record<string, string> = {};
      for (const t of teamsToReview) {
        if (t.payment_proof_url) {
          let cleanPath = t.payment_proof_url;
          if (cleanPath.startsWith("http://") || cleanPath.startsWith("https://")) {
            if (cleanPath.includes("/receipts/")) {
              cleanPath = cleanPath.split("/receipts/").pop() || cleanPath;
            } else {
              urls[t.id] = cleanPath;
              continue;
            }
          }
          cleanPath = cleanPath.split("?")[0].replace(/^receipts\//, "");

          try {
            const { data } = await supabase.storage
              .from("receipts")
              .createSignedUrl(cleanPath, 3600);

            if (data?.signedUrl) {
              urls[t.id] = data.signedUrl;
            } else {
              urls[t.id] = t.payment_proof_url;
            }
          } catch {
            urls[t.id] = t.payment_proof_url;
          }
        }
      }
      if (isMounted) {
        setProofSignedUrls(urls);
      }
    }

    loadSignedUrls();
    return () => {
      isMounted = false;
    };
  }, [showProofReviewModal, teamsToReview]);

  // Filtragem das equipes
  const filteredTeams = useMemo(() => {
    return localTeams.filter((t) => {
      // Ignora equipes já estornadas da visualização ativa padrão
      if (t.cancellation_status === "REFUNDED" || t.payment_status === "CANCELED" || t.status === "CANCELED") {
        return false;
      }

      if (statusFilter === "CANCELLATIONS") {
        return t.cancellation_status === "REQUESTED_BY_ATHLETE" || t.cancellation_status === "REFUND_REQUESTED";
      }

      const pStatus = t.payment_status || (t.status === "CONFIRMED" || t.status === "PAID" ? "APPROVED" : "PENDING");
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "APPROVED" && (pStatus === "APPROVED" || pStatus === "PAID")) ||
        (statusFilter === "PENDING" && pStatus === "PENDING") ||
        (statusFilter === "WAITING_PIX" && pStatus === "WAITING_PIX");

      const query = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !query ||
        t.name.toLowerCase().includes(query) ||
        (t.manager_name && t.manager_name.toLowerCase().includes(query)) ||
        (t.players && t.players.some((p) => p && p.toLowerCase().includes(query)));

      return matchesStatus && matchesQuery;
    });
  }, [localTeams, statusFilter, searchQuery]);

  // Leitura Segura de Comprovantes via Signed URL de 60 minutos (3600s)
  // Alternar visualização do acordeão de atletas (team_members)
  const toggleTeamRoster = async (teamId: string) => {
    setExpandedRosterIds((prev) => ({
      ...prev,
      [teamId]: !prev[teamId],
    }));

    // Se ainda não temos os membros desse time no mapa, busca sob demanda
    if (!teamMembersMap[teamId]) {
      try {
        const { data: mData } = await supabase
          .from("team_members")
          .select("*")
          .eq("team_id", teamId);

        if (mData) {
          setTeamMembersMap((prev) => ({
            ...prev,
            [teamId]: mData.map((m: any) => ({
              id: m.id,
              team_id: m.team_id,
              user_id: m.user_id,
              name: m.name || "Atleta",
              email: m.email || "",
              is_captain: Boolean(m.is_captain),
              created_at: m.created_at,
            })),
          }));
        }
      } catch (err) {
        console.warn("Aviso ao buscar team_members sob demanda:", err);
      }
    }
  };

  // Abrir Modal de Comprovante de Pagamento (Visualização com fallback para vazio)
  const openReceiptModal = async (team: Team) => {
    setViewingReceiptTeam(team);
    setReceiptModalSignedUrl(null);

    if (!team.payment_proof_url) return;

    setLoadingReceiptUrl(true);
    try {
      let cleanPath = team.payment_proof_url;
      if (cleanPath.startsWith("http://") || cleanPath.startsWith("https://")) {
        if (cleanPath.includes("/receipts/")) {
          cleanPath = cleanPath.split("/receipts/").pop() || cleanPath;
        } else {
          setReceiptModalSignedUrl(cleanPath);
          return;
        }
      }
      cleanPath = cleanPath.split("?")[0].replace(/^receipts\//, "");

      const { data, error } = await supabase.storage
        .from("receipts")
        .createSignedUrl(cleanPath, 3600);

      if (data?.signedUrl) {
        setReceiptModalSignedUrl(data.signedUrl);
      } else {
        setReceiptModalSignedUrl(team.payment_proof_url);
      }
    } catch (err) {
      console.warn("Aviso ao gerar URL assinada do comprovante:", err);
      setReceiptModalSignedUrl(team.payment_proof_url);
    } finally {
      setLoadingReceiptUrl(false);
    }
  };

  // Leitura Segura de Comprovantes via Signed URL de 60 minutos (3600s)
  const handleViewReceipt = async (path?: string | null) => {
    console.log("Tentando abrir comprovante no caminho:", path);
    if (!path) return alert("Caminho do comprovante vazio no banco de dados.");

    // Fallback de legado: se for URL completa (http:// ou https://) que não contenha /receipts/
    if (path.startsWith("http://") || path.startsWith("https://")) {
      if (path.includes("/receipts/")) {
        path = path.split("/receipts/").pop() || path;
      } else {
        console.log("Detectada URL legada, abrindo diretamente:", path);
        window.open(path, "_blank");
        return;
      }
    }

    const cleanPath = path.replace("receipts/", "");

    const { data, error } = await supabase.storage.from("receipts").createSignedUrl(cleanPath, 3600);

    if (error) {
      console.error("Erro fatal ao gerar SignedURL:", error);
      alert("Erro ao abrir (Path: " + cleanPath + "): " + error.message);
      return;
    }

    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  };

  // Função para Aprovar Pix com Repasse Manual (/api/manual-split)
  const handleApprovePix = async (teamId: string) => {
    if (isReadOnly || !hasFinancialAccess) {
      alert("Você não possui permissão financeira para aprovar inscrições.");
      return;
    }
    setIsApprovingId(teamId);

    try {
      const response = await fetch("/api/manual-split", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_id: teamId }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result?.error || "Erro ao processar repasse e aprovação Pix.");
      }

      // Garante a gravação no Supabase com payment_status PAID e payout_status MANUAL_PENDING
      await supabase
        .from("teams")
        .update({
          status: "PAID",
          payment_status: "PAID",
          payout_status: result.payoutStatus || "MANUAL_PENDING",
          payout_amount: result.amountTransferred ?? result.payout_amount,
        })
        .eq("id", teamId);

      // Atualiza o estado local imediatamente
      setLocalTeams((prev) =>
        prev.map((t) =>
          t.id === teamId
            ? {
                ...t,
                status: "PAID",
                payment_status: "PAID",
                payout_status: result.payoutStatus || "MANUAL_PENDING",
                payout_amount: result.amountTransferred ?? result.payout_amount,
              }
            : t
        )
      );

      if (selectedTeamDetails?.id === teamId) {
        setSelectedTeamDetails((prev) =>
          prev ? { ...prev, status: "PAID", payment_status: "PAID" } : null
        );
      }

      // Fecha o modal de conferência de comprovante
      if (viewingReceiptTeam?.id === teamId) {
        setViewingReceiptTeam(null);
      }

      setToastMessage(
        result.message || "Pagamento Pix aprovado com sucesso! Inscrição confirmada."
      );

      // Revalida dados com o banco de dados
      fetchTeamsFromDb();
    } catch (err: any) {
      console.error("Erro ao aprovar Pix com split manual:", err);

      // Fallback de contingência caso a rota de split falhe
      try {
        await supabase
          .from("teams")
          .update({
            status: "PAID",
            payment_status: "PAID",
          })
          .eq("id", teamId);

        setLocalTeams((prev) =>
          prev.map((t) =>
            t.id === teamId
              ? { ...t, status: "PAID", payment_status: "PAID" }
              : t
          )
        );

        setToastMessage("Inscrição confirmada (PAID)! Atenção: split financeiro pendente.");
        fetchTeamsFromDb();
      } catch (dbErr: any) {
        setToastMessage(err?.message || "Erro ao aprovar pagamento Pix.");
      }
    } finally {
      setIsApprovingId(null);
    }
  };

  // Função para Cancelar Inscrição e Estornar Pix via Mercado Pago
  const handleRefundTeam = async (teamId: string) => {
    if (isReadOnly || !hasFinancialAccess) {
      alert("Você não possui permissão para estornar pagamentos.");
      return;
    }

    if (
      !window.confirm(
        "Deseja confirmar o cancelamento desta inscrição e realizar o estorno do Pix via Mercado Pago?"
      )
    ) {
      return;
    }

    setIsRefundingId(teamId);

    try {
      const response = await fetch("/api/checkout/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Falha ao processar estorno do Pix.");
      }

      // Sucesso: mostrar toast e remover equipe da lista ativa
      setToastMessage("Inscrição cancelada e Pix estornado com sucesso!");
      setLocalTeams((prev) => prev.filter((t) => t.id !== teamId));
      if (selectedTeamDetails?.id === teamId) {
        setSelectedTeamDetails(null);
      }
    } catch (err: any) {
      console.error("Erro no estorno:", err);
      alert(err.message || "Ocorreu um erro ao processar o cancelamento e estorno.");
    } finally {
      setIsRefundingId(null);
    }
  };

  // Excluir inscrição pendente e libertar vaga (para evitar vagas fantasmas no limite max_teams)
  const handleDeleteOrFreeSpot = async (team: Team) => {
    const confirmMessage = `Deseja realmente excluir a inscrição da equipe "${team.name}" e libertar esta vaga no torneio?`;
    if (!window.confirm(confirmMessage)) return;

    setIsDeletingTeamId(team.id);

    try {
      // 1. Remove membros vinculados
      try {
        await supabase.from("team_members").delete().eq("team_id", team.id);
      } catch (tmErr) {
        console.warn("Aviso ao remover membros vinculados:", tmErr);
      }

      // 2. Remove da tabela teams para desocupar a contagem de max_teams
      const { error: deleteError } = await supabase
        .from("teams")
        .delete()
        .eq("id", team.id);

      if (deleteError) {
        console.warn("Delete direto falhou, aplicando fallback para status REJECTED:", deleteError);
        const { error: updateError } = await supabase
          .from("teams")
          .update({ status: "REJECTED", payment_status: "REJECTED" })
          .eq("id", team.id);

        if (updateError) {
          throw updateError;
        }
      }

      // 3. Atualiza estado local da lista e notifica componente pai
      setLocalTeams((prev) => prev.filter((t) => t.id !== team.id));
      onDeleteTeam?.(team.id);

      if (selectedTeamDetails?.id === team.id) {
        setSelectedTeamDetails(null);
      }

      setToastMessage(`Inscrição da equipe "${team.name}" excluída e vaga liberada!`);
    } catch (err) {
      console.error("Erro ao excluir/libertar vaga da equipe:", err);
      alert("Erro ao excluir inscrição e libertar vaga.");
    } finally {
      setIsDeletingTeamId(null);
    }
  };

  // Formatar data de inscrição
  const formatDate = (dateString?: string) => {
    if (!dateString) return "Hoje";
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return "Hoje";
      return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return "Hoje";
    }
  };

  // Manipuladores de Atletas Extras (Futsal / Vôlei)
  const handleAddAthleteField = () => {
    setFormAthletes((prev) => [...prev, ""]);
  };

  const handleUpdateAthlete = (index: number, val: string) => {
    setFormAthletes((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  const handleRemoveAthlete = (index: number) => {
    setFormAthletes((prev) => prev.filter((_, i) => i !== index));
  };

  // Submissão do Formulário de Adição Manual
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (isReadOnly) return;

    if (isPingPongSolo) {
      if (!formPlayer1.trim()) {
        setFormError("Por favor, informe o nome do jogador.");
        return;
      }
      const finalName = formName.trim() || formPlayer1.trim();
      onAddTeam(finalName, formPlayer1.trim(), "", undefined, "solo", formPaymentStatus, formCategory);
    } else if (isTeamSport) {
      if (!formName.trim() || !formPlayer1.trim()) {
        setFormError("Por favor, informe o Nome da Equipe e o Capitão/Responsável.");
        return;
      }
      const validRoster = formAthletes.map((a) => a.trim()).filter(Boolean);
      onAddTeam(formName.trim(), formPlayer1.trim(), "", validRoster, undefined, formPaymentStatus, formCategory);
    } else {
      // Dominó ou Ping Pong Duplas
      if (!formName.trim() || !formPlayer1.trim() || !formPlayer2.trim()) {
        setFormError("Por favor, preencha o Nome e ambos os jogadores da dupla.");
        return;
      }
      onAddTeam(
        formName.trim(),
        formPlayer1.trim(),
        formPlayer2.trim(),
        undefined,
        isPingPongDuplas ? "duplas" : undefined,
        formPaymentStatus,
        formCategory
      );
    }

    // Fecha o modal e limpa o formulário
    setShowAddModal(false);
    setFormName("");
    setFormPlayer1("");
    setFormPlayer2("");
    setFormAthletes([]);
    setFormPaymentStatus("PAID");
    setToastMessage(`${entitySingular} adicionad${isPingPongSolo ? "o" : "a"} com sucesso!`);
    setTimeout(() => {
      fetchTeamsFromDb();
    }, 400);
  };

  return (
    <div className="space-y-6 text-[#e4e4e7] animate-fadeIn pb-12">
      {/* Toast de Notificação */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-zinc-900 border border-blue-500/40 text-white text-xs font-bold shadow-2xl flex items-center gap-3 animate-fadeIn">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 text-zinc-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 1. Cabeçalho e Estatísticas */}
      <div className="space-y-4">
        {/* Topo do Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#27272a] pb-4">
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-yellow-500 block mb-0.5">
              Painel do Organizador
            </span>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-black text-white font-display tracking-tight uppercase">
                Gestão de Inscrições
              </h1>
              <span className="px-2.5 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-[#00a2ff] text-xs font-bold">
                {sportIcon} {currentSportType}
              </span>
            </div>
          </div>

          {/* Botões Superiores: Filtrar, Cancelamentos e Conferir Comprovantes */}
          <div className="flex items-center gap-2.5">
            {cancellationCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setShowFilterBar(true);
                  setStatusFilter("CANCELLATIONS");
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/35 text-red-400 text-xs font-bold transition-all cursor-pointer shadow-sm animate-pulse"
                title="Ver equipes com cancelamento solicitado pelo atleta"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>{cancellationCount} Cancelamento{cancellationCount > 1 ? "s" : ""}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowFilterBar((prev) => !prev)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95 ${
                showFilterBar || statusFilter !== "ALL" || searchQuery
                  ? "bg-zinc-800 border-blue-500/50 text-blue-400"
                  : "bg-[#1e1e1e] hover:bg-zinc-800 border-[#27272a] text-zinc-300 hover:text-white"
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              <span>Filtrar</span>
            </button>

            {hasFinancialAccess && !isReadOnly && onCloseRegistrations && (
              tournamentStatus === "CLOSED" ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold shadow-sm">
                  <Lock className="h-3.5 w-3.5" />
                  <span>Inscrições Encerradas</span>
                </span>
              ) : tournamentStatus === "IN_PROGRESS" || tournamentStatus === "EM_ANDAMENTO" || tournamentStatus === "LIVE" ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold shadow-sm">
                  <span>⚔️ Torneio em Andamento</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onCloseRegistrations}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 hover:text-red-300 font-bold text-xs uppercase tracking-wider transition-all shadow-sm active:scale-95 cursor-pointer"
                  title="Encerrar inscrições para impedir novos registros ou pagamentos"
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>Encerrar Inscrições</span>
                </button>
              )
            )}

            <button
              type="button"
              onClick={() => setShowProofReviewModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-blue-600/20 active:scale-95 cursor-pointer"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Conferir Comprovantes</span>
              {teamsToReview.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-blue-800 text-[10px] text-white font-black">
                  {teamsToReview.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Barra de Filtros Expansível */}
        {showFilterBar && (
          <div className="p-4 bg-[#18181b] border border-zinc-800 rounded-2xl space-y-3 animate-fadeIn">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por equipe, responsável ou jogador..."
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0f0f0f] border border-zinc-800 focus:border-blue-500 rounded-xl text-xs text-white placeholder:text-zinc-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                {[
                  { id: "ALL", label: "Todos" },
                  { id: "APPROVED", label: "Pagos" },
                  { id: "PENDING", label: "Pendentes" },
                  { id: "WAITING_PIX", label: "Aguardando Pix" },
                  ...(cancellationCount > 0
                    ? [{ id: "CANCELLATIONS", label: `Cancelamentos (${cancellationCount})` }]
                    : []),
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setStatusFilter(st.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      statusFilter === st.id
                        ? st.id === "CANCELLATIONS"
                          ? "bg-red-600 text-white shadow-md shadow-red-500/20"
                          : "bg-blue-600 text-white"
                        : "bg-zinc-800/80 text-zinc-400 hover:text-white"
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Grid de Estatísticas (2x2) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* 1. Total Inscritos */}
          <div className="bg-[#1e1e1e] border border-zinc-800 border-l-4 border-l-blue-500 rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
                Total Inscritos
              </span>
              <Users className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-3xl sm:text-4xl font-black text-white font-display">
              {stats.total}
            </div>
            <span className="text-[10px] text-zinc-500 mt-1 block">
              {entitySingular.toLowerCase()}s cadastradas
            </span>
          </div>

          {/* 2. Pagos */}
          <div className="bg-[#1e1e1e] border border-zinc-800 border-l-4 border-l-emerald-500 rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
                Pagos
              </span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-3xl sm:text-4xl font-black text-emerald-400 font-display">
              {stats.paid}
            </div>
            <span className="text-[10px] text-emerald-500/70 mt-1 block font-semibold">
              Inscrições aprovadas
            </span>
          </div>

          {/* 3. Pendentes */}
          <div className="bg-[#1e1e1e] border border-zinc-800 border-l-4 border-l-yellow-500 rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
                Pendentes
              </span>
              <Clock className="h-4 w-4 text-yellow-400" />
            </div>
            <div className="text-3xl sm:text-4xl font-black text-yellow-400 font-display">
              {stats.pending}
            </div>
            <span className="text-[10px] text-yellow-500/70 mt-1 block font-semibold">
              Aguardando confirmação
            </span>
          </div>

          {/* 4. Aguardando Pix */}
          <div className="bg-[#1e1e1e] border border-zinc-800 border-l-4 border-l-orange-500 rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
                Aguardando Pix
              </span>
              <Receipt className="h-4 w-4 text-orange-400" />
            </div>
            <div className="text-3xl sm:text-4xl font-black text-orange-400 font-display">
              {stats.waitingPix}
            </div>
            <span className="text-[10px] text-orange-400/70 mt-1 block font-semibold">
              Comprovantes enviados
            </span>
          </div>
        </div>
      </div>

      {/* 2. Lista de Inscrições (Team Cards Verticais) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-wider text-zinc-300">
            Equipes e Participantes ({filteredTeams.length})
          </h2>
          {onGenerateBracket && localTeams.length >= 2 && (
            <button
              type="button"
              onClick={onGenerateBracket}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600 text-[#00a2ff] hover:text-white border border-blue-500/30 text-xs font-bold transition-all cursor-pointer shadow-sm"
            >
              <Trophy className="h-3.5 w-3.5" />
              <span>Gerar Chaveamento</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredTeams.map((team) => {
            const pStatus =
              team.payment_status ||
              (team.status === "CONFIRMED" || team.status === "PAID" ? "PAID" : "PENDING");
            const isApproved = pStatus === "PAID" || pStatus === "APPROVED" || team.status === "CONFIRMED" || team.status === "PAID";
            const isWaitingApproval = !isApproved && (pStatus === "WAITING_APPROVAL" || Boolean(team.payment_proof_url));
            const isWaitingPix = !isApproved && !isWaitingApproval && pStatus === "WAITING_PIX";
            const isPending = !isApproved && !isWaitingApproval && !isWaitingPix;

            const isRefundRequested = team.cancellation_status === "REFUND_REQUESTED";
            const isCancellationRequested = team.cancellation_status === "REQUESTED_BY_ATHLETE" || isRefundRequested;

            const manager = team.manager_name || team.players[0] || "Não informado";
            const category = team.category || "Amador A";

            return (
              <div
                key={team.id}
                className={`rounded-2xl p-5 flex flex-col justify-between shadow-xl transition-all group relative ${
                  isCancellationRequested
                    ? "bg-[#180a0a] border-2 border-red-600/90 shadow-red-950/40"
                    : "bg-[#1a1a1a] border border-zinc-800/90 hover:border-zinc-700"
                }`}
              >
                {/* Linha Superior: Avatar/Ícone, Nome, Categoria e Status Badge */}
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      {/* Avatar com Ícone Esportivo e Link para o Perfil */}
                      {team.user_id ? (
                        <Link
                          href={`/atleta/${team.user_id}`}
                          title={`Ver perfil do atleta`}
                          className="w-11 h-11 rounded-xl bg-zinc-800/90 border border-zinc-700 hover:border-amber-400/60 flex items-center justify-center text-lg shadow-inner group-hover:scale-105 transition-all shrink-0 cursor-pointer"
                        >
                          {sportIcon}
                        </Link>
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-zinc-800/90 border border-zinc-700 flex items-center justify-center text-lg shadow-inner group-hover:scale-105 transition-transform shrink-0">
                          {sportIcon}
                        </div>
                      )}
                      <div>
                        <h3 className="font-display font-black text-base text-white group-hover:text-blue-400 transition-colors line-clamp-1">
                          {team.user_id ? (
                            <Link href={`/atleta/${team.user_id}`} className="hover:underline">
                              {team.name}
                            </Link>
                          ) : (
                            team.name
                          )}
                        </h3>
                        <span className="inline-block px-2 py-0.5 rounded bg-zinc-800/80 text-[10px] font-bold text-zinc-400 mt-0.5">
                          {category}
                        </span>
                      </div>
                    </div>

                    {/* Status Badge - Máxima Prioridade ao Cancelamento Solicitado */}
                    <div className="shrink-0">
                      {isRefundRequested ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950 border border-red-500 text-red-200 text-[10px] font-black uppercase tracking-wider shadow-sm animate-pulse">
                          <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                          <span>CANCELAMENTO COM REEMBOLSO</span>
                        </span>
                      ) : team.cancellation_status === "REQUESTED_BY_ATHLETE" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950 border border-red-600 text-red-200 text-[10px] font-black uppercase tracking-wider shadow-sm animate-pulse">
                          <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                          <span>CANCELAMENTO SOLICITADO</span>
                        </span>
                      ) : team.status === "PAID" || pStatus === "PAID" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400 text-emerald-300 text-[10px] font-black uppercase tracking-wider shadow-sm">
                          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                          <span>Pago (Confirmado)</span>
                        </span>
                      ) : isApproved ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400 text-emerald-300 text-[10px] font-black uppercase tracking-wider shadow-sm">
                          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                          <span>Aprovado</span>
                        </span>
                      ) : isWaitingApproval ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/25 text-blue-400 text-[10px] font-black uppercase tracking-wider">
                          <Clock className="h-3 w-3 animate-pulse" />
                          <span>Em Análise</span>
                        </span>
                      ) : isWaitingPix ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/25 text-orange-400 text-[10px] font-black uppercase tracking-wider">
                          <Clock className="h-3 w-3 animate-pulse" />
                          <span>Aguardando Pix</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/25 text-yellow-400 text-[10px] font-black uppercase tracking-wider">
                          <AlertCircle className="h-3 w-3" />
                          <span>Pendente</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Informações: Responsável e Data */}
                  <div className="p-3 rounded-xl bg-[#121214] border border-zinc-800/80 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-zinc-400">
                      <span className="font-medium text-zinc-500">Responsável:</span>
                      {team.user_id ? (
                        <Link
                          href={`/atleta/${team.user_id}`}
                          title="Ver perfil do atleta"
                          className="font-bold text-zinc-200 hover:text-amber-400 hover:underline truncate max-w-[140px] flex items-center gap-1 transition-colors"
                        >
                          <span className="truncate">{manager}</span>
                          <ExternalLink className="h-3 w-3 text-amber-400/80 shrink-0" />
                        </Link>
                      ) : (
                        <span className="font-bold text-zinc-200 truncate max-w-[140px]">
                          {manager}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-zinc-400">
                      <span className="font-medium text-zinc-500">Data:</span>
                      <span className="font-bold text-zinc-300">
                        {formatDate(team.createdAt)}
                      </span>
                    </div>

                    {/* Jogador 2 ou Roster (se houver) */}
                    {team.players && team.players[1] && (
                      <div className="flex items-center justify-between text-zinc-400 pt-1 border-t border-zinc-800/50">
                        <span className="font-medium text-zinc-500">Dupla:</span>
                        <span className="font-bold text-zinc-300 truncate max-w-[140px]">
                          {team.players[1]}
                        </span>
                      </div>
                    )}

                    {/* Alerta Visual de Cancelamento com Reembolso Solicitado e Contato do Atleta */}
                    {isCancellationRequested && (
                      <div className="p-3 rounded-xl bg-red-950/70 border border-red-500/60 text-red-200 text-xs space-y-2 shadow-md animate-fadeIn mt-2">
                        <div className="flex items-center gap-1.5 font-black text-red-400 uppercase tracking-wider text-[11px]">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                          <span>
                            {isRefundRequested
                              ? "Cancelamento Pós-Pagamento (Reembolso Solicitado)"
                              : "Cancelamento Solicitado"}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-300 leading-snug">
                          {isRefundRequested
                            ? "O atleta pagou e solicitou cancelamento da vaga. Entre em contato para combinar a devolução do valor:"
                            : "O atleta solicitou o cancelamento da inscrição:"}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          {team.contact ? (
                            <a
                              href={`https://wa.me/${team.contact.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] transition-all shadow-sm cursor-pointer"
                              title="Abrir WhatsApp para combinar a devolução"
                            >
                              <Phone className="h-3.5 w-3.5" />
                              <span>WhatsApp: {team.contact}</span>
                            </a>
                          ) : (
                            <span className="text-[11px] text-zinc-400 italic">Telefone não informado</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 2. Acordeão: Ver Elenco / Atletas da Equipe (team_members) */}
                    <div className="pt-2 border-t border-zinc-800/60">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTeamRoster(team.id);
                        }}
                        className="w-full py-1.5 px-2.5 rounded-lg bg-zinc-900/60 hover:bg-zinc-800/60 border border-zinc-800 text-[11px] font-bold text-zinc-300 hover:text-white transition-all flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-blue-400" />
                          <span>Ver Elenco/Atletas</span>
                          {(teamMembersMap[team.id]?.length || team.players?.filter(Boolean).length || 0) > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full bg-blue-500/15 text-blue-400 text-[10px] font-black">
                              {teamMembersMap[team.id]?.length || team.players?.filter(Boolean).length || 0}
                            </span>
                          )}
                        </div>
                        {expandedRosterIds[team.id] ? (
                          <ChevronUp className="h-3.5 w-3.5 text-zinc-400" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
                        )}
                      </button>

                      {/* Conteúdo Expandido do Acordeão */}
                      {expandedRosterIds[team.id] && (
                        <div className="mt-2 p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/90 space-y-2 animate-fadeIn">
                          {teamMembersMap[team.id] && teamMembersMap[team.id].length > 0 ? (
                            <div className="space-y-1.5">
                              {teamMembersMap[team.id].map((member, idx) => (
                                <div
                                  key={member.id || idx}
                                  className="p-2 rounded-lg bg-zinc-900/80 border border-zinc-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs"
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-zinc-100 truncate">
                                        {member.name}
                                      </span>
                                      {member.is_captain && (
                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-amber-500/15 border border-amber-500/30 text-amber-300">
                                          Capitão
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-zinc-400 truncate flex items-center gap-1 mt-0.5">
                                      <Mail className="h-2.5 w-2.5 text-zinc-500 shrink-0" />
                                      <span>{member.email || "E-mail não informado"}</span>
                                    </div>
                                  </div>

                                  {/* Status do atleta: se o usuário já tem conta ou é convite pendente */}
                                  <div className="shrink-0 self-start sm:self-auto pt-0.5 sm:pt-0">
                                    {member.user_id ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold shadow-sm">
                                        <UserCheck className="h-2.5 w-2.5" />
                                        <span>Conta Vinculada</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-bold">
                                        <Clock className="h-2.5 w-2.5" />
                                        <span>Convite Pendente</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : team.players && team.players.filter(Boolean).length > 0 ? (
                            <div className="space-y-1.5">
                              {team.players.filter(Boolean).map((playerName, pIdx) => {
                                const isCap = pIdx === 0;
                                const hasAccount = isCap && Boolean(team.user_id);
                                return (
                                  <div
                                    key={pIdx}
                                    className="p-2 rounded-lg bg-zinc-900/80 border border-zinc-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs"
                                  >
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-zinc-100 truncate">
                                          {playerName}
                                        </span>
                                        {isCap && (
                                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-amber-500/15 border border-amber-500/30 text-amber-300">
                                            Capitão
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-zinc-400 truncate flex items-center gap-1 mt-0.5">
                                        <Mail className="h-2.5 w-2.5 text-zinc-500 shrink-0" />
                                        <span>{isCap && team.contact ? team.contact : "E-mail não informado"}</span>
                                      </div>
                                    </div>

                                    <div className="shrink-0 self-start sm:self-auto pt-0.5 sm:pt-0">
                                      {hasAccount ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold shadow-sm">
                                          <UserCheck className="h-2.5 w-2.5" />
                                          <span>Conta Vinculada</span>
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-bold">
                                          <Clock className="h-2.5 w-2.5" />
                                          <span>Convite Pendente</span>
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="py-2 text-center text-[11px] text-zinc-400">
                              <span>Nenhum atleta detalhado na equipe.</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Botão de Ação Inferior */}
                <div className="mt-5 pt-3 border-t border-zinc-800/80 space-y-2">
                  {/* Botão Individual: Ver Recibo (Abre modal de visualização do comprovante) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openReceiptModal(team);
                    }}
                    className="w-full py-2 px-3 rounded-xl border border-zinc-700 hover:border-zinc-500 bg-transparent hover:bg-zinc-800/60 text-xs font-bold text-zinc-300 hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                    title="Visualizar comprovante de pagamento Pix"
                  >
                    <Receipt className="h-3.5 w-3.5 text-blue-400" />
                    <span>Ver Recibo</span>
                  </button>

                  {isCancellationRequested ? (
                    hasFinancialAccess && !isReadOnly ? (
                      <div className="space-y-2">
                        <button
                          type="button"
                          disabled={isRefundingId === team.id}
                          onClick={() => handleRefundTeam(team.id)}
                          className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-red-600/30 active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          {isRefundingId === team.id ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Estornando...</span>
                            </>
                          ) : (
                            <>
                              <RotateCcw className="h-4 w-4" />
                              <span>Confirmar Cancelamento e Estornar</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          disabled={isDeletingTeamId === team.id}
                          onClick={() => handleDeleteOrFreeSpot(team)}
                          className="w-full py-2 px-3 rounded-xl border border-red-500/30 hover:border-red-500/60 bg-red-500/5 hover:bg-red-500/15 text-red-400 hover:text-red-300 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-400" />
                          <span>Libertar Vaga Imediatamente</span>
                        </button>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-800/40 text-red-300 text-[11px] font-medium text-center">
                        Cancelamento Solicitado • Requer Organizador para estorno
                      </div>
                    )
                  ) : (
                    <>
                      {isApproved && (
                        <button
                          type="button"
                          onClick={() => setSelectedTeamDetails(team)}
                          className="w-full py-2.5 px-4 rounded-xl border border-zinc-700 hover:border-zinc-500 bg-transparent text-zinc-300 hover:text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer hover:bg-zinc-800/40"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Ver Detalhes</span>
                        </button>
                      )}

                      {isWaitingPix && hasFinancialAccess && !isReadOnly && (
                        <button
                          type="button"
                          disabled={isApprovingId === team.id}
                          onClick={() => handleApprovePix(team.id)}
                          className="w-full py-2.5 px-4 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-neutral-950 font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-yellow-500/20 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {isApprovingId === team.id ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              <span>Aprovando & Repassando...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Aprovar Pix</span>
                            </>
                          )}
                        </button>
                      )}

                      {isWaitingPix && (!hasFinancialAccess || isReadOnly) && (
                        <button
                          type="button"
                          onClick={() => setSelectedTeamDetails(team)}
                          className="w-full py-2 px-3 rounded-xl border border-zinc-700 bg-transparent text-zinc-400 text-xs font-bold flex items-center justify-center gap-1.5"
                        >
                          <Clock className="h-3.5 w-3.5 text-orange-400" />
                          <span>Aguardando Pix</span>
                        </button>
                      )}

                      {isPending && (
                        <button
                          type="button"
                          onClick={() => setSelectedTeamDetails(team)}
                          className="w-full py-2.5 px-4 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-neutral-950 font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-yellow-500/20 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Receipt className="h-3.5 w-3.5" />
                          <span>Conferir Pix</span>
                        </button>
                      )}

                      {/* Botão Vermelho: Excluir / Libertar Vaga para Pendentes e Aguardando Pix */}
                      {(isPending || isWaitingPix) && !isReadOnly && (
                        <button
                          type="button"
                          disabled={isDeletingTeamId === team.id}
                          onClick={() => handleDeleteOrFreeSpot(team)}
                          className="w-full py-2 px-3 rounded-xl border border-red-500/30 hover:border-red-500/60 bg-red-500/5 hover:bg-red-500/15 text-red-400 hover:text-red-300 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                          title="Excluir inscrição pendente e libertar vaga na competição"
                        >
                          {isDeletingTeamId === team.id ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              <span>Libertando Vaga...</span>
                            </>
                          ) : (
                            <>
                              <Trash2 className="h-3.5 w-3.5 text-red-400" />
                              <span>Excluir / Libertar Vaga</span>
                            </>
                          )}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* 3. Card Especial Tracejado: Adicionar Time Manualmente */}
          {!isReadOnly && (
            <div
              onClick={() => setShowAddModal(true)}
              className="border-2 border-dashed border-zinc-700 hover:border-yellow-500 bg-zinc-900/30 hover:bg-zinc-900/60 transition-all duration-300 cursor-pointer rounded-2xl min-h-[200px] flex flex-col items-center justify-center p-6 text-center group shadow-md"
            >
              <div className="w-12 h-12 rounded-2xl bg-zinc-800/80 group-hover:bg-yellow-500 group-hover:text-neutral-950 border border-zinc-700 group-hover:border-yellow-500 text-zinc-300 flex items-center justify-center mb-3 transition-all duration-300 group-hover:scale-110 shadow-lg">
                <Plus className="h-6 w-6" />
              </div>
              <h4 className="font-display font-black text-sm text-white group-hover:text-yellow-400 transition-colors uppercase tracking-wide">
                Adicionar {entitySingular} Manualmente
              </h4>
              <p className="text-[11px] text-zinc-500 mt-1 max-w-[200px] leading-relaxed">
                Insira atletas diretamente na tabela da competição.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: Adicionar Equipe Manualmente (Mesclagem com o Motor Antigo) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-[#1a1a1a] border border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full text-white shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-5 right-5 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-2xl bg-yellow-500/15 border border-yellow-500/25 text-yellow-500">
                <Plus className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-black font-display uppercase tracking-tight">
                  Nova {entitySingular} (Manual)
                </h3>
                <p className="text-xs text-zinc-400">
                  Cadastre participantes com adaptação dinâmica para {currentSportType}.
                </p>
              </div>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleManualSubmit} className="space-y-4">
              {/* Se for Ping Pong, seletor de Solo vs Duplas */}
              {isPingPong && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase text-zinc-400">
                    Formato da Disputa
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormPingPongFormat("solo")}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                        formPingPongFormat === "solo"
                          ? "bg-yellow-500 text-black border-yellow-500"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400"
                      }`}
                    >
                      Solo (1v1)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormPingPongFormat("duplas")}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                        formPingPongFormat === "duplas"
                          ? "bg-yellow-500 text-black border-yellow-500"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400"
                      }`}
                    >
                      Duplas (2v2)
                    </button>
                  </div>
                </div>
              )}

              {/* Nome da Equipe / Dupla */}
              {!isPingPongSolo && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase text-zinc-400">
                    Nome da {entitySingular} <span className="text-blue-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder={
                      isDomino
                        ? "Ex: Os Mestres do Carroça"
                        : "Ex: Falcões F.C."
                    }
                    className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-800 focus:border-yellow-500 rounded-xl text-sm text-white outline-none"
                  />
                </div>
              )}

              {/* Capitão / Jogador 1 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-zinc-400">
                  {isPingPongSolo
                    ? "Nome do Jogador"
                    : isTeamSport
                    ? "Capitão / Responsável"
                    : "Jogador 1 (Capitão)"}{" "}
                  <span className="text-blue-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formPlayer1}
                  onChange={(e) => setFormPlayer1(e.target.value)}
                  placeholder="Ex: Carlos Silva"
                  className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-800 focus:border-yellow-500 rounded-xl text-sm text-white outline-none"
                />
              </div>

              {/* Jogador 2 (para Duplas de Dominó ou Ping Pong Duplas) */}
              {(isDomino || isPingPongDuplas) && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase text-zinc-400">
                    Jogador 2 <span className="text-blue-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formPlayer2}
                    onChange={(e) => setFormPlayer2(e.target.value)}
                    placeholder="Ex: Roberto Souza"
                    className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-800 focus:border-yellow-500 rounded-xl text-sm text-white outline-none"
                  />
                </div>
              )}

              {/* Atletas adicionais para Futsal e Vôlei */}
              {isTeamSport && (
                <div className="space-y-2 pt-2 border-t border-zinc-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase text-zinc-400">
                      Plantel de Atletas ({formAthletes.length})
                    </label>
                    <button
                      type="button"
                      onClick={handleAddAthleteField}
                      className="text-xs text-yellow-500 hover:text-yellow-400 font-bold flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Adicionar Atleta</span>
                    </button>
                  </div>

                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {formAthletes.map((ath, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={ath}
                          onChange={(e) => handleUpdateAthlete(idx, e.target.value)}
                          placeholder={`Atleta #${idx + 1}`}
                          className="flex-1 px-3 py-1.5 bg-zinc-900 border border-zinc-800 focus:border-yellow-500 rounded-xl text-xs text-white outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveAthlete(idx)}
                          className="p-1.5 text-zinc-500 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Categoria e Status Inicial */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-zinc-400">
                    Categoria
                  </label>
                  <input
                    type="text"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    placeholder="Amador A"
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-zinc-400">
                    Status Financeiro
                  </label>
                  <select
                    value={formPaymentStatus}
                    onChange={(e) => setFormPaymentStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white outline-none cursor-pointer"
                  >
                    <option value="PAID">Pago (Confirmado)</option>
                    <option value="PENDING">Pendente</option>
                  </select>
                </div>
              </div>

              {/* Botão de Submissão */}
              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full py-3 px-6 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-neutral-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-yellow-500/20 active:scale-98 cursor-pointer"
                >
                  Confirmar Inscrição
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Ver Detalhes / Conferir Pix da Equipe */}
      {selectedTeamDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-[#1a1a1a] border border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-md w-full text-white shadow-2xl relative">
            <button
              onClick={() => setSelectedTeamDetails(null)}
              className="absolute top-5 right-5 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xl">
                {sportIcon}
              </div>
              <div>
                <h3 className="text-xl font-black font-display text-white">
                  {selectedTeamDetails.name}
                </h3>
                <span className="text-xs text-zinc-400">
                  Categoria: {selectedTeamDetails.category || "Amador A"}
                </span>
              </div>
            </div>

            <div className="space-y-3 p-4 bg-[#121214] border border-zinc-800 rounded-2xl text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Responsável:</span>
                <span className="font-bold text-white">
                  {selectedTeamDetails.manager_name || selectedTeamDetails.players[0] || "Não informado"}
                </span>
              </div>

              {selectedTeamDetails.players[1] && (
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Parceiro/Jogador 2:</span>
                  <span className="font-bold text-white">{selectedTeamDetails.players[1]}</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Data de Inscrição:</span>
                <span className="font-bold text-white">{formatDate(selectedTeamDetails.createdAt)}</span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                <span className="text-zinc-500">Status da Inscrição:</span>
                {selectedTeamDetails.cancellation_status === "REQUESTED_BY_ATHLETE" ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-950 border border-red-600 text-red-200 text-[10px] font-black uppercase tracking-wider animate-pulse">
                    <AlertTriangle className="h-3 w-3 text-red-400" />
                    <span>CANCELAMENTO SOLICITADO</span>
                  </span>
                ) : selectedTeamDetails.cancellation_status === "REFUND_REQUESTED" ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-950 border border-rose-500 text-rose-200 text-[10px] font-black uppercase tracking-wider animate-pulse">
                    <AlertTriangle className="h-3 w-3 text-rose-400" />
                    <span>CANCELAMENTO C/ REEMBOLSO</span>
                  </span>
                ) : selectedTeamDetails.payment_status === "PAID" ||
                  selectedTeamDetails.payment_status === "APPROVED" ||
                  selectedTeamDetails.status === "PAID" ||
                  selectedTeamDetails.status === "CONFIRMED" ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    <span>{selectedTeamDetails.payment_status === "APPROVED" ? "Aprovado" : "Pago (Confirmado)"}</span>
                  </span>
                ) : (
                  <span className="font-black text-yellow-400">
                    {selectedTeamDetails.payment_status || "PENDING"}
                  </span>
                )}
              </div>
            </div>

            {/* Alerta de Cancelamento Pós-Pagamento (REFUND_REQUESTED) */}
            {selectedTeamDetails.cancellation_status === "REFUND_REQUESTED" && (() => {
              const phone =
                selectedTeamDetails.manager_phone ||
                selectedTeamDetails.phone ||
                (selectedTeamDetails.custom_registration_answers &&
                  (selectedTeamDetails.custom_registration_answers["Telefone"] ||
                    selectedTeamDetails.custom_registration_answers["WhatsApp"] ||
                    selectedTeamDetails.custom_registration_answers["whatsapp"] ||
                    selectedTeamDetails.custom_registration_answers["telefone"])) ||
                "";
              return (
                <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-rose-950/70 via-red-950/40 to-amber-950/40 border border-rose-500/50 space-y-2">
                  <div className="flex items-center gap-2 text-rose-300 font-black text-xs uppercase tracking-wider">
                    <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                    <span>Cancelamento Pós-Pagamento Solicitado</span>
                  </div>
                  <p className="text-zinc-300 text-xs leading-relaxed">
                    O atleta pagou a taxa de inscrição e solicitou o cancelamento. Combine a devolução/estorno diretamente através dos canais de contato.
                  </p>
                  {phone ? (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-zinc-300">
                        Telefone: <strong className="text-white font-mono">{phone}</strong>
                      </span>
                      <a
                        href={`https://wa.me/55${String(phone).replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        <span>Conversar no WhatsApp</span>
                      </a>
                    </div>
                  ) : (
                    <p className="text-[11px] text-zinc-400">Telefone não cadastrado. Verifique o email do atleta.</p>
                  )}
                </div>
              );
            })()}

            {/* Exibição das Respostas do Formulário Personalizado */}
            {selectedTeamDetails.custom_registration_answers &&
              typeof selectedTeamDetails.custom_registration_answers === "object" &&
              Object.keys(selectedTeamDetails.custom_registration_answers).length > 0 && (
                <div className="mt-4 p-4 bg-[#121214] border border-zinc-800 rounded-2xl space-y-2.5">
                  <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
                    <FileText className="h-4 w-4 text-orange-400" />
                    <span className="text-xs font-black uppercase tracking-wider text-zinc-300">
                      Respostas da Inscrição (Campos Personalizados)
                    </span>
                  </div>
                  <div className="space-y-2 text-xs divide-y divide-zinc-800/60">
                    {Object.entries(selectedTeamDetails.custom_registration_answers).map(
                      ([question, answer], idx) => (
                        <div
                          key={idx}
                          className="pt-2 first:pt-0 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5"
                        >
                          <span className="text-zinc-400 font-medium sm:max-w-[50%] break-words">
                            {question}:
                          </span>
                          <span className="font-bold text-white sm:text-right bg-zinc-900/90 px-2.5 py-1 rounded-lg border border-zinc-800 break-words">
                            {typeof answer === "boolean"
                              ? answer
                                ? "Sim"
                                : "Não"
                              : answer === null || answer === undefined || answer === ""
                              ? "Não respondido"
                              : String(answer)}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

            {/* Ações do Modal */}
            <div className="mt-6 space-y-2.5">
              {selectedTeamDetails.payment_proof_url && (
                <button
                  type="button"
                  onClick={() => handleViewReceipt(selectedTeamDetails.payment_proof_url)}
                  className="w-full py-2.5 px-4 rounded-xl border border-zinc-700 hover:border-zinc-500 bg-zinc-900/60 hover:bg-zinc-800 text-xs font-bold text-zinc-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Eye className="h-4 w-4 text-blue-400" />
                  <span>Ver Comprovante Anexado</span>
                </button>
              )}

              {/* Botão Excluir / Libertar Vaga para Pendentes */}
              {(selectedTeamDetails.payment_status === "PENDING" ||
                selectedTeamDetails.payment_status === "WAITING_PIX" ||
                selectedTeamDetails.payment_status === "WAITING_APPROVAL" ||
                !selectedTeamDetails.payment_status) &&
                hasFinancialAccess &&
                !isReadOnly && (
                  <button
                    type="button"
                    disabled={isDeletingTeamId === selectedTeamDetails.id}
                    onClick={async () => {
                      const teamToDelete = selectedTeamDetails;
                      setSelectedTeamDetails(null);
                      await handleDeleteOrFreeSpot(teamToDelete);
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isDeletingTeamId === selectedTeamDetails.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    <span>Excluir / Libertar Vaga</span>
                  </button>
                )}

              {selectedTeamDetails.cancellation_status === "REQUESTED_BY_ATHLETE" ||
              selectedTeamDetails.cancellation_status === "REFUND_REQUESTED" ? (
                hasFinancialAccess && !isReadOnly ? (
                  <button
                    type="button"
                    disabled={isRefundingId === selectedTeamDetails.id}
                    onClick={() => handleRefundTeam(selectedTeamDetails.id)}
                    className="w-full py-3.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-red-600/30 active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isRefundingId === selectedTeamDetails.id ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Processando Devolução...</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw className="h-4 w-4" />
                        <span>Confirmar Cancelamento e Marcar como Reembolsado</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/40 text-red-300 text-xs font-medium text-center">
                    Cancelamento solicitado pelo atleta • Requer permissão financeira do organizador.
                  </div>
                )
              ) : (selectedTeamDetails.payment_status !== "APPROVED" && selectedTeamDetails.payment_status !== "PAID") ? (
                hasFinancialAccess && !isReadOnly ? (
                  <button
                    type="button"
                    disabled={isApprovingId === selectedTeamDetails.id}
                    onClick={() => handleApprovePix(selectedTeamDetails.id)}
                    className="w-full py-3 px-4 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-neutral-950 font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isApprovingId === selectedTeamDetails.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    <span>Aprovar Pagamento Pix</span>
                  </button>
                ) : (
                  <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-xs font-medium text-center">
                    Inscrição pendente de aprovação financeira pelo organizador.
                  </div>
                )
              ) : null}

              {!isReadOnly && hasFinancialAccess && onDeleteTeam && (
                <button
                  type="button"
                  onClick={() => {
                    onDeleteTeam?.(selectedTeamDetails.id);
                    setLocalTeams((prev) => prev.filter((t) => t.id !== selectedTeamDetails.id));
                    setSelectedTeamDetails(null);
                    setToastMessage("Inscrição removida com sucesso.");
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Excluir Inscrição Definitivamente</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}


      {/* MODAL 3: Conferir Comprovantes (Ação em Massa) */}
      {showProofReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-[#18181b] border border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full text-white shadow-2xl relative max-h-[90vh] overflow-y-auto">
            {/* Linha decorativa superior */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500" />

            <button
              type="button"
              onClick={() => setShowProofReviewModal(false)}
              className="absolute top-5 right-5 p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
              title="Fechar"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-2xl bg-blue-500/15 border border-blue-500/25 text-blue-400">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-black font-display uppercase tracking-tight">
                    Conferir Comprovantes Pix
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-400 text-[10px] font-black">
                    {teamsToReview.length} pendente(s)
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Valide os comprovantes anexados pelos atletas e aprove a inscrição para a chave oficial.
                </p>
              </div>
            </div>

            {teamsToReview.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <h4 className="text-base font-bold text-white">
                  Nenhum comprovante pendente no momento!
                </h4>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                  Todas as equipes com comprovante de pagamento Pix anexado já foram aprovadas.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowProofReviewModal(false)}
                    className="py-2.5 px-6 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white transition-all cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {teamsToReview.map((team) => (
                  <div
                    key={team.id}
                    className="p-5 rounded-2xl bg-[#121214] border border-zinc-800 space-y-4 shadow-lg"
                  >
                    {/* Cabeçalho da Equipe */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-black text-white font-display tracking-tight">
                            {team.name}
                          </h4>
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-orange-500/10 text-orange-400 border border-orange-500/25">
                            WAITING_PIX
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          Responsável: <strong className="text-zinc-200">{team.manager_name || (Array.isArray(team.players) ? team.players[0] : "") || "Capitão"}</strong>
                          {team.contact ? ` • Contato: ${team.contact}` : ""}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleViewReceipt(team.payment_proof_url)}
                        className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1.5 self-start sm:self-auto cursor-pointer transition-colors"
                        title="Abrir comprovante seguro em nova aba"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Abrir Original</span>
                      </button>
                    </div>

                    {/* Área da Imagem / PDF do Comprovante */}
                    <div className="bg-[#09090b] border border-zinc-800/80 rounded-xl p-3 flex items-center justify-center overflow-hidden min-h-[140px]">
                      {!team.payment_proof_url ? (
                        <div className="py-6 text-center space-y-1.5">
                          <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
                          <p className="text-xs text-zinc-200 font-bold">Nenhum comprovante anexado</p>
                          <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
                            O atleta ainda não enviou o comprovante de pagamento Pix desta inscrição.
                          </p>
                        </div>
                      ) : team.payment_proof_url?.toLowerCase().endsWith(".pdf") ? (
                        <div className="py-6 text-center space-y-2">
                          <FileText className="w-10 h-10 text-blue-400 mx-auto" />
                          <p className="text-xs text-zinc-300 font-bold">Documento em Formato PDF</p>
                          <button
                            type="button"
                            onClick={() => handleViewReceipt(team.payment_proof_url)}
                            className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white cursor-pointer"
                          >
                            Visualizar PDF
                          </button>
                        </div>
                      ) : (
                        <img
                          src={proofSignedUrls[team.id] || team.payment_proof_url}
                          alt={`Comprovante da equipe ${team.name}`}
                          className="max-h-64 w-auto object-contain rounded-lg mx-auto select-none shadow-md cursor-pointer hover:opacity-95"
                          onClick={() => handleViewReceipt(team.payment_proof_url)}
                          title="Clique para abrir imagem completa"
                        />
                      )}
                    </div>

                    {/* Botão de Aprovação logo abaixo de cada imagem */}
                    <button
                      type="button"
                      disabled={isApprovingId === team.id || isReadOnly}
                      onClick={() => handleApprovePix(team.id)}
                      className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-600/25 active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isApprovingId === team.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Aprovando & Repassando...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Aprovar Inscrição Pix</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL INDIVIDUAL: VISUALIZAÇÃO DO COMPROVANTE (RECIBO PIX) */}
      {/* ======================================================== */}
      {viewingReceiptTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-[#18181b] border border-zinc-800 rounded-2xl max-w-lg w-full p-6 text-white shadow-2xl relative">
            <button
              onClick={() => setViewingReceiptTeam(null)}
              className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Fechar"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-5 border-b border-zinc-800/80 pb-4">
              <div className="p-3 rounded-2xl bg-blue-500/15 border border-blue-500/25 text-blue-400">
                <Receipt className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-black font-display uppercase tracking-tight">
                  Comprovante de Pagamento
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Equipe: <strong className="text-zinc-200">{viewingReceiptTeam.name}</strong> • Responsável:{" "}
                  <strong className="text-zinc-200">
                    {viewingReceiptTeam.manager_name || viewingReceiptTeam.players?.[0] || "Capitão"}
                  </strong>
                </p>
              </div>
            </div>

            {/* Verificação: Se payment_proof_url estiver vazio */}
            {!viewingReceiptTeam.payment_proof_url ? (
              <div className="py-10 px-4 text-center space-y-3 bg-[#121214] rounded-2xl border border-dashed border-zinc-800 my-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-400 flex items-center justify-center mx-auto shadow-md">
                  <AlertCircle className="h-7 w-7" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">Nenhum comprovante anexado</h4>
                  <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
                    O atleta ou responsável não enviou uma imagem ou arquivo de comprovante Pix para esta inscrição.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 my-4">
                <div className="bg-[#09090b] border border-zinc-800 rounded-xl p-3 flex items-center justify-center overflow-hidden min-h-[220px]">
                  {loadingReceiptUrl ? (
                    <div className="py-12 flex flex-col items-center gap-2 text-xs text-zinc-400">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
                      <span>Carregando comprovante seguro...</span>
                    </div>
                  ) : viewingReceiptTeam.payment_proof_url?.toLowerCase().endsWith(".pdf") ? (
                    <div className="py-8 text-center space-y-3">
                      <FileText className="w-12 h-12 text-blue-400 mx-auto" />
                      <p className="text-xs text-zinc-300 font-bold">Comprovante em formato PDF</p>
                      <a
                        href={receiptModalSignedUrl || viewingReceiptTeam.payment_proof_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-md cursor-pointer"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>Abrir Documento PDF</span>
                      </a>
                    </div>
                  ) : (
                    <div className="relative group max-h-[380px] overflow-hidden rounded-lg">
                      <img
                        src={receiptModalSignedUrl || viewingReceiptTeam.payment_proof_url}
                        alt={`Comprovante da equipe ${viewingReceiptTeam.name}`}
                        className="max-h-[360px] w-auto object-contain rounded-lg mx-auto shadow-md select-none"
                      />
                    </div>
                  )}
                </div>

                {receiptModalSignedUrl && !viewingReceiptTeam.payment_proof_url?.toLowerCase().endsWith(".pdf") && (
                  <div className="flex justify-end">
                    <a
                      href={receiptModalSignedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Ver Imagem em Nova Aba</span>
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Ações do Modal */}
            <div className="pt-4 border-t border-zinc-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setViewingReceiptTeam(null)}
                className="py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-300 hover:text-white transition-all cursor-pointer"
              >
                Fechar
              </button>

              {(viewingReceiptTeam.payment_status === "WAITING_PIX" || viewingReceiptTeam.payment_status === "WAITING_APPROVAL" || Boolean(viewingReceiptTeam.payment_proof_url)) && hasFinancialAccess && !isReadOnly && (
                <button
                  type="button"
                  disabled={isApprovingId === viewingReceiptTeam.id}
                  onClick={() => handleApprovePix(viewingReceiptTeam.id)}
                  className="py-2.5 px-5 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-neutral-950 font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-yellow-500/20 active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isApprovingId === viewingReceiptTeam.id ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Aprovando & Repassando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Aprovar Pix</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
