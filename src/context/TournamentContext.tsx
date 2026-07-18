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

export const BYE_TEAM: Team = {
  id: "bye",
  name: "Chapéu / Folga",
  players: ["Folga", "Folga"],
  createdAt: "",
};

const codeToPrefix: Record<number, string> = {
  1: "f",
  2: "sf",
  3: "qf",
  4: "of",
  5: "dsa"
};

const prefixToCode: Record<string, number> = {
  f: 1,
  sf: 2,
  qf: 3,
  of: 4,
  dsa: 5
};

const getPrevPrefix = (currentPrefix: string): string => {
  if (currentPrefix === "f") return "sf";
  if (currentPrefix === "sf") return "qf";
  if (currentPrefix === "qf") return "of";
  if (currentPrefix === "of") return "dsa";
  if (currentPrefix === "dsa") return "r4";
  if (currentPrefix.startsWith("r")) {
    const num = parseInt(currentPrefix.slice(1), 10);
    if (!isNaN(num) && num > 1) {
      return `r${num - 1}`;
    }
  }
  return "";
};

export const getUuidForMatchId = (friendlyId: string): string => {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(friendlyId) && !friendlyId.startsWith("00000000-0000-0000-0000-")) {
    return friendlyId;
  }
  const parts = friendlyId.split("-");
  if (parts.length === 2) {
    const prefix = parts[0];
    const index = parseInt(parts[1], 10);
    let code = 0;
    if (prefixToCode[prefix]) {
      code = prefixToCode[prefix];
    } else if (prefix.startsWith("r")) {
      const num = parseInt(prefix.slice(1), 10);
      if (!isNaN(num)) {
        code = 10 + num;
      }
    }
    if (code > 0 && !isNaN(index)) {
      return `00000000-0000-0000-0000-${code.toString().padStart(4, "0")}${index.toString().padStart(8, "0")}`;
    }
  }
  return MATCH_ID_MAP[friendlyId] || friendlyId;
};

export const getFriendlyIdFromUuid = (uuid: string): string => {
  if (uuid.startsWith("00000000-0000-0000-0000-")) {
    const suffix = uuid.replace("00000000-0000-0000-0000-", "");
    if (suffix.length === 12) {
      const code = parseInt(suffix.slice(0, 4), 10);
      const index = parseInt(suffix.slice(4), 10);
      if (!isNaN(code) && !isNaN(index)) {
        if (codeToPrefix[code]) {
          return `${codeToPrefix[code]}-${index}`;
        } else if (code > 10) {
          return `r${code - 10}-${index}`;
        }
      }
    }
  }
  return REVERSE_MATCH_ID_MAP[uuid] || uuid;
};

const getPlaceholderTeam = (matchFriendlyId: string, slot: "A" | "B"): Team => {
  let label = `A definir ${slot}`;
  const parts = matchFriendlyId.split("-");
  if (parts.length === 2) {
    const prefix = parts[0];
    const index = parseInt(parts[1], 10);
    const prevPrefix = getPrevPrefix(prefix);
    if (prevPrefix) {
      const srcIndex = slot === "A" ? index * 2 - 1 : index * 2;
      const prevPhaseShort = prevPrefix.toUpperCase();
      label = `Vencedor ${prevPhaseShort} ${srcIndex}`;
    }
  }
  return {
    id: `placeholder-${label.toLowerCase().replace(/\s/g, "-")}`,
    name: label,
    players: ["A definir", "A definir"],
    createdAt: "",
  };
};

const getPhaseNameFromPrefix = (prefix: string): string => {
  if (prefix === "f") return "Final";
  if (prefix === "sf") return "Semifinal";
  if (prefix === "qf") return "Quartas de Final";
  if (prefix === "of") return "Oitavas de Final";
  if (prefix === "dsa") return "Dezesseis-avos de Final";
  if (prefix.startsWith("r")) {
    const num = parseInt(prefix.slice(1), 10);
    if (!isNaN(num)) {
      return `Fase de ${Math.pow(2, num)}`;
    }
  }
  return "Fase Inicial";
};

