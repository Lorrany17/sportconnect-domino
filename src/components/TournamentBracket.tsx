import React, { useState } from "react";
import { Match, Team } from "@/types";
import { Trophy, Activity, Pencil, X, Settings, ClipboardCheck, CheckCircle } from "lucide-react";
interface TournamentBracketProps {
  matches: Match[];
  teams: Team[];
  onUpdateMatch: (match: Match) => void;
  onSwapTeams: (srcMatchId: string, srcSlot: "A" | "B", destMatchId: string, destSlot: "A" | "B") => void;
  onReplaceTeam: (matchId: string, slot: "A" | "B", newTeamId: string) => void;
  onDeclareWO: (matchId: string, slotWithError: "A" | "B") => void;
  isAdmin?: boolean;
}

export default function TournamentBracket({
  matches,
  teams,
  onUpdateMatch,
  onSwapTeams,
  onReplaceTeam,
  onDeclareWO,
  isAdmin = false,
}: TournamentBracketProps) {
  const [editMode, setEditMode] = useState<boolean>(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);

  // Popover state for Mobile tap edit
  const [activeDropdownSlot, setActiveDropdownSlot] = useState<{ matchId: string; slot: "A" | "B" } | null>(null);

  // Form states for manual edit
  const [editTeamAId, setEditTeamAId] = useState<string>("");
  const [editTeamBId, setEditTeamBId] = useState<string>("");
  const [editStatus, setEditStatus] = useState<Match["status"]>("SCHEDULED");
  const [editScoreA, setEditScoreA] = useState<number>(0);
  const [editScoreB, setEditScoreB] = useState<number>(0);
  const [editWinnerId, setEditWinnerId] = useState<string>("");

  const getMatchesByPhase = (phaseName: string) => {
    return matches.filter((m) => m.phase.toLowerCase() === phaseName.toLowerCase());
  };
  const getLoserName = (matchId: string, fallback: string) => {
    const match = matches.find((m) => m.id === matchId);
    if (!match || match.status !== "COMPLETED" || !match.winnerId) {
      return fallback;
    }
    return match.winnerId === match.teamA.id ? match.teamB.name : match.teamA.name;
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, matchId: string, slot: "A" | "B") => {
    if (!editMode) return;
    e.dataTransfer.setData("text/plain", JSON.stringify({ matchId, slot }));
  };

  const handleDrop = (e: React.DragEvent, matchId: string, slot: "A" | "B") => {
    if (!editMode) return;
    e.preventDefault();
    try {
      const src = JSON.parse(e.dataTransfer.getData("text/plain"));
      onSwapTeams(src.matchId, src.slot, matchId, slot);
    } catch (err) {
      console.error("Drop error:", err);
    }
  };

  const startEditing = (match: Match) => {
    setEditingMatch(match);
    setEditTeamAId(match.teamA.id);
    setEditTeamBId(match.teamB.id);
    setEditStatus(match.status);
    setEditScoreA(match.scoreA);
    setEditScoreB(match.scoreB);
    setEditWinnerId(match.winnerId || "");
  };

  const getTeamOptions = (currentTeam: Team) => {
    const list = [...teams];
    if (!list.some((t) => t.id === currentTeam.id)) {
      list.push(currentTeam);
    }
    return list;
  };

  const handleSaveEdit = () => {
    if (!editingMatch) return;

    const selectedTeamA = teams.find((t) => t.id === editTeamAId) || editingMatch.teamA;
    const selectedTeamB = teams.find((t) => t.id === editTeamBId) || editingMatch.teamB;

    const updatedMatch: Match = {
      ...editingMatch,
      teamA: selectedTeamA,
      teamB: selectedTeamB,
      status: editStatus,
      scoreA: editScoreA,
      scoreB: editScoreB,
      winnerId: editStatus === "COMPLETED" ? editWinnerId || undefined : undefined,
    };

    onUpdateMatch(updatedMatch);
    setEditingMatch(null);
  };

  const hasQF = matches.some((m) => m.phase.toLowerCase() === "quartas de final");
  const hasMatches = matches.length > 0;

  const winnersPhases = hasQF
    ? ["Quartas de Final", "Semifinal", "Final"]
    : ["Semifinal", "Final"];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-brand-border/40 pb-6">
        <div>
          <h1 className="font-display text-3xl font-black tracking-tight uppercase">
            Chaveamento e <span className="text-gradient-neon">Tempo Real</span>
          </h1>
          <p className="text-brand-text-muted text-sm mt-1">
            Acompanhe o andamento das chaves de Vencedores e Repescagem em tempo real.
          </p>
        </div>

        {/* Toggle Edit Mode Button */}
        {hasMatches && isAdmin && (
          <button
            onClick={() => setEditMode(!editMode)}
            className={`flex items-center gap-2 px-4.5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer border ${editMode
                ? "bg-brand-neon/15 border-brand-neon text-brand-neon shadow-lg shadow-brand-neon/10"
                : "bg-neutral-900 border-brand-border hover:border-neutral-700 text-brand-text-muted"
              }`}
          >
            <Settings className={`h-3.5 w-3.5 ${editMode ? "animate-spin" : ""}`} />
            Modo Edição
          </button>
        )}
      </div>

      {/* Featured Live Matches Carousel */}
      {(() => {
        const liveMatches = matches.filter((m) => m.status === "LIVE");
        if (liveMatches.length === 0) return null;

        return (
          <div className="space-y-3">
            <style>{`
              .no-scrollbar::-webkit-scrollbar {
                display: none;
              }
              .no-scrollbar {
                -ms-overflow-style: none;
                scrollbar-width: none;
              }
            `}</style>
            
            <div className="text-[10px] font-bold text-brand-neon uppercase tracking-widest pl-1">
              🔥 Confrontos Ao Vivo Simultâneos
            </div>

            <div className="flex flex-row overflow-x-auto snap-x snap-mandatory gap-4 pb-2 no-scrollbar">
              {liveMatches.map((activeMatch) => {
                const isBestOf3 = activeMatch.phase.toLowerCase() === "semifinal";
                return (
                  <div
                    key={activeMatch.id}
                    className="glass-panel-neon rounded-2xl p-4 relative overflow-hidden bg-gradient-to-r from-brand-neon-orange/10 via-transparent to-brand-electric/5 min-w-[85%] md:min-w-[450px] snap-center shrink-0 border border-brand-neon-orange/20"
                  >
                    <div className="absolute top-0 right-0 h-24 w-24 rounded-full bg-brand-neon/10 blur-2xl -z-10" />
                    
                    <div className="flex items-center justify-between mb-3">
                      <span className="flex items-center gap-1 bg-brand-neon-orange/10 border border-brand-neon-orange/20 text-brand-neon text-[9px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full animate-pulse">
                        <span className="h-1.5 w-1.5 rounded-full bg-brand-neon" />
                        AO VIVO
                      </span>
                      <span className="text-[9px] font-black text-brand-text-muted">
                        MESA {activeMatch.tableNumber} • {activeMatch.phase.toUpperCase()}
                      </span>
                    </div>

                    <div className="grid grid-cols-7 gap-3 items-center">
                      <div className="col-span-3 text-center md:text-right min-w-0">
                        <h3 className="text-sm font-black text-white uppercase tracking-wide truncate">
                          {activeMatch.teamA.name}
                        </h3>
                        {isBestOf3 && (
                          <p className="text-[9px] text-neutral-500 font-bold uppercase mt-0.5">
                            {activeMatch.setsA || 0} Quadras
                          </p>
                        )}
                      </div>

                      <div className="col-span-1 flex flex-col items-center justify-center bg-neutral-950/80 border border-brand-border rounded-lg py-1.5 px-2.5 min-w-[70px] mx-auto shadow-inner">
                        <span className="font-display font-black text-xl text-brand-neon animate-glow">
                          {activeMatch.scoreA}:{activeMatch.scoreB}
                        </span>
                        <span className="text-[8px] font-bold text-neutral-500 uppercase tracking-widest mt-0.5">
                          PLACAR
                        </span>
                      </div>

                      <div className="col-span-3 text-center md:text-left min-w-0">
                        <h3 className="text-sm font-black text-white uppercase tracking-wide truncate">
                          {activeMatch.teamB.name}
                        </h3>
                        {isBestOf3 && (
                          <p className="text-[9px] text-neutral-500 font-bold uppercase mt-0.5">
                            {activeMatch.setsB || 0} Quadras
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Main Bracket (Vencedores) */}
      <div className="glass-panel rounded-2xl p-6 border border-brand-border/60 overflow-x-auto">
        <h2 className="text-sm font-black flex items-center gap-2 mb-6 border-b border-brand-border/40 pb-3">
          <Trophy className="h-4 w-4 text-brand-neon animate-pulse-slow" />
          <span className="text-gradient-neon uppercase tracking-wider">Chave Principal (Vencedores)</span>
        </h2>

        {!hasMatches ? (
          <div className="text-center py-12 text-brand-text-muted">
            <Trophy className="h-12 w-12 text-neutral-800 mx-auto mb-3" />
            <p className="text-sm font-semibold">Chaveamento não gerado.</p>
            <p className="text-xs text-neutral-600 mt-1">Inscreva as duplas e clique em &quot;Gerar Chaveamento&quot; na Gestão de Duplas.</p>
          </div>
        ) : (
          <div className="flex gap-8 md:gap-16 min-w-[700px] justify-between py-4 select-none min-h-[460px] items-stretch">
            {winnersPhases.map((phase) => {
              const phaseMatches = getMatchesByPhase(phase);
              return (
                <div key={phase} className="flex-1 flex flex-col justify-around gap-4">
                  {/* Phase Title */}
                  <div className="text-center border-b border-brand-border/40 pb-2 mb-2">
                    <span className="font-display text-[10px] font-black uppercase tracking-wider text-brand-electric-light">
                      {phase}
                    </span>
                  </div>

                  {/* Matches list for this phase */}
                  <div className="flex flex-col justify-around h-full gap-8 relative">
                    {phaseMatches.map((m) => {
                      const isCompleted = m.status === "COMPLETED";
                      const isLive = m.status === "LIVE";

                      return (
                        <div
                          key={m.id}
                          className={`relative rounded-xl p-3.5 border transition-all duration-300 ${isLive
                              ? "bg-white dark:bg-neutral-900/90 border-brand-neon/60 shadow-lg shadow-brand-neon/5 text-neutral-900 dark:text-white"
                              : isCompleted
                                ? "bg-neutral-50 dark:bg-neutral-900/40 border-neutral-200 dark:border-brand-border/60 text-neutral-800 dark:text-neutral-350"
                                : "bg-neutral-100/50 dark:bg-neutral-950/20 border-neutral-200 dark:border-brand-border/30 text-neutral-700 dark:text-neutral-400"
                            }`}
                        >
                          {/* Live Indicator or Edit Pencil */}
                          {editMode ? (
                            <button
                              onClick={() => startEditing(m)}
                              className="absolute -top-2.5 -right-2 p-1.5 rounded bg-brand-electric hover:bg-brand-electric-hover text-white text-xs border border-brand-electric/50 shadow-md cursor-pointer transition-all active:scale-90 animate-fadeIn"
                              title="Editar Geral do Confronto"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          ) : isLive ? (
                            <span className="absolute -top-2.5 -right-2 px-1.5 py-0.5 rounded bg-brand-neon-orange/20 border border-brand-neon-orange/40 text-brand-neon text-[8px] font-black tracking-widest uppercase animate-pulse">
                              AO VIVO
                            </span>
                          ) : null}

                          {/* Table tag */}
                          <div className="text-[8px] font-black text-brand-text-muted uppercase tracking-wider mb-2 flex justify-between">
                            <span>Mesa {m.tableNumber}</span>
                            {isCompleted && <span className="text-brand-electric-light">FIM</span>}
                            {!isCompleted && !isLive && <span className="text-neutral-500">AGENDADA</span>}
                          </div>

                          {/* Team A Card row */}
                          <div
                            draggable={editMode}
                            onDragStart={(e) => handleDragStart(e, m.id, "A")}
                            onDragOver={(e) => editMode && e.preventDefault()}
                            onDrop={(e) => editMode && handleDrop(e, m.id, "A")}
                            onClick={() => editMode && setActiveDropdownSlot({ matchId: m.id, slot: "A" })}
                            className={`flex items-center justify-between text-xs py-1.5 px-2 rounded-lg transition-all ${editMode
                                ? "cursor-grab active:cursor-grabbing hover:bg-brand-electric/10 border border-dashed border-transparent hover:border-brand-electric/30"
                                : ""
                              } ${isCompleted && m.winnerId === m.teamA.id
                                ? "bg-brand-electric/15 text-white font-bold"
                                : isCompleted
                                  ? "text-neutral-500"
                                  : "text-neutral-900 dark:text-white"
                              }`}
                          >
                            <span className="truncate max-w-[120px]" title={m.teamA.name}>
                              {m.teamA.name}
                            </span>
                            <span className="font-display font-black text-sm">{m.scoreA}</span>
                          </div>

                          {/* Divider */}
                          <div className="h-[1px] bg-neutral-200 dark:bg-brand-border/40 my-1" />

                          {/* Team B Card row */}
                          <div
                            draggable={editMode}
                            onDragStart={(e) => handleDragStart(e, m.id, "B")}
                            onDragOver={(e) => editMode && e.preventDefault()}
                            onDrop={(e) => editMode && handleDrop(e, m.id, "B")}
                            onClick={() => editMode && setActiveDropdownSlot({ matchId: m.id, slot: "B" })}
                            className={`flex items-center justify-between text-xs py-1.5 px-2 rounded-lg transition-all ${editMode
                                ? "cursor-grab active:cursor-grabbing hover:bg-brand-neon-orange/10 border border-dashed border-transparent hover:border-brand-neon-orange/30"
                                : ""
                              } ${isCompleted && m.winnerId === m.teamB.id
                                ? "bg-brand-electric/15 text-white font-bold"
                                : isCompleted
                                  ? "text-neutral-500"
                                  : "text-neutral-900 dark:text-white"
                              }`}
                          >
                            <span className="truncate max-w-[120px]" title={m.teamB.name}>
                              {m.teamB.name}
                            </span>
                            <span className="font-display font-black text-sm">{m.scoreB}</span>
                          </div>

                          {/* Connector lines inside Winners Bracket */}
                          {phase.toLowerCase() === "quartas de final" && (
                            <>
                              <div className="absolute top-1/2 right-[-16px] md:right-[-32px] w-[16px] md:w-[32px] h-[1.5px] bg-brand-border/40 -translate-y-1/2" />
                              {(m.id === "qf-1" || m.id === "qf-3") && (
                                <div className="absolute top-1/2 left-[calc(100%+16px)] md:left-[calc(100%+32px)] w-[1.5px] h-[80px] bg-brand-border/40" />
                              )}
                              {(m.id === "qf-2" || m.id === "qf-4") && (
                                <div className="absolute bottom-1/2 left-[calc(100%+16px)] md:left-[calc(100%+32px)] w-[1.5px] h-[80px] bg-brand-border/40" />
                              )}
                            </>
                          )}

                          {phase.toLowerCase() === "semifinal" && (
                            <>
                              <div className="absolute top-1/2 right-[-16px] md:right-[-32px] w-[16px] md:w-[32px] h-[1.5px] bg-brand-border/40 -translate-y-1/2" />
                              <div className="absolute top-1/2 left-[-16px] md:left-[-32px] w-[16px] md:w-[32px] h-[1.5px] bg-brand-border/40 -translate-y-1/2" />
                              {m.id.includes("sf-1") && (
                                <div className="absolute top-1/2 left-[calc(100%+16px)] md:left-[calc(100%+32px)] w-[1.5px] h-[140px] bg-brand-border/40" />
                              )}
                              {m.id.includes("sf-2") && (
                                <div className="absolute bottom-1/2 left-[calc(100%+16px)] md:left-[calc(100%+32px)] w-[1.5px] h-[140px] bg-brand-border/40" />
                              )}
                            </>
                          )}

                          {phase.toLowerCase() === "final" && (
                            <div className="absolute top-1/2 left-[-16px] md:left-[-32px] w-[16px] md:w-[32px] h-[1.5px] bg-brand-border/40 -translate-y-1/2" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Losers Bracket (Repescagem) */}
      <div className="glass-panel rounded-2xl p-6 border border-brand-border/60 overflow-x-auto">
        <h2 className="text-sm font-black flex items-center gap-2 mb-6 border-b border-brand-border/40 pb-3">
          <Activity className="h-4 w-4 text-brand-electric-light animate-pulse-slow" />
          <span className="text-gradient-electric uppercase tracking-wider">Chave de Repescagem (Perdedores)</span>
        </h2>

        {!hasMatches ? (
          <div className="text-center py-12 text-brand-text-muted">
            <Activity className="h-12 w-12 text-neutral-800 mx-auto mb-3" />
            <p className="text-sm font-semibold">Repescagem inativa.</p>
            <p className="text-xs text-neutral-600 mt-1">Inscreva as duplas e inicie o campeonato.</p>
          </div>
        ) : (
          <div className="flex gap-8 md:gap-16 min-w-[700px] justify-start py-4 select-none min-h-[300px] items-stretch">
            {/* Repescagem Column 1 */}
            {hasQF && (
              <div className="flex-1 flex flex-col justify-around gap-4 max-w-[280px]">
                <div className="text-center border-b border-brand-border/40 pb-2 mb-2">
                  <span className="font-display text-[10px] font-black uppercase tracking-wider text-neutral-500">
                    Semifinal Repescagem
                  </span>
                </div>
                <div className="flex flex-col justify-around h-full gap-8 relative">
                  {/* Losers Match 1 */}
                  <div className="relative rounded-xl p-3.5 border border-brand-border/30 bg-neutral-950/20">
                    <div className="text-[8px] font-black text-brand-text-muted uppercase tracking-wider mb-2">
                      Mesa R1
                    </div>
                    <div
                      draggable={editMode}
                      onDragStart={(e) => handleDragStart(e, "r-sf-1", "A")}
                      onDragOver={(e) => editMode && e.preventDefault()}
                      onDrop={(e) => editMode && handleDrop(e, "r-sf-1", "A")}
                      onClick={() => editMode && setActiveDropdownSlot({ matchId: "r-sf-1", slot: "A" })}
                      className={`flex items-center justify-between text-xs py-1.5 px-2 rounded-lg text-neutral-400 ${editMode ? "cursor-grab active:cursor-grabbing hover:bg-neutral-800" : ""
                        }`}
                    >
                      <span className="truncate max-w-[140px]" title={getLoserName("qf-1", "Perdedor QF 1")}>
                        {getLoserName("qf-1", "Perdedor QF 1")}
                      </span>
                      <span className="font-display font-black text-sm">0</span>
                    </div>
                    <div className="h-[1px] bg-brand-border/40 my-1" />
                    <div
                      draggable={editMode}
                      onDragStart={(e) => handleDragStart(e, "r-sf-1", "B")}
                      onDragOver={(e) => editMode && e.preventDefault()}
                      onDrop={(e) => editMode && handleDrop(e, "r-sf-1", "B")}
                      onClick={() => editMode && setActiveDropdownSlot({ matchId: "r-sf-1", slot: "B" })}
                      className={`flex items-center justify-between text-xs py-1.5 px-2 rounded-lg text-neutral-400 ${editMode ? "cursor-grab active:cursor-grabbing hover:bg-neutral-800" : ""
                        }`}
                    >
                      <span className="truncate max-w-[140px]" title={getLoserName("qf-2", "Perdedor QF 2")}>
                        {getLoserName("qf-2", "Perdedor QF 2")}
                      </span>
                      <span className="font-display font-black text-sm">0</span>
                    </div>
                    {/* Connector line */}
                    <div className="absolute top-1/2 right-[-16px] md:right-[-32px] w-[16px] md:w-[32px] h-[1.5px] bg-brand-border/40 -translate-y-1/2" />
                    <div className="absolute top-1/2 left-[calc(100%+16px)] md:left-[calc(100%+32px)] w-[1.5px] h-[60px] bg-brand-border/40" />
                  </div>

                  {/* Losers Match 2 */}
                  <div className="relative rounded-xl p-3.5 border border-brand-border/30 bg-neutral-950/20">
                    <div className="text-[8px] font-black text-brand-text-muted uppercase tracking-wider mb-2">
                      Mesa R2
                    </div>
                    <div
                      draggable={editMode}
                      onDragStart={(e) => handleDragStart(e, "r-sf-2", "A")}
                      onDragOver={(e) => editMode && e.preventDefault()}
                      onDrop={(e) => editMode && handleDrop(e, "r-sf-2", "A")}
                      onClick={() => editMode && setActiveDropdownSlot({ matchId: "r-sf-2", slot: "A" })}
                      className={`flex items-center justify-between text-xs py-1.5 px-2 rounded-lg text-neutral-400 ${editMode ? "cursor-grab active:cursor-grabbing hover:bg-neutral-800" : ""
                        }`}
                    >
                      <span className="truncate max-w-[140px]" title={getLoserName("qf-3", "Perdedor QF 3")}>
                        {getLoserName("qf-3", "Perdedor QF 3")}
                      </span>
                      <span className="font-display font-black text-sm">0</span>
                    </div>
                    <div className="h-[1px] bg-brand-border/40 my-1" />
                    <div
                      draggable={editMode}
                      onDragStart={(e) => handleDragStart(e, "r-sf-2", "B")}
                      onDragOver={(e) => editMode && e.preventDefault()}
                      onDrop={(e) => editMode && handleDrop(e, "r-sf-2", "B")}
                      onClick={() => editMode && setActiveDropdownSlot({ matchId: "r-sf-2", slot: "B" })}
                      className={`flex items-center justify-between text-xs py-1.5 px-2 rounded-lg text-neutral-400 ${editMode ? "cursor-grab active:cursor-grabbing hover:bg-neutral-800" : ""
                        }`}
                    >
                      <span className="truncate max-w-[140px]" title={getLoserName("qf-4", "Perdedor QF 4")}>
                        {getLoserName("qf-4", "Perdedor QF 4")}
                      </span>
                      <span className="font-display font-black text-sm">0</span>
                    </div>
                    {/* Connector line */}
                    <div className="absolute top-1/2 right-[-16px] md:right-[-32px] w-[16px] md:w-[32px] h-[1.5px] bg-brand-border/40 -translate-y-1/2" />
                    <div className="absolute bottom-1/2 left-[calc(100%+16px)] md:left-[calc(100%+32px)] w-[1.5px] h-[60px] bg-brand-border/40" />
                  </div>
                </div>
              </div>
            )}

            {/* Repescagem Column 2 */}
            <div className="flex-1 flex flex-col justify-around gap-4 max-w-[280px]">
              <div className="text-center border-b border-brand-border/40 pb-2 mb-2">
                <span className="font-display text-[10px] font-black uppercase tracking-wider text-neutral-500">
                  Final Repescagem (Bronze)
                </span>
              </div>
              <div className="flex flex-col justify-around h-full gap-8 relative">
                <div className="relative rounded-xl p-3.5 border border-brand-border/30 bg-neutral-950/20">
                  <div className="text-[8px] font-black text-brand-text-muted uppercase tracking-wider mb-2">
                    Mesa R3
                  </div>
                  <div
                    draggable={editMode}
                    onDragStart={(e) => handleDragStart(e, "r-f-1", "A")}
                    onDragOver={(e) => editMode && e.preventDefault()}
                    onDrop={(e) => editMode && handleDrop(e, "r-f-1", "A")}
                    onClick={() => editMode && setActiveDropdownSlot({ matchId: "r-f-1", slot: "A" })}
                    className={`flex items-center justify-between text-xs py-1.5 px-2 rounded-lg text-neutral-400 ${editMode ? "cursor-grab active:cursor-grabbing hover:bg-neutral-800" : ""
                      }`}
                  >
                    <span className="truncate max-w-[140px]" title={hasQF ? "Vencedor Repescagem SF" : getLoserName("sf-1", "Perdedor Semifinal 1")}>
                      {hasQF ? "Vencedor Repescagem SF" : getLoserName("sf-1", "Perdedor Semifinal 1")}
                    </span>
                    <span className="font-display font-black text-sm">0</span>
                  </div>
                  <div className="h-[1px] bg-brand-border/40 my-1" />
                  <div
                    draggable={editMode}
                    onDragStart={(e) => handleDragStart(e, "r-f-1", "B")}
                    onDragOver={(e) => editMode && e.preventDefault()}
                    onDrop={(e) => editMode && handleDrop(e, "r-f-1", "B")}
                    onClick={() => editMode && setActiveDropdownSlot({ matchId: "r-f-1", slot: "B" })}
                    className={`flex items-center justify-between text-xs py-1.5 px-2 rounded-lg text-neutral-400 ${editMode ? "cursor-grab active:cursor-grabbing hover:bg-neutral-800" : ""
                      }`}
                  >
                    <span className="truncate max-w-[140px]" title={hasQF ? getLoserName("sf-1", "Perdedor Semifinal 1") : getLoserName("sf-2", "Perdedor Semifinal 2")}>
                      {hasQF ? getLoserName("sf-1", "Perdedor Semifinal 1") : getLoserName("sf-2", "Perdedor Semifinal 2")}
                    </span>
                    <span className="font-display font-black text-sm">0</span>
                  </div>
                  {/* Left connectors */}
                  <div className="absolute top-1/2 left-[-16px] md:left-[-32px] w-[16px] md:w-[32px] h-[1.5px] bg-brand-border/40 -translate-y-1/2" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Histórico de Resultados */}
      <div className="glass-panel rounded-2xl p-6 border border-brand-border/60">
        <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
          <ClipboardCheck className="h-5 w-5 text-brand-neon" />
          <span>📋 Histórico de Resultados</span>
        </h2>

        {(() => {
          const completedMatches = matches
            .filter((m) => m.status === "COMPLETED")
            .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

          if (completedMatches.length === 0) {
            return (
              <p className="text-xs text-neutral-600 italic py-6 text-center">
                Nenhuma partida finalizada até o momento. Os resultados aparecerão aqui.
              </p>
            );
          }

          return (
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {completedMatches.map((m) => {
                const isBestOf3 = m.phase.toLowerCase() === "semifinal";
                const aWins = m.winnerId === m.teamA.id;
                const bWins = m.winnerId === m.teamB.id;

                // Scores to display
                let dispScoreA = "";
                let dispScoreB = "";
                const isWO = m.isWO;

                if (!isWO) {
                  if (isBestOf3) {
                    const finalSetsA = m.finalSetsA !== undefined ? m.finalSetsA : m.setsA || 0;
                    const finalSetsB = m.finalSetsB !== undefined ? m.finalSetsB : m.setsB || 0;
                    dispScoreA = String(finalSetsA);
                    dispScoreB = String(finalSetsB);
                  } else {
                    const finalScoreA = m.finalScoreA !== undefined ? m.finalScoreA : m.scoreA;
                    const finalScoreB = m.finalScoreB !== undefined ? m.finalScoreB : m.scoreB;
                    dispScoreA = String(finalScoreA);
                    dispScoreB = String(finalScoreB);
                  }
                }

                const isAWO = isWO && m.woSlot === "A";
                const isBWO = isWO && m.woSlot === "B";

                return (
                  <div
                    key={m.id}
                    className="glass-panel border border-brand-border/40 hover:border-neutral-800 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2">
                        <span>{m.phase} - Mesa {m.tableNumber}</span>
                        {isBestOf3 && !isWO && (
                          <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest bg-neutral-900 px-1.5 py-0.5 rounded border border-brand-border/20">
                            Sets
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 mt-1.5">
                        {/* Team A Row */}
                        <div className={`flex items-center gap-1.5 text-xs truncate max-w-[240px] ${aWins ? "font-bold text-white" : "text-neutral-400 opacity-70"}`}>
                          <span>{m.teamA.name}</span>
                          {isAWO && (
                            <span className="bg-red-500/10 border border-red-500/30 text-red-500 text-[8px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded animate-pulse">
                              W.O.
                            </span>
                          )}
                          {!isWO && (
                            <span className="font-display font-black ml-1 text-sm">{dispScoreA}</span>
                          )}
                        </div>

                        <span className="text-neutral-600 text-[10px] font-black uppercase tracking-widest hidden md:inline">vs</span>

                        {/* Team B Row */}
                        <div className={`flex items-center gap-1.5 text-xs truncate max-w-[240px] ${bWins ? "font-bold text-white" : "text-neutral-400 opacity-70"}`}>
                          <span>{m.teamB.name}</span>
                          {isBWO && (
                            <span className="bg-red-500/10 border border-red-500/30 text-red-500 text-[8px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded animate-pulse">
                              W.O.
                            </span>
                          )}
                          {!isWO && (
                            <span className="font-display font-black ml-1 text-sm">{dispScoreB}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="flex items-center gap-1 bg-green-500/10 border border-green-500/20 text-green-400 text-[9px] font-black tracking-widest uppercase px-2.5 py-1 rounded-full shrink-0 self-start md:self-center">
                      <CheckCircle className="h-3 w-3" />
                      FINALIZADO
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Manual Override Edit Modal (General match status editor) */}
      {editingMatch && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel border border-brand-border/60 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleUp">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-5 border-b border-brand-border/40 bg-neutral-950/40">
              <h3 className="font-display font-black text-white uppercase tracking-wider text-sm flex items-center gap-2">
                <Settings className="h-4 w-4 text-brand-electric-light animate-spin-slow" />
                <span>Editar Confronto - Mesa {editingMatch.tableNumber}</span>
              </h3>
              <button
                onClick={() => setEditingMatch(null)}
                className="text-neutral-500 hover:text-white transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <div className="text-[10px] font-bold text-brand-electric-light tracking-widest uppercase mb-1">
                Fase: {editingMatch.phase}
              </div>

              {/* Select Team A */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-brand-text-muted uppercase tracking-wider">
                  Dupla A (Casa)
                </label>
                <select
                  value={editTeamAId}
                  onChange={(e) => setEditTeamAId(e.target.value)}
                  className="w-full bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-brand-border text-xs rounded-xl p-2.5 outline-none focus:border-brand-electric text-neutral-900 dark:text-white cursor-pointer"
                >
                  {getTeamOptions(editingMatch.teamA).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    min={0}
                    value={editScoreA}
                    onChange={(e) => setEditScoreA(Math.max(0, Number(e.target.value)))}
                    className="w-20 bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-brand-border text-xs rounded-xl p-2 outline-none focus:border-brand-electric text-center text-neutral-900 dark:text-white font-bold"
                  />
                  <span className="text-[10px] text-brand-text-muted font-bold uppercase tracking-wider">Pontos parciais</span>
                </div>
              </div>

              {/* Select Team B */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-brand-text-muted uppercase tracking-wider">
                  Dupla B (Visitante)
                </label>
                <select
                  value={editTeamBId}
                  onChange={(e) => setEditTeamBId(e.target.value)}
                  className="w-full bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-brand-border text-xs rounded-xl p-2.5 outline-none focus:border-brand-electric text-neutral-900 dark:text-white cursor-pointer"
                >
                  {getTeamOptions(editingMatch.teamB).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    min={0}
                    value={editScoreB}
                    onChange={(e) => setEditScoreB(Math.max(0, Number(e.target.value)))}
                    className="w-20 bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-brand-border text-xs rounded-xl p-2 outline-none focus:border-brand-electric text-center text-neutral-900 dark:text-white font-bold"
                  />
                  <span className="text-[10px] text-brand-text-muted font-bold uppercase tracking-wider">Pontos parciais</span>
                </div>
              </div>

              {/* Status Selector */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-brand-text-muted uppercase tracking-wider">
                  Status do Confronto
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as Match["status"])}
                  className="w-full bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-brand-border text-xs rounded-xl p-2.5 outline-none focus:border-brand-electric text-neutral-900 dark:text-white cursor-pointer"
                >
                  <option value="SCHEDULED">AGENDADA (Scheduled)</option>
                  <option value="LIVE">AO VIVO (Live)</option>
                  <option value="COMPLETED">FINALIZADA (Completed)</option>
                </select>
              </div>

              {/* Winner Selector for Completed status */}
              {editStatus === "COMPLETED" && (
                <div className="space-y-1.5 bg-neutral-100 dark:bg-neutral-950/60 p-3.5 rounded-xl border border-neutral-200 dark:border-brand-border">
                  <label className="block text-[10px] font-black text-brand-neon uppercase tracking-wider">
                    🏆 Definir Vencedor (Avanço Automático)
                  </label>
                  <select
                    value={editWinnerId}
                    onChange={(e) => setEditWinnerId(e.target.value)}
                    className="w-full mt-1.5 bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-brand-border text-xs rounded-xl p-2.5 outline-none focus:border-brand-neon text-neutral-900 dark:text-white cursor-pointer"
                  >
                    <option value="">Nenhum (A definir)</option>
                    <option value={editTeamAId}>
                      Dupla A: {teams.find((t) => t.id === editTeamAId)?.name || editingMatch.teamA.name}
                    </option>
                    <option value={editTeamBId}>
                      Dupla B: {teams.find((t) => t.id === editTeamBId)?.name || editingMatch.teamB.name}
                    </option>
                  </select>
                  <p className="text-[9px] text-brand-text-muted mt-2 leading-relaxed">
                    Importante: Ao salvar com status FINALIZADA e um Vencedor selecionado, o chaveamento será recalculado e a dupla avançará na árvore imediatamente.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
             <div className="p-5 border-t border-neutral-200 dark:border-brand-border/40 bg-neutral-100/50 dark:bg-neutral-950/20 flex gap-3">
              <button
                type="button"
                onClick={() => setEditingMatch(null)}
                className="flex-1 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-brand-border hover:border-neutral-300 dark:hover:border-neutral-700 text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="flex-1 py-2.5 rounded-xl bg-brand-electric hover:bg-brand-electric-hover text-xs font-black uppercase tracking-wider text-white transition-all shadow-md shadow-brand-electric/15 cursor-pointer"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile-first Dropdown Popover (Tap to Edit Team Slot / Declare W.O.) */}
      {activeDropdownSlot && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel border border-brand-border/60 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-scaleUp">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-brand-border/40 bg-neutral-950/40">
              <h4 className="font-display font-black text-white text-xs uppercase tracking-wider">
                Editar Slot: Mesa {
                  matches.find((m) => m.id === activeDropdownSlot.matchId)?.tableNumber ||
                  (activeDropdownSlot.matchId.startsWith("r-") ? "Repescagem" : "")
                } • Dupla {activeDropdownSlot.slot}
              </h4>
              <button
                type="button"
                onClick={() => setActiveDropdownSlot(null)}
                className="text-neutral-500 hover:text-white transition-all cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-brand-text-muted uppercase tracking-wider mb-2">
                  Substituir Dupla Por:
                </label>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      onReplaceTeam(activeDropdownSlot.matchId, activeDropdownSlot.slot, e.target.value);
                      setActiveDropdownSlot(null);
                    }
                  }}
                  defaultValue=""
                  className="w-full bg-neutral-950 border border-brand-border text-xs rounded-xl p-2.5 outline-none focus:border-brand-electric text-white cursor-pointer"
                >
                  <option value="" disabled>Selecione uma dupla...</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {!activeDropdownSlot.matchId.startsWith("r-") && (
                <div className="border-t border-brand-border/40 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      onDeclareWO(activeDropdownSlot.matchId, activeDropdownSlot.slot);
                      setActiveDropdownSlot(null);
                    }}
                    className="w-full py-2.5 rounded-xl border border-red-500/30 hover:border-red-500 bg-red-500/5 hover:bg-red-500/10 text-red-500 hover:text-red-400 font-bold text-xs uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
                  >
                    Declarar W.O. (Derrota)
                  </button>
                  <p className="text-[9px] text-neutral-600 mt-2 text-center leading-relaxed">
                    Declarar W.O. dará vitória de 4-0 para o adversário e avançará a chave automaticamente.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
