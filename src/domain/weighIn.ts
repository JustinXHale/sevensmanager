/** Pre- or post-session body mass (kg) for sweat-loss estimates. */
export type WeighInPhase = 'pre' | 'post';

export interface WeighInRecord {
  id: string;
  teamMemberId: string;
  /** Optional link to a logged match (same team). */
  matchId?: string;
  /** Wall-clock ms when the reading was taken. */
  recordedAt: number;
  weightKg: number;
  phase: WeighInPhase;
  createdAt: number;
}
