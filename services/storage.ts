import AsyncStorage from '@react-native-async-storage/async-storage';
import { Report, ReportFormData } from '../types';

const REPORTS_KEY = 'reports_data';

const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
};

export const getReports = async (): Promise<Report[]> => {
  try {
    const json = await AsyncStorage.getItem(REPORTS_KEY);
    if (!json) return [];
    return JSON.parse(json) as Report[];
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
    createdAt: now,
    updatedAt: now,
  };
  reports.push(report);
  await AsyncStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
  return report;
};

export const updateReport = async (
  id: string,
  data: Partial<ReportFormData>
): Promise<Report | null> => {
  const reports = await getReports();
  const index = reports.findIndex((r) => r.id === id);
  if (index === -1) return null;
  const updated: Report = {
    ...reports[index],
    ...data,
    updatedAt: new Date().toISOString(),
  };
  reports[index] = updated;
  await AsyncStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
  return updated;
};

export const deleteReport = async (id: string): Promise<void> => {
  const reports = await getReports();
  const filtered = reports.filter((r) => r.id !== id);
  await AsyncStorage.setItem(REPORTS_KEY, JSON.stringify(filtered));
};

export const getReportsByMonth = async (
  month: number,
  year: number
): Promise<Report[]> => {
  const reports = await getReports();
  return reports.filter((r) => {
    // Parse YYYY-MM-DD in local time to avoid UTC off-by-one issues
    const [y, m] = r.date.split('-').map(Number);
    return m === month && y === year;
  });
};

export const getAllReportsJson = async (): Promise<string> => {
  const reports = await getReports();
  return JSON.stringify(reports, null, 2);
};
