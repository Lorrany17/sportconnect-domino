"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Users,
  Trophy,
  DollarSign,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Share2,
  ExternalLink,
  Layers,
  Sparkles,
  Clock,
  Ban,
  Network,
  Building2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthProvider";
import { useTournament } from "@/context/TournamentContext";
import { Tournament, SportType, Team } from "@/types";
import { DEFAULT_COVERS, SPORT_SELECT_OPTIONS } from "@/components/CreateTournamentForm";
import PublicRegistrationForm from "@/components/PublicRegistrationForm";
import PublicHeader from "@/components/PublicHeader";

export default function DetalhesTorneioPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { tournaments: contextTournaments, setCurrentTournamentId } = useTournament();

  const id = (params?.id as string) || "";

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [loginNotice, setLoginNotice] = useState("");
  const [isEnrolledRequested, setIsEnrolledRequested] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState<string | null>(null);
  const [cancellationStatus, setCancellationStatus] = useState<string | null>(null);
  const [registeredTeamId, setRegisteredTeamId] = useState<string | null>(null);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [tournamentTeams, setTournamentTeams] = useState<Team[]>([]);

  // Verificação de inscrição do usuário autenticado no torneio
  useEffect(() => {
    if (!id || !user?.id) {
      setRegistrationStatus(null);
      setCancellationStatus(null);
      setRegisteredTeamId(null);
      return;
    }

    const currentUserId = user.id;

    async function checkExistingRegistration() {
      try {
        const { data, error } = await supabase
          .from("teams")
          .select("id, payment_status, cancellation_status")
          .eq("tournament_id", id)
          .eq("user_id", currentUserId)
          .limit(1);

        if (!error && data && data.length > 0) {
          setRegisteredTeamId(data[0].id);
          setRegistrationStatus(data[0].payment_status || "PENDING");
          setCancellationStatus(data[0].cancellation_status || null);
        } else {
          setRegisteredTeamId(null);
          setRegistrationStatus(null);
          setCancellationStatus(null);
        }
      } catch (err) {
        console.warn("Aviso ao checar inscrição existente:", err);
        setRegistrationStatus(null);
        setCancellationStatus(null);
        setRegisteredTeamId(null);
      }
    }

    checkExistingRegistration();
  }, [id, user?.id]);

  // Fetch do torneio por ID
  useEffect(() => {
    if (!id) return;

    async function fetchTournament() {
      try {
        setLoading(true);
        setErrorMessage("");

        const { data, error } = await supabase
          .from("tournaments")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (error) {
          console.warn("Erro ao buscar detalhes do torneio no Supabase:", error);
          // Fallback ao contexto
          const foundInContext = contextTournaments.find((t) => t.id === id);
          if (foundInContext) {
            setTournament(foundInContext);
          } else {
            setErrorMessage("Torneio não encontrado.");
          }
        } else if (data) {
          const mapped: Tournament = {
            id: data.id,
            name: data.name,
            status: data.status,
            createdAt: data.created_at,
            sport_type: (data.sport_type as SportType) || "DOMINO",
            format: data.format,
            owner_id: data.owner_id,
            max_teams: data.max_teams ? Number(data.max_teams) : 16,
            entry_fee: data.entry_fee ? Number(data.entry_fee) : 0,
            location: data.location,
            start_date: data.start_date,
            end_date: data.end_date,
            rules: data.rules,
            cover_url: data.cover_url,
            gender_category: data.gender_category,
            sponsors: data.sponsors || [],
            organizer_pix_key: data.organizer_pix_key,
            custom_registration_fields: data.custom_registration_fields,
          };
          setTournament(mapped);

          // Fetch das equipes inscritas no torneio
          const { data: teamsData } = await supabase
            .from("teams")
            .select("*")
            .eq("tournament_id", id)
            .order("created_at", { ascending: true });

          if (teamsData) {
            const mappedTeams: Team[] = teamsData.map((t: any) => ({
              id: t.id,
              name: t.name,
              players: [t.player1 || "Jogador 1", t.player2].filter(Boolean),
              roster: t.roster,
              createdAt: t.created_at || new Date().toISOString(),
              status: t.status,
              tournamentId: t.tournament_id,
              payment_status: t.payment_status,
              manager_name: t.manager_name || t.player1,
              category: t.category,
              user_id: t.user_id,
            }));
            setTournamentTeams(mappedTeams);
          }
        } else {
          const foundInContext = contextTournaments.find((t) => t.id === id);
          if (foundInContext) {
            setTournament(foundInContext);
          } else {
            setErrorMessage("Torneio não encontrado.");
          }
        }
      } catch (err) {
        console.error("Exceção ao buscar torneio:", err);
        const foundInContext = contextTournaments.find((t) => t.id === id);
        if (foundInContext) {
          setTournament(foundInContext);
        } else {
          setErrorMessage("Ocorreu um erro ao carregar as informações do torneio.");
        }
      } finally {
        setLoading(false);
      }
    }

    fetchTournament();
  }, [id, contextTournaments]);

  // Formatação de data
  const formatDate = (dateString?: string) => {
    if (!dateString) return "A definir";
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return "A definir";
      return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    } catch {
      return "A definir";
    }
  };

  // Formatação de taxa de inscrição
  const formatFee = (fee?: number) => {
    if (fee === undefined || fee === null || Number(fee) === 0) return "Gratuito";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(Number(fee));
  };

  // Clique no botão de Inscrição
  const handleEnrollClick = () => {
    if (registrationStatus) return;

    if (!user) {
      setLoginNotice("Faça login para se inscrever");
      setTimeout(() => {
        router.push(`/login?redirect=/torneio/${id}&message=Faça login para se inscrever`);
      }, 1200);
      return;
    }

    // Se estiver logado, abre o formulário público dinâmico
    setShowRegistrationModal(true);
  };

  // Ação de Cancelamento pelo Atleta
  const handleCancelRegistration = async () => {
    if (!registeredTeamId) return;

    if (registrationStatus === "APPROVED" || registrationStatus === "WAITING_PIX") {
      alert("Sua inscrição será cancelada e o organizador será notificado para realizar o estorno.");
    } else {
      if (!window.confirm("Deseja realmente cancelar sua inscrição nesta competição?")) {
        return;
      }
    }

    try {
      const { error } = await supabase
        .from("teams")
        .update({ cancellation_status: "REQUESTED_BY_ATHLETE" })
        .eq("id", registeredTeamId);

      if (error) {
        console.error("Erro ao solicitar cancelamento:", error);
        alert(`Erro ao solicitar cancelamento: ${error.message}`);
        return;
      }

      setCancellationStatus("REQUESTED_BY_ATHLETE");
    } catch (err) {
      console.error("Exceção ao solicitar cancelamento:", err);
      alert("Erro ao solicitar cancelamento.");
    }
  };

  // Visualizar Chaveamento
  const handleViewBracket = () => {
    if (tournament) {
      setCurrentTournamentId(tournament.id);
      router.push(`/torneio/${tournament.id}/chaveamento`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] text-white flex flex-col items-center justify-center p-6">
        <Loader2 className="h-10 w-10 text-blue-500 animate-spin mb-4" />
        <p className="text-sm font-bold text-zinc-400">Carregando detalhes do torneio...</p>
      </div>
    );
  }

  if (errorMessage || !tournament) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-4">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-black font-display uppercase tracking-tight mb-2">
          Torneio Não Encontrado
        </h1>
        <p className="text-sm text-zinc-400 max-w-md mb-6">
          {errorMessage || "Não foi possível localizar os dados desta competição."}
        </p>
        <Link
          href="/explorar"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-blue-600/30"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar ao Explorador</span>
        </Link>
      </div>
    );
  }

  const sportType: SportType = tournament.sport_type || "DOMINO";
  const coverImage = tournament.cover_url || DEFAULT_COVERS[sportType] || DEFAULT_COVERS.DOMINO;
  const sportMeta = SPORT_SELECT_OPTIONS.find((s) => s.id === sportType);

  // Status Badge
  const getStatusBadge = () => {
    if (tournament.status === "FINALIZADO") {
      return {
        text: "FINALIZADO",
        classes: "bg-zinc-800/90 text-zinc-300 border-zinc-700",
      };
    }
    if (tournament.status === "EM_ANDAMENTO" || tournament.status === "LIVE") {
      return {
        text: "AO VIVO",
        classes: "bg-amber-500/90 text-white border-amber-400/40 shadow-lg shadow-amber-500/25",
      };
    }
    return {
      text: "INSCRIÇÕES ABERTAS",
      classes: "bg-emerald-500/90 text-white border-emerald-400/40 shadow-lg shadow-emerald-500/25",
    };
  };

  const statusBadge = getStatusBadge();
  const isOpenForEnrollment = tournament.status === "ATIVO" || !tournament.status;

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-[#e4e4e7] selection:bg-[#00a2ff]/30 selection:text-white flex flex-col justify-between">
      <div>
        {/* Header Global Público Padronizado */}
        <PublicHeader activePage="torneio" />

        {/* Sub-barra de Navegação e Status */}
        <div className="w-full border-b border-[#27272a] bg-[#141416]/50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
            <Link
              href="/explorar"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1e1e1e] hover:bg-zinc-800 border border-[#27272a] text-xs font-bold text-[#e4e4e7] hover:text-white transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <ArrowLeft className="h-4 w-4 text-[#00a2ff]" />
              <span>Voltar às Arenas</span>
            </Link>

            <div className="flex items-center gap-2">
              <Link
                href={`/torneio/${tournament.id}/chaveamento`}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#00a2ff]/10 hover:bg-[#00a2ff]/20 border border-[#00a2ff]/30 text-[#00a2ff] text-xs font-bold transition-all"
              >
                <Network className="h-3.5 w-3.5" />
                <span>Chaveamento Oficial</span>
              </Link>

              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border ${statusBadge.classes}`}
              >
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span>{statusBadge.text}</span>
              </span>
            </div>
          </div>
        </div>

        {/* 1. Hero Section (Foto de Capa Grande + Nome Sobreposto) */}
        <section className="relative w-full h-72 sm:h-96 overflow-hidden bg-zinc-950">
          <img
            src={coverImage}
            alt={tournament.name}
            className="w-full h-full object-cover"
          />
          {/* Gradiente Escuro Sobreposto com foco nas cores SportConnect */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f0f] via-[#0f0f0f]/70 to-black/40" />

          {/* Conteúdo do Hero Sobreposto */}
          <div className="absolute inset-0 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-end pb-8">
            <div className="space-y-3 max-w-3xl animate-fadeIn">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-xs font-black uppercase tracking-wider text-blue-400">
                  <span>{sportMeta?.icon || "🏆"}</span>
                  <span>{sportMeta?.label || sportType}</span>
                </span>
                {tournament.gender_category && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-500/15 backdrop-blur-md border border-purple-500/30 text-xs font-bold text-purple-300">
                    <span>{tournament.gender_category}</span>
                  </span>
                )}
                {tournament.format && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-900/80 backdrop-blur-md border border-white/10 text-xs font-bold text-zinc-300">
                    <Layers className="h-3.5 w-3.5 text-blue-400" />
                    <span>{tournament.format}</span>
                  </span>
                )}
              </div>

              <h1 className="text-3xl sm:text-5xl font-black text-white font-display tracking-tight leading-tight">
                {tournament.name}
              </h1>

              <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs sm:text-sm text-zinc-300 pt-1">
                {tournament.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-[#00a2ff]" />
                    <span>{tournament.location}</span>
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-[#00a2ff]" />
                  <span>{formatDate(tournament.start_date)}</span>
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Informações Detalhadas (Corpo Principal em Grid 2 Colunas) */}
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Coluna Esquerda: Visão Geral, Localização com Iframe e Regras (2 Cols) */}
            <div className="lg:col-span-2 space-y-8">
              {/* Visão Geral (Cards de Estatísticas Rápidas) */}
              <div className="bg-[#18181b] border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
                <h2 className="text-sm font-black uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-blue-500" />
                  <span>Visão Geral da Competição</span>
                </h2>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                  <div className="bg-[#121214] border border-zinc-800/80 rounded-xl p-3.5">
                    <span className="text-[11px] text-zinc-500 font-bold uppercase block mb-1">
                      Modalidade
                    </span>
                    <span className="text-sm font-black text-white flex items-center gap-1.5">
                      <span>{sportMeta?.icon}</span>
                      <span>{sportMeta?.label || sportType}</span>
                    </span>
                  </div>

                  <div className="bg-[#121214] border border-zinc-800/80 rounded-xl p-3.5">
                    <span className="text-[11px] text-zinc-500 font-bold uppercase block mb-1">
                      Formato
                    </span>
                    <span className="text-sm font-black text-white">
                      {tournament.format || "Padrão"}
                    </span>
                  </div>

                  <div className="bg-[#121214] border border-zinc-800/80 rounded-xl p-3.5">
                    <span className="text-[11px] text-zinc-500 font-bold uppercase block mb-1">
                      Inscrição
                    </span>
                    <span className="text-sm font-black text-emerald-400">
                      {formatFee(tournament.entry_fee)}
                    </span>
                  </div>

                  <div className="bg-[#121214] border border-zinc-800/80 rounded-xl p-3.5">
                    <span className="text-[11px] text-zinc-500 font-bold uppercase block mb-1">
                      Capacidade
                    </span>
                    <span className="text-sm font-black text-white flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-blue-400" />
                      <span>{tournament.max_teams || 16} vagas</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Localização & Mapa Reativo com Google Maps Iframe */}
              <div className="bg-[#18181b] border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
                <h2 className="text-sm font-black uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-blue-500" />
                  <span>Localização do Evento</span>
                </h2>

                <p className="text-sm text-zinc-300">
                  {tournament.location || "O endereço exato será divulgado pela comissão organizadora."}
                </p>

                {tournament.location ? (
                  <div className="relative rounded-xl overflow-hidden border border-zinc-700 bg-zinc-900 shadow-md">
                    <iframe
                      width="100%"
                      height="240"
                      className="rounded-xl border-0 w-full block"
                      src={`https://maps.google.com/maps?q=${encodeURIComponent(
                        tournament.location
                      )}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                      frameBorder="0"
                      scrolling="no"
                      title="Localização do Torneio"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="h-[140px] w-full rounded-xl border border-zinc-800 bg-[#121214] flex flex-col items-center justify-center p-4 text-center">
                    <MapPin className="h-6 w-6 text-zinc-600 mb-2" />
                    <p className="text-xs text-zinc-500 font-medium">
                      Mapa indisponível até o endereço ser confirmado
                    </p>
                  </div>
                )}
              </div>

              {/* Regras e Regulamento em Caixa Destacada */}
              <div className="bg-[#18181b] border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
                <h2 className="text-sm font-black uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-400" />
                  <span>Regras e Regulamento Oficial</span>
                </h2>

                {tournament.rules ? (
                  <div className="p-4 rounded-xl bg-[#121214] border border-zinc-800 text-sm text-zinc-300 whitespace-pre-line leading-relaxed">
                    {tournament.rules}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 italic">
                    Regulamento padrão da SportConnect aplicado: eliminatória simples (mata-mata), pontuação oficial da federação e tolerância de 15 minutos para atrasos.
                  </p>
                )}
              </div>

              {/* Equipes e Atletas Inscritos */}
              <div className="bg-[#18181b] border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-black uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                    <Users className="h-4 w-4 text-emerald-400" />
                    <span>Equipes e Atletas Inscritos ({tournamentTeams.length})</span>
                  </h2>
                  <span className="text-[11px] text-zinc-500">
                    {tournament.max_teams ? `${tournamentTeams.length}/${tournament.max_teams} vagas` : "Inscrições abertas"}
                  </span>
                </div>

                {tournamentTeams.length === 0 ? (
                  <div className="p-6 rounded-xl bg-[#121214] border border-dashed border-zinc-800 text-center space-y-1">
                    <Users className="h-8 w-8 text-zinc-600 mx-auto mb-1" />
                    <p className="text-xs font-bold text-zinc-400">Nenhuma equipe confirmada ainda</p>
                    <p className="text-[11px] text-zinc-600">Seja o primeiro a inscrever sua equipe neste campeonato!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {tournamentTeams.map((team, idx) => (
                      <div
                        key={team.id}
                        className="p-3.5 rounded-xl bg-[#121214] border border-zinc-800/80 hover:border-zinc-700 transition-all flex items-start gap-3"
                      >
                        {team.user_id ? (
                          <Link
                            href={`/atleta/${team.user_id}`}
                            title="Ver perfil do atleta"
                            className="w-9 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 flex items-center justify-center text-sm font-black text-amber-400 shrink-0 shadow-inner group transition-transform hover:scale-105"
                          >
                            <span>#{idx + 1}</span>
                          </Link>
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-sm font-black text-zinc-400 shrink-0 shadow-inner">
                            <span>#{idx + 1}</span>
                          </div>
                        )}
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <h4 className="text-xs font-bold text-white truncate">
                              {team.user_id ? (
                                <Link
                                  href={`/atleta/${team.user_id}`}
                                  className="hover:text-amber-400 hover:underline transition-colors"
                                  title="Ver perfil do atleta"
                                >
                                  {team.name}
                                </Link>
                              ) : (
                                team.name
                              )}
                            </h4>
                          </div>
                          <div className="text-[11px] text-zinc-400 truncate flex items-center gap-1.5">
                            <span>Capitão:</span>
                            {team.user_id ? (
                              <Link
                                href={`/atleta/${team.user_id}`}
                                className="font-semibold text-zinc-300 hover:text-amber-400 hover:underline"
                              >
                                {team.players[0]}
                              </Link>
                            ) : (
                              <span className="font-semibold text-zinc-300">{team.players[0]}</span>
                            )}
                            {team.players[1] && (
                              <span className="text-zinc-500">• {team.players[1]}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Coluna Direita: Box de Inscrição e Ações (1 Col) */}
            <div className="space-y-6">
              <div className="bg-[#18181b] border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-5 sticky top-24">
                <div className="space-y-2">
                  <span className="text-xs uppercase font-bold text-zinc-500">
                    Taxa de Inscrição
                  </span>
                  <div className="text-3xl font-black text-white font-display text-emerald-400">
                    {formatFee(tournament.entry_fee)}
                  </div>
                  <p className="text-xs text-zinc-400">
                    Garante vaga oficial na tabela e acesso a toda a infraestrutura da arena.
                  </p>
                </div>

                {/* Alerta de Login se clicou deslogado */}
                {loginNotice && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{loginNotice}</span>
                  </div>
                )}

                {/* Botão de Inscrição / Call to Action */}
                <div className="space-y-3 pt-2">
                  {isOpenForEnrollment ? (
                    cancellationStatus === "REQUESTED_BY_ATHLETE" ? (
                      <div className="space-y-2">
                        <button
                          type="button"
                          disabled
                          className="w-full py-4 px-6 rounded-xl bg-amber-500/15 border border-amber-500/35 cursor-not-allowed text-amber-400 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 text-center"
                        >
                          <Clock className="h-5 w-5 text-amber-400 animate-pulse" />
                          <span>Cancelamento Solicitado</span>
                        </button>
                        <p className="text-[11px] text-amber-300 text-center font-medium">
                          O organizador foi notificado para realizar o estorno do Pix.
                        </p>
                      </div>
                    ) : cancellationStatus === "REFUNDED" ? (
                      <button
                        type="button"
                        disabled
                        className="w-full py-4 px-6 rounded-xl bg-red-500/15 border border-red-500/35 cursor-not-allowed text-red-400 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 text-center"
                      >
                        <Ban className="h-5 w-5 text-red-400" />
                        <span>Inscrição Cancelada / Estornada</span>
                      </button>
                    ) : registrationStatus === "APPROVED" ? (
                      <div className="space-y-2.5">
                        <button
                          type="button"
                          disabled
                          className="w-full py-4 px-6 rounded-xl bg-emerald-500/20 border border-emerald-500/40 cursor-not-allowed text-emerald-400 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 text-center"
                        >
                          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                          <span>Inscrição Aprovada!</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleCancelRegistration}
                          className="w-full py-2.5 px-4 rounded-xl border border-red-500/30 hover:border-red-500/60 bg-red-500/5 hover:bg-red-500/15 text-red-400 hover:text-red-300 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95"
                        >
                          <Ban className="h-3.5 w-3.5 text-red-400" />
                          <span>Cancelar Minha Inscrição</span>
                        </button>
                      </div>
                    ) : registrationStatus === "WAITING_PIX" || registrationStatus === "PENDING" ? (
                      <div className="space-y-2.5">
                        <button
                          type="button"
                          disabled
                          className="w-full py-4 px-6 rounded-xl bg-amber-500/15 border border-amber-500/35 cursor-not-allowed text-amber-400 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 text-center"
                        >
                          <Clock className="h-5 w-5 text-amber-400" />
                          <span>Aguardando Confirmação do Organizador</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleCancelRegistration}
                          className="w-full py-2.5 px-4 rounded-xl border border-red-500/30 hover:border-red-500/60 bg-red-500/5 hover:bg-red-500/15 text-red-400 hover:text-red-300 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95"
                        >
                          <Ban className="h-3.5 w-3.5 text-red-400" />
                          <span>Cancelar Minha Inscrição</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleEnrollClick}
                        className="w-full py-4 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm uppercase tracking-wider transition-all shadow-lg shadow-blue-600/30 active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Sparkles className="h-4 w-4" />
                        <span>Inscrever Minha Equipe</span>
                      </button>
                    )
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="w-full py-4 px-6 rounded-xl bg-zinc-800 text-zinc-500 font-bold text-sm uppercase tracking-wider cursor-not-allowed text-center"
                    >
                      Inscrições Encerradas
                    </button>
                  )}

                  {/* Ação secundária: Ver Chaveamento */}
                  <button
                    type="button"
                    onClick={handleViewBracket}
                    className="w-full py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/60 text-xs font-bold text-zinc-300 hover:text-white transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Trophy className="h-3.5 w-3.5 text-[#00a2ff]" />
                    <span>Ver Chaveamento Oficial</span>
                  </button>
                </div>

                <div className="pt-4 border-t border-zinc-800 text-[11px] text-zinc-500 text-center space-y-1">
                  <p>Inscrições sujeitas à aprovação pela comissão organizadora.</p>
                  <p>Dúvidas? Entre em contato com o suporte SportConnect.</p>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* SECÇÃO DE APOIO E PATROCÍNIO */}
          {/* ========================================================= */}
          {tournament.sponsors && tournament.sponsors.length > 0 && (
            <section className="mt-12 pt-8 border-t border-[#27272a] animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-black uppercase tracking-wider mb-1.5">
                    <Building2 className="h-3 w-3" />
                    <span>Marcas Parceiras</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white font-display tracking-tight">
                    Apoio e Patrocínio
                  </h2>
                </div>
                <p className="text-xs text-zinc-500">
                  Apoiadores oficiais que tornam esta competição possível.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {tournament.sponsors.map((sponsor) => {
                  const CardContent = (
                    <div className="h-full p-4 rounded-2xl bg-[#141416] border border-[#27272a] hover:border-amber-500/50 hover:bg-zinc-900/80 transition-all flex flex-col items-center justify-center text-center gap-2 group shadow-sm">
                      {sponsor.logo_url ? (
                        <div className="w-full h-16 sm:h-20 flex items-center justify-center p-2 rounded-xl bg-zinc-900/60 border border-zinc-800/80 group-hover:scale-105 transition-transform">
                          <img
                            src={sponsor.logo_url}
                            alt={sponsor.name}
                            className="max-h-full max-w-full object-contain filter group-hover:brightness-110 transition-all"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-black text-base group-hover:scale-105 transition-transform">
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
            </section>
          )}
        </main>
      </div>

      {/* Modal de Inscrição Pública Dinâmica */}
      {tournament && (
        <PublicRegistrationForm
          tournament={tournament}
          isOpen={showRegistrationModal}
          onClose={() => setShowRegistrationModal(false)}
          onSuccess={() => {
            setRegistrationStatus("WAITING_PIX");
            setIsEnrolledRequested(true);
            setShowRegistrationModal(false);
          }}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-[#27272a] py-6 text-center text-xs text-zinc-500 bg-[#141416]/50">
        <div>SportConnect • Portal de Competições Esportivas</div>
      </footer>
    </div>
  );
}
