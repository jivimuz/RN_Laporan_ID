import { getUnsyncedReports, markReportsAsSynced } from "@/services/storage";
import { getUserName } from "@/services/userService";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SPREADSHEET_URL_KEY = "spreadsheet_sync_url";
const SPREADSHEET_NAME_KEY = "spreadsheet_sync_name";

export type SpreadsheetConfig = {
  url: string;
  sheetName: string;
};

export const getDefaultMonthlySheetName = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

export type SpreadsheetRow = {
  Tujuan: string;
  "Tipe (in/out)": "in" | "out";
  Kategori: string;
  Nominal: number;
  Tanggal: string;
  User: string;
  created_at: string;
  updated_at: string;
  deleted_at: string;
};

export const getSpreadsheetConfig = async (): Promise<SpreadsheetConfig> => {
  const [url, sheetName] = await Promise.all([
    AsyncStorage.getItem(SPREADSHEET_URL_KEY),
    AsyncStorage.getItem(SPREADSHEET_NAME_KEY),
  ]);

  return {
    url: url ?? "",
    sheetName: sheetName ?? "",
  };
};

export const saveSpreadsheetConfig = async (
  config: SpreadsheetConfig,
): Promise<void> => {
  await Promise.all([
    AsyncStorage.setItem(SPREADSHEET_URL_KEY, config.url.trim()),
    AsyncStorage.setItem(SPREADSHEET_NAME_KEY, config.sheetName.trim()),
  ]);
};

export const syncReportsToSpreadsheet = async (
  config: SpreadsheetConfig,
): Promise<void> => {
  const url = config.url.trim();
  const configuredSheetName = config.sheetName.trim();

  if (!url) {
    throw new Error("URL spreadsheet belum diatur.");
  }

  const reports = await getUnsyncedReports();
  if (reports.length === 0) {
    throw new Error("Tidak ada data baru untuk disinkronkan.");
  }

  const userName = (await getUserName()) ?? "";

  const resolveSheetByReport = (report: (typeof reports)[number]): string => {
    if (report.syncedSheet) return report.syncedSheet;
    if (configuredSheetName) return configuredSheetName;

    const date = new Date(`${report.date}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? getDefaultMonthlySheetName()
      : getDefaultMonthlySheetName(date);
  };

  const groups = new Map<string, typeof reports>();
  for (const report of reports) {
    const sheetName = resolveSheetByReport(report);
    const list = groups.get(sheetName) ?? [];
    list.push(report);
    groups.set(sheetName, list);
  }

  const syncedItems: Array<{ id: string; sheetName: string }> = [];
  for (const [sheetName, sheetReports] of groups.entries()) {
    const rows: SpreadsheetRow[] = sheetReports.map((report) => ({
      Tujuan: report.title,
      "Tipe (in/out)": report.transactionType,
      Kategori: report.category,
      Nominal: typeof report.amount === "number" ? report.amount : 0,
      Tanggal: report.date,
      User: userName,
      created_at: report.createdAt,
      updated_at: report.updatedAt,
      deleted_at: report.deletedAt ?? "",
    }));

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sheetName,
        headers: [
          "Tujuan",
          "Tipe (in/out)",
          "Kategori",
          "Nominal",
          "Tanggal",
          "User",
          "created_at",
          "updated_at",
          "deleted_at",
        ],
        keyField: "created_at",
        rows,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Server spreadsheet merespons ${response.status} pada sheet ${sheetName}.`,
      );
    }

    for (const report of sheetReports) {
      syncedItems.push({ id: report.id, sheetName });
    }
  }

  await markReportsAsSynced(syncedItems);
};
