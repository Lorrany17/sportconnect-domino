/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Team, Match, Round, TournamentEvent, Tournament, SportType } from "@/types";
import { supabase } from "@/lib/supabase";
import { completeMatchAction } from "@/app/actions/bracket";

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
  roster: dbTeam.roster,
  createdAt: dbTeam.created_at || new Date().toISOString(),
  source: "manual",
  status: dbTeam.status,
  tournamentId: dbTeam.tournament_id,
  payment_status: dbTeam.payment_status || (dbTeam.status === "CONFIRMED" || dbTeam.status === "PAID" ? "PAID" : "PENDING"),
  payout_status: dbTeam.payout_status || "PENDING",
  payout_amount: dbTeam.payout_amount ? Number(dbTeam.payout_amount) : undefined,
  payment_proof_url: dbTeam.payment_proof_url,
  manager_name: dbTeam.manager_name || dbTeam.player1,
  category: dbTeam.category || "Amador A",
  cancellation_status: dbTeam.cancellation_status,
  mp_payment_id: dbTeam.mp_payment_id,
  contact: dbTeam.contact,
  user_id: dbTeam.user_id,
  custom_registration_answers: dbTeam.custom_registration_answers,
});

const extractSetsFromDbMatch = (dbMatch: any): any[] => {
  const candidates: any[] = [
    dbMatch.sets_history,
    dbMatch.set_history,
    dbMatch.history,
    dbMatch.details?.sets,
    dbMatch.details?.set_history,
    dbMatch.details?.sets_history,
    dbMatch.detailed_score?.sets,
    dbMatch.historicoSets,
    dbMatch.historico_sets,
  ];

  if (typeof dbMatch.details === "string") {
    try {
      const pd = JSON.parse(dbMatch.details);
      if (Array.isArray(pd)) candidates.push(pd);
      if (Array.isArray(pd?.sets)) candidates.push(pd.sets);
      if (Array.isArray(pd?.set_history)) candidates.push(pd.set_history);
    } catch {}
  }

  if (typeof dbMatch.detailed_score === "string") {
    try {
      const pds = JSON.parse(dbMatch.detailed_score);
      if (Array.isArray(pds)) candidates.push(pds);
      if (Array.isArray(pds?.sets)) candidates.push(pds.sets);
    } catch {}
  }

  for (const cand of candidates) {
    if (!cand) continue;
    let val = cand;
    if (typeof val === "string") {
      try {
        val = JSON.parse(val);
      } catch {
        val = null;
      }
    }
    if (Array.isArray(val) && val.length > 0) {
      return val;
    }
  }

  return [];
};

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

  // Prioriza o winner_id persistido no banco; caso ausente, aplica lógica estrita por sets ou score
  let winnerId: string | undefined = dbMatch.winner_id || undefined;
  if (status === "COMPLETED" && !winnerId) {
    const setsA = dbMatch.sets_a || 0;
    const setsB = dbMatch.sets_b || 0;
    const isSetsSport = setsA > 0 || setsB > 0;
    if (isSetsSport && setsA !== setsB) {
      winnerId = setsA > setsB ? teamA.id : teamB.id;
    } else if (scoreA > scoreB) {
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
    setsVencidosTimeA: dbMatch.sets_a || 0,
    setsVencidosTimeB: dbMatch.sets_b || 0,
    tableNumber,
    historicoSets: extractSetsFromDbMatch(dbMatch),
    sets_history: extractSetsFromDbMatch(dbMatch),
    set_history: extractSetsFromDbMatch(dbMatch),
    history: extractSetsFromDbMatch(dbMatch),
    detailedScore:
      dbMatch.detailed_score ||
      (dbMatch.details?.rounds ? { rounds: dbMatch.details.rounds } : { rounds: [] }),
    penaltiesA: dbMatch.penalties_a ?? 0,
    penaltiesB: dbMatch.penalties_b ?? 0,
    penalties_a: dbMatch.penalties_a ?? 0,
    penalties_b: dbMatch.penalties_b ?? 0,
    score_a: scoreA,
    score_b: scoreB,
    sets_a: dbMatch.sets_a || 0,
    sets_b: dbMatch.sets_b || 0,
    team_a_id: dbMatch.team_a_id || dbMatch.team1_id,
    team_b_id: dbMatch.team_b_id || dbMatch.team2_id,
    winnerId,
    round: dbMatch.round,
    match_order: dbMatch.match_order,
    next_match_id: dbMatch.next_match_id,
    team1_id: dbMatch.team1_id || dbMatch.team_a_id,
    team2_id: dbMatch.team2_id || dbMatch.team_b_id,
    completedAt: status === "COMPLETED" ? Date.now() : undefined,
    finalScoreA: status === "COMPLETED" ? scoreA : undefined,
    finalScoreB: status === "COMPLETED" ? scoreB : undefined,
    finalSetsA: status === "COMPLETED" ? dbMatch.sets_a || 0 : undefined,
    finalSetsB: status === "COMPLETED" ? dbMatch.sets_b || 0 : undefined,
    tournamentId: dbMatch.tournament_id,
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
  tournaments: Tournament[];
  setTournaments: React.Dispatch<React.SetStateAction<Tournament[]>>;
  currentTournamentId: string | null;
  setCurrentTournamentId: (id: string | null) => void;
  currentSportType: SportType;
  setCurrentSportType: (sport: SportType) => void;
  isReadOnly: boolean;
  handleCreateTournament: (name: string, sportType?: SportType) => Promise<void>;
  handleFinishTournament: (id: string) => Promise<void>;
  handleDeleteTournament: (id: string) => Promise<void>;
  teams: Team[];
  setTeams: React.Dispatch<React.SetStateAction<Team[]>>;
  matches: Match[];
  events: TournamentEvent[];
  isAdmin: boolean;
  isAuthLoaded: boolean;
  login: (pin: string) => boolean;
  logout: () => void;
  handleAddTeam: (
    name: string,
    p1: string,
    p2?: string,
    roster?: string[],
    format?: 'solo' | 'duplas',
    paymentStatus?: string,
    category?: string
  ) => void;
  handleImportTeams: (importedTeams: Team[]) => void;
  handleDeleteTeam: (id: string) => void;
  handleLoadMockTeams: (count: number) => void;
  handleGenerateBracket: (onNavigate?: () => void) => void;
  handleUpdateScore: (matchId: string, teamAScore: number, teamBScore: number, extra?: { penaltiesA?: number; penaltiesB?: number }) => void;
  handleScorePoint: (matchId: string, teamSlot: "A" | "B", delta: number, isPenalty?: boolean) => void;
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
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [currentTournamentId, setCurrentTournamentId] = useState<string | null>(null);
  const [currentSportType, setCurrentSportType] = useState<SportType>("DOMINO");
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [events, setEvents] = useState<TournamentEvent[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isAuthLoaded, setIsAuthLoaded] = useState<boolean>(false);

  const currentTournament = tournaments.find((t) => t.id === currentTournamentId);
  const isReadOnly = currentTournament?.status === "FINALIZADO";

  // Sincroniza a modalidade esportiva quando o torneio atual mudar
  useEffect(() => {
    if (currentTournament?.sport_type) {
      setCurrentSportType(currentTournament.sport_type);
    }
  }, [currentTournament?.sport_type]);

  const loadTournaments = async () => {
    try {
      const { data: dbTournaments, error } = await supabase
        .from("tournaments")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      const mappedTournaments: Tournament[] = (dbTournaments || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        status: t.status as "ATIVO" | "FINALIZADO",
        createdAt: t.created_at,
        sport_type: (t.sport_type as SportType) || "DOMINO",
        owner_id: t.owner_id,
        max_teams: t.max_teams ? Number(t.max_teams) : undefined,
        entry_fee: t.entry_fee ? Number(t.entry_fee) : undefined,
        location: t.location,
        start_date: t.start_date,
        start_time: t.start_time,
        end_date: t.end_date,
        rules: t.rules,
        format: t.format,
        cover_url: t.cover_url,
        gender_category: t.gender_category,
        organizer_pix_key: t.organizer_pix_key,
        tournament_format: t.tournament_format,
        pix_key_type: t.pix_key_type,
        rulebook_url: t.rulebook_url,
        match_rules: t.match_rules,
        sponsors: t.sponsors || [],
        custom_registration_fields: t.custom_registration_fields,
        prize_first: t.prize_first,
        prize_second: t.prize_second,
        prize_third: t.prize_third,
        min_players: t.min_players,
        max_players: t.max_players,
        min_age: t.min_age,
        max_age: t.max_age,
      }));

      setTournaments(mappedTournaments);

      if (mappedTournaments.length > 0) {
        let selectedId = localStorage.getItem("sc_current_tournament_id");
        if (!selectedId || !mappedTournaments.some((t) => t.id === selectedId)) {
          selectedId = mappedTournaments[0].id;
          localStorage.setItem("sc_current_tournament_id", selectedId);
        }
        setCurrentTournamentId(selectedId);
      } else {
        const defaultId = generateUUID();
        const { data: newTour, error: insertError } = await supabase
          .from("tournaments")
          .insert({ id: defaultId, name: "Torneio Principal", status: "ATIVO", sport_type: "DOMINO" })
          .select()
          .single();
        
        if (!insertError && newTour) {
          const mappedDefault: Tournament = {
            id: newTour.id,
            name: newTour.name,
            status: newTour.status as "ATIVO" | "FINALIZADO",
            createdAt: newTour.created_at,
            sport_type: (newTour.sport_type as SportType) || "DOMINO"
          };
          setTournaments([mappedDefault]);
          setCurrentTournamentId(defaultId);
          localStorage.setItem("sc_current_tournament_id", defaultId);
        }
      }
    } catch (err) {
      console.error("Erro ao carregar torneios:", err);
    }
  };

  const loadTeamsAndMatches = async (tournamentId: string) => {
    if (!tournamentId) return;
    try {
      const { data: dbTeams, error: teamsError } = await supabase
        .from("teams")
        .select("*, cancellation_status")
        .eq("tournament_id", tournamentId);
      if (teamsError) throw teamsError;

      const { data: dbMatches, error: matchesError } = await supabase
        .from("matches")
        .select("*")
        .eq("tournament_id", tournamentId);
      if (matchesError) throw matchesError;

      const localTeamsJson = typeof window !== "undefined" ? localStorage.getItem("sc_teams") : null;
      const localTeamsMap: Record<string, any> = {};
      if (localTeamsJson) {
        try {
          const parsed = JSON.parse(localTeamsJson);
          parsed.forEach((pt: any) => {
            localTeamsMap[pt.id] = pt;
          });
        } catch (e) {
          console.error("Erro ao ler equipes locais:", e);
        }
      }

      const mappedTeams = (dbTeams || []).map((dbT) => {
        const team = mapTeamFromDb(dbT);
        const local = localTeamsMap[team.id];
        if (local) {
          if (local.roster) team.roster = local.roster;
          if (local.format) team.format = local.format;
        }
        return team;
      });
      setTeams(mappedTeams);

      const rawDbMatches = dbMatches || [];
      const mappedMatches = rawDbMatches.map((m) =>
        mapMatchFromDb(m, mappedTeams, rawDbMatches)
      );
      
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

      mappedMatches.sort((a, b) => compareMatchIds(a.id, b.id));

      // Preserva propriedades multiesportes (historicoSets, penalties) armazenadas localmente
      const localMatchesJson = localStorage.getItem("sc_matches");
      if (localMatchesJson) {
        try {
          const parsed = JSON.parse(localMatchesJson);
          const localMap: Record<string, any> = {};
          parsed.forEach((pm: any) => {
            localMap[pm.id] = pm;
          });
          mappedMatches.forEach((m) => {
            const local = localMap[m.id];
            if (local) {
              const localSets = local.sets_history || local.historicoSets || local.set_history;
              if (localSets && (!m.sets_history || (Array.isArray(m.sets_history) && m.sets_history.length === 0))) {
                m.sets_history = localSets;
                m.set_history = localSets;
                m.historicoSets = Array.isArray(localSets) ? localSets : [];
              }
              if (local.penaltiesA !== undefined) m.penaltiesA = local.penaltiesA;
              if (local.penaltiesB !== undefined) m.penaltiesB = local.penaltiesB;
              if (local.setsVencidosTimeA !== undefined) m.setsVencidosTimeA = local.setsVencidosTimeA;
              if (local.setsVencidosTimeB !== undefined) m.setsVencidosTimeB = local.setsVencidosTimeB;
              if (local.detailedScore?.rounds?.length > 0) m.detailedScore = local.detailedScore;
            }
          });
        } catch (e) {
          console.error("Erro ao mesclar partidas locais:", e);
        }
      }

      setMatches(mappedMatches);
    } catch (err) {
      console.error("Erro ao carregar dados do Supabase:", err);
    } finally {
      setIsAuthLoaded(true);
    }
  };

  useEffect(() => {
    const init = async () => {
      await loadTournaments();
      setIsAuthLoaded(true);
    };
    init();

    const savedEvents = localStorage.getItem("sc_events");
    const savedAuth = localStorage.getItem("sc_admin_auth");
    if (savedEvents) setEvents(JSON.parse(savedEvents));
    if (savedAuth === "true") setIsAdmin(true);

    // Sincroniza isAdmin com sessão do Supabase Auth
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setIsAdmin(true);
      }
    });

    const {
      data: { subscription: authSub },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setIsAdmin(true);
      } else if (localStorage.getItem("sc_admin_auth") !== "true") {
        setIsAdmin(false);
      }
    });

    return () => {
      authSub.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!currentTournamentId) return;

    loadTeamsAndMatches(currentTournamentId);

    const channel = supabase
      .channel(`public:realtime:${currentTournamentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
          filter: `tournament_id=eq.${currentTournamentId}`
        },
        (payload) => {
          console.log("Mudança recebida em tempo real nas partidas:", payload);
          loadTeamsAndMatches(currentTournamentId);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "teams",
          filter: `tournament_id=eq.${currentTournamentId}`
        },
        (payload) => {
          console.log("Mudança recebida em tempo real nas equipes:", payload);
          loadTeamsAndMatches(currentTournamentId);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournaments" },
        (payload) => {
          console.log("Mudança recebida em tempo real nos torneios:", payload);
          loadTournaments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentTournamentId]);

  // Sync state helpers
  const saveTeams = (newTeams: Team[]) => {
    setTeams(newTeams);
    localStorage.setItem("sc_teams", JSON.stringify(newTeams));
  };

  const saveMatches = async (newMatches: Match[]) => {
    if (!currentTournamentId) return;
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
          team1_id: teamAId,
          team2_id: teamBId,
          score_a: match.scoreA,
          score_b: match.scoreB,
          sets_a: match.setsA || match.setsVencidosTimeA || 0,
          sets_b: match.setsB || match.setsVencidosTimeB || 0,
          status: match.status,
          winner_id: match.winnerId || null,
          tournament_id: currentTournamentId,
          set_history: match.historicoSets || [],
          sets_history: match.historicoSets || [],
          history: match.historicoSets || [],
          details: {
            sets: match.historicoSets || [],
            rounds: match.detailedScore?.rounds || [],
          },
          detailed_score: match.detailedScore || { rounds: [] },
          penalties_a: match.penaltiesA || 0,
          penalties_b: match.penaltiesB || 0,
        };
      });

      const { error } = await supabase.from("matches").upsert(dbMatches);
      if (error) {
        if (
          error.message?.includes("column") ||
          error.message?.includes("winner_id") ||
          error.message?.includes("team1_id") ||
          error.message?.includes("set_history") ||
          error.message?.includes("sets_history") ||
          error.message?.includes("history") ||
          error.message?.includes("details") ||
          error.message?.includes("detailed_score")
        ) {
          const legacyMatches = dbMatches.map((m) => {
            const {
              team1_id,
              team2_id,
              winner_id,
              set_history,
              sets_history,
              history,
              details,
              detailed_score,
              penalties_a,
              penalties_b,
              ...legacy
            } = m;
            return legacy;
          });
          await supabase.from("matches").upsert(legacyMatches);
        } else {
          console.error("Detalhes do erro do Supabase ao salvar partidas:", error.message, error.details, error.hint);
        }
      }
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
  const handleAddTeam = async (
    name: string,
    p1: string,
    p2: string = "",
    roster?: string[],
    format?: 'solo' | 'duplas',
    paymentStatus: string = "PAID",
    category: string = "Amador A"
  ) => {
    if (!currentTournamentId) return;
    const isPaid = paymentStatus === "PAID" || paymentStatus === "APPROVED";
    const statusVal = isPaid ? "PAID" : "PENDING";
    const paymentStatusVal = isPaid ? "PAID" : "PENDING";

    const newTeam: Team = {
      id: generateUUID(),
      name,
      players: p2 ? [p1, p2] : [p1, ""],
      roster,
      format,
      createdAt: new Date().toISOString(),
      source: "manual",
      tournamentId: currentTournamentId || undefined,
      payment_status: paymentStatusVal,
      status: statusVal,
      manager_name: p1,
      category: category || "Amador A",
    };
    const updated = [...teams, newTeam];
    saveTeams(updated);

    try {
      const { error } = await supabase.from("teams").insert({
        id: newTeam.id,
        name: newTeam.name,
        player1: p1,
        player2: p2 || "",
        status: statusVal,
        tournament_id: currentTournamentId,
        payment_status: paymentStatusVal,
        manager_name: p1,
        category: category || "Amador A",
      });
      if (error) {
        console.error("Detalhes do erro do Supabase ao adicionar dupla/equipe:", error.message, error.details, error.hint);
        throw error;
      }
    } catch (err) {
      console.error("Erro ao adicionar dupla/equipe no Supabase:", err);
    }

    const eventDesc = format === "solo"
      ? `Jogador "${p1}" (${name}) se inscreveu no torneio.`
      : p2
      ? `Dupla "${name}" (${p1} & ${p2}) se inscreveu no torneio.`
      : `Equipe "${name}" (Capitão: ${p1}${roster && roster.length > 0 ? `, Elenco: ${roster.join(', ')}` : ''}) se inscreveu no torneio.`;

    addEvent(eventDesc, "INFO");
  };

  const handleImportTeams = async (importedTeams: Team[]) => {
    if (!currentTournamentId) return;
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
          status: "CONFIRMED",
          tournament_id: currentTournamentId,
        }));
        const { error } = await supabase.from("teams").insert(dbTeams);
        if (error) {
          console.error("Detalhes do erro do Supabase ao importar duplas:", error.message, error.details, error.hint);
          throw error;
        }
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
    if (!currentTournamentId) return;
    const mockToLoad = count === 8 ? MOCK_TEAMS_8 : MOCK_TEAMS_4;
    
    const mockWithUuids = mockToLoad.map((t) => ({
      ...t,
      id: generateUUID()
    }));

    try {
      await supabase.from("matches").delete().eq("tournament_id", currentTournamentId);
      await supabase.from("teams").delete().eq("tournament_id", currentTournamentId);

      const dbTeams = mockWithUuids.map((t) => ({
        id: t.id,
        name: t.name,
        player1: t.players[0],
        player2: t.players[1],
        status: "CONFIRMED",
        tournament_id: currentTournamentId,
      }));

      const { error } = await supabase.from("teams").insert(dbTeams);
      if (error) {
        console.error("Detalhes do erro do Supabase ao carregar duplas de demonstração:", error.message, error.details, error.hint);
        throw error;
      }
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
    if (!currentTournamentId) return;
    const confirmedTeams = teams.filter((t) => !t.status || t.status === "CONFIRMED" || t.status === "PAID");
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
        await supabase.from("matches").delete().eq("tournament_id", currentTournamentId);
        await supabase.from("tournaments").update({ status: "IN_PROGRESS" }).eq("id", currentTournamentId);
        setTournaments((prev) =>
          prev.map((t) => (t.id === currentTournamentId ? { ...t, status: "IN_PROGRESS" } : t))
        );
      } catch (err) {
        console.error("Erro ao sincronizar partidas e status no chaveamento:", err);
      }
      await saveMatches(generatedMatches);
    };

    syncBracket();
    saveEvents([...newEvents, ...events]);
    if (onNavigate) {
      onNavigate();
    }
  };

  // Scoreboard Adjustments com roteamento de regras
  const handleUpdateScore = (
    matchId: string,
    teamAScore: number,
    teamBScore: number,
    extra?: { penaltiesA?: number; penaltiesB?: number }
  ) => {
    const updatedMatches = matches.map((m) => {
      if (m.id === matchId) {
        switch (currentSportType) {
          case "FUTSAL": {
            const penA = extra?.penaltiesA !== undefined ? extra.penaltiesA : m.penaltiesA || 0;
            const penB = extra?.penaltiesB !== undefined ? extra.penaltiesB : m.penaltiesB || 0;
            addEvent(
              `Placar alterado (Futsal) Mesa/Quadra ${m.tableNumber}: ${m.teamA.name} ${teamAScore} x ${teamBScore} ${m.teamB.name}${penA || penB ? ` (Pênaltis: ${penA}x${penB})` : ""}`,
              "SCORE_CHANGE",
              matchId
            );
            return {
              ...m,
              scoreA: teamAScore,
              scoreB: teamBScore,
              penaltiesA: penA,
              penaltiesB: penB,
            };
          }

          case "PING_PONG": {
            const hasWonA = teamAScore >= 11 && (teamAScore - teamBScore) >= 2;
            const hasWonB = teamBScore >= 11 && (teamBScore - teamAScore) >= 2;
            if (hasWonA || hasWonB) {
              const currentSetNum = (m.historicoSets?.length || 0) + 1;
              const newHistorico = [
                ...(m.historicoSets || []),
                { setNumber: currentSetNum, scoreA: teamAScore, scoreB: teamBScore },
              ];
              const nextSetsA = (m.setsA || 0) + (hasWonA ? 1 : 0);
              const nextSetsB = (m.setsB || 0) + (hasWonB ? 1 : 0);
              addEvent(
                `Ping Pong - Set ${currentSetNum} finalizado (${teamAScore}x${teamBScore})! Placar de sets: ${nextSetsA}x${nextSetsB}`,
                "ROUND_WIN",
                matchId
              );
              return {
                ...m,
                scoreA: 0,
                scoreB: 0,
                setsA: nextSetsA,
                setsB: nextSetsB,
                setsVencidosTimeA: nextSetsA,
                setsVencidosTimeB: nextSetsB,
                historicoSets: newHistorico,
                sets_history: newHistorico,
                set_history: newHistorico,
              };
            }
            return { ...m, scoreA: teamAScore, scoreB: teamBScore };
          }

          case "VOLEI": {
            const completedSets = (m.setsA || 0) + (m.setsB || 0);
            const target = completedSets === 4 ? 15 : 25;
            const hasWonA = teamAScore >= target && (teamAScore - teamBScore) >= 2;
            const hasWonB = teamBScore >= target && (teamBScore - teamAScore) >= 2;
            if (hasWonA || hasWonB) {
              const currentSetNum = completedSets + 1;
              const newHistorico = [
                ...(m.historicoSets || []),
                { setNumber: currentSetNum, scoreA: teamAScore, scoreB: teamBScore },
              ];
              const nextSetsA = (m.setsA || 0) + (hasWonA ? 1 : 0);
              const nextSetsB = (m.setsB || 0) + (hasWonB ? 1 : 0);
              addEvent(
                `Vôlei - Set ${currentSetNum} finalizado (${teamAScore}x${teamBScore})! Placar de sets: ${nextSetsA}x${nextSetsB}`,
                "ROUND_WIN",
                matchId
              );
              return {
                ...m,
                scoreA: 0,
                scoreB: 0,
                setsA: nextSetsA,
                setsB: nextSetsB,
                setsVencidosTimeA: nextSetsA,
                setsVencidosTimeB: nextSetsB,
                historicoSets: newHistorico,
                sets_history: newHistorico,
                set_history: newHistorico,
              };
            }
            return { ...m, scoreA: teamAScore, scoreB: teamBScore };
          }

          case "DOMINO":
          default: {
            if (m.scoreA !== teamAScore || m.scoreB !== teamBScore) {
              addEvent(
                `Placar alterado na Mesa ${m.tableNumber} (${m.phase}): ${m.teamA.name} ${teamAScore} x ${teamBScore} ${m.teamB.name}`,
                "SCORE_CHANGE",
                matchId
              );
            }
            return { ...m, scoreA: teamAScore, scoreB: teamBScore };
          }
        }
      }
      return m;
    });
    saveMatches(updatedMatches);
  };

  // Pontuação multiesportes granular (Gols, Pênaltis, Sets, Pontos corridos)
  const handleScorePoint = (
    matchId: string,
    teamSlot: "A" | "B",
    delta: number,
    isPenalty?: boolean
  ) => {
    const updatedMatches = matches.map((m) => {
      if (m.id !== matchId) return m;

      const isTeamA = teamSlot === "A";
      const targetTeam = isTeamA ? m.teamA : m.teamB;

      switch (currentSportType) {
        case "FUTSAL": {
          if (isPenalty) {
            const nextPenA = isTeamA ? Math.max(0, (m.penaltiesA || 0) + delta) : m.penaltiesA || 0;
            const nextPenB = !isTeamA ? Math.max(0, (m.penaltiesB || 0) + delta) : m.penaltiesB || 0;
            addEvent(
              `Mesa/Quadra ${m.tableNumber} (Futsal): Pênalti ${delta > 0 ? "convertido para" : "removido de"} "${targetTeam.name}". Pênaltis: ${nextPenA} x ${nextPenB}`,
              "SCORE_CHANGE",
              matchId
            );
            return {
              ...m,
              penaltiesA: nextPenA,
              penaltiesB: nextPenB,
            };
          } else {
            const nextScoreA = isTeamA ? Math.max(0, m.scoreA + delta) : m.scoreA;
            const nextScoreB = !isTeamA ? Math.max(0, m.scoreB + delta) : m.scoreB;
            addEvent(
              `Mesa/Quadra ${m.tableNumber} (Futsal): ${delta > 0 ? "⚽ GOL de" : "Gol anulado de"} "${targetTeam.name}"! Placar: ${nextScoreA} x ${nextScoreB}`,
              "SCORE_CHANGE",
              matchId
            );
            return {
              ...m,
              scoreA: nextScoreA,
              scoreB: nextScoreB,
            };
          }
        }

        case "PING_PONG": {
          if (delta < 0) {
            const nextScoreA = isTeamA ? Math.max(0, m.scoreA - 1) : m.scoreA;
            const nextScoreB = !isTeamA ? Math.max(0, m.scoreB - 1) : m.scoreB;
            addEvent(
              `Mesa ${m.tableNumber} (Ping Pong): Ponto desfeito para "${targetTeam.name}". Placar: ${nextScoreA} x ${nextScoreB}`,
              "SCORE_CHANGE",
              matchId
            );
            return {
              ...m,
              scoreA: nextScoreA,
              scoreB: nextScoreB,
            };
          }

          const nextScoreA = isTeamA ? m.scoreA + delta : m.scoreA;
          const nextScoreB = !isTeamA ? m.scoreB + delta : m.scoreB;

          // Regra do Ping Pong: O set é vencido aos 11 pontos com diferença mínima de 2
          const hasWonSetA = nextScoreA >= 11 && (nextScoreA - nextScoreB) >= 2;
          const hasWonSetB = nextScoreB >= 11 && (nextScoreB - nextScoreA) >= 2;

          if (hasWonSetA || hasWonSetB) {
            const currentSetNum = (m.historicoSets?.length || 0) + 1;
            const newHistorico = [
              ...(m.historicoSets || []),
              { setNumber: currentSetNum, scoreA: nextScoreA, scoreB: nextScoreB },
            ];
            const nextSetsA = (m.setsA || 0) + (hasWonSetA ? 1 : 0);
            const nextSetsB = (m.setsB || 0) + (hasWonSetB ? 1 : 0);
            const setWinner = hasWonSetA ? m.teamA : m.teamB;

            addEvent(
              `Mesa ${m.tableNumber} (Ping Pong) - SET ${currentSetNum} VENCIDO! "${setWinner.name}" venceu o set por ${nextScoreA}x${nextScoreB}. Placar de Sets: ${nextSetsA} x ${nextSetsB}`,
              "ROUND_WIN",
              matchId
            );

            return {
              ...m,
              scoreA: 0,
              scoreB: 0,
              setsA: nextSetsA,
              setsB: nextSetsB,
              setsVencidosTimeA: nextSetsA,
              setsVencidosTimeB: nextSetsB,
              historicoSets: newHistorico,
              sets_history: newHistorico,
              set_history: newHistorico,
            };
          }

          addEvent(
            `Mesa ${m.tableNumber} (Ping Pong): Ponto de "${targetTeam.name}"! Placar do Set: ${nextScoreA} x ${nextScoreB}`,
            "SCORE_CHANGE",
            matchId
          );

          return {
            ...m,
            scoreA: nextScoreA,
            scoreB: nextScoreB,
          };
        }

        case "VOLEI": {
          if (delta < 0) {
            const nextScoreA = isTeamA ? Math.max(0, m.scoreA - 1) : m.scoreA;
            const nextScoreB = !isTeamA ? Math.max(0, m.scoreB - 1) : m.scoreB;
            addEvent(
              `Quadra ${m.tableNumber} (Vôlei): Ponto desfeito para "${targetTeam.name}". Placar: ${nextScoreA} x ${nextScoreB}`,
              "SCORE_CHANGE",
              matchId
            );
            return {
              ...m,
              scoreA: nextScoreA,
              scoreB: nextScoreB,
            };
          }

          const nextScoreA = isTeamA ? m.scoreA + delta : m.scoreA;
          const nextScoreB = !isTeamA ? m.scoreB + delta : m.scoreB;

          // Regra do Vôlei: Sets 1 a 4 aos 25 pts (dif 2); 5º set (tie-break) aos 15 pts (dif 2)
          const completedSets = (m.setsA || 0) + (m.setsB || 0);
          const isTieBreak = completedSets === 4;
          const targetPoints = isTieBreak ? 15 : 25;

          const hasWonSetA = nextScoreA >= targetPoints && (nextScoreA - nextScoreB) >= 2;
          const hasWonSetB = nextScoreB >= targetPoints && (nextScoreB - nextScoreA) >= 2;

          if (hasWonSetA || hasWonSetB) {
            const currentSetNum = completedSets + 1;
            const newHistorico = [
              ...(m.historicoSets || []),
              { setNumber: currentSetNum, scoreA: nextScoreA, scoreB: nextScoreB },
            ];
            const nextSetsA = (m.setsA || 0) + (hasWonSetA ? 1 : 0);
            const nextSetsB = (m.setsB || 0) + (hasWonSetB ? 1 : 0);
            const setWinner = hasWonSetA ? m.teamA : m.teamB;

            addEvent(
              `Quadra ${m.tableNumber} (Vôlei) - SET ${currentSetNum} VENCIDO! "${setWinner.name}" venceu o set por ${nextScoreA}x${nextScoreB}. Placar de Sets: ${nextSetsA} x ${nextSetsB}`,
              "ROUND_WIN",
              matchId
            );

            return {
              ...m,
              scoreA: 0,
              scoreB: 0,
              setsA: nextSetsA,
              setsB: nextSetsB,
              setsVencidosTimeA: nextSetsA,
              setsVencidosTimeB: nextSetsB,
              historicoSets: newHistorico,
              sets_history: newHistorico,
              set_history: newHistorico,
            };
          }

          addEvent(
            `Quadra ${m.tableNumber} (Vôlei): Ponto de "${targetTeam.name}"! Placar do Set: ${nextScoreA} x ${nextScoreB}`,
            "SCORE_CHANGE",
            matchId
          );

          return {
            ...m,
            scoreA: nextScoreA,
            scoreB: nextScoreB,
          };
        }

        case "DOMINO":
        default: {
          return m;
        }
      }
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

    const isSetsSport =
      currentSportType === "PING_PONG" ||
      currentSportType === "VOLEI" ||
      (targetMatch.phase.toLowerCase() === "semifinal" && currentSportType === "DOMINO");

    const tSetsA = targetMatch.setsVencidosTimeA ?? targetMatch.setsA ?? 0;
    const tSetsB = targetMatch.setsVencidosTimeB ?? targetMatch.setsB ?? 0;
    const tScoreA = targetMatch.scoreA;
    const tScoreB = targetMatch.scoreB;

    // Definição estrita do winner_id:
    // const winner_id = team1Score > team2Score ? team1_id : team2_id; (ou utilizando o total de sets)
    let finalWinnerId: string;
    if (isSetsSport && (tSetsA > 0 || tSetsB > 0 || tSetsA !== tSetsB)) {
      finalWinnerId = tSetsA > tSetsB ? targetMatch.teamA.id : targetMatch.teamB.id;
    } else if (tScoreA !== tScoreB) {
      finalWinnerId = tScoreA > tScoreB ? targetMatch.teamA.id : targetMatch.teamB.id;
    } else {
      finalWinnerId = winnerId;
    }

    const isTeamA = finalWinnerId === targetMatch.teamA.id;
    const winnerTeam = isTeamA ? targetMatch.teamA : targetMatch.teamB;
    const loserTeam = isTeamA ? targetMatch.teamB : targetMatch.teamA;
    const winnerScore = isTeamA ? targetMatch.scoreA : targetMatch.scoreB;
    const loserScore = isTeamA ? targetMatch.scoreB : targetMatch.scoreA;
    const winnerSets = isTeamA ? tSetsA : tSetsB;
    const loserSets = isTeamA ? tSetsB : tSetsA;
    const winnerPenalties = isTeamA ? (targetMatch.penaltiesA || 0) : (targetMatch.penaltiesB || 0);
    const loserPenalties = isTeamA ? (targetMatch.penaltiesB || 0) : (targetMatch.penaltiesA || 0);

    let finishMessage = "";
    switch (currentSportType) {
      case "FUTSAL":
        if (winnerPenalties > 0 || loserPenalties > 0) {
          finishMessage = `FIM DE JOGO! Mesa/Quadra ${targetMatch.tableNumber} (Futsal): "${winnerTeam.name}" venceu "${loserTeam.name}" por ${winnerScore}x${loserScore} gols (${winnerPenalties}x${loserPenalties} nos pênaltis) e avança no torneio!`;
        } else {
          finishMessage = `FIM DE JOGO! Mesa/Quadra ${targetMatch.tableNumber} (Futsal): "${winnerTeam.name}" venceu "${loserTeam.name}" por ${winnerScore}x${loserScore} gols e avança no torneio!`;
        }
        break;
      case "PING_PONG":
        finishMessage = `FIM DE JOGO! Mesa ${targetMatch.tableNumber} (Ping Pong): "${winnerTeam.name}" venceu "${loserTeam.name}" por ${winnerSets}x${loserSets} sets e avança no torneio!`;
        break;
      case "VOLEI":
        finishMessage = `FIM DE JOGO! Quadra ${targetMatch.tableNumber} (Vôlei): "${winnerTeam.name}" venceu "${loserTeam.name}" por ${winnerSets}x${loserSets} sets e avança no torneio!`;
        break;
      case "DOMINO":
      default:
        finishMessage = `FIM DE JOGO! Mesa ${targetMatch.tableNumber} (Dominó): "${winnerTeam.name}" venceu a partida contra "${loserTeam.name}" por ${winnerScore}x${loserScore} pontos (Buchas) e avança no torneio!`;
        break;
    }

    addEvent(finishMessage, "MATCH_COMPLETED", matchId);

    let updatedMatches = matches.map((m) => {
      if (m.id === matchId) {
        return {
          ...m,
          status: "COMPLETED" as const,
          winnerId: finalWinnerId,
          completedAt: Date.now(),
          finalScoreA: m.scoreA,
          finalScoreB: m.scoreB,
          finalSetsA: tSetsA,
          finalSetsB: tSetsB,
        };
      }
      return m;
    });

    updatedMatches = updatedMatches.map((m) => {
      const updatedMatch = { ...m };
      
      if (m.sourceMatchAId === matchId) {
        updatedMatch.teamA = winnerTeam;
        addEvent(`Chaveamento Atualizado: "${winnerTeam.name}" avançou para ${m.phase} (Mesa/Quadra ${m.tableNumber}).`, "INFO");
      }
      
      if (m.sourceMatchBId === matchId) {
        updatedMatch.teamB = winnerTeam;
        addEvent(`Chaveamento Atualizado: "${winnerTeam.name}" avançou para ${m.phase} (Mesa/Quadra ${m.tableNumber}).`, "INFO");
      }

      // Propagação direta para o chaveamento moderno (next_match_id)
      if (targetMatch.next_match_id && m.id === targetMatch.next_match_id) {
        const order = targetMatch.match_order || 1;
        const isSlot1 = (order - 1) % 2 === 0;
        if (isSlot1) {
          updatedMatch.teamA = winnerTeam;
        } else {
          updatedMatch.teamB = winnerTeam;
        }
        addEvent(`Chaveamento Atualizado: "${winnerTeam.name}" avançou para ${m.phase} (Mesa/Quadra ${m.tableNumber}).`, "INFO");
      }

      const isTeamAReady = !updatedMatch.teamA.id.startsWith("placeholder-");
      const isTeamBReady = !updatedMatch.teamB.id.startsWith("placeholder-");
      if (updatedMatch.status === "SCHEDULED" && isTeamAReady && isTeamBReady) {
        updatedMatch.status = "SCHEDULED";
      }

      return updatedMatch;
    });

    const sportLabel = currentSportType === "FUTSAL" ? "Futsal" : currentSportType === "PING_PONG" ? "Ping Pong" : currentSportType === "VOLEI" ? "Vôlei" : "Dominó";
    if (matchId === "f-1" || targetMatch.phase.toLowerCase() === "final") {
      addEvent(`🏆 PARABÉNS! "${winnerTeam.name}" é a grande CAMPEÃ do torneio de ${sportLabel} SportConnect! 🏆`, "MATCH_COMPLETED");
    }

    saveMatches(updatedMatches);

    // Dispara a Server Action para persistência estrita no banco e avanço em next_match_id
    const dbMatchUuid = getUuidForMatchId(matchId);
    completeMatchAction({
      matchId: dbMatchUuid,
      scoreA: tScoreA,
      scoreB: tScoreB,
      setsA: tSetsA,
      setsB: tSetsB,
      winnerId: finalWinnerId,
      sportType: currentSportType,
      setHistory: targetMatch.historicoSets || [],
      detailedScore: targetMatch.detailedScore || { rounds: [] },
      penaltiesA: targetMatch.penaltiesA || 0,
      penaltiesB: targetMatch.penaltiesB || 0,
    }).catch((err) => {
      console.warn("Aviso ao rodar completeMatchAction:", err);
    });
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

    let scoreA = 0;
    let scoreB = 0;
    let setsA = 0;
    let setsB = 0;
    let historicoSets: Array<{ setNumber: number; scoreA: number; scoreB: number }> = [];

    switch (currentSportType) {
      case "FUTSAL":
        // Futsal: 4x0 automático em gols
        scoreA = winnerSlot === "A" ? 4 : 0;
        scoreB = winnerSlot === "B" ? 4 : 0;
        break;
      case "PING_PONG":
        // Ping Pong: 3x0 em sets
        setsA = winnerSlot === "A" ? 3 : 0;
        setsB = winnerSlot === "B" ? 3 : 0;
        historicoSets = [
          { setNumber: 1, scoreA: winnerSlot === "A" ? 11 : 0, scoreB: winnerSlot === "B" ? 11 : 0 },
          { setNumber: 2, scoreA: winnerSlot === "A" ? 11 : 0, scoreB: winnerSlot === "B" ? 11 : 0 },
          { setNumber: 3, scoreA: winnerSlot === "A" ? 11 : 0, scoreB: winnerSlot === "B" ? 11 : 0 },
        ];
        break;
      case "VOLEI":
        // Vôlei: 3x0 em sets
        setsA = winnerSlot === "A" ? 3 : 0;
        setsB = winnerSlot === "B" ? 3 : 0;
        historicoSets = [
          { setNumber: 1, scoreA: winnerSlot === "A" ? 25 : 0, scoreB: winnerSlot === "B" ? 25 : 0 },
          { setNumber: 2, scoreA: winnerSlot === "A" ? 25 : 0, scoreB: winnerSlot === "B" ? 25 : 0 },
          { setNumber: 3, scoreA: winnerSlot === "A" ? 25 : 0, scoreB: winnerSlot === "B" ? 25 : 0 },
        ];
        break;
      case "DOMINO":
      default:
        // Dominó: Pontuação máxima da regra (4x0)
        scoreA = winnerSlot === "A" ? 4 : 0;
        scoreB = winnerSlot === "B" ? 4 : 0;
        setsA = winnerSlot === "A" ? 2 : 0;
        setsB = winnerSlot === "B" ? 2 : 0;
        break;
    }

    let updatedMatches = matches.map((m) => {
      if (m.id === matchId) {
        return {
          ...m,
          status: "COMPLETED" as const,
          scoreA,
          scoreB,
          setsA,
          setsB,
          setsVencidosTimeA: setsA,
          setsVencidosTimeB: setsB,
          historicoSets,
          winnerId: winnerTeam.id,
          completedAt: Date.now(),
          finalScoreA: scoreA,
          finalScoreB: scoreB,
          finalSetsA: setsA,
          finalSetsB: setsB,
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
        addEvent(`Chaveamento Atualizado (W.O.): "${winnerTeam.name}" avançou para ${m.phase} (Mesa/Quadra ${m.tableNumber}).`, "INFO");
      }
      if (m.sourceMatchBId === matchId) {
        nextMatch.teamB = winnerTeam;
        addEvent(`Chaveamento Atualizado (W.O.): "${winnerTeam.name}" avançou para ${m.phase} (Mesa/Quadra ${m.tableNumber}).`, "INFO");
      }
      const isTeamAReady = !nextMatch.teamA.id.startsWith("placeholder-");
      const isTeamBReady = !nextMatch.teamB.id.startsWith("placeholder-");
      if (nextMatch.status === "SCHEDULED" && isTeamAReady && isTeamBReady) {
        nextMatch.status = "SCHEDULED";
      }
      return nextMatch;
    });

    addEvent(
      `Vitória por W.O. declarada para "${winnerTeam.name}" devido à ausência/desclassificação de "${loserTeam.name}" na Mesa/Quadra ${match.tableNumber}.`,
      "MATCH_COMPLETED",
      matchId
    );

    const sportLabel = currentSportType === "FUTSAL" ? "Futsal" : currentSportType === "PING_PONG" ? "Ping Pong" : currentSportType === "VOLEI" ? "Vôlei" : "Dominó";
    if (matchId === "f-1") {
      addEvent(`🏆 PARABÉNS! "${winnerTeam.name}" é a grande CAMPEÃ do torneio de ${sportLabel} SportConnect! 🏆`, "MATCH_COMPLETED");
    }

    saveMatches(updatedMatches);
  };

  const handleCreateTournament = async (name: string, sportType: SportType = "DOMINO") => {
    const newTourId = generateUUID();
    const createdAt = new Date().toISOString();
    const { error } = await supabase.from("tournaments").insert({
      id: newTourId,
      name,
      status: "OPEN",
      sport_type: sportType,
      gender_category: "MISTO",
    });
    if (error) {
      console.error("Erro ao criar torneio:", error);
      throw error;
    }
    const newTour: Tournament = {
      id: newTourId,
      name,
      status: "ATIVO" as const,
      createdAt,
      sport_type: sportType
    };
    setTournaments((prev) => [newTour, ...prev]);
    setCurrentTournamentId(newTourId);
    localStorage.setItem("sc_current_tournament_id", newTourId);
  };

  const handleFinishTournament = async (id: string) => {
    const { error } = await supabase
      .from("tournaments")
      .update({ status: "FINALIZADO" })
      .eq("id", id);
    if (error) {
      console.error("Erro ao finalizar torneio:", error);
      throw error;
    }
    setTournaments((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: "FINALIZADO" as const } : t))
    );
  };

  const handleDeleteTournament = async (id: string) => {
    const { error } = await supabase
      .from("tournaments")
      .delete()
      .eq("id", id);
    if (error) {
      console.error("Erro ao deletar torneio:", error);
      throw error;
    }
    
    const remaining = tournaments.filter((t) => t.id !== id);
    setTournaments(remaining);

    if (remaining.length === 0) {
      setCurrentTournamentId(null);
      localStorage.removeItem("sc_current_tournament_id");
      setTeams([]);
      setMatches([]);
      setEvents([]);
    } else if (currentTournamentId === id) {
      const nextId = remaining[0].id;
      setCurrentTournamentId(nextId);
      localStorage.setItem("sc_current_tournament_id", nextId);
    }
  };

  return (
    <TournamentContext.Provider
      value={{
        tournaments,
        setTournaments,
        currentTournamentId,
        setCurrentTournamentId,
        currentSportType,
        setCurrentSportType,
        isReadOnly,
        handleCreateTournament,
        handleFinishTournament,
        handleDeleteTournament,
        teams,
        setTeams,
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
        handleScorePoint,
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
