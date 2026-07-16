export interface Team {
  id: string;
  name: string;
  players: [string, string]; // Dupla: [Capitão, Jogador 2]
  createdAt: string;
  source?: "external" | "manual" | "csv";
  status?: string;
}

export interface Round {
  roundNumber: number;
  winnerTeamId: string;
  pointsGenerated: number;
  note?: string; // Ex: "Carroça de sena", "Lá e cá", etc.
}

export interface Match {
  id: string;
  phase: string; // "Quartas de Final" | "Semifinal" | "Final"
  status: "SCHEDULED" | "LIVE" | "COMPLETED";
  teamA: Team;
  teamB: Team;
  scoreA: number;
  scoreB: number;
  setsA?: number;
  setsB?: number;
  detailedScore: {
    rounds: Round[];
  };
  winnerId?: string;
  tableNumber: number;
  sourceMatchAId?: string;
  sourceMatchBId?: string;
  completedAt?: number;
  finalScoreA?: number;
  finalScoreB?: number;
  finalSetsA?: number;
  finalSetsB?: number;
  isWO?: boolean;
  woSlot?: "A" | "B";
}

export interface TournamentEvent {
  id: string;
  timestamp: string; // HH:MM:SS
  matchId?: string;
  description: string;
  type: "INFO" | "SCORE_CHANGE" | "ROUND_WIN" | "MATCH_COMPLETED" | "TORNEIO_START";
}
