import React, { useState, useEffect, useRef } from "react";
import { Team } from "@/types";
import { UserPlus, Trash2, Trophy, HelpCircle, Users, Upload, FileText, Sparkles } from "lucide-react";

interface TeamRegistrationProps {
  teams: Team[];
  onAddTeam: (name: string, p1: string, p2: string) => void;
  onImportTeams: (importedTeams: Team[]) => void;
  onDeleteTeam: (id: string) => void;
  onGenerateBracket: () => void;
}


export default function TeamRegistration({
  teams,
  onAddTeam,
  onImportTeams,
  onDeleteTeam,
  onGenerateBracket,
}: TeamRegistrationProps) {
  const [teamName, setTeamName] = useState("");
  const [player1, setPlayer1] = useState("");
  const [player2, setPlayer2] = useState("");
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "info" | "error" } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close toast automatically after 5 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim() || !player1.trim() || !player2.trim()) {
      setError("Por favor, preencha todos os campos.");
      return;
    }
    onAddTeam(teamName.trim(), player1.trim(), player2.trim());
    setTeamName("");
    setPlayer1("");
    setPlayer2("");
    setError("");
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

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/);
    if (lines.length === 0) return { imported: [], ignored: 0 };

    // Delimiter detection (supports comma or semicolon)
    const firstLine = lines[0];
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semiCount = (firstLine.match(/;/g) || []).length;
    const delimiter = semiCount > commaCount ? ";" : ",";

    // Extract headers
    const headers = lines[0]
      .split(delimiter)
      .map((h) => h.replace(/^["']|["']$/g, "").trim().toUpperCase());

    const idxProtocolo = headers.indexOf("PROTOCOLO");
    const idxP1 = headers.indexOf("JOGADOR 1");
    const idxP2 = headers.indexOf("JOGADOR 2");
    const idxStatus = headers.indexOf("STATUS");

    if (idxProtocolo === -1 || idxP1 === -1 || idxP2 === -1 || idxStatus === -1) {
      throw new Error(
        "Colunas necessárias não encontradas no CSV. O cabeçalho deve conter: PROTOCOLO, JOGADOR 1, JOGADOR 2, STATUS."
      );
    }

    const results: Team[] = [];
    let ignoredCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Split line keeping quoted values grouped
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

      const status = fields[idxStatus].replace(/^["']|["']$/g, "").trim();
      const statusLower = status.toLowerCase();

      if (statusLower === "confirmado") {
        const protocolo = fields[idxProtocolo].replace(/^["']|["']$/g, "").trim();
        const p1 = fields[idxP1].replace(/^["']|["']$/g, "").trim();
        const p2 = fields[idxP2].replace(/^["']|["']$/g, "").trim();

        if (!protocolo || !p1 || !p2) continue;

        // Auto-generate team name using first names
        const getFirstName = (fullName: string) => fullName.split(" ")[0] || fullName;
        const autoTeamName = `${getFirstName(p1)} & ${getFirstName(p2)}`;

        results.push({
          id: protocolo,
          name: autoTeamName,
          players: [p1, p2],
          createdAt: new Date().toISOString(),
          source: "csv",
        });
      } else if (statusLower === "pendente") {
        ignoredCount++;
      }
    }

    return { imported: results, ignored: ignoredCount };
  };

  const handleFile = (file: File) => {
    // Basic CSV extension validation
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
          message: `Leitura concluída: ${newTeams.length} novas duplas adicionadas. ${duplicateCount} duplas já estavam no sistema e ${ignored} pendentes foram ignoradas.`,
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
                : "bg-white/95 dark:bg-neutral-900/95 text-neutral-800 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700/60"
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

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-brand-border/40 pb-6">
        <div>
          <h1 className="font-display text-3xl font-black tracking-tight uppercase">
            Gestão de <span className="text-gradient-electric">Duplas</span>
          </h1>
          <p className="text-brand-text-muted text-sm mt-1">
            Cadastre as duplas inscritas no torneio de dominó e gere o chaveamento mata-mata automático.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Import and Form Panels stacked */}
        <div className="lg:col-span-1 space-y-6">
          {/* CSV Import Dropzone */}
          <div className="glass-panel rounded-2xl p-6 border border-brand-border/60">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-brand-electric-light" />
              <span>Importar Inscrições</span>
            </h2>
            <p className="text-xs text-brand-text-muted mb-4 leading-relaxed">
              Importe uma planilha contendo as colunas: <code className="text-brand-electric-light text-[10px]">PROTOCOLO</code>, <code className="text-brand-electric-light text-[10px]">JOGADOR 1</code>, <code className="text-brand-electric-light text-[10px]">JOGADOR 2</code> e <code className="text-brand-electric-light text-[10px]">STATUS</code>.
            </p>

            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={onButtonClick}
              className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                dragActive
                  ? "border-brand-electric bg-brand-electric/5 text-neutral-800 dark:text-white"
                  : "border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950/20 hover:border-brand-electric/50 text-neutral-500 dark:text-brand-text-muted hover:text-neutral-850 dark:hover:text-white"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <Upload
                className={`h-8 w-8 mb-3 transition-transform ${
                  dragActive ? "scale-110 text-brand-electric-light animate-bounce" : "text-neutral-500"
                }`}
              />
              <p className="text-xs font-bold text-center leading-relaxed max-w-[200px]">
                Arraste o arquivo CSV de inscrições aqui ou clique para selecionar
              </p>
            </div>
          </div>

          {/* Manual Form */}
          <div className="glass-panel rounded-2xl p-6 border border-brand-border/60">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-5">
              <UserPlus className="h-5 w-5 text-brand-electric-light" />
              <span>Nova Dupla (Manual)</span>
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-text-muted mb-2">
                  Nome da Dupla
                </label>
                 <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Ex: Os Imbatíveis"
                  className="w-full px-4 py-3 rounded-xl bg-neutral-50 dark:bg-neutral-950/80 border border-neutral-200 dark:border-brand-border focus:border-brand-electric focus:ring-1 focus:ring-brand-electric outline-none text-sm transition-all text-neutral-900 dark:text-white placeholder:text-neutral-500 dark:placeholder:text-neutral-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-text-muted mb-2">
                  Jogador 1 (Capitão)
                </label>
                 <input
                  type="text"
                  value={player1}
                  onChange={(e) => setPlayer1(e.target.value)}
                  placeholder="Ex: Carlos Silva"
                  className="w-full px-4 py-3 rounded-xl bg-neutral-50 dark:bg-neutral-950/80 border border-neutral-200 dark:border-brand-border focus:border-brand-electric focus:ring-1 focus:ring-brand-electric outline-none text-sm transition-all text-neutral-900 dark:text-white placeholder:text-neutral-500 dark:placeholder:text-neutral-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-text-muted mb-2">
                  Jogador 2 (Parceiro)
                </label>
                 <input
                  type="text"
                  value={player2}
                  onChange={(e) => setPlayer2(e.target.value)}
                  placeholder="Ex: Roberto Souza"
                  className="w-full px-4 py-3 rounded-xl bg-neutral-50 dark:bg-neutral-950/80 border border-neutral-200 dark:border-brand-border focus:border-brand-electric focus:ring-1 focus:ring-brand-electric outline-none text-sm transition-all text-neutral-900 dark:text-white placeholder:text-neutral-500 dark:placeholder:text-neutral-600"
                />
              </div>

              {error && <div className="text-red-500 text-xs font-bold">{error}</div>}

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 bg-brand-electric hover:bg-brand-electric-hover text-white py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all shadow-lg shadow-brand-electric/15 active:scale-95 cursor-pointer"
              >
                <UserPlus className="h-4 w-4" />
                <span>Adicionar Dupla Manualmente</span>
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
                <span>Duplas Inscritas ({teams.length})</span>
              </h2>
              {teams.length >= 4 && (
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
                <p className="text-neutral-500 dark:text-brand-text-muted text-sm font-semibold">Nenhuma dupla inscrita até o momento.</p>
                <p className="text-xs text-neutral-455 dark:text-neutral-600 mt-1">Cadastre duplas manualmente ou envie um arquivo CSV.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[580px] overflow-y-auto pr-1">
                  {teams.map((team, idx) => (
                    <div
                      key={team.id}
                      className="group relative rounded-xl bg-white dark:bg-neutral-900/60 border border-neutral-200 dark:border-brand-border hover:border-brand-electric/30 p-4 transition-all duration-300 hover:bg-neutral-50/50 dark:hover:bg-neutral-900/90 flex flex-col justify-between shadow-sm dark:shadow-none"
                    >
                      <div className="flex justify-between items-start">
                        <div className="max-w-[80%]">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-[10px] font-bold text-brand-electric-light tracking-widest uppercase">
                              DUPLA #{String(idx + 1).padStart(2, "0")}
                            </span>
                            {team.source === "csv" ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-bold uppercase tracking-wider scale-90 origin-left">
                                Importado via CSV
                              </span>
                            ) : team.source === "external" ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/20 font-bold uppercase tracking-wider scale-90 origin-left">
                                Site Externo
                              </span>
                            ) : (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-neutral-300 dark:border-neutral-700 font-bold uppercase tracking-wider scale-90 origin-left">
                                Inserção Manual
                              </span>
                            )}
                          </div>
                          <h3 className="font-display font-bold text-lg text-neutral-900 dark:text-white tracking-wide truncate group-hover:text-brand-electric-light transition-colors">
                            {team.name}
                          </h3>
                        </div>
                        <button
                          onClick={() => onDeleteTeam(team.id)}
                          className="text-neutral-400 hover:text-red-500 hover:bg-red-500/10 p-1.5 rounded-lg transition-all cursor-pointer"
                          title="Remover Dupla"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="mt-4 pt-3 border-t border-neutral-200 dark:border-brand-border/40 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] text-neutral-500 dark:text-brand-text-muted uppercase block font-semibold">Capitão</span>
                          <span className="font-medium text-neutral-800 dark:text-white truncate block">{team.players[0]}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-neutral-500 dark:text-brand-text-muted uppercase block font-semibold">Jogador 2</span>
                          <span className="font-medium text-neutral-800 dark:text-white truncate block">{team.players[1]}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {teams.length < 4 && (
                 <div className="mt-6 flex items-start gap-2.5 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-brand-border text-xs text-neutral-500 dark:text-brand-text-muted">
                    <HelpCircle className="h-4 w-4 text-brand-electric-light shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-neutral-800 dark:text-white block mb-0.5">Mínimo de 4 Duplas Requerido</span>
                      Adicione pelo menos 4 duplas para habilitar a geração do chaveamento mata-mata clássico. Recomendamos 4 ou 8 duplas para melhor fluxo do campeonato.
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
