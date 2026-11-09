import { exportReportsToExcel } from "@/services/exportService";
import {
  getDefaultMonthlySheetName,
  getSpreadsheetConfig,
  saveSpreadsheetConfig,
  syncReportsToSpreadsheet,
} from "@/services/spreadsheetService";
import { getUserName, saveUserName } from "@/services/userService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  ChevronLeft,
  CircleHelp,
  CloudUpload,
  Copy,
  FileDown,
  PenLine,
  PlayCircle,
  Settings,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const APPS_SCRIPT_SNIPPET = `function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const defaultSheetName = now.getFullYear() + "-" + month;
    const sheetName = payload.sheetName || defaultSheetName;
    const headers = payload.headers || ["Tujuan", "Tipe (in/out)", "Kategori", "Nominal", "Tanggal", "User", "created_at", "updated_at", "deleted_at"];
    const keyField = payload.keyField || "created_at";
    const rows = payload.rows || [];

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);

    if (sheet.getMaxColumns() < headers.length) {
      sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
    }

    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    } else {
      const currentHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
      const headerMatches = headers.every((header, i) => currentHeaders[i] === header);

      if (!headerMatches) {
        sheet.insertRowBefore(1);
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      }
    }

    const keyIndex = headers.indexOf(keyField);
    if (keyIndex === -1) throw new Error("keyField tidak ditemukan di headers");

    const lastRow = sheet.getLastRow();
    const existingMap = {};
    if (lastRow > 1) {
      const existingValues = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
      for (let i = 0; i < existingValues.length; i++) {
        const key = existingValues[i][keyIndex];
        if (key) existingMap[String(key)] = i + 2;
      }
    }

    for (const row of rows) {
      const values = headers.map((header) => row[header] || "");
      const key = values[keyIndex];
      if (!key) continue;

      const foundRow = existingMap[String(key)];
      if (foundRow) {
        sheet.getRange(foundRow, 1, 1, headers.length).setValues([values]);
      } else {
        sheet.appendRow(values);
      }
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: "success", rows: rows.length }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

const SPREADSHEET_TUTORIAL_VIDEO_URL = "https://youtu.be/5IgJ1lr-sNw";
const LAST_SYNC_AT_KEY = "spreadsheet_last_sync_at";

const formatLastSync = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

export default function SettingsScreen() {
  const monthlyDefaultSheet = getDefaultMonthlySheetName();
  const [userName, setUserName] = useState("");
  const [spreadsheetUrl, setSpreadsheetUrl] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [lastSyncAt, setLastSyncAt] = useState("");
  const [sheetHelpModal, setSheetHelpModal] = useState(false);
  const [renameModal, setRenameModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [renameError, setRenameError] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [syncSaving, setSyncSaving] = useState(false);
  const [exportSaving, setExportSaving] = useState(false);
  const [spreadsheetSaving, setSpreadsheetSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const [name, config, savedLastSyncAt] = await Promise.all([
      getUserName(),
      getSpreadsheetConfig(),
      AsyncStorage.getItem(LAST_SYNC_AT_KEY),
    ]);

    if (name) setUserName(name);
    setSpreadsheetUrl(config.url);
    setSheetName(config.sheetName);
    setLastSyncAt(savedLastSyncAt ?? "");
  };

  const handleRenameOpen = () => {
    setNewName(userName);
    setRenameError("");
    setRenameModal(true);
  };

  const handleRenameSave = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setRenameError("Nama tidak boleh kosong");
      return;
    }
    setRenameSaving(true);
    try {
      await saveUserName(trimmed);
      setUserName(trimmed);
      setRenameModal(false);
    } catch {
      setRenameError("Gagal menyimpan nama. Coba lagi.");
    } finally {
      setRenameSaving(false);
    }
  };

  const handleSpreadsheetConfigSave = async () => {
    const url = spreadsheetUrl.trim();
    const name = sheetName.trim();

    if (!url) {
      Alert.alert("Error", "Isi URL spreadsheet target dulu.");
      return;
    }

    setSpreadsheetSaving(true);
    try {
      await saveSpreadsheetConfig({ url, sheetName: name });
      Alert.alert("Berhasil", "Konfigurasi spreadsheet berhasil disimpan.", [
        { text: "OK" },
      ]);
    } catch {
      Alert.alert("Error", "Gagal menyimpan konfigurasi spreadsheet.");
    } finally {
      setSpreadsheetSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncSaving(true);
    try {
      await syncReportsToSpreadsheet({
        url: spreadsheetUrl,
        sheetName,
      });
      const syncedAt = new Date().toISOString();
      setLastSyncAt(syncedAt);
      await AsyncStorage.setItem(LAST_SYNC_AT_KEY, syncedAt);
      Alert.alert("Berhasil", "Data laporan berhasil disinkronkan.");
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Silakan cek URL spreadsheet dan coba lagi.";
      Alert.alert("Error", `Gagal sinkron ke spreadsheet. ${message}`);
    } finally {
      setSyncSaving(false);
    }
  };

  const handleExport = async () => {
    setExportSaving(true);
    try {
      await exportReportsToExcel();
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Silakan coba lagi.";
      Alert.alert("Gagal export Excel", message);
    } finally {
      setExportSaving(false);
    }
  };

  const handleCopyScript = async () => {
    await Clipboard.setStringAsync(APPS_SCRIPT_SNIPPET);
    Alert.alert("Berhasil", "Script Apps Script sudah disalin.");
  };

  const handleOpenTutorialVideo = async () => {
    try {
      await WebBrowser.openBrowserAsync(SPREADSHEET_TUTORIAL_VIDEO_URL);
    } catch {
      Alert.alert("Error", "Gagal membuka video tutorial.");
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={20} color="#2563EB" strokeWidth={2.8} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pengaturan</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroTitle}>Pengaturan aplikasi</Text>
            <Text style={styles.heroSubtitle}>
              Atur profil dan sinkronisasi spreadsheet dari satu tempat.
            </Text>
          </View>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>Aman & cepat</Text>
          </View>
        </View>

        {/* Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profil</Text>
          <View style={styles.card}>
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {userName ? userName[0].toUpperCase() : "?"}
                </Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileLabel}>Nama Pelapor</Text>
                <Text style={styles.profileName}>{userName || "-"}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleRenameOpen}
              activeOpacity={0.8}
            >
              <PenLine
                size={18}
                color="#334155"
                strokeWidth={2.3}
                style={styles.actionBtnIcon}
              />
              <Text style={styles.actionBtnText}>Ubah Nama</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Data Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Target</Text>
            <View style={styles.cardHeaderRow}>
              <TouchableOpacity
                style={styles.helpBtn}
                onPress={() => setSheetHelpModal(true)}
                activeOpacity={0.8}
              >
                <CircleHelp size={14} color="#0E7490" strokeWidth={2.5} />
                <Text style={styles.helpBtnText}>Cara Ambil URL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.copyScriptBtn}
                onPress={handleCopyScript}
                activeOpacity={0.8}
              >
                <Copy size={14} color="#3730A3" strokeWidth={2.5} />
                <Text style={styles.copyScriptBtnText}>Copy code script</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.card}>
            <Text style={styles.profileLabel}>URL Web App / Endpoint</Text>

            <TextInput
              style={styles.input}
              placeholder="https://script.google.com/macros/s/.../exec"
              placeholderTextColor="#9CA3AF"
              value={spreadsheetUrl}
              onChangeText={setSpreadsheetUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.profileLabel}>Nama Sheet / Tab</Text>
            <TextInput
              style={styles.input}
              placeholder={`Kosongkan untuk otomatis (${monthlyDefaultSheet})`}
              placeholderTextColor="#9CA3AF"
              value={sheetName}
              onChangeText={setSheetName}
            />

            <TouchableOpacity
              style={[
                styles.actionBtn,
                styles.actionBtnBlue,
                spreadsheetSaving && styles.actionBtnDisabled,
              ]}
              onPress={handleSpreadsheetConfigSave}
              disabled={spreadsheetSaving}
              activeOpacity={0.8}
            >
              {spreadsheetSaving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Settings
                    size={18}
                    color="#FFFFFF"
                    strokeWidth={2.3}
                    style={styles.actionBtnIcon}
                  />
                  <Text
                    style={[styles.actionBtnText, styles.actionBtnTextWhite]}
                  >
                    Simpan Target Spreadsheet
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.hint}>
              Isi URL endpoint Apps Script. Jika Nama Sheet dikosongkan,
              otomatis pakai format bulan-tahun (contoh: {monthlyDefaultSheet}).
            </Text>
          </View>
          <View style={styles.infoCard}>
            <View style={styles.infoHeaderRow}>
              <Text style={styles.infoTitle}>Status sinkronisasi</Text>
              <View style={styles.infoPill}>
                <Text style={styles.infoPillText}>Riwayat</Text>
              </View>
            </View>
            <Text style={styles.infoLabel}>Terakhir sync</Text>
            <Text style={styles.infoValue}>
              {lastSyncAt ? formatLastSync(lastSyncAt) : "Belum pernah sync"}
            </Text>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Data</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={[
                styles.actionBtn,
                styles.actionBtnBlue,
                syncSaving && styles.actionBtnDisabled,
              ]}
              onPress={handleSync}
              disabled={syncSaving}
              activeOpacity={0.8}
            >
              {syncSaving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <CloudUpload
                    size={18}
                    color="#FFFFFF"
                    strokeWidth={2.3}
                    style={styles.actionBtnIcon}
                  />
                  <Text
                    style={[styles.actionBtnText, styles.actionBtnTextWhite]}
                  >
                    Sinkron ke Spreadsheet
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={styles.hint}>
              Data akan dikirim ke spreadsheet target yang sudah disimpan.
            </Text>
            <TouchableOpacity
              style={[
                styles.actionBtn,
                styles.actionBtnGreen,
                exportSaving && styles.actionBtnDisabled,
              ]}
              onPress={handleExport}
              disabled={exportSaving}
              activeOpacity={0.8}
            >
              {exportSaving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <FileDown
                    size={18}
                    color="#FFFFFF"
                    strokeWidth={2.3}
                    style={styles.actionBtnIcon}
                  />
                  <Text
                    style={[styles.actionBtnText, styles.actionBtnTextWhite]}
                  >
                    Export ke Excel
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={styles.hint}>
              Membuat file .xlsx dari seluruh laporan aktif dan membuka menu
              berbagi perangkat.
            </Text>
          </View>
        </View>

        <View style={styles.developerCard}>
          <Text style={styles.developerLabel}>Developer</Text>
          <Text style={styles.developerName}>Jivi Muzaqi Guntur</Text>
          <Text style={styles.developerNote}>
            Aplikasi ini dikembangkan untuk memudahkan pencatatan dan
            sinkronisasi laporan.
          </Text>
          <Text style={[styles.developerLabel, { marginTop: 10 }]}>
            App Version
          </Text>
          <Text style={styles.developerName}>v1.0.1</Text>
        </View>
      </ScrollView>

      {/* Spreadsheet Tutorial Modal */}
      <Modal
        visible={sheetHelpModal}
        transparent
        animationType="fade"
        onRequestClose={() => setSheetHelpModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Cara Mendapatkan Spreadsheet URL
            </Text>

            <Text style={styles.tutorialText}>
              1. Buka Google Sheet yang mau dipakai.
            </Text>
            <Text style={styles.tutorialText}>
              2. Klik Extensions → Apps Script.
            </Text>
            <Text style={styles.tutorialText}>
              3. Copy code script dari tombol di kanan atas, lalu tempel ke Apps
              Script.
            </Text>
            <Text style={styles.tutorialText}>4. Deploy → New deployment.</Text>
            <Text style={styles.tutorialText}>
              5. Pilih Web app, lalu set Execute as: Me dan Who has access:
              Anyone with the link.
            </Text>
            <Text style={styles.tutorialText}>
              6. Salin URL Web App yang berakhiran /exec, lalu tempel di kolom
              URL di atas.
            </Text>
            <Text style={styles.tutorialText}>
              7. Struktur kolom sinkron: Tujuan, Tipe (in/out), Kategori,
              Nominal, Tanggal, User, created_at, updated_at, deleted_at.
            </Text>
            <Text style={styles.tutorialText}>
              8. Header akan dibuat otomatis oleh script jika belum ada atau
              belum sesuai.
            </Text>
            <Text style={styles.tutorialText}>
              9. Jika sheetName tidak diisi, data otomatis masuk ke tab bulan
              berjalan (format YYYY-MM), jadi tiap bulan membuat tab baru.
            </Text>

            <TouchableOpacity
              style={[styles.actionBtn, styles.videoTutorialBtn]}
              onPress={handleOpenTutorialVideo}
              activeOpacity={0.8}
            >
              <PlayCircle
                size={18}
                color="#FFFFFF"
                strokeWidth={2.3}
                style={styles.actionBtnIcon}
              />
              <Text style={[styles.actionBtnText, styles.actionBtnTextWhite]}>
                Tonton Tutorial Video
              </Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.saveBtn, { flex: 1 }]}
                onPress={() => setSheetHelpModal(false)}
              >
                <Text style={styles.saveBtnText}>Tutup</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Rename Modal */}
      <Modal
        visible={renameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ubah Nama</Text>

            <TextInput
              style={styles.input}
              placeholder="Nama baru"
              placeholderTextColor="#9CA3AF"
              value={newName}
              onChangeText={(t) => {
                setNewName(t);
                if (renameError) setRenameError("");
              }}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleRenameSave}
            />
            {renameError ? (
              <Text style={styles.errorText}>{renameError}</Text>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setRenameModal(false)}
              >
                <Text style={styles.cancelBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, renameSaving && styles.saveBtnDisabled]}
                onPress={handleRenameSave}
                disabled={renameSaving}
              >
                {renameSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Simpan</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F0F7FF" },
  header: {
    backgroundColor: "rgba(255,255,255,0.92)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 56 : 48,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
    textAlign: "center",
  },
  headerRight: { width: 32 },
  content: { padding: 20, paddingBottom: 28 },
  heroCard: {
    backgroundColor: "#1D4ED8",
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    shadowColor: "#1D4ED8",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 5,
  },
  heroTextWrap: { marginBottom: 10 },
  heroTitle: { fontSize: 22, fontWeight: "800", color: "#fff" },
  heroSubtitle: {
    fontSize: 13,
    color: "#DBEAFE",
    marginTop: 6,
    lineHeight: 19,
  },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.6,
  },
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    marginTop: 18,
    borderWidth: 1,
    borderColor: "#DBEAFE",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  infoHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  infoTitle: { fontSize: 14, fontWeight: "800", color: "#0F172A" },
  infoPill: {
    backgroundColor: "#EFF6FF",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  infoPillText: { fontSize: 11, fontWeight: "800", color: "#1D4ED8" },
  infoLabel: { fontSize: 12, color: "#64748B", marginBottom: 4 },
  infoValue: { fontSize: 15, fontWeight: "700", color: "#1E293B" },
  section: { marginBottom: 24 },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  profileRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  avatarText: { color: "#fff", fontSize: 22, fontWeight: "700" },
  profileInfo: { flex: 1 },
  profileLabel: { fontSize: 12, color: "#94A3B8", marginBottom: 2 },
  profileName: { fontSize: 18, fontWeight: "600", color: "#1E293B" },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
    gap: 12,
  },
  copyScriptBtn: {
    flexDirection: "row",
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  copyScriptBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#3730A3",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    minHeight: 52,
    paddingHorizontal: 14,
    marginTop: 6,
  },
  actionBtnBlue: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 4,
  },
  actionBtnGreen: {
    backgroundColor: "#16A34A",
    borderColor: "#16A34A",
    shadowColor: "#16A34A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 4,
  },
  actionBtnDisabled: {
    opacity: 0.65,
    shadowOpacity: 0,
    elevation: 0,
  },
  videoTutorialBtn: {
    backgroundColor: "#DC2626",
    borderColor: "#DC2626",
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 4,
    marginTop: 6,
  },
  actionBtnIcon: { marginRight: 10 },
  actionBtnText: { fontSize: 15, fontWeight: "700", color: "#334155" },
  actionBtnTextWhite: { color: "#fff" },
  hint: { fontSize: 12, color: "#94A3B8", marginTop: 10, textAlign: "center" },
  helpBtn: {
    flexDirection: "row",
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#ECFEFF",
    borderWidth: 1,
    borderColor: "#67E8F9",
    alignItems: "center",
    justifyContent: "center",
  },
  helpBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0E7490",
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 16,
  },
  tutorialText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#334155",
    marginBottom: 10,
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: "#1E293B",
    backgroundColor: "#F8FAFC",
    marginBottom: 6,
  },
  errorText: { color: "#EF4444", fontSize: 13, marginBottom: 8, marginLeft: 2 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  cancelBtn: {
    flex: 1,
    minHeight: 50,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: { fontSize: 15, fontWeight: "600", color: "#64748B" },
  saveBtn: {
    flex: 1,
    minHeight: 50,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    borderWidth: 1,
    borderColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  developerCard: {
    backgroundColor: "#0F172A",
    borderRadius: 18,
    padding: 16,
    marginBottom: 8,
  },
  developerLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#93C5FD",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  developerName: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  developerNote: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: "#CBD5E1",
  },
});
