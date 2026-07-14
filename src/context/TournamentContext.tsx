/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Team, Match, Round, TournamentEvent } from "@/types";
import { supabase } from "@/lib/supabase";

const MATCH_ID_MAP: Record<string, string> = {
  "qf-1": "00000000-0000-0000-0000-000000000001",
  "qf-2": "00000000-0000-0000-0000-000000000002",
  "qf-3": "00000000-0000-0000-0000-000000000003",
  "qf-4": "00000000-0000-0000-0000-000000000004",
  "sf-1": "00000000-0000-0000-0000-000000000005",
  "sf-2": "00000000-0000-0000-0000-000000000006",
  "f-1":  "00000000-0000-0000-0000-000000000007"
};

const REVERSE_MATCH_ID_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(MATCH_ID_MAP).map(([k, v]) => [v, k])
);

const generateUUID = () => {
  if (typeof window !== "undefined" && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const getPlaceholderTeam = (matchFriendlyId: string, slot: "A" | "B"): Team => {
  let label = "";
  if (matchFriendlyId === "sf-1") {
    label = slot === "A" ? "Vencedor QF 1" : "Vencedor QF 2";
  } else if (matchFriendlyId === "sf-2") {
    label = slot === "A" ? "Vencedor QF 3" : "Vencedor QF 4";
  } else if (matchFriendlyId === "f-1") {
    label = slot === "A" ? "Vencedor SF 1" : "Vencedor SF 2";
  } else {
    label = `A definir ${slot}`;
  }
  return {
    id: `placeholder-${label.toLowerCase().replace(/\s/g, "-")}`,
    name: label,
    players: ["A definir", "A definir"],
    createdAt: "",
  };
};

const mapTeamFromDb = (dbTeam: any): Team => ({
  id: dbTeam.id,
  name: dbTeam.name,
  players: [dbTeam.player1, dbTeam.player2],
  createdAt: new Date().toISOString(),
  source: "manual",
});

const mapMatchFromDb = (dbMatch: any, allTeams: Team[], hasQF: boolean): Match => {
  const friendlyId = REVERSE_MATCH_ID_MAP[dbMatch.id] || dbMatch.id;
  
  const teamA = allTeams.find((t) => t.id === dbMatch.team_a_id) || getPlaceholderTeam(friendlyId, "A");
  const teamB = allTeams.find((t) => t.id === dbMatch.team_b_id) || getPlaceholderTeam(friendlyId, "B");
  
  let phase = dbMatch.phase;
  let tableNumber = 1;
  let sourceMatchAId: string | undefined = undefined;
  let sourceMatchBId: string | undefined = undefined;
  
  if (friendlyId.startsWith("qf-")) {
    phase = "Quartas de Final";
    tableNumber = parseInt(friendlyId.split("-")[1], 10);
  } else if (friendlyId.startsWith("sf-")) {
    phase = "Semifinal";
    tableNumber = parseInt(friendlyId.split("-")[1], 10);
    if (hasQF) {
      sourceMatchAId = tableNumber === 1 ? "qf-1" : "qf-3";
      sourceMatchBId = tableNumber === 1 ? "qf-2" : "qf-4";
    }
  } else if (friendlyId === "f-1") {
    phase = "Final";
    tableNumber = 1;
    sourceMatchAId = "sf-1";
    sourceMatchBId = "sf-2";
  }
  
  const scoreA = dbMatch.score_a || 0;
  const scoreB = dbMatch.score_b || 0;
  const status = dbMatch.status as Match["status"];
  
  let winnerId: string | undefined = undefined;
  if (status === "COMPLETED") {
    if (scoreA > scoreB) {
      winnerId = teamA.id;
    } else if (scoreB > scoreA) {
      winnerId = teamB.id;
    }
  }
  
  return {
    id: friendlyId,
    phase,
    status,
    teamA,
    teamB,
    scoreA,
    scoreB,
    setsA: dbMatch.sets_a || 0,
    setsB: dbMatch.sets_b || 0,
    tableNumber,
    sourceMatchAId,
    sourceMatchBId,
    detailedScore: { rounds: [] },
    winnerId,
    completedAt: status === "COMPLETED" ? Date.now() : undefined,
    finalScoreA: status === "COMPLETED" ? scoreA : undefined,
    finalScoreB: status === "COMPLETED" ? scoreB : undefined,
    finalSetsA: status === "COMPLETED" ? dbMatch.sets_a || 0 : undefined,
    finalSetsB: status === "COMPLETED" ? dbMatch.sets_b || 0 : undefined,
  };
};


const MOCK_TEAMS_4: Team[] = [
  {
    id: "team-1",
    name: "Os Imbatíveis de Copacabana",
    players: ["Carlos Silva", "Roberto Souza"],
    createdAt: new Date().toISOString(),
    source: "manual",
  },
  {
    id: "team-2",
    name: "Carrascos do Carroça",
    players: ["Bruno Lemos", "Lucas Mota"],
    createdAt: new Date().toISOString(),
    source: "manual",
  },
  {
    id: "team-3",
    name: "Sena de Ouro",
    players: ["Marcos Santos", "Thiago Lima"],
    createdAt: new Date().toISOString(),
    source: "manual",
  },
  {
    id: "team-4",
    name: "Mestres do Dominó",
    players: ["Diego Costa", "Felipe Rocha"],
    createdAt: new Date().toISOString(),
    source: "manual",
  },
];

const MOCK_TEAMS_8: Team[] = [
  ...MOCK_TEAMS_4,
  {
    id: "team-5",
    name: "Terno Seco Esporte Clube",
    players: ["Alexandre Mendes", "Gabriel Pinto"],
    createdAt: new Date().toISOString(),
    source: "manual",
  },
  {
    id: "team-6",
    name: "Dupla da Laje",
    players: ["Julio Cesar", "Rafael Alencar"],
    createdAt: new Date().toISOString(),
    source: "manual",
  },
  {
    id: "team-7",
    name: "Os Fechadores de Quadra",
    players: ["Leonardo Guedes", "Vinicius Junior"],
    createdAt: new Date().toISOString(),
    source: "manual",
  },
  {
    id: "team-8",
    name: "Bate-Lá-Bate-Cá",
    players: ["Rodrigo Faro", "Luciano Huck"],
    createdAt: new Date().toISOString(),
    source: "manual",
  },
];

interface TournamentContextType {
  teams: Team[];
  matches: Match[];
  events: TournamentEvent[];
  isAdmin: boolean;
  isAuthLoaded: boolean;
  login: (pin: string) => boolean;
  logout: () => void;
  handleAddTeam: (name: string, p1: string, p2: string) => void;
  handleImportTeams: (importedTeams: Team[]) => void;
  handleDeleteTeam: (id: string) => void;
  handleLoadMockTeams: (count: number) => void;
  handleGenerateBracket: (onNavigate?: () => void) => void;
  handleUpdateScore: (matchId: string, teamAScore: number, teamBScore: number) => void;
  handleSubtractPoint: (matchId: string, teamId: string) => void;
  handleAddRound: (matchId: string, round: Round, limit?: number) => void;
  handleStartMatch: (matchId: string) => void;
  handleFinishMatch: (matchId: string, winnerId: string) => void;
  handleUpdateMatch: (updatedMatch: Match) => void;
  handleSwapTeams: (srcMatchId: string, srcSlot: "A" | "B", destMatchId: string, destSlot: "A" | "B") => void;
  handleReplaceTeam: (matchId: string, slot: "A" | "B", newTeamId: string) => void;
  handleDeclareWO: (matchId: string, slotWithError: "A" | "B") => void;
}

const TournamentContext = createContext<TournamentContextType | undefined>(undefined);

export function TournamentProvider({ children }: { children: React.ReactNode }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [events, setEvents] = useState<TournamentEvent[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isAuthLoaded, setIsAuthLoaded] = useState<boolean>(false);

  // Load state from Supabase on mount
  useEffect(() => {
    const loadFromSupabase = async () => {
      try {
        const { data: dbTeams, error: teamsError } = await supabase
          .from("teams")
          .select("*");
        if (teamsError) throw teamsError;

        const { data: dbMatches, error: matchesError } = await supabase
          .from("matches")
          .select("*");
        if (matchesError) throw matchesError;

        const mappedTeams = (dbTeams || []).map(mapTeamFromDb);
        setTeams(mappedTeams);

        const hasQF = (dbMatches || []).some((m) => {
          const fid = REVERSE_MATCH_ID_MAP[m.id] || m.id;
          return fid.startsWith("qf-");
        });

        const mappedMatches = (dbMatches || []).map((m) =>
          mapMatchFromDb(m, mappedTeams, hasQF)
        );
        
        // Sort matches by friendly ID order
        const sortOrder = ["qf-1", "qf-2", "qf-3", "qf-4", "sf-1", "sf-2", "f-1"];
        mappedMatches.sort((a, b) => sortOrder.indexOf(a.id) - sortOrder.indexOf(b.id));
        setMatches(mappedMatches);
      } catch (err) {
        console.error("Erro ao carregar dados do Supabase:", err);
      } finally {
        setIsAuthLoaded(true);
      }
    };

    loadFromSupabase();

    const savedEvents = localStorage.getItem("sc_events");
    const savedAuth = localStorage.getItem("sc_admin_auth");
    if (savedEvents) setEvents(JSON.parse(savedEvents));
    if (savedAuth === "true") setIsAdmin(true);
  }, []);

  // Sync state helpers
  const saveTeams = (newTeams: Team[]) => {
    setTeams(newTeams);
    localStorage.setItem("sc_teams", JSON.stringify(newTeams));
  };

  const saveMatches = async (newMatches: Match[]) => {
    setMatches(newMatches);
    localStorage.setItem("sc_matches", JSON.stringify(newMatches));
    
    if (newMatches.length === 0) return;

    try {
      const dbMatches = newMatches.map((match) => {
        const dbId = MATCH_ID_MAP[match.id] || match.id;
        const teamAId = match.teamA.id.startsWith("placeholder-") ? null : match.teamA.id;
        const teamBId = match.teamB.id.startsWith("placeholder-") ? null : match.teamB.id;
        return {
          id: dbId,
          phase: match.phase,
          team_a_id: teamAId,
          team_b_id: teamBId,
          score_a: match.scoreA,
          score_b: match.scoreB,
          sets_a: match.setsA || 0,
          sets_b: match.setsB || 0,
          status: match.status
        };
      });

      const { error } = await supabase.from("matches").upsert(dbMatches);
      if (error) throw error;
    } catch (err) {
      console.error("Erro ao salvar partidas no Supabase:", err);
    }
  };

  const saveEvents = (newEventList: TournamentEvent[]) => {
    setEvents(newEventList);
    localStorage.setItem("sc_events", JSON.stringify(newEventList));
  };

  const addEvent = (description: string, type: TournamentEvent["type"], matchId?: string) => {
    const now = new Date();
    const timeStr = now.toTimeString().split(" ")[0]; // HH:MM:SS
    const newEvent: TournamentEvent = {
      id: `evt-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: timeStr,
      description,
      type,
      matchId,
    };
    setEvents((prev) => {
      const updated = [newEvent, ...prev];
      localStorage.setItem("sc_events", JSON.stringify(updated));
      return updated;
    });
  };

  // Auth Functions
  const login = (pin: string): boolean => {
    const adminPin = process.env.NEXT_PUBLIC_ADMIN_PIN || "painelAdmin123!";
    if (pin === adminPin) {
      setIsAdmin(true);
      localStorage.setItem("sc_admin_auth", "true");
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAdmin(false);
    localStorage.removeItem("sc_admin_auth");
  };

  // Team Actions
  const handleAddTeam = async (name: string, p1: string, p2: string) => {
    const newTeam: Team = {
      id: generateUUID(),
      name,
      players: [p1, p2],
      createdAt: new Date().toISOString(),
      source: "manual",
    };
    const updated = [...teams, newTeam];
    saveTeams(updated);

    try {
      const { error } = await supabase.from("teams").insert({
        id: newTeam.id,
        name: newTeam.name,
        player1: p1,
        player2: p2,
        status: "CONFIRMED"
      });
      if (error) throw error;
    } catch (err) {
      console.error("Erro ao adicionar dupla no Supabase:", err);
    }

    addEvent(`Dupla "${name}" (${p1} & ${p2}) se inscreveu no torneio.`, "INFO");
  };

  const handleImportTeams = async (importedTeams: Team[]) => {
    const existingIds = new Set(teams.map((t) => t.id));
    const newTeams = importedTeams
      .filter((t) => !existingIds.has(t.id))
      .map((t) => ({
        ...t,
        id: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t.id)
          ? t.id
          : generateUUID()
      }));
    
    if (newTeams.length > 0) {
      const updated = [...teams, ...newTeams];
      saveTeams(updated);

      try {
        const dbTeams = newTeams.map((team) => ({
          id: team.id,
          name: team.name,
          player1: team.players[0],
          player2: team.players[1],
          status: "CONFIRMED"
        }));
        const { error } = await supabase.from("teams").insert(dbTeams);
        if (error) throw error;
      } catch (err) {
        console.error("Erro ao importar duplas no Supabase:", err);
      }
      
      newTeams.forEach((team) => {
        const sourceLabel = team.source === "csv" ? "Arquivo CSV" : "Site Externo";
        addEvent(
          `Dupla "${team.name}" (${team.players[0]} & ${team.players[1]}) importada via ${sourceLabel}.`,
          "INFO"
        );
      });
    }
  };

  const handleDeleteTeam = async (id: string) => {
    const teamToRemove = teams.find((t) => t.id === id);
    const updated = teams.filter((t) => t.id !== id);
    saveTeams(updated);

    try {
      const { error } = await supabase.from("teams").delete().eq("id", id);
      if (error) throw error;
    } catch (err) {
      console.error("Erro ao deletar dupla no Supabase:", err);
    }

    if (teamToRemove) {
      addEvent(`Inscrição da dupla "${teamToRemove.name}" foi cancelada.`, "INFO");
    }
  };

  const handleLoadMockTeams = async (count: number) => {
    const mockToLoad = count === 8 ? MOCK_TEAMS_8 : MOCK_TEAMS_4;
    
    const mockWithUuids = mockToLoad.map((t) => ({
      ...t,
      id: generateUUID()
    }));

    try {
      await supabase.from("matches").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("teams").delete().neq("id", "00000000-0000-0000-0000-000000000000");

      const dbTeams = mockWithUuids.map((t) => ({
        id: t.id,
        name: t.name,
        player1: t.players[0],
        player2: t.players[1],
        status: "CONFIRMED"
      }));

      const { error } = await supabase.from("teams").insert(dbTeams);
      if (error) throw error;
    } catch (err) {
      console.error("Erro ao carregar duplas de demonstração no Supabase:", err);
    }

    setTeams(mockWithUuids);
    localStorage.setItem("sc_teams", JSON.stringify(mockWithUuids));
    setMatches([]);
    localStorage.removeItem("sc_matches");
    
    const clearedEvents: TournamentEvent[] = [];
    setEvents(clearedEvents);
    localStorage.setItem("sc_events", JSON.stringify(clearedEvents));
    
    const now = new Date();
    const timeStr = now.toTimeString().split(" ")[0];
    const initialEvent: TournamentEvent = {
      id: `evt-init`,
      timestamp: timeStr,
      description: `Carregadas ${count} duplas de demonstração para o torneio.`,
      type: "INFO",
    };
    saveEvents([initialEvent]);
  };

  // Generate Bracket Action
  const handleGenerateBracket = (onNavigate?: () => void) => {
    if (teams.length < 4) return;

    const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);
    const generatedMatches: Match[] = [];

    const now = new Date();
    const timeStr = now.toTimeString().split(" ")[0];
    const newEvents: TournamentEvent[] = [
      {
        id: `evt-start-${Date.now()}`,
        timestamp: timeStr,
        description: `Chaveamento oficial de Mata-Mata gerado! Boa sorte aos competidores!`,
        type: "TORNEIO_START",
      },
    ];

    if (teams.length >= 8) {
      const qfTeams = shuffledTeams.slice(0, 8);

      for (let i = 0; i < 4; i++) {
        const teamA = qfTeams[i * 2];
        const teamB = qfTeams[i * 2 + 1];
        generatedMatches.push({
          id: `qf-${i + 1}`,
          phase: "Quartas de Final",
          status: "SCHEDULED",
          teamA,
          teamB,
          scoreA: 0,
          scoreB: 0,
          detailedScore: { rounds: [] },
          tableNumber: i + 1,
        });
        
        newEvents.push({
          id: `evt-qf-${i}-${Date.now()}`,
          timestamp: timeStr,
          description: `Quartas de Final - Mesa ${i + 1}: ${teamA.name} vs ${teamB.name}`,
          type: "INFO",
        });
      }

      const dummyTeam = (label: string): Team => ({
        id: `placeholder-${label.toLowerCase().replace(/\s/g, "-")}`,
        name: label,
        players: ["A definir", "A definir"],
        createdAt: "",
      });

      generatedMatches.push({
        id: "sf-1",
        phase: "Semifinal",
        status: "SCHEDULED",
        teamA: dummyTeam("Vencedor QF 1"),
        teamB: dummyTeam("Vencedor QF 2"),
        scoreA: 0,
        scoreB: 0,
        detailedScore: { rounds: [] },
        tableNumber: 1,
        sourceMatchAId: "qf-1",
        sourceMatchBId: "qf-2",
      });

      generatedMatches.push({
        id: "sf-2",
        phase: "Semifinal",
        status: "SCHEDULED",
        teamA: dummyTeam("Vencedor QF 3"),
        teamB: dummyTeam("Vencedor QF 4"),
        scoreA: 0,
        scoreB: 0,
        detailedScore: { rounds: [] },
        tableNumber: 2,
        sourceMatchAId: "qf-3",
        sourceMatchBId: "qf-4",
      });

      generatedMatches.push({
        id: "f-1",
        phase: "Final",
        status: "SCHEDULED",
        teamA: dummyTeam("Vencedor SF 1"),
        teamB: dummyTeam("Vencedor SF 2"),
        scoreA: 0,
        scoreB: 0,
        detailedScore: { rounds: [] },
        tableNumber: 1,
        sourceMatchAId: "sf-1",
        sourceMatchBId: "sf-2",
      });

    } else {
      const sfTeams = shuffledTeams.slice(0, 4);

      for (let i = 0; i < 2; i++) {
        const teamA = sfTeams[i * 2];
        const teamB = sfTeams[i * 2 + 1];
        generatedMatches.push({
          id: `sf-${i + 1}`,
          phase: "Semifinal",
          status: "SCHEDULED",
          teamA,
          teamB,
          scoreA: 0,
          scoreB: 0,
          detailedScore: { rounds: [] },
          tableNumber: i + 1,
        });

        newEvents.push({
          id: `evt-sf-${i}-${Date.now()}`,
          timestamp: timeStr,
          description: `Semifinal - Mesa ${i + 1}: ${teamA.name} vs ${teamB.name}`,
          type: "INFO",
        });
      }

      const dummyTeam = (label: string): Team => ({
        id: `placeholder-${label.toLowerCase().replace(/\s/g, "-")}`,
        name: label,
        players: ["A definir", "A definir"],
        createdAt: "",
      });

      generatedMatches.push({
        id: "f-1",
        phase: "Final",
        status: "SCHEDULED",
        teamA: dummyTeam("Vencedor SF 1"),
        teamB: dummyTeam("Vencedor SF 2"),
        scoreA: 0,
        scoreB: 0,
        detailedScore: { rounds: [] },
        tableNumber: 1,
        sourceMatchAId: "sf-1",
        sourceMatchBId: "sf-2",
      });
    }

    const syncBracket = async () => {
      try {
        await supabase.from("matches").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      } catch (err) {
        console.error("Erro ao deletar partidas antigas no chaveamento:", err);
      }
      await saveMatches(generatedMatches);
    };

    syncBracket();
    saveEvents([...newEvents, ...events]);
    if (onNavigate) {
      onNavigate();
    }
  };

  // Scoreboard Adjustments
  const handleUpdateScore = (matchId: string, teamAScore: number, teamBScore: number) => {
    const updatedMatches = matches.map((m) => {
      if (m.id === matchId) {
        if (m.scoreA !== teamAScore || m.scoreB !== teamBScore) {
          addEvent(
            `Placar alterado na Mesa ${m.tableNumber} (${m.phase}): ${m.teamA.name} ${teamAScore} x ${teamBScore} ${m.teamB.name}`,
            "SCORE_CHANGE",
            matchId
          );
        }
        return { ...m, scoreA: teamAScore, scoreB: teamBScore };
      }
      return m;
    });
    saveMatches(updatedMatches);
  };

  const handleSubtractPoint = (matchId: string, teamId: string) => {
    const updatedMatches = matches.map((m) => {
      if (m.id === matchId) {
        const isTeamA = teamId === m.teamA.id;
        const currentScore = isTeamA ? m.scoreA : m.scoreB;
        if (currentScore <= 0) return m;

        const newScoreA = isTeamA ? Math.max(0, m.scoreA - 1) : m.scoreA;
        const newScoreB = !isTeamA ? Math.max(0, m.scoreB - 1) : m.scoreB;

        const rounds = [...m.detailedScore.rounds];
        let lastRoundIndex = -1;
        for (let i = rounds.length - 1; i >= 0; i--) {
          if (rounds[i].winnerTeamId === teamId) {
            lastRoundIndex = i;
            break;
          }
        }

        if (lastRoundIndex !== -1) {
          const round = { ...rounds[lastRoundIndex] };
          round.pointsGenerated -= 1;
          if (round.pointsGenerated <= 0) {
            rounds.splice(lastRoundIndex, 1);
          } else {
            rounds[lastRoundIndex] = round;
          }
        }

        addEvent(
          `Mesa ${m.tableNumber} (${m.phase}): Removido 1 ponto de "${isTeamA ? m.teamA.name : m.teamB.name}".`,
          "SCORE_CHANGE",
          matchId
        );

        return {
          ...m,
          scoreA: newScoreA,
          scoreB: newScoreB,
          detailedScore: {
            rounds,
          },
        };
      }
      return m;
    });
    saveMatches(updatedMatches);
  };

  // Add detailed Round Record
  const handleAddRound = (matchId: string, round: Round, limit: number = 4) => {
    const updatedMatches = matches.map((m) => {
      if (m.id === matchId) {
        if (round.winnerTeamId === "") {
          addEvent(
            `Mesa ${m.tableNumber} - Rodada ${round.roundNumber}: Rodada anulada (5 buchas).`,
            "INFO",
            matchId
          );
          return {
            ...m,
            detailedScore: {
              rounds: [...m.detailedScore.rounds, round],
            },
          };
        }

        const isTeamA = round.winnerTeamId === m.teamA.id;
        let newScoreA = m.scoreA + (isTeamA ? round.pointsGenerated : 0);
        let newScoreB = m.scoreB + (!isTeamA ? round.pointsGenerated : 0);

        const isBestOf3 = m.phase.toLowerCase() === "semifinal";
        let newSetsA = m.setsA || 0;
        let newSetsB = m.setsB || 0;

        if (isBestOf3) {
          if (newScoreA >= limit) {
            newSetsA += 1;
            newScoreA = 0;
            newScoreB = 0;
          } else if (newScoreB >= limit) {
            newSetsB += 1;
            newScoreA = 0;
            newScoreB = 0;
          }
        }

        const winnerName = isTeamA ? m.teamA.name : m.teamB.name;
        const noteText = round.note ? ` (${round.note})` : "";
        addEvent(
          `Mesa ${m.tableNumber} - Rodada ${round.roundNumber}: "${winnerName}" bateu o jogo e somou +${round.pointsGenerated} ponto(s)${noteText}!`,
          "ROUND_WIN",
          matchId
        );

        return {
          ...m,
          scoreA: newScoreA,
          scoreB: newScoreB,
          setsA: newSetsA,
          setsB: newSetsB,
          detailedScore: {
            rounds: [...m.detailedScore.rounds, round],
          },
        };
      }
      return m;
    });
    saveMatches(updatedMatches);
  };

  // Start a Match
  const handleStartMatch = (matchId: string) => {
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;

    if (match.teamA.id.startsWith("placeholder-") || match.teamB.id.startsWith("placeholder-")) {
      return;
    }

    const updated = matches.map((m) => {
      if (m.id === matchId) {
        addEvent(`Mesa ${m.tableNumber}: Confronto iniciado! ${m.teamA.name} vs ${m.teamB.name}`, "INFO", matchId);
        return { ...m, status: "LIVE" as const };
      }
      return m;
    });
    saveMatches(updated);
  };

  // Complete Match and Propagate Winner
  const handleFinishMatch = (matchId: string, winnerId: string) => {
    const targetMatch = matches.find((m) => m.id === matchId);
    if (!targetMatch) return;

    const isTeamA = winnerId === targetMatch.teamA.id;
    const winnerTeam = isTeamA ? targetMatch.teamA : targetMatch.teamB;
    const loserTeam = isTeamA ? targetMatch.teamB : targetMatch.teamA;
    const winnerScore = isTeamA ? targetMatch.scoreA : targetMatch.scoreB;
    const loserScore = isTeamA ? targetMatch.scoreB : targetMatch.scoreA;

    addEvent(
      `FIM DE JOGO! Mesa ${targetMatch.tableNumber}: "${winnerTeam.name}" venceu a partida contra "${loserTeam.name}" por ${winnerScore}x${loserScore} e avança no torneio!`,
      "MATCH_COMPLETED",
      matchId
    );

    let updatedMatches = matches.map((m) => {
      if (m.id === matchId) {
        return {
          ...m,
          status: "COMPLETED" as const,
          winnerId,
          completedAt: Date.now(),
          finalScoreA: m.scoreA,
          finalScoreB: m.scoreB,
          finalSetsA: m.setsA || 0,
          finalSetsB: m.setsB || 0,
        };
      }
      return m;
    });

    updatedMatches = updatedMatches.map((m) => {
      const updatedMatch = { ...m };
      
      if (m.sourceMatchAId === matchId) {
        updatedMatch.teamA = winnerTeam;
        addEvent(`Chaveamento Atualizado: "${winnerTeam.name}" avançou para ${m.phase} (Mesa ${m.tableNumber}).`, "INFO");
      }
      
      if (m.sourceMatchBId === matchId) {
        updatedMatch.teamB = winnerTeam;
        addEvent(`Chaveamento Atualizado: "${winnerTeam.name}" avançou para ${m.phase} (Mesa ${m.tableNumber}).`, "INFO");
      }

      const isTeamAReady = !updatedMatch.teamA.id.startsWith("placeholder-");
      const isTeamBReady = !updatedMatch.teamB.id.startsWith("placeholder-");
      if (updatedMatch.status === "SCHEDULED" && isTeamAReady && isTeamBReady) {
        updatedMatch.status = "SCHEDULED";
      }

      return updatedMatch;
    });

    if (matchId === "f-1") {
      addEvent(`🏆 PARABÉNS! A dupla "${winnerTeam.name}" é a grande CAMPEÃ do torneio de Dominó SportConnect! 🏆`, "MATCH_COMPLETED");
    }

    saveMatches(updatedMatches);
  };

  // Update a Match from Bracket Edit mode
  const handleUpdateMatch = (updatedMatch: Match) => {
    if (updatedMatch.status === "COMPLETED" && updatedMatch.winnerId) {
      updatedMatch.completedAt = updatedMatch.completedAt || Date.now();
      updatedMatch.finalScoreA = updatedMatch.scoreA;
      updatedMatch.finalScoreB = updatedMatch.scoreB;
      updatedMatch.finalSetsA = updatedMatch.setsA || 0;
      updatedMatch.finalSetsB = updatedMatch.setsB || 0;
    }
    let updatedMatches = matches.map((m) => (m.id === updatedMatch.id ? updatedMatch : m));

    if (updatedMatch.status === "COMPLETED" && updatedMatch.winnerId) {
      const winnerTeam = updatedMatch.winnerId === updatedMatch.teamA.id ? updatedMatch.teamA : updatedMatch.teamB;

      addEvent(
        `Mesa ${updatedMatch.tableNumber}: Confronto Finalizado via painel de edição! Vencedor: ${winnerTeam.name} (${updatedMatch.scoreA}x${updatedMatch.scoreB})`,
        "MATCH_COMPLETED",
        updatedMatch.id
      );

      updatedMatches = updatedMatches.map((m) => {
        const nextMatch = { ...m };
        if (m.sourceMatchAId === updatedMatch.id) {
          nextMatch.teamA = winnerTeam;
          addEvent(`Chaveamento Atualizado: "${winnerTeam.name}" avançou para ${m.phase} (Mesa ${m.tableNumber}).`, "INFO");
        }
        if (m.sourceMatchBId === updatedMatch.id) {
          nextMatch.teamB = winnerTeam;
          addEvent(`Chaveamento Atualizado: "${winnerTeam.name}" avançou para ${m.phase} (Mesa ${m.tableNumber}).`, "INFO");
        }
        const isTeamAReady = !nextMatch.teamA.id.startsWith("placeholder-");
        const isTeamBReady = !nextMatch.teamB.id.startsWith("placeholder-");
        if (nextMatch.status === "SCHEDULED" && isTeamAReady && isTeamBReady) {
          nextMatch.status = "SCHEDULED";
        }
        return nextMatch;
      });

      if (updatedMatch.id === "f-1") {
        addEvent(`🏆 PARABÉNS! A dupla "${winnerTeam.name}" é a grande CAMPEÃ do torneio de Dominó SportConnect! 🏆`, "MATCH_COMPLETED");
      }
    } else {
      addEvent(
        `Partida da Mesa ${updatedMatch.tableNumber} (${updatedMatch.phase}) editada pelo organizador.`,
        "INFO",
        updatedMatch.id
      );
    }

    saveMatches(updatedMatches);
  };

  // Swap teams between two slots in the tournament bracket
  const handleSwapTeams = (
    srcMatchId: string,
    srcSlot: "A" | "B",
    destMatchId: string,
    destSlot: "A" | "B"
  ) => {
    if (srcMatchId === destMatchId && srcSlot === destSlot) return;

    const srcMatch = matches.find((m) => m.id === srcMatchId);
    const destMatch = matches.find((m) => m.id === destMatchId);
    if (!srcMatch || !destMatch) return;

    const srcTeam = srcSlot === "A" ? srcMatch.teamA : srcMatch.teamB;
    const destTeam = destSlot === "A" ? destMatch.teamA : destMatch.teamB;

    const updatedMatches = matches.map((m) => {
      if (m.id === srcMatchId) {
        return {
          ...m,
          teamA: srcSlot === "A" ? destTeam : m.teamA,
          teamB: srcSlot === "B" ? destTeam : m.teamB,
          scoreA: 0,
          scoreB: 0,
          setsA: 0,
          setsB: 0,
          detailedScore: { rounds: [] },
          status: "SCHEDULED" as const,
          winnerId: undefined,
        };
      }
      if (m.id === destMatchId) {
        return {
          ...m,
          teamA: destSlot === "A" ? srcTeam : m.teamA,
          teamB: destSlot === "B" ? srcTeam : m.teamB,
          scoreA: 0,
          scoreB: 0,
          setsA: 0,
          setsB: 0,
          detailedScore: { rounds: [] },
          status: "SCHEDULED" as const,
          winnerId: undefined,
        };
      }
      return m;
    });

    saveMatches(updatedMatches);
    addEvent(
      `Chaveamento: Troca rápida de times efetuada entre "${srcTeam.name}" (Mesa ${srcMatch.tableNumber}) e "${destTeam.name}" (Mesa ${destMatch.tableNumber}).`,
      "INFO"
    );
  };

  // Replace a team in a match slot, swapping if they are already in the bracket
  const handleReplaceTeam = (matchId: string, slot: "A" | "B", newTeamId: string) => {
    const selectedTeam = teams.find((t) => t.id === newTeamId);
    if (!selectedTeam) return;

    const existingMatch = matches.find((m) => m.teamA.id === newTeamId || m.teamB.id === newTeamId);

    let updatedMatches;
    if (existingMatch) {
      const existingSlot = existingMatch.teamA.id === newTeamId ? "A" : "B";
      updatedMatches = matches.map((m) => {
        if (m.id === matchId) {
          return {
            ...m,
            teamA: slot === "A" ? selectedTeam : m.teamA,
            teamB: slot === "B" ? selectedTeam : m.teamB,
            scoreA: 0,
            scoreB: 0,
            setsA: 0,
            setsB: 0,
            detailedScore: { rounds: [] },
            status: "SCHEDULED" as const,
            winnerId: undefined,
          };
        }
        if (m.id === existingMatch.id) {
          const targetMatch = matches.find((tm) => tm.id === matchId);
          const oldTeam = slot === "A" ? targetMatch?.teamA : targetMatch?.teamB;
          if (!oldTeam) return m;
          return {
            ...m,
            teamA: existingSlot === "A" ? oldTeam : m.teamA,
            teamB: existingSlot === "B" ? oldTeam : m.teamB,
            scoreA: 0,
            scoreB: 0,
            setsA: 0,
            setsB: 0,
            detailedScore: { rounds: [] },
            status: "SCHEDULED" as const,
            winnerId: undefined,
          };
        }
        return m;
      });
      addEvent(`Chaveamento: "${selectedTeam.name}" trocou de posição com outra dupla na mesa.`, "INFO");
    } else {
      updatedMatches = matches.map((m) => {
        if (m.id === matchId) {
          return {
            ...m,
            teamA: slot === "A" ? selectedTeam : m.teamA,
            teamB: slot === "B" ? selectedTeam : m.teamB,
            scoreA: 0,
            scoreB: 0,
            setsA: 0,
            setsB: 0,
            detailedScore: { rounds: [] },
            status: "SCHEDULED" as const,
            winnerId: undefined,
          };
        }
        return m;
      });
      addEvent(`Chaveamento: Dupla na mesa editada manualmente para "${selectedTeam.name}".`, "INFO");
    }

    saveMatches(updatedMatches);
  };

  // Declare W.O. victory for the other slot in a match
  const handleDeclareWO = (matchId: string, slotWithError: "A" | "B") => {
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;

    const winnerSlot = slotWithError === "A" ? "B" : "A";
    const winnerTeam = winnerSlot === "A" ? match.teamA : match.teamB;
    const loserTeam = slotWithError === "A" ? match.teamA : match.teamB;

    let updatedMatches = matches.map((m) => {
      if (m.id === matchId) {
        return {
          ...m,
          status: "COMPLETED" as const,
          scoreA: winnerSlot === "A" ? 4 : 0,
          scoreB: winnerSlot === "B" ? 4 : 0,
          winnerId: winnerTeam.id,
          completedAt: Date.now(),
          finalScoreA: winnerSlot === "A" ? 4 : 0,
          finalScoreB: winnerSlot === "B" ? 4 : 0,
          finalSetsA: winnerSlot === "A" ? 2 : 0,
          finalSetsB: winnerSlot === "B" ? 2 : 0,
          isWO: true,
          woSlot: slotWithError,
        };
      }
      return m;
    });

    updatedMatches = updatedMatches.map((m) => {
      const nextMatch = { ...m };
      if (m.sourceMatchAId === matchId) {
        nextMatch.teamA = winnerTeam;
        addEvent(`Chaveamento Atualizado (W.O.): "${winnerTeam.name}" avançou para ${m.phase} (Mesa ${m.tableNumber}).`, "INFO");
      }
      if (m.sourceMatchBId === matchId) {
        nextMatch.teamB = winnerTeam;
        addEvent(`Chaveamento Atualizado (W.O.): "${winnerTeam.name}" avançou para ${m.phase} (Mesa ${m.tableNumber}).`, "INFO");
      }
      const isTeamAReady = !nextMatch.teamA.id.startsWith("placeholder-");
      const isTeamBReady = !nextMatch.teamB.id.startsWith("placeholder-");
      if (nextMatch.status === "SCHEDULED" && isTeamAReady && isTeamBReady) {
        nextMatch.status = "SCHEDULED";
      }
      return nextMatch;
    });

    addEvent(
      `Vitória por W.O. declarada para "${winnerTeam.name}" devido à ausência/desclassificação de "${loserTeam.name}" na Mesa ${match.tableNumber}.`,
      "MATCH_COMPLETED",
      matchId
    );

    if (matchId === "f-1") {
      addEvent(`🏆 PARABÉNS! A dupla "${winnerTeam.name}" é a grande CAMPEÃ do torneio de Dominó SportConnect! 🏆`, "MATCH_COMPLETED");
    }

    saveMatches(updatedMatches);
  };

  return (
    <TournamentContext.Provider
      value={{
        teams,
        matches,
        events,
        isAdmin,
        isAuthLoaded,
        login,
        logout,
        handleAddTeam,
        handleImportTeams,
        handleDeleteTeam,
        handleLoadMockTeams,
        handleGenerateBracket,
        handleUpdateScore,
        handleSubtractPoint,
        handleAddRound,
        handleStartMatch,
        handleFinishMatch,
        handleUpdateMatch,
        handleSwapTeams,
        handleReplaceTeam,
        handleDeclareWO,
      }}
    >
      {children}
    </TournamentContext.Provider>
  );
}

export function useTournament() {
  const context = useContext(TournamentContext);
  if (context === undefined) {
    throw new Error("useTournament must be used within a TournamentProvider");
  }
  return context;
}
