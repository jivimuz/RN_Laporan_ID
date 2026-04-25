import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { getAllReportsJson } from '../services/storage';
import { getUserName, saveUserName } from '../services/userService';

export default function SettingsScreen() {
  const [userName, setUserName] = useState('');
  const [renameModal, setRenameModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [renameError, setRenameError] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const name = await getUserName();
    if (name) setUserName(name);
  };

  const handleRenameOpen = () => {
    setNewName(userName);
    setRenameError('');
    setRenameModal(true);
  };

  const handleRenameSave = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setRenameError('Nama tidak boleh kosong');
      return;
    }
    setRenameSaving(true);
    try {
      await saveUserName(trimmed);
      setUserName(trimmed);
      setRenameModal(false);
    } catch {
      setRenameError('Gagal menyimpan nama. Coba lagi.');
    } finally {
      setRenameSaving(false);
    }
  };

  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      // Fetch all data to backup
      const data = await getAllReportsJson();

      // In a real implementation, this would:
      // 1. Use expo-auth-session to authenticate with Google OAuth
      // 2. Upload the data file to Google Drive via the Drive API
      // For now we show a preview of the data that would be backed up
      Alert.alert(
        'Backup Data',
        `Fitur backup ke Google Drive memerlukan konfigurasi OAuth.\n\nData yang akan di-backup:\n${data.length > 200 ? data.slice(0, 200) + '...' : data || '(Tidak ada data)'}`,
        [{ text: 'OK' }]
      );
    } catch {
      Alert.alert('Error', 'Gagal mengambil data untuk backup.');
    } finally {
      setBackupLoading(false);
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
                  {userName ? userName[0].toUpperCase() : '?'}
                </Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileLabel}>Nama</Text>
                <Text style={styles.profileName}>{userName || '-'}</Text>
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
          <Text style={styles.sectionTitle}>Data</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnBlue]}
              onPress={handleBackup}
              disabled={backupLoading}
              activeOpacity={0.8}
            >
              {backupLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={styles.actionBtnIcon}>☁️</Text>
                  <Text style={[styles.actionBtnText, styles.actionBtnTextWhite]}>
                    Backup ke Google Drive
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={styles.hint}>
              Backup semua data laporan ke akun Google Drive Anda
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Rename Modal */}
      <Modal
        visible={renameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
                if (renameError) setRenameError('');
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
  container: { flex: 1, backgroundColor: '#F0F7FF' },
  header: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 48,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: { padding: 4, marginRight: 8 },
  backIcon: { fontSize: 22, color: '#3B82F6' },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700', color: '#1E293B', textAlign: 'center' },
  headerRight: { width: 32 },
  content: { padding: 20 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  profileInfo: { flex: 1 },
  profileLabel: { fontSize: 12, color: '#94A3B8', marginBottom: 2 },
  profileName: { fontSize: 18, fontWeight: '600', color: '#1E293B' },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 14,
    marginTop: 4,
  },
  actionBtnBlue: { backgroundColor: '#3B82F6' },
  actionBtnIcon: { fontSize: 18, marginRight: 10 },
  actionBtnText: { fontSize: 15, fontWeight: '600', color: '#334155' },
  actionBtnTextWhite: { color: '#fff' },
  hint: { fontSize: 12, color: '#94A3B8', marginTop: 10, textAlign: 'center' },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1E293B', marginBottom: 16 },
  input: {
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#1E293B',
    backgroundColor: '#F8FAFC',
    marginBottom: 6,
  },
  errorText: { color: '#EF4444', fontSize: 13, marginBottom: 8, marginLeft: 2 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: '#64748B' },
  saveBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
