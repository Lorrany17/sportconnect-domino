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
  status: "OPEN" | "ATIVO" | "IN_PROGRESS" | "EM_ANDAMENTO" | "COMPLETED" | "FINALIZADO" | "CANCELADO" | string;
  createdAt: string;
  sport_type?: SportType; // Adicionado para identificar a modalidade
  format?: string;
  owner_id?: string;
  max_teams?: number;
  entry_fee?: number;
  location?: string;
  start_date?: string;
  start_time?: string;
  end_date?: string;
  rules?: string;
  cover_url?: string;
  organizer_pix_key?: string;
  gender_category?: "MASCULINO" | "FEMININO" | "MISTO" | "Masculino" | "Feminino" | "Misto" | string;
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
  payment_status?: 'APPROVED' | 'PAID' | 'WAITING_PIX' | 'WAITING_APPROVAL' | 'PENDING' | string;
  payout_status?: 'COMPLETED' | 'FAILED_TRANSFER' | 'MANUAL_PENDING' | 'PENDING' | string;
  payout_amount?: number;
  payment_proof_url?: string;
  manager_name?: string;
  manager_phone?: string;
  phone?: string;
  category?: string;
  contact?: string;
  user_id?: string;
  mp_payment_id?: string;
  cancellation_status?: 'REQUESTED_BY_ATHLETE' | 'REFUND_REQUESTED' | 'REFUNDED' | string;
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
  status: "SCHEDULED" | "LIVE" | "COMPLETED" | "IN_PROGRESS" | string;
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
  winner_id?: string | null;
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
  sets_history?: SetScore[] | string | null | any; // Coluna JSONB de histórico de sets no Supabase
  set_history?: SetScore[] | string | null | any; // Alias compatível
  history?: SetScore[] | string | null | any; // Alias compatível
  details?: any;
  detailed_score?: any;
  setsVencidosTimeA?: number;
  setsVencidosTimeB?: number;
  round?: number;
  match_order?: number;
  next_match_id?: string | null;
  team1_id?: string | null;
  team2_id?: string | null;
  team_a_id?: string | null;
  team_b_id?: string | null;
  score_a?: number;
  score_b?: number;
  sets_a?: number;
  sets_b?: number;
  penalties_a?: number | null;
  penalties_b?: number | null;
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