const getRoundInfo = (roundIndex: number, totalRounds: number) => {
  const diff = totalRounds - 1 - roundIndex;
  if (diff === 0) {
    return { prefix: "f", phase: "Final" };
  } else if (diff === 1) {
    return { prefix: "sf", phase: "Semifinal" };
  } else if (diff === 2) {
    return { prefix: "qf", phase: "Quartas de Final" };
  } else if (diff === 3) {
    return { prefix: "of", phase: "Oitavas de Final" };
  } else if (diff === 4) {
    return { prefix: "dsa", phase: "Dezesseis-avos de Final" };
  } else {
    return { prefix: `r${roundIndex + 1}`, phase: `Fase de ${Math.pow(2, diff + 1)}` };
  }
};

export const compareMatchIds = (idA: string, idB: string): number => {
  const parseMatchId = (id: string) => {
    const parts = id.split("-");
    if (parts.length === 2) {
      const prefix = parts[0];
      const index = parseInt(parts[1], 10);
      let roundCode = 0;
      if (prefixToCode[prefix]) {
        roundCode = prefixToCode[prefix];
      } else if (prefix.startsWith("r")) {
        const num = parseInt(prefix.slice(1), 10);
        if (!isNaN(num)) {
          roundCode = 10 + num;
        }
      }
      return { roundCode, index: isNaN(index) ? 0 : index };
    }
    return { roundCode: 999, index: 0 };
  };

  const a = parseMatchId(idA);
  const b = parseMatchId(idB);

  if (a.roundCode !== b.roundCode) {
    return b.roundCode - a.roundCode;
  }
  return a.index - b.index;
};

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

const mapTeamFromDb = (dbTeam: any): Team => ({
  id: dbTeam.id,
  name: dbTeam.name,
  players: [dbTeam.player1, dbTeam.player2],
  createdAt: new Date().toISOString(),
  source: "manual",
  status: dbTeam.status,
});

