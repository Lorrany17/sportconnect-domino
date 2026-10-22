// Define os desportos disponíveis no sistema
export type SportType = 'DOMINO' | 'PING_PONG' | 'FUTSAL' | 'VOLEI';

// Tipos para Formulário de Inscrição Dinâmico (Estilo Google Forms)
export type CustomFieldType = "text" | "textarea" | "select" | "checkbox";

export interface CustomRegistrationField {
  id: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  options?: string[];
  optionsString?: string;
}

export interface Tournament {
  id: string;
  name: string;
  status: "ATIVO" | "FINALIZADO" | "CANCELADO" | "EM_ANDAMENTO" | string;
  createdAt: string;
  sport_type?: SportType; // Adicionado para identificar a modalidade
  format?: string;
  owner_id?: string;
  max_teams?: number;
  entry_fee?: number;
  location?: string;
  start_date?: string;
  end_date?: string;
  rules?: string;
  cover_url?: string;
  organizer_pix_key?: string;
  gender_category?: "Masculino" | "Feminino" | "Misto" | string;
  sponsors?: Sponsor[];
  custom_registration_fields?: CustomRegistrationField[];
}

export interface Sponsor {
  id: string;
  name: string;
  logo_url: string | null;
  link: string | null;
}

export interface TeamMember {
  id?: string;
  team_id: string;
  user_id?: string | null;
  name?: string;
  email?: string;
  is_captain?: boolean;
  created_at?: string;
}

export interface Profile {
  id: string;
  full_name?: string;
  is_admin?: boolean;
  avatar_url?: string;
  phone?: string;
  location?: string;
  bio?: string;
  email?: string;
  created_at?: string;
  favorite_sport?: string;
  instagram?: string;
  tiktok?: string;
  show_phone?: boolean;
}

export interface Team {
  id: string;
  name: string;
  players: [string, string] | string[]; // Dupla: [Capitão, Jogador 2] ou Solo ou Capitão
  roster?: string[]; // Atletas adicionais (para Futsal/Vôlei)
  format?: 'solo' | 'duplas'; // Formato para esportes individuais ou em dupla (ex: Ping Pong)
  createdAt: string;
  source?: "external" | "manual" | "csv";
  status?: string;
  tournamentId?: string;
  payment_status?: 'APPROVED' | 'WAITING_PIX' | 'PENDING' | string;
  payment_proof_url?: string;
  manager_name?: string;
  category?: string;
  contact?: string;
  user_id?: string;
  mp_payment_id?: string;
  cancellation_status?: 'REQUESTED_BY_ATHLETE' | 'REFUNDED' | string;
  custom_registration_answers?: Record<string, any>;
}

export interface Round {
  roundNumber: number;
  winnerTeamId: string;
  pointsGenerated: number;
  note?: string; // Ex: "Carroça de sena", "Lá e cá", etc.
}

export interface SetScore {
  setNumber: number;
  scoreA: number;
  scoreB: number;
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
  tournamentId?: string;
  is_chilena?: boolean; // Adicionado para suportar a regra do 7x0 do Ping Pong
  penaltiesA?: number; // Futsal: pênaltis time A
  penaltiesB?: number; // Futsal: pênaltis time B
  historicoSets?: SetScore[]; // Ping Pong e Vôlei: histórico de sets
  setsVencidosTimeA?: number;
  setsVencidosTimeB?: number;
}

export interface TournamentEvent {
  id: string;
  timestamp: string; // HH:MM:SS
  matchId?: string;
  description: string;
  type: "INFO" | "SCORE_CHANGE" | "ROUND_WIN" | "MATCH_COMPLETED" | "TORNEIO_START";
}

// Adicionado para o novo sistema de Ranking Contínuo global
export interface Ranking {
  id: string;
  name: string;
  sport_type: SportType;
  is_public: boolean;
  createdAt: string;
}

// ==========================================
// RBAC: Equipe do Torneio e Permissões
// ==========================================
export type TournamentRole = 'OWNER' | 'ADMIN' | 'REFEREE' | 'SCOREKEEPER';

export interface TournamentStaffMember {
  id: string;
  tournament_id: string;
  email: string;
  role: 'ADMIN' | 'REFEREE' | 'SCOREKEEPER';
  user_id?: string | null;
  created_at?: string;
}

export interface TournamentPermissions {
  canEditSettings: boolean;
  canManageFinances: boolean;
  canEditScores: boolean;
  role: TournamentRole | null;
  isOwner: boolean;
  isAdmin: boolean;
  isReferee: boolean;
  isScorekeeper: boolean;
  isLoading: boolean;
}