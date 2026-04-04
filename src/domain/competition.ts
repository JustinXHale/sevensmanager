/** Tournament / competition container (admin hierarchy). */
export interface CompetitionRecord {
  id: string;
  name: string;
  /** When set, this competition belongs to a landing club (team picker). */
  clubId?: string;
  createdAt: number;
  updatedAt: number;
}
