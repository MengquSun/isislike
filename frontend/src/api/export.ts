function resolveApiBase(): string {
  const fromEnv = import.meta.env.VITE_CHEMINFORMATICS_API_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (import.meta.env.DEV) return "http://localhost:8000";
  return "";
}

const API_BASE = resolveApiBase();

function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${p}` : p;
}

function exportHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extra,
  };
  const key = import.meta.env.VITE_EXPORT_API_KEY;
  if (key) {
    headers["X-Export-Key"] = key;
  }
  return headers;
}

async function parseError(res: Response, fallback: string): Promise<never> {
  const err = await res.json().catch(() => ({ detail: res.statusText }));
  const detail =
    typeof err.detail === "string"
      ? err.detail
      : JSON.stringify(err.detail ?? err);
  throw new Error(detail || `${fallback} (${res.status})`);
}

export interface ExportFilters {
  canonical_smiles?: string;
  formula?: string;
  name?: string;
}

export interface ExportPreviewChemical {
  id: string;
  name?: string | null;
  canonical_smiles: string;
  formula?: string | null;
}

export type ExportFormat = "xlsx" | "csv";
export type ExportFieldSort = "alphabetical" | "definition_order";

export interface ExportConfig {
  enabled: boolean;
  require_key: boolean;
}

export const EXPORT_ATTRIBUTE_OPTIONS = [
  { key: "canonical_smiles", label: "Canonical SMILES" },
  { key: "molecular_weight", label: "Molecular weight" },
  { key: "molecular_formula", label: "Formula" },
  { key: "created_at", label: "Created" },
  { key: "updated_at", label: "Updated" },
  { key: "name", label: "Name" },
  { key: "notes", label: "Notes" },
  { key: "structure_image", label: "2D structure" },
] as const;

export type ExportAttributeKey = (typeof EXPORT_ATTRIBUTE_OPTIONS)[number]["key"];

export const DEFAULT_EXPORT_ATTRIBUTES: ExportAttributeKey[] =
  EXPORT_ATTRIBUTE_OPTIONS.map((o) => o.key);

let configCache: ExportConfig | null = null;

export async function fetchExportConfig(): Promise<ExportConfig> {
  if (configCache) return configCache;
  const res = await fetch(apiUrl("/api/export/config"));
  if (!res.ok) {
    return { enabled: false, require_key: false };
  }
  configCache = (await res.json()) as ExportConfig;
  return configCache;
}

export function clearExportConfigCache(): void {
  configCache = null;
}

export async function previewExport(
  filters: ExportFilters,
  options?: { allChemicals?: boolean }
): Promise<ExportPreviewChemical[]> {
  const res = await fetch(apiUrl("/api/export/preview"), {
    method: "POST",
    headers: exportHeaders(),
    body: JSON.stringify({
      filters,
      all_chemicals: options?.allChemicals ?? false,
    }),
  });
  if (!res.ok) {
    await parseError(res, "Preview failed");
  }
  const data = (await res.json()) as { chemicals: ExportPreviewChemical[] };
  return data.chemicals;
}

export interface CustomExportOptions {
  format?: ExportFormat;
  fieldSort?: ExportFieldSort;
}

export async function customExport(
  chemicalIds: string[],
  attributes: ExportAttributeKey[],
  options?: CustomExportOptions
): Promise<{ blob: Blob; filename: string }> {
  const format = options?.format ?? "xlsx";
  const res = await fetch(apiUrl("/api/export/custom"), {
    method: "POST",
    headers: exportHeaders(),
    body: JSON.stringify({
      chemical_ids: chemicalIds,
      attributes,
      format,
      field_sort: options?.fieldSort ?? "alphabetical",
    }),
  });
  if (!res.ok) {
    await parseError(res, "Export failed");
  }
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? (format === "csv" ? "custom_export.zip" : "custom_export.xlsx");
  return { blob: await res.blob(), filename };
}
