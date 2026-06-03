/**
 * All chemical operations go through the RDKit microservice.
 * The frontend NEVER writes SMILES directly to Supabase.
 */

const API_BASE =
  import.meta.env.VITE_CHEMINFORMATICS_API_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

export interface Molecule {
  id: string;
  canonical_smiles: string;
  molecular_weight?: number | null;
  molecular_formula?: string | null;
  similarity?: number | null;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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

export async function listMolecules(limit = 500): Promise<Molecule[]> {
  const res = await fetch(`${API_BASE}/api/molecules?limit=${limit}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(
      typeof err.detail === "string" ? err.detail : `List failed (${res.status})`
    );
  }
  return res.json();
}

export async function saveMolecule(smiles: string): Promise<Molecule> {
  return post<Molecule>("/molecules/save", { smiles });
}

export async function exactSearch(smiles: string): Promise<Molecule | null> {
  return post<Molecule | null>("/molecules/search/exact", { smiles });
}

export async function substructureSearch(
  smarts: string
): Promise<Molecule[]> {
  return post<Molecule[]>("/molecules/search/substructure", { smarts });
}

export async function similaritySearch(
  smiles: string,
  matchThreshold = 0.7,
  matchCount = 50
): Promise<Molecule[]> {
  return post<Molecule[]>("/molecules/search/similarity", {
    smiles,
    match_threshold: matchThreshold,
    match_count: matchCount,
  });
}
