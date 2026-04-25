export interface Report {
  id: string;
  title: string;
  description: string;
  category: string;
  transactionType: "in" | "out";
  is_sinc: 0 | 1;
  syncedSheet: string | null;
  amount?: number;
  date: string; // "YYYY-MM-DD"
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  name: string;
}

export type ReportFormData = Omit<
  Report,
  "id" | "createdAt" | "updatedAt" | "is_sinc" | "syncedSheet"
>;
