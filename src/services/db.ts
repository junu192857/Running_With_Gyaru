// 러닝 기록 저장 (SQLite)

import * as SQLite from "expo-sqlite";
import type { GoalType } from "../store/runSession";

export interface RunRecord {
  id: number;
  /** ISO8601, 러닝 시작 시각 */
  startedAt: string;
  goalType: GoalType;
  /** distance: meters, time: seconds */
  goalValue: number;
  distanceMeters: number;
  durationSeconds: number;
  /** 초/km. 측정 불가였으면 null */
  averagePaceSecondsPerKm: number | null;
  completed: boolean;
}

export type NewRunRecord = Omit<RunRecord, "id">;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync("runs.db");
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS runs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          started_at TEXT NOT NULL,
          goal_type TEXT NOT NULL,
          goal_value REAL NOT NULL,
          distance_meters REAL NOT NULL,
          duration_seconds REAL NOT NULL,
          average_pace_seconds_per_km REAL,
          completed INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_runs_started_at ON runs (started_at DESC);
      `);
      return db;
    })();
  }
  return dbPromise;
}

interface RunRow {
  id: number;
  started_at: string;
  goal_type: string;
  goal_value: number;
  distance_meters: number;
  duration_seconds: number;
  average_pace_seconds_per_km: number | null;
  completed: number;
}

function toRecord(row: RunRow): RunRecord {
  return {
    id: row.id,
    startedAt: row.started_at,
    goalType: row.goal_type as GoalType,
    goalValue: row.goal_value,
    distanceMeters: row.distance_meters,
    durationSeconds: row.duration_seconds,
    averagePaceSecondsPerKm: row.average_pace_seconds_per_km,
    completed: row.completed === 1,
  };
}

export async function saveRun(record: NewRunRecord): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO runs
       (started_at, goal_type, goal_value, distance_meters, duration_seconds, average_pace_seconds_per_km, completed)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    record.startedAt,
    record.goalType,
    record.goalValue,
    record.distanceMeters,
    record.durationSeconds,
    record.averagePaceSecondsPerKm,
    record.completed ? 1 : 0,
  );
  return result.lastInsertRowId;
}

export async function listRuns(limit = 50): Promise<RunRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<RunRow>(
    `SELECT * FROM runs ORDER BY started_at DESC LIMIT ?`,
    limit,
  );
  return rows.map(toRecord);
}

export async function getRun(id: number): Promise<RunRecord | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<RunRow>(`SELECT * FROM runs WHERE id = ?`, id);
  return row ? toRecord(row) : null;
}

export async function deleteRun(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM runs WHERE id = ?`, id);
}
