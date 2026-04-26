import AsyncStorage from "@react-native-async-storage/async-storage";
import { Report, ReportFormData } from "../types";

const REPORTS_KEY = "reports_data";
const AUTO_SYNC_DEBOUNCE_MS = 1200;

let autoSyncTimer: ReturnType<typeof setTimeout> | null = null;
let autoSyncRunning = false;
let autoSyncQueued = false;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const normalizeReports = (value: unknown): Report[] => {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isObject)
    .map((r) => ({
      id: typeof r.id === "string" ? r.id : Date.now().toString(36),
      title: typeof r.title === "string" ? r.title : "",
      description: typeof r.description === "string" ? r.description : "",
      category: typeof r.category === "string" ? r.category : "Lainnya",
      transactionType: (r.transactionType === "out" ? "out" : "in") as
        | "in"
        | "out",
      is_sinc: (r.is_sinc === 1 ? 1 : 0) as 0 | 1,
      syncedSheet: typeof r.syncedSheet === "string" ? r.syncedSheet : null,
      amount:
        typeof r.amount === "number" && Number.isFinite(r.amount)
          ? r.amount
          : undefined,
      date: typeof r.date === "string" ? r.date : "",
      deletedAt:
        typeof r.deletedAt === "string" && r.deletedAt ? r.deletedAt : null,
      createdAt:
        typeof r.createdAt === "string"
          ? r.createdAt
          : new Date().toISOString(),
      updatedAt:
        typeof r.updatedAt === "string"
          ? r.updatedAt
          : new Date().toISOString(),
    }))
    .filter((r) => r.title.trim() && r.description.trim() && r.date);
};

const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
};

const flushAutoSyncQueue = async (): Promise<void> => {
  if (autoSyncRunning) return;
  if (!autoSyncQueued) return;

  autoSyncRunning = true;
  try {
    while (autoSyncQueued) {
      autoSyncQueued = false;

      try {
        // Dynamic import keeps sync optional and avoids hard runtime coupling.
        const { getSpreadsheetConfig, syncReportsToSpreadsheet } =
          await import("./spreadsheetService");
        const config = await getSpreadsheetConfig();

        if (!config.url.trim()) {
          return;
        }

        await syncReportsToSpreadsheet(config);
      } catch {
        // Ignore auto-sync errors; data remains queued as unsynced.
      }
    }
  } finally {
    autoSyncRunning = false;
  }
};

const scheduleAutoSync = (): void => {
  autoSyncQueued = true;

  if (autoSyncTimer) {
    clearTimeout(autoSyncTimer);
  }

  autoSyncTimer = setTimeout(() => {
    autoSyncTimer = null;
    void flushAutoSyncQueue();
  }, AUTO_SYNC_DEBOUNCE_MS);
};

export const getReports = async (): Promise<Report[]> => {
  try {
    const json = await AsyncStorage.getItem(REPORTS_KEY);
    if (!json) return [];

    const parsed = JSON.parse(json) as unknown;
    const normalized = normalizeReports(parsed);

    // Self-heal storage format to prevent repeated runtime failures.
    if (!Array.isArray(parsed) || normalized.length !== parsed.length) {
      await AsyncStorage.setItem(REPORTS_KEY, JSON.stringify(normalized));
    }

    return normalized;
  } catch {
    return [];
  }
};

export const createReport = async (data: ReportFormData): Promise<Report> => {
  const reports = await getReports();
  const now = new Date().toISOString();
  const report: Report = {
    ...data,
    id: generateId(),
    is_sinc: 0,
    syncedSheet: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  reports.push(report);
  await AsyncStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
  scheduleAutoSync();
  return report;
};

export const updateReport = async (
  id: string,
  data: Partial<ReportFormData>,
): Promise<Report | null> => {
  const reports = await getReports();
  const index = reports.findIndex((r) => r.id === id);
  if (index === -1) return null;
  const updated: Report = {
    ...reports[index],
    ...data,
    syncedSheet: reports[index].syncedSheet,
    deletedAt: reports[index].deletedAt,
    is_sinc: 0,
    updatedAt: new Date().toISOString(),
  };
  reports[index] = updated;
  await AsyncStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
  scheduleAutoSync();
  return updated;
};

export const deleteReport = async (id: string): Promise<void> => {
  const reports = await getReports();
  const now = new Date().toISOString();
  const updated = reports.map((r) =>
    r.id === id ? { ...r, deletedAt: now, updatedAt: now, is_sinc: 0 as 0 } : r,
  );
  await AsyncStorage.setItem(REPORTS_KEY, JSON.stringify(updated));
  scheduleAutoSync();
};

export const getActiveReports = async (): Promise<Report[]> => {
  const reports = await getReports();
  return reports.filter((r) => !r.deletedAt);
};

export const getReportsByMonth = async (
  month: number,
  year: number,
): Promise<Report[]> => {
  const reports = await getActiveReports();
  return reports.filter((r) => {
    if (typeof r.date !== "string") return false;

    // Parse YYYY-MM-DD in local time to avoid UTC off-by-one issues
    const parts = r.date.split("-");
    if (parts.length < 2) return false;

    const y = Number(parts[0]);
    const m = Number(parts[1]);
    if (!Number.isFinite(y) || !Number.isFinite(m)) return false;

    return m === month && y === year;
  });
};

export const getUnsyncedReports = async (): Promise<Report[]> => {
  const reports = await getReports();
  return reports.filter((report) => report.is_sinc === 0);
};

export const markReportsAsSynced = async (
  syncedItems: Array<{ id: string; sheetName: string }>,
): Promise<void> => {
  if (syncedItems.length === 0) return;

  const reports = await getReports();
  const syncedMap = new Map(
    syncedItems.map((item) => [item.id, item.sheetName]),
  );
  const updated = reports.map((report) =>
    syncedMap.has(report.id)
      ? {
          ...report,
          is_sinc: 1,
          syncedSheet: syncedMap.get(report.id) ?? report.syncedSheet,
        }
      : report,
  );

  await AsyncStorage.setItem(REPORTS_KEY, JSON.stringify(updated));
};

export const getAllReportsJson = async (): Promise<string> => {
  const reports = await getReports();
  return JSON.stringify(reports, null, 2);
};
