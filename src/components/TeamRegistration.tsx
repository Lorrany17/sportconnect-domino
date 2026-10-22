"use client";

import React, { useState, useEffect, useRef } from "react";
import { Team, Match } from "@/types";
import {
  UserPlus,
  Trash2,
  Trophy,
  HelpCircle,
  Users,
  Upload,
  FileText,
  Sparkles,
  Lock,
  ShieldCheck,
  Plus,
  X,
  UserCheck,
  User,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { useTournament } from "@/context/TournamentContext";
import { useAuth } from "@/context/AuthProvider";
import AuthModal from "@/components/AuthModal";

interface TeamRegistrationProps {
  teams: Team[];
  matches: Match[];
  onAddTeam: (
    name: string,
    p1: string,
    p2?: string,
    roster?: string[],
    format?: "solo" | "duplas"
  ) => void;
  onImportTeams: (importedTeams: Team[]) => void;
  onDeleteTeam: (id: string) => void;
  onGenerateBracket: () => void;
  isReadOnly?: boolean;
  onFinishTournament?: () => void;
  onDeleteTournament?: () => void;
}

export default function TeamRegistration({
  teams,
  matches,
  onAddTeam,
  onImportTeams,
  onDeleteTeam,
  onGenerateBracket,
  isReadOnly = false,
  onFinishTournament,
  onDeleteTournament,
}: TeamRegistrationProps) {
  // Modalidade e Autenticação
  const { currentSportType } = useTournament();
  const { user } = useAuth();
  const isAuthenticated = !!user;

  // Estados do formulário
  const [teamName, setTeamName] = useState("");
  const [player1, setPlayer1] = useState("");
  const [player2, setPlayer2] = useState("");
  const [pingPongFormat, setPingPongFormat] = useState<"solo" | "duplas">("solo");
  const [athletes, setAthletes] = useState<string[]>([]);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "info" | "error";
  } | null>(null);

  const hasMatches = matches.length > 0;
  const allMatchesFinished = hasMatches && matches.every((m) => m.status === "COMPLETED");
  const canEndTournament = hasMatches && allMatchesFinished;

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fecha o toast automaticamente após 5 segundos
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Definições contextuais de acordo com o esporte
  const isDomino = currentSportType === "DOMINO";
  const isPingPong = currentSportType === "PING_PONG";
  const isFutsal = currentSportType === "FUTSAL";
  const isVolei = currentSportType === "VOLEI";
  const isTeamSport = isFutsal || isVolei;

  const isPingPongSolo = isPingPong && pingPongFormat === "solo";
  const isPingPongDuplas = isPingPong && pingPongFormat === "duplas";

  // Nomenclatura dinâmica
  const entitySingular = isPingPongSolo ? "Jogador" : isTeamSport ? "Equipe" : "Dupla";
  const entityPlural = isPingPongSolo ? "Jogadores" : isTeamSport ? "Equipes" : "Duplas";

  const pageSubtitle = isPingPongSolo
    ? "Cadastre os jogadores individuais (1v1) de Ping Pong e gere o chaveamento mata-mata automático."
    : isPingPongDuplas
    ? "Cadastre as duplas (2v2) de Ping Pong e gere o chaveamento mata-mata automático."
    : isFutsal
    ? "Cadastre as equipes inscritas no campeonato de futsal, elenque o plantel de atletas e gere o chaveamento mata-mata automático."
    : isVolei
    ? "Cadastre as equipes inscritas no campeonato de vôlei, elenque o plantel de atletas e gere o chaveamento mata-mata automático."
    : "Cadastre as duplas inscritas no torneio de dominó e gere o chaveamento mata-mata automático.";

  const formTitle = `Nov${isPingPongSolo ? "o" : "a"} ${entitySingular} (Manual)`;
  const listTitle = `${entityPlural} Inscrit${isPingPongSolo ? "os" : "as"} (${teams.length})`;
  const submitButtonText = `Adicionar ${entitySingular} Manualmente`;

  // Manipuladores de atletas extras (Futsal / Vôlei)
  const handleAddAthleteField = () => {
    setAthletes((prev) => [...prev, ""]);
  };

  const handleUpdateAthlete = (index: number, value: string) => {
    setAthletes((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleRemoveAthleteField = (index: number) => {
    setAthletes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    if (!isAuthenticated) {
      setToast({
        message: "Acesso restrito: Faça login como organizador para adicionar participantes.",
        type: "error",
      });
      return;
    }

    if (isPingPongSolo) {
      if (!player1.trim()) {
        setError("Por favor, informe o nome do jogador.");
        return;
      }
      const finalName = teamName.trim() || player1.trim();
      onAddTeam(finalName, player1.trim(), "", undefined, "solo");
    } else if (isTeamSport) {
      if (!teamName.trim() || !player1.trim()) {
        setError("Por favor, preencha o Nome da Equipe e o Capitão/Responsável.");
        return;
      }
      const validRoster = athletes.map((a) => a.trim()).filter(Boolean);
      onAddTeam(teamName.trim(), player1.trim(), "", validRoster, undefined);
    } else {
      // Domino ou Ping Pong Duplas
      if (!teamName.trim() || !player1.trim() || !player2.trim()) {
        setError("Por favor, preencha todos os campos da dupla.");
        return;
      }
      onAddTeam(
        teamName.trim(),
        player1.trim(),
        player2.trim(),
        undefined,
        isPingPongDuplas ? "duplas" : undefined
      );
    }

    // Reset dos campos
    setTeamName("");
    setPlayer1("");
    setPlayer2("");
    setAthletes([]);
    setError("");
    setToast({
      message: `${entitySingular} adicionad${isPingPongSolo ? "o" : "a"} com sucesso!`,
      type: "success",
    });
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (isReadOnly) return;

    if (!isAuthenticated) {
      setToast({
        message: "Acesso restrito: Faça login como organizador para importar inscrições CSV.",
        type: "error",
      });
      return;
    }

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (isReadOnly) return;

    if (!isAuthenticated) {
      setToast({
        message: "Acesso restrito: Faça login como organizador para importar inscrições CSV.",
        type: "error",
      });
      return;
    }

    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    if (isReadOnly) return;
    if (!isAuthenticated) {
      setToast({
        message: "Acesso restrito: Faça login como organizador para importar arquivos.",
        type: "error",
      });
      return;
    }
    fileInputRef.current?.click();
  };

  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/);
    if (lines.length === 0) return { imported: [], ignored: 0 };

    // Detecção de delimitador (suporta vírgula ou ponto e vírgula)
    const firstLine = lines[0];
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semiCount = (firstLine.match(/;/g) || []).length;
    const delimiter = semiCount > commaCount ? ";" : ",";

    // Extrai cabeçalhos normalizados
    const headers = lines[0]
      .split(delimiter)
      .map((h) => h.replace(/^["']|["']$/g, "").trim().toUpperCase());

    const findHeader = (possibleNames: string[]) => {
      for (const name of possibleNames) {
        const idx = headers.indexOf(name);
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const idxProtocolo = findHeader(["PROTOCOLO", "ID", "CODIGO", "CÓDIGO", "INSCRICAO", "INSCRIÇÃO"]);
    const idxTeam = findHeader(["NOME DA EQUIPE", "EQUIPE", "NOME DA DUPLA", "DUPLA", "TIME", "NOME"]);
    const idxP1 = findHeader(["JOGADOR 1", "CAPITAO", "CAPITÃO", "JOGADOR", "ATLETA 1", "ATLETA"]);
    const idxP2 = findHeader(["JOGADOR 2", "PARCEIRO", "ATLETA 2", "SEGUNDO JOGADOR"]);
    const idxStatus = findHeader(["STATUS", "SITUACAO", "SITUAÇÃO"]);

    if (idxP1 === -1) {
      throw new Error(
        "Colunas necessárias não encontradas. O cabeçalho deve conter ao menos: JOGADOR 1 (ou CAPITÃO / JOGADOR)."
      );
    }

    const results: Team[] = [];
    let ignoredCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const fields: string[] = [];
      let currentField = "";
      let inQuotes = false;

      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          fields.push(currentField.trim());
          currentField = "";
        } else {
          currentField += char;
        }
      }
      fields.push(currentField.trim());

      if (fields.length < headers.length) continue;

      const status = idxStatus !== -1 ? fields[idxStatus].replace(/^["']|["']$/g, "").trim().toLowerCase() : "confirmado";

      if (status === "confirmado" || status === "confirmed" || status === "ativo") {
        const protocolo = idxProtocolo !== -1 ? fields[idxProtocolo].replace(/^["']|["']$/g, "").trim() : `imp-${Math.random().toString(36).substr(2, 9)}`;
        const p1 = fields[idxP1].replace(/^["']|["']$/g, "").trim();
        const p2 = idxP2 !== -1 ? fields[idxP2].replace(/^["']|["']$/g, "").trim() : "";
        const explicitTeam = idxTeam !== -1 ? fields[idxTeam].replace(/^["']|["']$/g, "").trim() : "";

        if (!p1) continue;

        const getFirstName = (fullName: string) => fullName.split(" ")[0] || fullName;
        let autoName = explicitTeam;
        if (!autoName) {
          if (p2) {
            autoName = `${getFirstName(p1)} & ${getFirstName(p2)}`;
          } else {
            autoName = p1;
          }
        }

        results.push({
          id: protocolo,
          name: autoName,
          players: p2 ? [p1, p2] : [p1, ""],
          createdAt: new Date().toISOString(),
          source: "csv",
        });
      } else if (status === "pendente" || status === "pending") {
        ignoredCount++;
      }
    }

    return { imported: results, ignored: ignoredCount };
  };

  const handleFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setToast({
        message: "Por favor, envie apenas arquivos com extensão .csv.",
        type: "error",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const { imported, ignored } = parseCSV(text);

        const existingIds = new Set(teams.map((t) => t.id));
        const newTeams = imported.filter((t) => !existingIds.has(t.id));
        const duplicateCount = imported.length - newTeams.length;

        if (newTeams.length > 0) {
          onImportTeams(newTeams);
        }

        setToast({
          message: `Leitura concluída: ${newTeams.length} nov${isPingPongSolo ? "os jogadores adicionados" : isTeamSport ? "as equipes adicionadas" : "as duplas adicionadas"}. ${duplicateCount} já constavam no sistema e ${ignored} pendentes foram ignoradas.`,
          type: "success",
        });
      } catch (err: unknown) {
        console.error(err);
        const errMsg = err instanceof Error ? err.message : "Erro ao ler ou processar o arquivo CSV.";
        setToast({
          message: errMsg,
          type: "error",
        });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 animate-slideIn">
          <div
            className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border shadow-2xl backdrop-blur-md transition-all ${
              toast.type === "success"
                ? "bg-emerald-950/95 text-emerald-400 border-emerald-500/30"
                : toast.type === "error"
                ? "bg-red-950/95 text-red-400 border-red-500/30"
                : "bg-[#e6ddca]/95 dark:bg-neutral-900/95 text-[#3b342e] dark:text-neutral-300 border-[#d8ccb4] dark:border-neutral-700/60"
            }`}
          >
            {toast.type === "success" && <Sparkles className="h-5 w-5 text-emerald-400" />}
            {toast.type === "error" && <HelpCircle className="h-5 w-5 text-red-400" />}
            {toast.type === "info" && <Users className="h-5 w-5 text-neutral-400" />}
            <span className="text-sm font-bold">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="text-neutral-500 hover:text-white transition-colors cursor-pointer text-xs font-black uppercase ml-2"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Header com Título Dinâmico */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-brand-border/40 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-brand-electric/15 text-brand-electric-light border border-brand-electric/30">
              Modalidade: {currentSportType}
            </span>
            {isAuthenticated ? (
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                <ShieldCheck className="h-3 w-3" /> Organizador Conectado
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                <Lock className="h-3 w-3" /> Apenas Leitura
              </span>
            )}
          </div>
          <h1 className="font-display text-3xl font-black tracking-tight uppercase">
            Gestão de <span className="text-gradient-electric">{entityPlural}</span>
          </h1>
          <p className="text-brand-text-muted text-sm mt-1">{pageSubtitle}</p>
        </div>

        {/* Encerrar e Excluir Campeonato buttons */}
        {onFinishTournament && (
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            {!isReadOnly && (
              <>
                <button
                  disabled={!canEndTournament}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Tem certeza que deseja encerrar este campeonato? Esta ação congelará os placares e o chaveamento de forma permanente no histórico."
                      )
                    ) {
                      onFinishTournament();
                    }
                  }}
                  className="w-full md:w-auto px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold uppercase tracking-wider rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed dark:bg-red-700 dark:hover:bg-red-600 cursor-pointer text-xs"
                  title={
                    canEndTournament
                      ? "Encerrar campeonato atual e mover para o histórico."
                      : "O campeonato só pode ser encerrado após a conclusão de todas as partidas."
                  }
                >
                  <span>Encerrar Campeonato Atual</span>
                </button>
                {!canEndTournament && (
                  <span className="text-[10px] text-stone-500 dark:text-brand-text-muted font-bold block text-right max-w-[280px] leading-tight">
                    ⚠️ O campeonato só pode ser encerrado após a geração de chaves e conclusão de todas as partidas.
                  </span>
                )}
              </>
            )}

            {onDeleteTournament && (
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      "ATENÇÃO: Tem certeza absoluta que deseja EXCLUIR este campeonato permanentemente? Todos os dados de equipes, partidas e chaveamento deste campeonato serão apagados para sempre. Esta ação NÃO pode ser desfeita."
                    )
                  ) {
                    onDeleteTournament();
                  }
                }}
                className="w-full md:w-auto mt-1 px-4 py-2 border border-red-600/30 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 hover:text-red-700 dark:text-red-400 font-bold uppercase tracking-wider rounded-lg transition-colors text-[10px] cursor-pointer flex items-center justify-center gap-1.5"
                title="Excluir o campeonato atual e todos os seus dados permanentemente."
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Excluir Campeonato Atual</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Alerta de Autenticação para Organizador */}
      {!isAuthenticated && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                Acesso de Organizador Necessário
              </h4>
              <p className="text-xs text-stone-600 dark:text-brand-text-muted mt-0.5">
                Faça login com suas credenciais do Supabase ou PIN de organizador para cadastrar participantes e importar inscrições.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowAuthModal(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#00a2ff] hover:bg-blue-600 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-500/20 shrink-0 transition-all active:scale-95 cursor-pointer"
          >
            <Shield className="h-4 w-4" />
            <span>Fazer Login</span>
          </button>
        </div>
      )}

      {/* Modal de Autenticação Supabase */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Import and Form Panels */}
        <div className="lg:col-span-1 space-y-6">
          {/* CSV Import Dropzone */}
          <div className="glass-panel rounded-2xl p-6 border border-brand-border/60">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FileText className="h-5 w-5 text-brand-electric-light" />
                <span>Importar Inscrições</span>
              </h2>
              {!isAuthenticated && (
                <span className="text-[10px] font-bold text-neutral-500 flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Bloqueado
                </span>
              )}
            </div>

            <p className="text-xs text-brand-text-muted mb-4 leading-relaxed">
              Importe uma planilha contendo as colunas:{" "}
              <code className="text-brand-electric-light text-[10px]">PROTOCOLO</code>,{" "}
              <code className="text-brand-electric-light text-[10px]">JOGADOR 1</code>,{" "}
              {isPingPongSolo ? (
                <>e <code className="text-brand-electric-light text-[10px]">STATUS</code>.</>
              ) : isTeamSport ? (
                <>
                  <code className="text-brand-electric-light text-[10px]">EQUIPE</code> e{" "}
                  <code className="text-brand-electric-light text-[10px]">STATUS</code>.
                </>
              ) : (
                <>
                  <code className="text-brand-electric-light text-[10px]">JOGADOR 2</code> e{" "}
                  <code className="text-brand-electric-light text-[10px]">STATUS</code>.
                </>
              )}
            </p>

            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={onButtonClick}
              className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl transition-all ${
                !isAuthenticated || isReadOnly
                  ? "border-neutral-300 dark:border-neutral-800 bg-neutral-100/50 dark:bg-neutral-900/10 text-neutral-400 dark:text-neutral-600 cursor-not-allowed opacity-75"
                  : dragActive
                  ? "border-brand-electric bg-brand-electric/5 text-neutral-800 dark:text-white cursor-pointer"
                  : "border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950/20 hover:border-brand-electric/50 text-neutral-500 dark:text-brand-text-muted hover:text-neutral-850 dark:hover:text-white cursor-pointer"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                disabled={!isAuthenticated || isReadOnly}
                onChange={handleFileChange}
                className="hidden"
              />
              {!isAuthenticated ? (
                <Lock className="h-8 w-8 mb-3 text-neutral-400 dark:text-neutral-600" />
              ) : (
                <Upload
                  className={`h-8 w-8 mb-3 transition-transform ${
                    dragActive ? "scale-110 text-brand-electric-light animate-bounce" : "text-neutral-500"
                  }`}
                />
              )}
              <p className="text-xs font-bold text-center leading-relaxed max-w-[200px]">
                {!isAuthenticated
                  ? "Faça login como organizador para importar arquivo CSV"
                  : "Arraste o arquivo CSV de inscrições aqui ou clique para selecionar"}
              </p>
            </div>
          </div>

          {/* Manual Form Dinâmico por Esporte */}
          <div className="glass-panel rounded-2xl p-6 border border-brand-border/60">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-brand-electric-light" />
                <span>{formTitle}</span>
              </h2>
              {!isAuthenticated && (
                <span className="text-[10px] font-bold text-neutral-500 flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Bloqueado
                </span>
              )}
            </div>

            {/* Se for Ping Pong, exibe seletor de Formato: Solo (1v1) ou Duplas (2v2) */}
            {isPingPong && (
              <div className="mb-5 p-3 rounded-xl bg-neutral-100 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800">
                <label className="block text-[10px] font-black uppercase tracking-wider text-brand-text-muted mb-2">
                  Formato da Disputa
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!isAuthenticated || isReadOnly}
                    onClick={() => setPingPongFormat("solo")}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      pingPongFormat === "solo"
                        ? "bg-brand-electric text-white shadow-md shadow-brand-electric/20"
                        : "bg-white/60 dark:bg-neutral-800 text-stone-700 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-700"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <User className="h-3.5 w-3.5" />
                    <span>Solo (1v1)</span>
                  </button>
                  <button
                    type="button"
                    disabled={!isAuthenticated || isReadOnly}
                    onClick={() => setPingPongFormat("duplas")}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      pingPongFormat === "duplas"
                        ? "bg-brand-electric text-white shadow-md shadow-brand-electric/20"
                        : "bg-white/60 dark:bg-neutral-800 text-stone-700 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-700"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span>Duplas (2v2)</span>
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* CASO 1: PING PONG SOLO */}
              {isPingPongSolo && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-brand-text-muted mb-2">
                    Nome do Jogador
                  </label>
                  <input
                    type="text"
                    disabled={!isAuthenticated || isReadOnly}
                    value={player1}
                    onChange={(e) => {
                      setPlayer1(e.target.value);
                      if (!teamName || teamName === player1) {
                        setTeamName(e.target.value);
                      }
                    }}
                    placeholder="Ex: Hugo Calderano"
                    className="w-full px-4 py-3 rounded-xl bg-[#f2ece0] dark:bg-neutral-950/80 border border-[#d8ccb4] dark:border-brand-border focus:border-brand-electric focus:ring-1 focus:ring-brand-electric outline-none text-sm transition-all text-[#3b342e] dark:text-white placeholder:text-stone-500 dark:placeholder:text-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <p className="text-[10px] text-stone-500 dark:text-neutral-500 mt-1.5">
                    No formato Solo, cada atleta disputa partidas individuais de 11 pontos com sets corridos.
                  </p>
                </div>
              )}

              {/* CASO 2: DOMINÓ OU PING PONG DUPLAS */}
              {(isDomino || isPingPongDuplas) && (
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-brand-text-muted mb-2">
                      Nome da Dupla
                    </label>
                    <input
                      type="text"
                      disabled={!isAuthenticated || isReadOnly}
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder={isPingPongDuplas ? "Ex: Dupla Calderano & Ishiy" : "Ex: Os Imbatíveis"}
                      className="w-full px-4 py-3 rounded-xl bg-[#f2ece0] dark:bg-neutral-950/80 border border-[#d8ccb4] dark:border-brand-border focus:border-brand-electric focus:ring-1 focus:ring-brand-electric outline-none text-sm transition-all text-[#3b342e] dark:text-white placeholder:text-stone-500 dark:placeholder:text-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-brand-text-muted mb-2">
                      Jogador 1 (Capitão)
                    </label>
                    <input
                      type="text"
                      disabled={!isAuthenticated || isReadOnly}
                      value={player1}
                      onChange={(e) => setPlayer1(e.target.value)}
                      placeholder="Ex: Carlos Silva"
                      className="w-full px-4 py-3 rounded-xl bg-[#f2ece0] dark:bg-neutral-950/80 border border-[#d8ccb4] dark:border-brand-border focus:border-brand-electric focus:ring-1 focus:ring-brand-electric outline-none text-sm transition-all text-[#3b342e] dark:text-white placeholder:text-stone-500 dark:placeholder:text-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-brand-text-muted mb-2">
                      Jogador 2 (Parceiro)
                    </label>
                    <input
                      type="text"
                      disabled={!isAuthenticated || isReadOnly}
                      value={player2}
                      onChange={(e) => setPlayer2(e.target.value)}
                      placeholder="Ex: Roberto Souza"
                      className="w-full px-4 py-3 rounded-xl bg-[#f2ece0] dark:bg-neutral-950/80 border border-[#d8ccb4] dark:border-brand-border focus:border-brand-electric focus:ring-1 focus:ring-brand-electric outline-none text-sm transition-all text-[#3b342e] dark:text-white placeholder:text-stone-500 dark:placeholder:text-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </>
              )}

              {/* CASO 3: FUTSAL OU VÔLEI (EQUIPES E ELENCO DINÂMICO) */}
              {isTeamSport && (
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-brand-text-muted mb-2">
                      Nome da Equipe
                    </label>
                    <input
                      type="text"
                      disabled={!isAuthenticated || isReadOnly}
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder={isFutsal ? "Ex: Falcões Futsal Clube" : "Ex: Vôlei Campeão"}
                      className="w-full px-4 py-3 rounded-xl bg-[#f2ece0] dark:bg-neutral-950/80 border border-[#d8ccb4] dark:border-brand-border focus:border-brand-electric focus:ring-1 focus:ring-brand-electric outline-none text-sm transition-all text-[#3b342e] dark:text-white placeholder:text-stone-500 dark:placeholder:text-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-brand-text-muted mb-2">
                      Capitão / Responsável
                    </label>
                    <input
                      type="text"
                      disabled={!isAuthenticated || isReadOnly}
                      value={player1}
                      onChange={(e) => setPlayer1(e.target.value)}
                      placeholder="Ex: Marcos Andrade (Capitão)"
                      className="w-full px-4 py-3 rounded-xl bg-[#f2ece0] dark:bg-neutral-950/80 border border-[#d8ccb4] dark:border-brand-border focus:border-brand-electric focus:ring-1 focus:ring-brand-electric outline-none text-sm transition-all text-[#3b342e] dark:text-white placeholder:text-stone-500 dark:placeholder:text-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Elenco de Atletas Dinâmico */}
                  <div className="pt-2 border-t border-neutral-200 dark:border-brand-border/40">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-[10px] font-black uppercase tracking-wider text-brand-text-muted">
                        Elenco da Equipe ({athletes.length + 1} Atletas)
                      </label>
                      <button
                        type="button"
                        disabled={!isAuthenticated || isReadOnly}
                        onClick={handleAddAthleteField}
                        className="text-xs text-brand-electric-light hover:text-brand-electric font-bold flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Adicionar Atleta</span>
                      </button>
                    </div>

                    {athletes.length === 0 ? (
                      <p className="text-[10px] text-stone-500 dark:text-neutral-500 italic py-1">
                        Nenhum atleta reserva listado. Clique acima para cadastrar mais atletas no elenco.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {athletes.map((athlete, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input
                              type="text"
                              disabled={!isAuthenticated || isReadOnly}
                              value={athlete}
                              onChange={(e) => handleUpdateAthlete(idx, e.target.value)}
                              placeholder={`Atleta #${idx + 2}`}
                              className="flex-1 px-3 py-2 rounded-lg bg-[#f2ece0] dark:bg-neutral-950/80 border border-[#d8ccb4] dark:border-brand-border text-xs text-[#3b342e] dark:text-white outline-none focus:border-brand-electric disabled:opacity-50"
                            />
                            <button
                              type="button"
                              disabled={!isAuthenticated || isReadOnly}
                              onClick={() => handleRemoveAthleteField(idx)}
                              className="text-neutral-400 hover:text-red-500 p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                              title="Remover atleta"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {error && <div className="text-red-500 text-xs font-bold">{error}</div>}

              <button
                type="submit"
                disabled={!isAuthenticated || isReadOnly}
                className="w-full flex items-center justify-center gap-2 bg-brand-electric hover:bg-brand-electric-hover text-white py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all shadow-lg shadow-brand-electric/15 active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-4"
              >
                {!isAuthenticated ? (
                  <>
                    <Lock className="h-4 w-4" />
                    <span>Faça Login para Cadastrar</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    <span>{submitButtonText}</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Registered Teams Grid & Action */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel rounded-2xl p-6 border border-brand-border/60">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Trophy className="h-5 w-5 text-brand-neon" />
                <span>{listTitle}</span>
              </h2>
              {teams.length >= 2 && !isReadOnly && (
                <button
                  onClick={onGenerateBracket}
                  className="flex items-center gap-2 bg-gradient-to-r from-brand-neon to-brand-neon-orange hover:from-brand-neon-hover hover:to-brand-neon-orange/95 text-neutral-950 px-5 py-2.5 rounded-xl font-black text-sm uppercase tracking-wider transition-all transform hover:scale-[1.03] active:scale-95 shadow-lg shadow-brand-neon/10 cursor-pointer"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Gerar Chaveamento</span>
                </button>
              )}
            </div>

            {teams.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 border border-dashed border-neutral-300 dark:border-brand-border rounded-xl bg-neutral-50 dark:bg-neutral-900/10">
                <Users className="h-12 w-12 text-neutral-300 dark:text-neutral-800 mb-3" />
                <p className="text-neutral-500 dark:text-brand-text-muted text-sm font-semibold">
                  Nenhum{isPingPongSolo ? "" : "a"} {entitySingular.toLowerCase()} inscrit{isPingPongSolo ? "o" : "a"} até o momento.
                </p>
                <p className="text-xs text-neutral-455 dark:text-neutral-600 mt-1">
                  Cadastre participantes manualmente ou envie um arquivo CSV.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[580px] overflow-y-auto pr-1">
                  {teams.map((team, idx) => (
                    <div
                      key={team.id}
                      className="group relative rounded-xl bg-[#e6ddca] dark:bg-neutral-900/60 border border-[#d8ccb4] dark:border-brand-border hover:border-brand-electric/30 p-4 transition-all duration-300 hover:bg-[#e6ddca]/80 dark:hover:bg-neutral-900/90 flex flex-col justify-between shadow-sm dark:shadow-none"
                    >
                      <div className="flex justify-between items-start">
                        <div className="max-w-[80%]">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-[10px] font-bold text-brand-electric-light tracking-widest uppercase">
                              {entitySingular.toUpperCase()} #{String(idx + 1).padStart(2, "0")}
                            </span>
                            {team.format === "solo" && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/20 font-bold uppercase tracking-wider scale-90 origin-left">
                                1v1 Solo
                              </span>
                            )}
                            {team.source === "csv" ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-bold uppercase tracking-wider scale-90 origin-left">
                                CSV
                              </span>
                            ) : team.source === "external" ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/20 font-bold uppercase tracking-wider scale-90 origin-left">
                                Externo
                              </span>
                            ) : (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-neutral-300 dark:border-neutral-700 font-bold uppercase tracking-wider scale-90 origin-left">
                                Manual
                              </span>
                            )}
                            {team.user_id && (
                              <Link
                                href={`/atleta/${team.user_id}`}
                                className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 hover:text-blue-300 border border-blue-500/25 font-bold uppercase tracking-wider scale-90 origin-left"
                                title="Ver perfil público do atleta"
                              >
                                Ver Perfil
                              </Link>
                            )}
                          </div>
                          <h3 className="font-display font-bold text-lg text-[#3b342e] dark:text-white tracking-wide truncate group-hover:text-brand-electric-light transition-colors">
                            {team.user_id ? (
                              <Link href={`/atleta/${team.user_id}`} className="hover:underline">
                                {team.name}
                              </Link>
                            ) : (
                              team.name
                            )}
                          </h3>
                        </div>
                        {!isReadOnly && isAuthenticated && (
                          <button
                            onClick={() => onDeleteTeam(team.id)}
                            className="text-neutral-400 hover:text-red-500 hover:bg-red-500/10 p-1.5 rounded-lg transition-all cursor-pointer"
                            title={`Remover ${entitySingular}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      {/* Informações dos Atletas / Jogadores */}
                      <div className="mt-4 pt-3 border-t border-neutral-200 dark:border-brand-border/40 text-xs">
                        {team.format === "solo" || (!team.players[1] && !isTeamSport) ? (
                          <div>
                            <span className="text-[10px] text-neutral-500 dark:text-brand-text-muted uppercase block font-semibold">
                              Jogador Individual
                            </span>
                            {team.user_id ? (
                              <Link
                                href={`/atleta/${team.user_id}`}
                                className="font-medium text-neutral-800 dark:text-white hover:text-brand-electric-light hover:underline truncate block"
                              >
                                {team.players[0]}
                              </Link>
                            ) : (
                              <span className="font-medium text-neutral-800 dark:text-white truncate block">
                                {team.players[0]}
                              </span>
                            )}
                          </div>
                        ) : isTeamSport ? (
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <div>
                                <span className="text-[10px] text-neutral-500 dark:text-brand-text-muted uppercase block font-semibold">
                                  Capitão
                                </span>
                                {team.user_id ? (
                                  <Link
                                    href={`/atleta/${team.user_id}`}
                                    className="font-medium text-neutral-800 dark:text-white hover:text-brand-electric-light hover:underline truncate block"
                                  >
                                    {team.players[0]}
                                  </Link>
                                ) : (
                                  <span className="font-medium text-neutral-800 dark:text-white truncate block">
                                    {team.players[0]}
                                  </span>
                                )}
                              </div>
                              {team.roster && team.roster.length > 0 && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-brand-electric/10 text-brand-electric-light border border-brand-electric/20">
                                  +{team.roster.length} no elenco
                                </span>
                              )}
                            </div>
                            {team.roster && team.roster.length > 0 && (
                              <div className="text-[10px] text-stone-500 dark:text-neutral-400 truncate">
                                Elenco: {team.roster.join(", ")}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-[10px] text-neutral-500 dark:text-brand-text-muted uppercase block font-semibold">
                                Capitão
                              </span>
                              {team.user_id ? (
                                <Link
                                  href={`/atleta/${team.user_id}`}
                                  className="font-medium text-neutral-800 dark:text-white hover:text-brand-electric-light hover:underline truncate block"
                                >
                                  {team.players[0]}
                                </Link>
                              ) : (
                                <span className="font-medium text-neutral-800 dark:text-white truncate block">
                                  {team.players[0]}
                                </span>
                              )}
                            </div>
                            <div>
                              <span className="text-[10px] text-neutral-500 dark:text-brand-text-muted uppercase block font-semibold">
                                Parceiro
                              </span>
                              <span className="font-medium text-neutral-800 dark:text-white truncate block">
                                {team.players[1] || "—"}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {teams.length < 2 && (
                  <div className="mt-6 flex items-start gap-2.5 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-brand-border text-xs text-neutral-500 dark:text-brand-text-muted">
                    <HelpCircle className="h-4 w-4 text-brand-electric-light shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-neutral-800 dark:text-white block mb-0.5">
                        Mínimo de 2 {entityPlural} Requerido
                      </span>
                      Adicione pelo menos 2 participantes para habilitar a geração do chaveamento mata-mata.
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
