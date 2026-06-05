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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(apiUrl(`/api${path}`), init);
  } catch (e) {
    const hint = import.meta.env.DEV
      ? "Start the backend on port 8000."
      : "Check API URL / Netlify proxy.";
    throw new Error(
      e instanceof TypeError ? `Cannot reach API. ${hint}` : String(e)
    );
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail =
      typeof err.detail === "string"
        ? err.detail
        : JSON.stringify(err.detail ?? err);
    throw new Error(detail || `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export type FieldType = "text" | "number" | "date" | "select";

export interface Database {
  id: string;
  name: string;
  description?: string | null;
  created_at?: string | null;
}

export interface FieldDefinition {
  id: string;
  database_id: string;
  name: string;
  field_type: FieldType;
  options?: { choices?: string[] } | null;
  sort_order: number;
  created_at?: string | null;
}

export interface RecordValue {
  field_id: string;
  field_name?: string | null;
  field_type?: FieldType | null;
  text_value?: string | null;
  number_value?: number | null;
  date_value?: string | null;
}

export interface LinkedDatabaseRecord {
  record_id: string;
  database_id: string;
  database_name: string;
  canonical_smiles: string;
  created_at?: string | null;
  updated_at?: string | null;
  values: RecordValue[];
}

export interface MoleculeDatabaseRecord {
  id: string;
  molecule_id: string;
  source_database: string;
  database_id: string;
  created_at?: string | null;
  updated_at?: string | null;
  values: RecordValue[];
}

export interface MoleculeDatabaseRecordFilters {
  source_database?: string;
  field_name?: string;
  keyword?: string;
  date_from?: string;
  date_to?: string;
}

export interface DatabaseRecord {
  id: string;
  database_id: string;
  molecule_id: string;
  canonical_smiles: string;
  created_at?: string | null;
  updated_at?: string | null;
  values: RecordValue[];
}

export async function listDatabases(): Promise<Database[]> {
  return request<Database[]>("/databases");
}

export async function createDatabase(data: {
  name: string;
  description?: string | null;
}): Promise<Database> {
  return post<Database>("/databases", data);
}

export async function getDatabase(id: string): Promise<Database> {
  return request<Database>(`/databases/${id}`);
}

export async function listFields(databaseId: string): Promise<FieldDefinition[]> {
  return request<FieldDefinition[]>(`/databases/${databaseId}/fields`);
}

export async function createField(
  databaseId: string,
  data: {
    name: string;
    field_type: FieldType;
    options?: { choices: string[] };
    sort_order?: number;
  }
): Promise<FieldDefinition> {
  return post<FieldDefinition>(`/databases/${databaseId}/fields`, data);
}

export async function updateField(
  databaseId: string,
  fieldId: string,
  data: Partial<{
    name: string;
    field_type: FieldType;
    options: { choices: string[] };
    sort_order: number;
  }>
): Promise<FieldDefinition> {
  return request<FieldDefinition>(
    `/databases/${databaseId}/fields/${fieldId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }
  );
}

export async function deleteField(
  databaseId: string,
  fieldId: string
): Promise<void> {
  await request<void>(`/databases/${databaseId}/fields/${fieldId}`, {
    method: "DELETE",
  });
}

export async function listRecords(
  databaseId: string
): Promise<DatabaseRecord[]> {
  return request<DatabaseRecord[]>(`/databases/${databaseId}/records`);
}

export async function createRecord(
  databaseId: string,
  data: {
    smiles: string;
    values: Record<string, string | number | null>;
  }
): Promise<DatabaseRecord> {
  return post<DatabaseRecord>(`/databases/${databaseId}/records`, data);
}

export async function updateRecord(
  databaseId: string,
  recordId: string,
  data: {
    smiles?: string;
    values?: Record<string, string | number | null>;
  }
): Promise<DatabaseRecord> {
  return request<DatabaseRecord>(
    `/databases/${databaseId}/records/${recordId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }
  );
}

export async function deleteRecord(
  databaseId: string,
  recordId: string
): Promise<void> {
  await request<void>(`/databases/${databaseId}/records/${recordId}`, {
    method: "DELETE",
  });
}

export function recordValueDisplay(v: RecordValue | undefined): string {
  if (!v) return "—";
  if (v.number_value != null && v.number_value !== undefined) {
    return String(v.number_value);
  }
  if (v.date_value) return v.date_value;
  if (v.text_value) return v.text_value;
  return "—";
}

export function valuesMapFromRecord(
  record: DatabaseRecord
): Record<string, string | number | null> {
  const map: Record<string, string | number | null> = {};
  for (const v of record.values) {
    if (v.number_value != null) map[v.field_id] = v.number_value;
    else if (v.date_value) map[v.field_id] = v.date_value;
    else map[v.field_id] = v.text_value ?? null;
  }
  return map;
}