const mapMatchFromDb = (dbMatch: any, allTeams: Team[], dbMatches: any[]): Match => {
  const friendlyId = getFriendlyIdFromUuid(dbMatch.id);
  const parts = friendlyId.split("-");
  const prefix = parts[0];
  const index = parts.length === 2 ? parseInt(parts[1], 10) : 1;
  const tableNumber = isNaN(index) ? 1 : index;

  const prevPrefix = getPrevPrefix(prefix);
  const isFirstRoundMatch = !prevPrefix || !dbMatches.some((dm) => {
    const fid = getFriendlyIdFromUuid(dm.id);
    return fid.startsWith(prevPrefix + "-");
  });

  const teamA = dbMatch.team_a_id === "bye"
    ? BYE_TEAM
    : allTeams.find((t) => t.id === dbMatch.team_a_id) || (isFirstRoundMatch && dbMatch.team_a_id === null ? BYE_TEAM : getPlaceholderTeam(friendlyId, "A"));

  const teamB = dbMatch.team_b_id === "bye"
    ? BYE_TEAM
    : allTeams.find((t) => t.id === dbMatch.team_b_id) || (isFirstRoundMatch && dbMatch.team_b_id === null ? BYE_TEAM : getPlaceholderTeam(friendlyId, "B"));

  const phase = dbMatch.phase || getPhaseNameFromPrefix(prefix);
  const scoreA = dbMatch.score_a || 0;
  const scoreB = dbMatch.score_b || 0;
  const status = dbMatch.status as Match["status"];

  let winnerId: string | undefined = undefined;
  if (status === "COMPLETED") {
    if (scoreA > scoreB) {
      winnerId = teamA.id;
    } else if (scoreB > scoreA) {
      winnerId = teamB.id;
    } else if (teamA.id === "bye") {
      winnerId = teamB.id;
    } else if (teamB.id === "bye") {
      winnerId = teamA.id;
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

  // Load state from Supabase on mount and subscribe to realtime updates
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

        const rawDbMatches = dbMatches || [];
        const mappedMatches = rawDbMatches.map((m) =>
          mapMatchFromDb(m, mappedTeams, rawDbMatches)
        );
        
        // Assign sourceMatchAId and sourceMatchBId if the source matches exist in loaded matches
        const matchIds = new Set(mappedMatches.map((m) => m.id));
        mappedMatches.forEach((m) => {
          const parts = m.id.split("-");
          if (parts.length === 2) {
            const prefix = parts[0];
            const index = parseInt(parts[1], 10);
            const prevPrefix = getPrevPrefix(prefix);
            if (prevPrefix) {
              const srcA = `${prevPrefix}-${index * 2 - 1}`;
              const srcB = `${prevPrefix}-${index * 2}`;
              if (matchIds.has(srcA)) m.sourceMatchAId = srcA;
              if (matchIds.has(srcB)) m.sourceMatchBId = srcB;
            }
          }
        });

        // Sort matches dynamically
        mappedMatches.sort((a, b) => compareMatchIds(a.id, b.id));
        setMatches(mappedMatches);
      } catch (err) {
        console.error("Erro ao carregar dados do Supabase:", err);
      } finally {
        setIsAuthLoaded(true);
      }
    };

    loadFromSupabase();

    // Subscribe to realtime database changes on matches and teams
    const channel = supabase
      .channel("public:realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches" },
        (payload) => {
          console.log("Mudança recebida em tempo real nas partidas:", payload);
          loadFromSupabase();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams" },
        (payload) => {
          console.log("Mudança recebida em tempo real nas equipes:", payload);
          loadFromSupabase();
        }
      )
      .subscribe();

    const savedEvents = localStorage.getItem("sc_events");
    const savedAuth = localStorage.getItem("sc_admin_auth");
    if (savedEvents) setEvents(JSON.parse(savedEvents));
    if (savedAuth === "true") setIsAdmin(true);

    return () => {
      supabase.removeChannel(channel);
    };
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
        const dbId = getUuidForMatchId(match.id);
        const teamAId = match.teamA.id.startsWith("placeholder-") || match.teamA.id === "bye" ? null : match.teamA.id;
        const teamBId = match.teamB.id.startsWith("placeholder-") || match.teamB.id === "bye" ? null : match.teamB.id;
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
    if (!teamToRemove) return;

    const hasMatches = matches.some((m) => m.teamA.id === id || m.teamB.id === id);

    try {
      if (hasMatches) {
        // 1. Remove as partidas associadas a essa dupla no Supabase
        const { error: matchesError } = await supabase
          .from("matches")
          .delete()
          .or(`team_a_id.eq.${id},team_b_id.eq.${id}`);
        if (matchesError) throw matchesError;
      }

      // 2. Agora apaga a dupla com segurança
      const { error: teamError } = await supabase.from("teams").delete().eq("id", id);
      if (teamError) throw teamError;

      // 3. Atualiza os estados locais
      const updatedTeams = teams.filter((t) => t.id !== id);
      saveTeams(updatedTeams);

      if (hasMatches) {
        // Limpa completamente a chave de confrontos local e no banco
        setMatches([]);
        localStorage.removeItem("sc_matches");
        await supabase
          .from("matches")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");

        addEvent(`Chaveamento resetado devido à exclusão da dupla "${teamToRemove.name}".`, "INFO");
      }

      addEvent(`Inscrição da dupla "${teamToRemove.name}" foi cancelada.`, "INFO");
    } catch (err: any) {
      console.error("Erro ao deletar dupla no Supabase:", err);
      if (typeof window !== "undefined") {
        window.alert("Não foi possível apagar esta dupla. Tente resetar o chaveamento primeiro.");
      }
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
    const confirmedTeams = teams.filter((t) => !t.status || t.status === "CONFIRMED");
    if (confirmedTeams.length < 2) return;

    const shuffledTeams = [...confirmedTeams].sort(() => Math.random() - 0.5);
    const N = shuffledTeams.length;

    let P = 2;
    while (P < N) {
      P *= 2;
    }

    const totalRounds = Math.log2(P);
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

    const matchesMap = new Map<string, Match>();

    // Generate Round 1 (Round 0)
    const firstRoundMatchCount = P / 2;
    const { prefix: firstRoundPrefix, phase: firstRoundPhase } = getRoundInfo(0, totalRounds);
    const numByes = P - N;

    for (let i = 0; i < firstRoundMatchCount; i++) {
      const matchIndex = i + 1;
      const friendlyId = `${firstRoundPrefix}-${matchIndex}`;

      let teamA: Team;
      let teamB: Team;

      if (i < numByes) {
        teamA = shuffledTeams[i];
        teamB = BYE_TEAM;
      } else {
        const offset = numByes + (i - numByes) * 2;
        teamA = shuffledTeams[offset];
        teamB = shuffledTeams[offset + 1];
      }

      const isByeMatch = teamA.id === "bye" || teamB.id === "bye";

      const match: Match = {
        id: friendlyId,
        phase: firstRoundPhase,
        status: isByeMatch ? "COMPLETED" : "SCHEDULED",
        teamA,
        teamB,
        scoreA: isByeMatch ? (teamA.id === "bye" ? 0 : 1) : 0,
        scoreB: isByeMatch ? (teamB.id === "bye" ? 0 : 1) : 0,
        detailedScore: { rounds: [] },
        tableNumber: matchIndex,
        winnerId: isByeMatch ? (teamA.id === "bye" ? teamB.id : teamA.id) : undefined,
        completedAt: isByeMatch ? Date.now() : undefined,
        finalScoreA: isByeMatch ? (teamA.id === "bye" ? 0 : 1) : undefined,
        finalScoreB: isByeMatch ? (teamB.id === "bye" ? 0 : 1) : undefined,
        finalSetsA: 0,
        finalSetsB: 0,
      };

      generatedMatches.push(match);
      matchesMap.set(friendlyId, match);

      if (isByeMatch) {
        const winner = teamA.id === "bye" ? teamB : teamA;
        newEvents.push({
          id: `evt-bye-${friendlyId}-${Date.now()}`,
          timestamp: timeStr,
          description: `Avanço Automático: "${winner.name}" avançou na primeira rodada por Chapéu/Folga.`,
          type: "INFO",
        });
      } else {
        newEvents.push({
          id: `evt-init-${friendlyId}-${Date.now()}`,
          timestamp: timeStr,
          description: `${firstRoundPhase} - Mesa ${matchIndex}: ${teamA.name} vs ${teamB.name}`,
          type: "INFO",
        });
      }
    }

    // Generate Subsequent Rounds
    for (let r = 1; r < totalRounds; r++) {
      const matchCount = P / Math.pow(2, r + 1);
      const { prefix: roundPrefix, phase: roundPhase } = getRoundInfo(r, totalRounds);
      const { prefix: prevRoundPrefix } = getRoundInfo(r - 1, totalRounds);

      for (let i = 0; i < matchCount; i++) {
        const matchIndex = i + 1;
        const friendlyId = `${roundPrefix}-${matchIndex}`;

        const sourceMatchAId = `${prevRoundPrefix}-${matchIndex * 2 - 1}`;
        const sourceMatchBId = `${prevRoundPrefix}-${matchIndex * 2}`;

        const sourceMatchA = matchesMap.get(sourceMatchAId)!;
        const sourceMatchB = matchesMap.get(sourceMatchBId)!;

        const teamA = sourceMatchA.status === "COMPLETED" && sourceMatchA.winnerId
          ? (sourceMatchA.winnerId === sourceMatchA.teamA.id ? sourceMatchA.teamA : sourceMatchA.teamB)
          : getPlaceholderTeam(friendlyId, "A");

        const teamB = sourceMatchB.status === "COMPLETED" && sourceMatchB.winnerId
          ? (sourceMatchB.winnerId === sourceMatchB.teamA.id ? sourceMatchB.teamA : sourceMatchB.teamB)
          : getPlaceholderTeam(friendlyId, "B");

        const match: Match = {
          id: friendlyId,
          phase: roundPhase,
          status: "SCHEDULED",
          teamA,
          teamB,
          scoreA: 0,
          scoreB: 0,
          detailedScore: { rounds: [] },
          tableNumber: matchIndex,
          sourceMatchAId,
          sourceMatchBId,
        };

        generatedMatches.push(match);
        matchesMap.set(friendlyId, match);
      }
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

    if (match.teamA.id.startsWith("placeholder-") || match.teamB.id.startsWith("placeholder-") ||
        match.teamA.id === "bye" || match.teamB.id === "bye") {
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
