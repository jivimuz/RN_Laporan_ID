import { getActiveReports } from "@/services/storage";
import { getUserName } from "@/services/userService";
import * as FileSystem from "expo-file-system/legacy";
import * as XLSX from "xlsx";

const formatFileDate = (date: Date): string =>
  date.toISOString().slice(0, 10);

export const exportReportsToExcel = async (): Promise<void> => {
  const [reports, userName] = await Promise.all([
    getActiveReports(),
    getUserName(),
  ]);

  if (reports.length === 0) {
    throw new Error("Belum ada laporan aktif untuk diekspor.");
  }

  if (!FileSystem.documentDirectory) {
    throw new Error("Penyimpanan file tidak tersedia di perangkat ini.");
  }

  let Sharing: typeof import("expo-sharing");
  try {
    // Load the native module only when export is requested.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Sharing = require("expo-sharing");
  } catch {
    throw new Error(
      "Modul berbagi file belum tersedia. Gunakan development build terbaru.",
    );
  }

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Fitur berbagi file tidak tersedia di perangkat ini.");
  }

  const rows = reports.map((report) => ({
    Tujuan: report.title,
    Deskripsi: report.description,
    "Tipe (in/out)": report.transactionType,
    Kategori: report.category,
    Nominal: report.amount ?? 0,
    Tanggal: report.date,
    User: userName ?? "",
    created_at: report.createdAt,
    updated_at: report.updatedAt,
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan");

  const base64 = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "base64",
  });
  const fileUri = `${FileSystem.documentDirectory}laporin-${formatFileDate(
    new Date(),
  )}.xlsx`;

  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await Sharing.shareAsync(fileUri, {
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    dialogTitle: "Export laporan Laporin ID",
    UTI: "com.microsoft.excel.xlsx",
  });
};
