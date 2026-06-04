/**
 * All chemical operations go through the RDKit microservice.
 * The frontend NEVER writes SMILES directly to Supabase.
 */

/** Production Netlify: empty → same-origin /api (proxied in netlify.toml). Dev: local backend. */
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

function formatNetworkError(op: string, err: unknown): string {
  if (err instanceof TypeError) {
    const hint = import.meta.env.DEV
      ? "Is the backend running on http://localhost:8000?"
      : "Redeploy Netlify after setting VITE_CHEMINFORMATICS_API_URL or the /api proxy in netlify.toml.";
    return `${op}: cannot reach API. ${hint}`;
  }
  return err instanceof Error ? err.message : `${op} failed`;
}

export interface Molecule {
  id: string;
  canonical_smiles: string;
  molecular_weight?: number | null;
  molecular_formula?: string | null;
  similarity?: number | null;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(apiUrl(`/api${path}`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error(formatNetworkError("Request", e));
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

export async function listMolecules(limit = 500): Promise<Molecule[]> {
  let res: Response;
  try {
    res = await fetch(apiUrl(`/api/molecules?limit=${limit}`));
  } catch (e) {
    throw new Error(formatNetworkError("See All", e));
  }
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
