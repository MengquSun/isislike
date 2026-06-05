import type {
  ExportAttributeKey,
  ExportFieldSort,
  ExportFilters,
  ExportFormat,
} from "../api/export";

const TEMPLATES_KEY = "isislike:export-templates";
const HISTORY_KEY = "isislike:export-history";
const MAX_TEMPLATES = 20;
const MAX_HISTORY = 30;

export interface ExportTemplate {
  id: string;
  name: string;
  filters: ExportFilters;
  attributes: ExportAttributeKey[];
  fieldSort: ExportFieldSort;
  format: ExportFormat;
  createdAt: string;
}

export interface ExportHistoryEntry {
  id: string;
  timestamp: string;
  chemicalCount: number;
  format: ExportFormat;
  fieldSort: ExportFieldSort;
  filterSummary: string;
  filters: ExportFilters;
  attributes: ExportAttributeKey[];
  chemicalIds: string[];
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function listExportTemplates(): ExportTemplate[] {
  return readJson<ExportTemplate[]>(TEMPLATES_KEY, []);
}

export function saveExportTemplate(
  name: string,
  data: Omit<ExportTemplate, "id" | "name" | "createdAt">
): ExportTemplate {
  const templates = listExportTemplates();
  const entry: ExportTemplate = {
    id: crypto.randomUUID(),
    name: name.trim(),
    createdAt: new Date().toISOString(),
    ...data,
  };
  const next = [entry, ...templates.filter((t) => t.name !== entry.name)].slice(
    0,
    MAX_TEMPLATES
  );
  writeJson(TEMPLATES_KEY, next);
  return entry;
}

export function deleteExportTemplate(id: string): void {
  writeJson(
    TEMPLATES_KEY,
    listExportTemplates().filter((t) => t.id !== id)
  );
}

export function listExportHistory(): ExportHistoryEntry[] {
  return readJson<ExportHistoryEntry[]>(HISTORY_KEY, []);
}

export function addExportHistory(
  entry: Omit<ExportHistoryEntry, "id" | "timestamp">
): ExportHistoryEntry {
  const history = listExportHistory();
  const row: ExportHistoryEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...entry,
  };
  writeJson(HISTORY_KEY, [row, ...history].slice(0, MAX_HISTORY));
  return row;
}

export function deleteExportHistoryEntry(id: string): void {
  writeJson(HISTORY_KEY, listExportHistory().filter((h) => h.id !== id));
}

export function buildFilterSummary(filters: ExportFilters, allChemicals = false): string {
  if (allChemicals) return "All chemicals";
  const parts: string[] = [];
  if (filters.canonical_smiles?.trim()) {
    parts.push(`SMILES: ${filters.canonical_smiles.trim()}`);
  }
  if (filters.formula?.trim()) {
    parts.push(`Formula: ${filters.formula.trim()}`);
  }
  if (filters.name?.trim()) {
    parts.push(`Name: ${filters.name.trim()}`);
  }
  return parts.length > 0 ? parts.join("; ") : "No filters (all)";
}
