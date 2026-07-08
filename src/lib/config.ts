export type TournamentType = "SINGLE_ELIMINATION" | "DOUBLE_ELIMINATION";

export const TOURNAMENT_TYPE: TournamentType =
  (process.env.NEXT_PUBLIC_TOURNAMENT_TYPE as TournamentType) || "SINGLE_ELIMINATION";
