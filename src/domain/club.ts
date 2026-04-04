/** Top-level club / organization the user manages (landing “team” picker). */
export interface ClubRecord {
  id: string;
  name: string;
  nickname: string;
  abbreviation: string;
  /** Optional small image (data URL), set from file upload. */
  logoDataUrl?: string;
  createdAt: number;
  updatedAt: number;
}
