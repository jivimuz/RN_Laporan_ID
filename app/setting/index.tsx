import {
  getDefaultMonthlySheetName,
  getSpreadsheetConfig,
  saveSpreadsheetConfig,
  syncReportsToSpreadsheet,
} from "@/services/spreadsheetService";
import { getUserName, saveUserName } from "@/services/userService";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
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

export default function SettingsScreen() {
  const monthlyDefaultSheet = getDefaultMonthlySheetName();
  const [userName, setUserName] = useState("");
  const [spreadsheetUrl, setSpreadsheetUrl] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [sheetHelpModal, setSheetHelpModal] = useState(false);
  const [renameModal, setRenameModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [renameError, setRenameError] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [syncSaving, setSyncSaving] = useState(false);
  const [spreadsheetSaving, setSpreadsheetSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const [name, config] = await Promise.all([
      getUserName(),
      getSpreadsheetConfig(),
    ]);

    if (name) setUserName(name);
    setSpreadsheetUrl(config.url);
    setSheetName(config.sheetName);
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

  const handleCopyScript = async () => {
    await Clipboard.setStringAsync(APPS_SCRIPT_SNIPPET);
    Alert.alert("Berhasil", "Script Apps Script sudah disalin.");
  };

  const handleOpenTutorialVideo = async () => {
    try {
      const supported = await Linking.canOpenURL(
        SPREADSHEET_TUTORIAL_VIDEO_URL,
      );
      if (!supported) {
        Alert.alert(
          "Error",
          "Link tutorial tidak bisa dibuka di perangkat ini.",
        );
        return;
      }
      await Linking.openURL(SPREADSHEET_TUTORIAL_VIDEO_URL);
    } catch {
      Alert.alert("Error", "Gagal membuka video tutorial.");
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pengaturan</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
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
                <Text style={styles.profileLabel}>Nama</Text>
                <Text style={styles.profileName}>{userName || "-"}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleRenameOpen}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnIcon}>✏️</Text>
              <Text style={styles.actionBtnText}>Ubah Nama</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Data Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Spreadsheet Target</Text>
            <View style={styles.cardHeaderRow}>
              <TouchableOpacity
                style={styles.helpBtn}
                onPress={() => setSheetHelpModal(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.helpBtnText}>? Cara Ambil URL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.copyScriptBtn}
                onPress={handleCopyScript}
                activeOpacity={0.8}
              >
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
              style={[styles.actionBtn, styles.actionBtnBlue]}
              onPress={handleSpreadsheetConfigSave}
              disabled={spreadsheetSaving}
              activeOpacity={0.8}
            >
              {spreadsheetSaving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={styles.actionBtnIcon}>⚙️</Text>
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

          <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Data</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnBlue]}
              onPress={handleSync}
              disabled={syncSaving}
              activeOpacity={0.8}
            >
              {syncSaving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={styles.actionBtnIcon}>☁️</Text>
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
          </View>
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
              <Text style={styles.actionBtnIcon}>▶️</Text>
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
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 56 : 48,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backBtn: { padding: 4, marginRight: 8 },
  backIcon: { fontSize: 22, color: "#3B82F6" },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
    textAlign: "center",
  },
  headerRight: { width: 32 },
  content: { padding: 20 },
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
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
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
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#E0E7FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  copyScriptBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4338CA",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    padding: 14,
    marginTop: 4,
  },
  actionBtnBlue: { backgroundColor: "#3B82F6" },
  videoTutorialBtn: {
    backgroundColor: "#DC2626",
    marginTop: 4,
  },
  actionBtnIcon: { fontSize: 18, marginRight: 10 },
  actionBtnText: { fontSize: 15, fontWeight: "600", color: "#334155" },
  actionBtnTextWhite: { color: "#fff" },
  hint: { fontSize: 12, color: "#94A3B8", marginTop: 10, textAlign: "center" },
  helpBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#E0F2FE",
    borderWidth: 1,
    borderColor: "#7DD3FC",
  },
  helpBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0369A1",
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
    padding: 14,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
  },
  cancelBtnText: { fontSize: 15, fontWeight: "600", color: "#64748B" },
  saveBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: "#3B82F6",
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
