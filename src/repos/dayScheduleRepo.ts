import type { DayScheduleItemRecord, DayScheduleKind } from '@/domain/daySchedule';
import { db } from './db';

export async function listDaySchedule(teamId: string, dayDate: string): Promise<DayScheduleItemRecord[]> {
  const rows = await db.dayScheduleItems.where('teamId').equals(teamId).filter((r) => r.dayDate === dayDate).toArray();
  return rows.sort((a, b) => a.sortIndex - b.sortIndex || a.startMinutes - b.startMinutes);
}

export async function addDayScheduleItem(input: {
  teamId: string;
  dayDate: string;
  startMinutes: number;
  endMinutes?: number;
  label: string;
  kind: DayScheduleKind;
}): Promise<DayScheduleItemRecord> {
  const existing = await db.dayScheduleItems.where('teamId').equals(input.teamId).filter((r) => r.dayDate === input.dayDate).toArray();
  const maxSort = existing.reduce((m, r) => Math.max(m, r.sortIndex), -1);
  const now = Date.now();
  const row: DayScheduleItemRecord = {
    id: crypto.randomUUID(),
    teamId: input.teamId,
    dayDate: input.dayDate,
    sortIndex: maxSort + 1,
    startMinutes: Math.max(0, Math.min(1439, Math.round(input.startMinutes))),
    endMinutes:
      input.endMinutes !== undefined
        ? Math.max(0, Math.min(1439, Math.round(input.endMinutes)))
        : undefined,
    label: input.label.trim() || 'Block',
    kind: input.kind,
    createdAt: now,
    updatedAt: now,
  };
  await db.dayScheduleItems.put(row);
  return row;
}

export async function updateDayScheduleItem(
  id: string,
  patch: Partial<Pick<DayScheduleItemRecord, 'startMinutes' | 'endMinutes' | 'label' | 'kind' | 'sortIndex'>>,
): Promise<void> {
  const row = await db.dayScheduleItems.get(id);
  if (!row) return;
  await db.dayScheduleItems.put({
    ...row,
    ...patch,
    label: patch.label !== undefined ? patch.label.trim() || row.label : row.label,
    updatedAt: Date.now(),
  });
}

export async function deleteDayScheduleItem(id: string): Promise<void> {
  await db.dayScheduleItems.delete(id);
}
