import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import {
  createReport,
  deleteReport,
  getReportsByMonth,
  updateReport,
} from '../../services/storage';
import { getUserName } from '../../services/userService';
import { Report, ReportFormData } from '../../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

const CATEGORIES = ['Umum', 'Keuangan', 'Operasional', 'SDM', 'Lainnya'];

const today = new Date();

// Month button: width (56) + gap (6) + marginRight approximation = ~62px, padded to 68 for scroll
const MONTH_ITEM_WIDTH = 62;
// Delay in ms to let the layout settle before auto-scrolling
const MONTH_SCROLL_DELAY_MS = 300;

const buildYears = () => {
  const current = today.getFullYear();
  return [current - 2, current - 1, current, current + 1];
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1)
    .toString()
    .padStart(2, '0')}/${d.getFullYear()}`;
};

const emptyForm = (): ReportFormData => ({
  title: '',
  description: '',
  category: CATEGORIES[0],
  amount: undefined,
  date: today.toISOString().split('T')[0],
});

// ─── Report Form Modal ─────────────────────────────────────────────────────────

interface FormModalProps {
  visible: boolean;
  mode: 'create' | 'edit';
  initialData?: Report;
  onClose: () => void;
  onSave: (data: ReportFormData) => Promise<void>;
}

function ReportFormModal({ visible, mode, initialData, onClose, onSave }: FormModalProps) {
  const [form, setForm] = useState<ReportFormData>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof ReportFormData, string>>>({});

  useEffect(() => {
    if (visible) {
      if (mode === 'edit' && initialData) {
        setForm({
          title: initialData.title,
          description: initialData.description,
          category: initialData.category,
          amount: initialData.amount,
          date: initialData.date,
        });
      } else {
        setForm(emptyForm());
      }
      setErrors({});
    }
  }, [visible, mode, initialData]);

  const validate = () => {
    const e: Partial<Record<keyof ReportFormData, string>> = {};
    if (!form.title.trim()) e.title = 'Judul wajib diisi';
    if (!form.description.trim()) e.description = 'Deskripsi wajib diisi';
    if (!form.date) e.date = 'Tanggal wajib diisi';
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch {
      Alert.alert('Error', 'Gagal menyimpan data.');
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof ReportFormData, value: string | number | undefined) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>
            {mode === 'create' ? 'Buat Laporan Baru' : 'Edit Laporan'}
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <FormField label="Judul *" error={errors.title}>
              <TextInput
                style={[styles.input, errors.title && styles.inputError]}
                placeholder="Judul laporan"
                placeholderTextColor="#9CA3AF"
                value={form.title}
                onChangeText={(t) => set('title', t)}
              />
            </FormField>

            <FormField label="Deskripsi *" error={errors.description}>
              <TextInput
                style={[styles.input, styles.textArea, errors.description && styles.inputError]}
                placeholder="Isi deskripsi laporan"
                placeholderTextColor="#9CA3AF"
                value={form.description}
                onChangeText={(t) => set('description', t)}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </FormField>

            <FormField label="Kategori">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.chip, form.category === cat && styles.chipActive]}
                    onPress={() => set('category', cat)}
                  >
                    <Text style={[styles.chipText, form.category === cat && styles.chipTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </FormField>

            <FormField label="Nominal (opsional)">
              <TextInput
                style={styles.input}
                placeholder="Contoh: 500000"
                placeholderTextColor="#9CA3AF"
                value={form.amount?.toString() ?? ''}
                onChangeText={(t) => {
                  // Remove non-numeric characters except a single leading decimal point
                  const cleaned = t.replace(/[^0-9.]/g, '').replace(/^(\d*\.?\d*).*$/, '$1');
                  set('amount', cleaned ? parseFloat(cleaned) : undefined);
                }}
                keyboardType="numeric"
              />
            </FormField>

            <FormField label="Tanggal *" error={errors.date}>
              <TextInput
                style={[styles.input, errors.date && styles.inputError]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9CA3AF"
                value={form.date}
                onChangeText={(t) => set('date', t)}
                keyboardType="numbers-and-punctuation"
              />
            </FormField>
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Simpan</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── View Modal ────────────────────────────────────────────────────────────────

interface ViewModalProps {
  visible: boolean;
  report: Report | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function ReportViewModal({ visible, report, onClose, onEdit, onDelete }: ViewModalProps) {
  if (!report) return null;

  const handleDelete = () => {
    Alert.alert(
      'Hapus Laporan',
      `Yakin ingin menghapus "${report.title}"?`,
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Hapus', style: 'destructive', onPress: onDelete },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.viewHeader}>
            <Text style={styles.modalTitle} numberOfLines={2}>{report.title}</Text>
            <View style={[styles.badge, { backgroundColor: badgeColor(report.category) }]}>
              <Text style={styles.badgeText}>{report.category}</Text>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <InfoRow label="Tanggal" value={formatDate(report.date)} />
            {report.amount != null && (
              <InfoRow
                label="Nominal"
                value={`Rp ${report.amount.toLocaleString('id-ID')}`}
              />
            )}
            <InfoRow label="Dibuat" value={formatDate(report.createdAt)} />
            <InfoRow label="Diperbarui" value={formatDate(report.updatedAt)} />

            <View style={styles.descBox}>
              <Text style={styles.descLabel}>Deskripsi</Text>
              <Text style={styles.descText}>{report.description}</Text>
            </View>
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
              <Text style={styles.deleteBtnText}>🗑 Hapus</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.editBtn} onPress={onEdit}>
              <Text style={styles.editBtnText}>✏️ Edit</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.closeBtnFull} onPress={onClose}>
            <Text style={styles.closeBtnFullText}>Tutup</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Helper subcomponents ──────────────────────────────────────────────────────

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const BADGE_COLORS: Record<string, string> = {
  Umum: '#6366F1',
  Keuangan: '#10B981',
  Operasional: '#F59E0B',
  SDM: '#EC4899',
  Lainnya: '#94A3B8',
};

const badgeColor = (cat: string) => BADGE_COLORS[cat] ?? '#94A3B8';

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const [userName, setUserName] = useState('');
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());

  const [createModal, setCreateModal] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  const monthScrollRef = useRef<ScrollView>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [name, data] = await Promise.all([
      getUserName(),
      getReportsByMonth(selectedMonth, selectedYear),
    ]);
    if (name) setUserName(name);
    setReports(data);
    setLoading(false);
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Scroll month selector to selected month
  useEffect(() => {
    setTimeout(() => {
      monthScrollRef.current?.scrollTo({ x: (selectedMonth - 1) * MONTH_ITEM_WIDTH, animated: true });
    }, MONTH_SCROLL_DELAY_MS);
  }, [selectedMonth]);

  const handleCreate = async (data: ReportFormData) => {
    await createReport(data);
    await loadData();
  };

  const handleUpdate = async (data: ReportFormData) => {
    if (!selectedReport) return;
    await updateReport(selectedReport.id, data);
    setSelectedReport(null);
    await loadData();
  };

  const handleDelete = async () => {
    if (!selectedReport) return;
    await deleteReport(selectedReport.id);
    setViewModal(false);
    setSelectedReport(null);
    await loadData();
  };

  const openView = (report: Report) => {
    setSelectedReport(report);
    setViewModal(true);
  };

  const openEdit = () => {
    setViewModal(false);
    setEditModal(true);
  };

  const years = buildYears();

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>Halo, {userName || '...'} 👋</Text>
          <Text style={styles.headerSub}>Laporan Anda</Text>
        </View>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => router.push('/settings')}
          activeOpacity={0.7}
        >
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* ── Filter + Action Row ── */}
      <View style={styles.filterRow}>
        {/* Year picker */}
        <View style={styles.yearPicker}>
          {years.map((y) => (
            <TouchableOpacity
              key={y}
              style={[styles.yearBtn, selectedYear === y && styles.yearBtnActive]}
              onPress={() => setSelectedYear(y)}
            >
              <Text style={[styles.yearBtnText, selectedYear === y && styles.yearBtnTextActive]}>
                {y}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* New Report Button */}
        <TouchableOpacity
          style={styles.inputBtn}
          onPress={() => setCreateModal(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.inputBtnText}>+ Input</Text>
        </TouchableOpacity>
      </View>

      {/* ── Month Selector ── */}
      <ScrollView
        ref={monthScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.monthRow}
        style={styles.monthScroll}
      >
        {MONTHS.map((m, i) => {
          const num = i + 1;
          const active = selectedMonth === num;
          return (
            <TouchableOpacity
              key={m}
              style={[styles.monthBtn, active && styles.monthBtnActive]}
              onPress={() => setSelectedMonth(num)}
            >
              <Text style={[styles.monthBtnText, active && styles.monthBtnTextActive]}>{m}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── List ── */}
      {loading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : reports.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>Belum ada laporan</Text>
          <Text style={styles.emptySubtitle}>
            {'Tap tombol "+ Input" untuk menambahkan laporan baru'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.reportCard}
              onPress={() => openView(item)}
              activeOpacity={0.85}
            >
              <View style={styles.reportCardLeft}>
                <View style={[styles.catDot, { backgroundColor: badgeColor(item.category) }]} />
              </View>
              <View style={styles.reportCardBody}>
                <View style={styles.reportCardTop}>
                  <Text style={styles.reportTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.reportDate}>{formatDate(item.date)}</Text>
                </View>
                <Text style={styles.reportDesc} numberOfLines={2}>
                  {item.description}
                </Text>
                <View style={styles.reportCardBottom}>
                  <View style={[styles.badge, { backgroundColor: badgeColor(item.category) + '22' }]}>
                    <Text style={[styles.badgeText, { color: badgeColor(item.category) }]}>
                      {item.category}
                    </Text>
                  </View>
                  {item.amount != null && (
                    <Text style={styles.reportAmount}>
                      Rp {item.amount.toLocaleString('id-ID')}
                    </Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* ── Modals ── */}
      <ReportFormModal
        visible={createModal}
        mode="create"
        onClose={() => setCreateModal(false)}
        onSave={handleCreate}
      />

      <ReportViewModal
        visible={viewModal}
        report={selectedReport}
        onClose={() => { setViewModal(false); setSelectedReport(null); }}
        onEdit={openEdit}
        onDelete={handleDelete}
      />

      <ReportFormModal
        visible={editModal}
        mode="edit"
        initialData={selectedReport ?? undefined}
        onClose={() => { setEditModal(false); setSelectedReport(null); }}
        onSave={handleUpdate}
      />
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F7FF' },

  // Header
  header: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 48,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerLeft: { flex: 1 },
  greeting: { fontSize: 20, fontWeight: '700', color: '#1E293B' },
  headerSub: { fontSize: 13, color: '#64748B', marginTop: 2 },
  settingsBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsIcon: { fontSize: 20 },

  // Filter Row
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  yearPicker: { flexDirection: 'row', gap: 6 },
  yearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  yearBtnActive: { backgroundColor: '#3B82F6' },
  yearBtnText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  yearBtnTextActive: { color: '#fff' },
  inputBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  inputBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Month Selector
  monthScroll: { backgroundColor: '#fff', maxHeight: 52 },
  monthRow: { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  monthBtn: {
    width: 56,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  monthBtnActive: { backgroundColor: '#3B82F6' },
  monthBtnText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  monthBtnTextActive: { color: '#fff' },

  // Empty
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 20 },

  // List
  listContent: { padding: 16, gap: 12 },
  reportCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  reportCardLeft: { justifyContent: 'flex-start', paddingTop: 4, marginRight: 12 },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  reportCardBody: { flex: 1 },
  reportCardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  reportTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#1E293B', marginRight: 8 },
  reportDate: { fontSize: 12, color: '#94A3B8' },
  reportDesc: { fontSize: 13, color: '#64748B', lineHeight: 18, marginBottom: 8 },
  reportCardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reportAmount: { fontSize: 13, fontWeight: '700', color: '#10B981' },

  // Badge
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  // Modal shared
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#CBD5E1',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1E293B', marginBottom: 20 },

  // Form modal
  fieldWrapper: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#1E293B',
    backgroundColor: '#F8FAFC',
  },
  inputError: { borderColor: '#EF4444' },
  textArea: { height: 100, textAlignVertical: 'top' },
  fieldError: { color: '#EF4444', fontSize: 12, marginTop: 4 },
  chipRow: { flexDirection: 'row', marginTop: 2 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chipActive: { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  chipTextActive: { color: '#3B82F6' },

  // Buttons
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: '#64748B' },
  saveBtn: {
    flex: 2,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // View modal
  viewHeader: { marginBottom: 16 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoLabel: { fontSize: 13, color: '#94A3B8', fontWeight: '500' },
  infoValue: { fontSize: 14, color: '#1E293B', fontWeight: '600', flex: 1, textAlign: 'right' },
  descBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 14,
    marginTop: 16,
    marginBottom: 8,
  },
  descLabel: { fontSize: 12, color: '#94A3B8', fontWeight: '600', marginBottom: 6 },
  descText: { fontSize: 14, color: '#334155', lineHeight: 20 },
  deleteBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
  },
  deleteBtnText: { fontSize: 14, fontWeight: '700', color: '#EF4444' },
  editBtn: {
    flex: 2,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
  },
  editBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  closeBtnFull: {
    marginTop: 10,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  closeBtnFullText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
});
