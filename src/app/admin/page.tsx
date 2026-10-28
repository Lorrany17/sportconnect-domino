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
  Wifi,
  WifiOff,
  Radio,
  Terminal,
  Send,
  Database,
  Zap,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { RealtimeChannel } from "@supabase/supabase-js";
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

export interface RealtimeLogEntry {
  id: string;
  timestamp: string;
  type: "postgres" | "broadcast" | "presence" | "system" | "error";
  title: string;
  table?: string;
  eventType?: string;
  details?: any;
}

type AdminTab = "overview" | "tournaments" | "users" | "websocket";

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
  const [failedPayouts, setFailedPayouts] = useState<any[]>([]);

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

  // =========================================================
  // ESTADOS E REFS DO WEBSOCKET / REALTIME
  // =========================================================
  const [wsStatus, setWsStatus] = useState<
    "CONNECTING" | "SUBSCRIBED" | "CLOSED" | "CHANNEL_ERROR" | "TIMED_OUT"
  >("CONNECTING");
  const [latency, setLatency] = useState<number | null>(null);
  const [isPinging, setIsPinging] = useState(false);

  // Feed de Eventos e Estatísticas
  const [realtimeLogs, setRealtimeLogs] = useState<RealtimeLogEntry[]>([]);
  const [logFilter, setLogFilter] = useState<string>("ALL");
  const [totalWsEvents, setTotalWsEvents] = useState<number>(0);

  // Broadcast e Presença
  const [broadcastInput, setBroadcastInput] = useState<string>("");
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<{ id: string; name: string; onlineAt: string }[]>([]);

  // Feedback Visual
  const [liveToast, setLiveToast] = useState<{ id: string; message: string; type: "create" | "update" | "delete" | "info" } | null>(null);
  const [highlightedTournId, setHighlightedTournId] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Refs de Canal e Medição de Tempo
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pingTimestampRef = useRef<number>(0);

  // Adiciona uma linha formatada no console de eventos WebSocket
  const addLog = (
    type: "postgres" | "broadcast" | "presence" | "system" | "error",
    title: string,
    details?: any,
    table?: string,
    eventType?: string
  ) => {
    const entry: RealtimeLogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        fractionalSecondDigits: 3,
      }),
      type,
      title,
      table,
      eventType,
      details,
    };
    setRealtimeLogs((prev) => [entry, ...prev.slice(0, 99)]);
    setTotalWsEvents((prev) => prev + 1);
  };

  // Dispara um toast flutuante no canto da tela e dá destaque na linha do torneio
  const triggerLiveToast = (message: string, type: "create" | "update" | "delete" | "info" = "info", tournId?: string) => {
    const toastId = Math.random().toString(36).substring(2, 8);
    setLiveToast({ id: toastId, message, type });
    if (tournId) {
      setHighlightedTournId(tournId);
      setTimeout(() => setHighlightedTournId(null), 4000);
    }
    setTimeout(() => {
      setLiveToast((prev) => (prev?.id === toastId ? null : prev));
    }, 4500);
  };

  // Disparo do Ping WebSocket
  const sendWebSocketPing = async (targetChannel?: RealtimeChannel | null) => {
    const ch = targetChannel || channelRef.current;
    if (!ch) return;
    try {
      setIsPinging(true);
      const now = Date.now();
      pingTimestampRef.current = now;
      await ch.send({
        type: "broadcast",
        event: "ping",
        payload: {
          sentAt: now,
          sender: user?.email || "admin",
        },
      });
    } catch (err: any) {
      setIsPinging(false);
      addLog("error", "Falha ao enviar Ping WebSocket", err);
    }
  };

  // Envio de Broadcast Manual
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastInput.trim() || !channelRef.current) return;
    try {
      setIsSendingBroadcast(true);
      const text = broadcastInput.trim();
      await channelRef.current.send({
        type: "broadcast",
        event: "system_alert",
        payload: {
          text,
          sender: user?.email || "Super Admin",
          sentAt: Date.now(),
        },
      });
      setBroadcastInput("");
      addLog("broadcast", `Você enviou broadcast: "${text}"`);
    } catch (err: any) {
      addLog("error", "Falha ao transmitir broadcast", err);
    } finally {
      setIsSendingBroadcast(false);
    }
  };

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
          start_time: t.start_time,
          end_date: t.end_date,
          cover_url: t.cover_url,
          rules: t.rules,
          gender_category: t.gender_category,
          organizer_pix_key: t.organizer_pix_key,
          sponsors: t.sponsors || [],
          custom_registration_fields: t.custom_registration_fields,
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

        // E. Fetch de Repasses Pix com Falha (Split 90% para Organizadores)
        let failedPayoutsList: any[] = [];
        try {
          const { data: failedTeams } = await supabase
            .from("teams")
            .select("id, name, tournament_id, status, payment_status, payout_status, payout_amount, mp_payment_id, created_at")
            .eq("payout_status", "FAILED_TRANSFER")
            .order("created_at", { ascending: false });

          if (failedTeams) {
            failedPayoutsList = failedTeams;
          }
        } catch {
          // Fallback se coluna payout_status não existir no Supabase
        }

        if (mounted) {
          setTournaments(tournsList);
          setUsersList(dbProfiles || []);
          setTotalTeamsCount(teamsCount || 0);
          setFailedPayouts(failedPayoutsList);

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

  // =========================================================
  // CONEXÃO WEBSOCKET / REALTIME (SUPABASE)
  // =========================================================
  useEffect(() => {
    if (!user) return;
    addLog("system", "Iniciando conexão WebSocket na Central do Sistema...");
    setWsStatus("CONNECTING");
    const channelName = "central-sistema-realtime";
    const clientName = user.email || user.id || "SuperAdmin";
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: true },
        presence: { key: clientName },
      },
    });

    // 1. Broadcast: Ping (Cálculo de latência RTT) e Alertas
    channel
      .on("broadcast", { event: "ping" }, (payload: any) => {
        const now = Date.now();
        const sentAt = payload.payload?.sentAt || pingTimestampRef.current;
        if (sentAt) {
          const rtt = Math.max(1, now - sentAt);
          setLatency(rtt);
          setIsPinging(false);
          addLog("broadcast", `Ping WebSocket retornado! RTT: ${rtt}ms`, payload);
        }
      })
      .on("broadcast", { event: "system_alert" }, (payload: any) => {
        const msg = payload.payload?.text || "Alerta do Sistema";
        const sender = payload.payload?.sender || "Sistema";
        addLog("broadcast", `[Alerta de ${sender}]: ${msg}`, payload);
        triggerLiveToast(`🔔 ${sender}: ${msg}`, "info");
      });

    // 2. Presença: Usuários online no canal
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const users: { id: string; name: string; onlineAt: string }[] = [];
        Object.keys(state).forEach((k) => {
          const list = state[k] as any[];
          list.forEach((p) => {
            users.push({
              id: p.presence_ref || k,
              name: p.name || k,
              onlineAt: p.onlineAt || new Date().toISOString(),
            });
          });
        });
        setOnlineUsers(users);
        addLog("presence", `Presença sincronizada (${users.length} usuários online)`, users);
      })
      .on("presence", { event: "join" }, ({ key, newPresences }: any) => {
        addLog("presence", `Usuário conectou ao WebSocket: ${key}`, newPresences);
      })
      .on("presence", { event: "leave" }, ({ key, leftPresences }: any) => {
        addLog("presence", `Usuário desconectou do WebSocket: ${key}`, leftPresences);
      });

    // 3. Postgres Changes: Sincronização em tempo real da tabela "tournaments"
    channel
      .on("postgres_changes", { event: "*", schema: "public", table: "tournaments" }, async (payload: any) => {
        const eventType = payload.eventType; // 'INSERT' | 'UPDATE' | 'DELETE'
        const newRow = payload.new;
        const oldRow = payload.old;
        addLog("postgres", `Alteração em "tournaments" [${eventType}]`, payload, "tournaments", eventType);

        if (eventType === "INSERT" && newRow) {
          const newTournament: Tournament = {
            id: newRow.id,
            name: newRow.name || "Novo Torneio",
            status: newRow.status || "ATIVO",
            createdAt: newRow.created_at || new Date().toISOString(),
            sport_type: (newRow.sport_type as SportType) || "DOMINO",
            format: newRow.format,
            owner_id: newRow.owner_id,
            max_teams: newRow.max_teams ? Number(newRow.max_teams) : 16,
            entry_fee: newRow.entry_fee ? Number(newRow.entry_fee) : 0,
            location: newRow.location,
            start_date: newRow.start_date,
            end_date: newRow.end_date,
            cover_url: newRow.cover_url,
            rules: newRow.rules,
            organizer_pix_key: newRow.organizer_pix_key,
          };
          setTournaments((prev) => [newTournament, ...prev.filter((t) => t.id !== newRow.id)]);
          triggerLiveToast(`✨ Novo torneio criado via WebSocket: "${newRow.name}"`, "create", newRow.id);
        } else if (eventType === "UPDATE" && newRow) {
          setTournaments((prev) =>
            prev.map((t) => (t.id === newRow.id ? { ...t, ...newRow, createdAt: newRow.created_at || t.createdAt } : t))
          );
          triggerLiveToast(`⚡ Torneio atualizado via WebSocket: "${newRow.name || newRow.id}"`, "update", newRow.id);
        } else if (eventType === "DELETE" && oldRow) {
          setTournaments((prev) => prev.filter((t) => t.id !== oldRow.id));
          triggerLiveToast(`🗑️ Torneio removido em tempo real.`, "delete");
        }
      })
      // 4. Postgres Changes: Auditoria de "matches" e "teams"
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, (payload: any) => {
        addLog("postgres", `Alteração em "matches" [${payload.eventType}]`, payload, "matches", payload.eventType);
        triggerLiveToast(`⚽ Partida atualizada em tempo real.`, "info");
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, (payload: any) => {
        addLog("postgres", `Alteração em "teams" [${payload.eventType}]`, payload, "teams", payload.eventType);
        triggerLiveToast(`👥 Inscrição/Equipe alterada em tempo real.`, "info");
      });

    // 5. Inscrição do Canal
    channel.subscribe(async (status: string, err?: any) => {
      if (status === "SUBSCRIBED") {
        setWsStatus("SUBSCRIBED");
        addLog("system", "Canal WebSocket inscrito com sucesso! (SUBSCRIBED)", { channel: channelName });
        await channel.track({
          name: clientName,
          onlineAt: new Date().toLocaleTimeString("pt-BR"),
        });
        sendWebSocketPing(channel);
      } else if (status === "CLOSED") {
        setWsStatus("CLOSED");
      } else if (status === "CHANNEL_ERROR") {
        setWsStatus("CHANNEL_ERROR");
        addLog("error", "Erro no canal WebSocket", err);
      } else if (status === "TIMED_OUT") {
        setWsStatus("TIMED_OUT");
      }
    });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user]);

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

      try {
        const { data: failedTeams } = await supabase
          .from("teams")
          .select("id, name, tournament_id, status, payment_status, payout_status, payout_amount, mp_payment_id, created_at")
          .eq("payout_status", "FAILED_TRANSFER")
          .order("created_at", { ascending: false });
        if (failedTeams) {
          setFailedPayouts(failedTeams);
        }
      } catch {
        // Coluna pode não existir ainda
      }
    } catch (err) {
      console.error("Erro ao atualizar dados do painel admin:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Marcar Repasse Manual como Concluído
  const handleMarkPayoutCompleted = async (teamId: string) => {
    try {
      const { error } = await supabase
        .from("teams")
        .update({ payout_status: "COMPLETED" })
        .eq("id", teamId);

      if (!error) {
        setFailedPayouts((prev) => prev.filter((t) => t.id !== teamId));
      }
    } catch (err) {
      console.error("Erro ao concluir repasse manual:", err);
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
        (t.status || "OPEN").toUpperCase() === "OPEN" ||
        (t.status || "OPEN").toUpperCase() === "ATIVO" ||
        (t.status || "").toUpperCase() === "IN_PROGRESS" ||
        (t.status || "").toUpperCase() === "EM_ANDAMENTO"
    ).length;
    const completedTournaments = tournaments.filter(
      (t) =>
        (t.status || "").toUpperCase() === "FINALIZADO" ||
        (t.status || "").toUpperCase() === "COMPLETED"
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
              {/* WebSocket Status & Ping Trigger */}
              <button
                type="button"
                onClick={() => sendWebSocketPing()}
                disabled={isPinging}
                className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold transition-all shadow-sm cursor-pointer ${
                  wsStatus === "SUBSCRIBED"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                    : wsStatus === "CONNECTING"
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                    : "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
                }`}
                title="Clique para testar o Ping WebSocket (RTT)"
              >
                {wsStatus === "SUBSCRIBED" ? (
                  <>
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <span>WebSocket Ativo</span>
                    {latency !== null && (
                      <span className="text-[10px] bg-emerald-500/20 px-1.5 py-0.5 rounded text-emerald-300 font-mono">
                        {isPinging ? "..." : `${latency}ms`}
                      </span>
                    )}
                  </>
                ) : wsStatus === "CONNECTING" ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
                    <span>Conectando WS...</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3 text-red-400" />
                    <span>WS Desconectado</span>
                  </>
                )}
              </button>

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

            <button
              type="button"
              onClick={() => setActiveTab("websocket")}
              className={`px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap relative ${
                activeTab === "websocket"
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/25 border border-purple-400/30"
                  : "bg-[#141416] text-zinc-400 hover:text-white hover:bg-zinc-800 border border-[#27272a]"
              }`}
            >
              <Radio className="h-4 w-4 text-emerald-400" />
              <span>Monitor & Diagnóstico WebSocket</span>
              <span className="ml-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-[10px] text-emerald-300 font-mono">
                LIVE
              </span>
            </button>
          </div>

          {/* ========================================================= */}
          {/* CONTEÚDO DA ABA 1: VISÃO GERAL */}
          {/* ========================================================= */}
          {activeTab === "overview" && (
            <div className="space-y-6 animate-fadeIn">
              {/* Alerta de Repasses Manuais Pendentes (Split Pix Falhou) */}
              {failedPayouts.length > 0 && (
                <div className="bg-gradient-to-r from-amber-950/40 via-red-950/30 to-[#121214] border border-amber-500/40 rounded-3xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-amber-400" />
                      <h3 className="text-sm font-black uppercase tracking-wider text-white">
                        Repasses Pix com Falha ({failedPayouts.length}) • Ação Manual Necessária
                      </h3>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-[10px] font-black text-amber-300 uppercase">
                      Split 90% Organizador
                    </span>
                  </div>

                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Os seguintes atletas pagaram a inscrição com sucesso via Pix, mas a transferência automática dos 90% para o organizador falhou (chave Pix inexistente ou recusada pelo Mercado Pago). Efetue a transferência manual e marque como concluído:
                  </p>

                  <div className="space-y-3">
                    {failedPayouts.map((fp) => {
                      const tourney = tournaments.find((t) => t.id === fp.tournament_id);
                      const pixKey = tourney?.organizer_pix_key || "Não cadastrada";
                      return (
                        <div
                          key={fp.id}
                          className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-white">{fp.name}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold">
                                {tourney?.name || "Torneio"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-zinc-400">
                              <span>Chave Pix Organizador:</span>
                              <code className="px-2 py-0.5 bg-black/60 rounded text-amber-300 font-mono text-xs">
                                {pixKey}
                              </code>
                              {pixKey !== "Não cadastrada" && (
                                <button
                                  type="button"
                                  onClick={(e) => handleCopy(pixKey, e)}
                                  className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                                  title="Copiar Chave Pix"
                                >
                                  {copiedText === pixKey ? (
                                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              )}
                            </div>
                            {fp.payout_amount && (
                              <p className="text-xs font-bold text-emerald-400">
                                Valor a Repassar (90%): R$ {Number(fp.payout_amount).toFixed(2)}
                              </p>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleMarkPayoutCompleted(fp.id)}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Marcar como Repassado</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

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
                              className={`transition-colors group ${
                                highlightedTournId === t.id
                                  ? "bg-purple-950/40 ring-1 ring-purple-500 animate-pulse"
                                  : "hover:bg-zinc-800/40"
                              }`}
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
                                {rawStatus === "ATIVO" || rawStatus === "OPEN" ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    <span>Inscrições Abertas</span>
                                  </span>
                                ) : rawStatus === "EM_ANDAMENTO" || rawStatus === "IN_PROGRESS" ? (
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

          {/* ========================================================= */}
          {/* CONTEÚDO DA ABA 4: MONITOR & DIAGNÓSTICO WEBSOCKET */}
          {/* ========================================================= */}
          {activeTab === "websocket" && (
            <div className="space-y-6 animate-fadeIn">
              {/* Cards de Métricas de Rede / WebSocket */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Status do Canal */}
                <div className="p-5 rounded-2xl bg-[#121214] border border-[#27272a] space-y-2 shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Radio className="h-4 w-4 text-purple-400" />
                      <span>Status do Canal</span>
                    </span>
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        wsStatus === "SUBSCRIBED"
                          ? "bg-emerald-500 shadow-lg shadow-emerald-500/50"
                          : wsStatus === "CONNECTING"
                          ? "bg-amber-500 animate-pulse"
                          : "bg-red-500"
                      }`}
                    />
                  </div>
                  <div className="text-2xl font-black text-white font-mono tracking-tight">
                    {wsStatus}
                  </div>
                  <p className="text-[11px] text-zinc-500 font-mono truncate">
                    Canal: central-sistema-realtime
                  </p>
                </div>

                {/* 2. Latência RTT */}
                <div className="p-5 rounded-2xl bg-[#121214] border border-[#27272a] space-y-2 shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Activity className="h-4 w-4 text-emerald-400" />
                      <span>Latência (RTT)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => sendWebSocketPing()}
                      disabled={isPinging}
                      className="text-[10px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 transition-all cursor-pointer"
                    >
                      <RefreshCw className={`h-2.5 w-2.5 ${isPinging ? "animate-spin" : ""}`} />
                      <span>Testar Ping</span>
                    </button>
                  </div>
                  <div className="text-2xl font-black text-emerald-400 font-mono">
                    {isPinging ? (
                      <span className="text-sm text-zinc-400 animate-pulse">Medindo...</span>
                    ) : latency !== null ? (
                      `${latency} ms`
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    Round-trip time com Supabase
                  </p>
                </div>

                {/* 3. Total de Eventos Capturados */}
                <div className="p-5 rounded-2xl bg-[#121214] border border-[#27272a] space-y-2 shadow-md">
                  <span className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-amber-400" />
                    <span>Eventos Capturados</span>
                  </span>
                  <div className="text-2xl font-black text-amber-400 font-mono">
                    {totalWsEvents}
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    {realtimeLogs.length} logs mantidos na sessão
                  </p>
                </div>

                {/* 4. Presença Online */}
                <div className="p-5 rounded-2xl bg-[#121214] border border-[#27272a] space-y-2 shadow-md">
                  <span className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-blue-400" />
                    <span>Usuários no Canal</span>
                  </span>
                  <div className="text-2xl font-black text-blue-400 font-mono">
                    {onlineUsers.length}
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    Clientes sincronizados via Presence
                  </p>
                </div>
              </div>

              {/* Seção Central: Broadcast e Presença */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Transmissor de Broadcast */}
                <div className="lg:col-span-2 bg-[#121214] border border-[#27272a] rounded-3xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-[#27272a] pb-3">
                    <div className="space-y-0.5">
                      <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                        <Send className="h-4 w-4 text-purple-400" />
                        <span>Transmissor de Broadcast (Alerta Global)</span>
                      </h3>
                      <p className="text-xs text-zinc-500">
                        Envie um alerta em tempo real para todos os clientes e administradores conectados a este canal.
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleSendBroadcast} className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={broadcastInput}
                        onChange={(e) => setBroadcastInput(e.target.value)}
                        placeholder="Ex: Manutenção agendada para 22h ou Inscrições prorrogadas..."
                        className="flex-1 px-4 py-3 bg-[#18181b] border border-[#27272a] focus:border-purple-500 rounded-2xl text-xs text-white placeholder-zinc-500 outline-none transition-all"
                      />
                      <button
                        type="submit"
                        disabled={isSendingBroadcast || !broadcastInput.trim()}
                        className="px-5 py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:hover:bg-purple-600 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-purple-600/30 cursor-pointer active:scale-95"
                      >
                        {isSendingBroadcast ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        <span>Transmitir</span>
                      </button>
                    </div>
                    <div className="text-[11px] text-zinc-500 flex items-center gap-2">
                      <span className="flex h-1.5 w-1.5 rounded-full bg-purple-400" />
                      <span>Dispara notificação flutuante com feedback visual instantâneo em todas as telas conectadas.</span>
                    </div>
                  </form>
                </div>

                {/* Usuários Conectados (Presence) */}
                <div className="bg-[#121214] border border-[#27272a] rounded-3xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-[#27272a] pb-3">
                    <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                      <Users className="h-4 w-4 text-emerald-400" />
                      <span>Presença ({onlineUsers.length})</span>
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-300 font-mono">
                      SYNC
                    </span>
                  </div>

                  {onlineUsers.length === 0 ? (
                    <div className="py-8 text-center text-xs text-zinc-500">
                      Nenhum outro usuário detectado no canal.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                      {onlineUsers.map((u, idx) => (
                        <div
                          key={`${u.id}-${idx}`}
                          className="p-3 rounded-xl bg-[#18181b] border border-[#27272a] flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                            <span className="text-xs font-bold text-zinc-200 truncate">
                              {u.name}
                            </span>
                          </div>
                          <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                            {u.onlineAt}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Console de Diagnóstico Realtime */}
              <div className="bg-[#0f0f12] border border-[#27272a] rounded-3xl overflow-hidden shadow-2xl">
                {/* Console Header */}
                <div className="px-6 py-4 bg-[#141418] border-b border-[#27272a] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex gap-1.5">
                      <span className="h-3 w-3 rounded-full bg-red-500/80 inline-block" />
                      <span className="h-3 w-3 rounded-full bg-amber-500/80 inline-block" />
                      <span className="h-3 w-3 rounded-full bg-emerald-500/80 inline-block" />
                    </div>
                    <span className="text-xs font-mono font-bold text-zinc-300 flex items-center gap-1.5 ml-2">
                      <Terminal className="h-3.5 w-3.5 text-purple-400" />
                      <span>Console de Eventos Realtime</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-[10px] text-zinc-400 font-mono">
                      {realtimeLogs.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Filtros de Tipo */}
                    <div className="flex items-center gap-1 bg-[#18181b] p-1 rounded-xl border border-zinc-800">
                      {(["ALL", "postgres", "broadcast", "presence", "system", "error"] as const).map(
                        (f) => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => setLogFilter(f)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${
                              logFilter === f
                                ? "bg-purple-600 text-white shadow-sm"
                                : "text-zinc-400 hover:text-white"
                            }`}
                          >
                            {f}
                          </button>
                        )
                      )}
                    </div>

                    {/* Botão Limpar Logs */}
                    <button
                      type="button"
                      onClick={() => setRealtimeLogs([])}
                      className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-red-400 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                      title="Limpar console"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Limpar</span>
                    </button>
                  </div>
                </div>

                {/* Console Log List */}
                <div className="p-4 font-mono text-xs max-h-[520px] overflow-y-auto space-y-2">
                  {realtimeLogs
                    .filter((l) => (logFilter === "ALL" ? true : l.type === logFilter))
                    .length === 0 ? (
                    <div className="py-16 text-center text-zinc-600 space-y-2">
                      <Terminal className="h-8 w-8 text-zinc-700 mx-auto" />
                      <p className="text-xs">Nenhum evento registrado no console com os filtros atuais.</p>
                      <p className="text-[10px] text-zinc-700">
                        Eventos de banco (INSERT/UPDATE/DELETE), pings e broadcasts aparecerão aqui em tempo real.
                      </p>
                    </div>
                  ) : (
                    realtimeLogs
                      .filter((l) => (logFilter === "ALL" ? true : l.type === logFilter))
                      .map((log) => {
                        const typeBadgeColor =
                          log.type === "postgres"
                            ? "bg-blue-500/15 border-blue-500/40 text-blue-300"
                            : log.type === "broadcast"
                            ? "bg-purple-500/15 border-purple-500/40 text-purple-300"
                            : log.type === "presence"
                            ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                            : log.type === "error"
                            ? "bg-red-500/15 border-red-500/40 text-red-300"
                            : "bg-zinc-800 border-zinc-700 text-zinc-400";

                        const isExpanded = expandedLogId === log.id;

                        return (
                          <div
                            key={log.id}
                            className="p-3 rounded-xl bg-[#141418] border border-zinc-800/80 hover:border-zinc-700 transition-all space-y-2"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] text-zinc-500">
                                  [{log.timestamp}]
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase ${typeBadgeColor}`}
                                >
                                  {log.type}
                                </span>
                                {log.table && (
                                  <span className="px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-700 text-[10px] text-zinc-300 flex items-center gap-1">
                                    <Database className="h-2.5 w-2.5 text-purple-400" />
                                    <span>{log.table}</span>
                                    {log.eventType && (
                                      <span className="text-purple-300 font-bold">
                                        :{log.eventType}
                                      </span>
                                    )}
                                  </span>
                                )}
                                <span className="text-zinc-200 font-semibold text-xs">
                                  {log.title}
                                </span>
                              </div>

                              {log.details && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedLogId(isExpanded ? null : log.id)
                                  }
                                  className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer px-2 py-0.5 rounded hover:bg-zinc-800 transition-colors shrink-0"
                                >
                                  <span>{isExpanded ? "Ocultar" : "Detalhes"}</span>
                                  {isExpanded ? (
                                    <ChevronUp className="h-3 w-3" />
                                  ) : (
                                    <ChevronDown className="h-3 w-3" />
                                  )}
                                </button>
                              )}
                            </div>

                            {isExpanded && log.details && (
                              <pre className="p-3 rounded-lg bg-[#0a0a0c] border border-zinc-800 text-[11px] text-zinc-300 overflow-x-auto leading-relaxed">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            )}
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* ========================================================= */}
        {/* TOAST FLUTUANTE WEBSOCKET / REALTIME */}
        {/* ========================================================= */}
        {liveToast && (
          <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#18181b]/95 backdrop-blur-md border border-purple-500/40 text-white shadow-2xl shadow-purple-950/50">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <p className="text-xs font-semibold text-zinc-100">{liveToast.message}</p>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
