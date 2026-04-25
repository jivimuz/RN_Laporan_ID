export interface Report {
  id: string;
  title: string;
  description: string;
  category: string;
  amount?: number;
  date: string; // "YYYY-MM-DD"
  createdAt: string;
  updatedAt: string;
}

export interface User {
  name: string;
}

export type ReportFormData = Omit<Report, 'id' | 'createdAt' | 'updatedAt'>;
