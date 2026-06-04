import { useCallback, useEffect, useState } from "react";
import {
  exactSearch,
  listMolecules,
  saveMolecule,
  similaritySearch,
  substructureSearch,
  type ImportResult,
  type Molecule,
} from "./api/cheminformatics";
import ErrorBoundary from "./components/ErrorBoundary";
import KetcherEditor, { type KetcherHandle } from "./components/KetcherEditor";
import MoleculeDetailDrawer from "./components/MoleculeDetailDrawer";
import MoleculeImport from "./components/MoleculeImport";
import MoleculeTable from "./components/MoleculeTable";

type SearchMode = "save" | "exact" | "substructure" | "similarity" | "browse";

function upsertRow(rows: Molecule[], updated: Molecule): Molecule[] {
  const i = rows.findIndex((r) => r.id === updated.id);
  if (i < 0) return rows;
  const next = [...rows];
  next[i] = { ...next[i], ...updated };
  return next;
}

function removeRow(rows: Molecule[], id: string): Molecule[] {
  return rows.filter((r) => r.id !== id);
}

export default function App() {
  const [ketcher, setKetcher] = useState<KetcherHandle | null>(null);
  const [mode, setMode] = useState<SearchMode>("save");
  const [loading, setLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [status, setStatus] = useState<{
    type: "info" | "error" | "success";
    message: string;
  } | null>(null);
  const [results, setResults] = useState<Molecule[]>([]);
  const [catalog, setCatalog] = useState<Molecule[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [singleResult, setSingleResult] = useState<Molecule | null>(null);
  const [threshold, setThreshold] = useState(0.7);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refreshCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      setCatalogError(null);
      const rows = await listMolecules(500);
      setCatalog(rows);
      return rows;
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Could not load molecules";
      setCatalogError(message);
      return [];
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  const handleSeeAll = useCallback(async () => {
    setMode("browse");
    setResults([]);
    setSingleResult(null);
    setStatus(null);
    const rows = await refreshCatalog();
    if (rows.length > 0) {
      setStatus({
        type: "info",
        message: `Showing all ${rows.length} registered structure(s).`,
      });
    }
  }, [refreshCatalog]);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setLoading(true);
      setStatus(null);
      setResults([]);
      setSingleResult(null);
      try {
        await fn();
      } catch (e) {
        setStatus({
          type: "error",
          message: e instanceof Error ? e.message : "Operation failed",
        });
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const handleSave = () =>
    run(async () => {
      if (!ketcher) throw new Error("Editor not ready");
      const smiles = await ketcher.getSmiles();
      const molfile = await ketcher.getMolfile();
      const saved = await saveMolecule(smiles, { molfile });
      setSingleResult(saved);
      setResults([saved]);
      setStatus({
        type: "success",
        message: `Saved: ${saved.canonical_smiles}`,
      });
      await refreshCatalog();
    });

  const handleExact = () =>
    run(async () => {
      if (!ketcher) throw new Error("Editor not ready");
      const smiles = await ketcher.getSmiles();
      const hit = await exactSearch(smiles);
      if (!hit) {
        setStatus({ type: "info", message: "No exact match found." });
        return;
      }
      setSingleResult(hit);
      setResults([hit]);
      setStatus({ type: "success", message: "Exact match found." });
    });

  const handleSubstructure = () =>
    run(async () => {
      if (!ketcher) throw new Error("Editor not ready");
      const smarts = await ketcher.getSmarts();
      const hits = await substructureSearch(smarts);
      setResults(hits);
      setStatus({
        type: hits.length ? "success" : "info",
        message:
          hits.length === 0
            ? "No substructure matches."
            : `${hits.length} substructure match(es).`,
      });
    });

  const handleSimilarity = () =>
    run(async () => {
      if (!ketcher) throw new Error("Editor not ready");
      const smiles = await ketcher.getSmiles();
      const hits = await similaritySearch(smiles, threshold);
      setResults(hits);
      setStatus({
        type: hits.length ? "success" : "info",
        message:
          hits.length === 0
            ? "No similar structures above threshold."
            : `${hits.length} similar structure(s).`,
      });
    });

  const handleImported = useCallback(
    async (result: ImportResult) => {
      await refreshCatalog();
      setMode("browse");
      setResults([]);
      setSingleResult(null);
      const errPreview =
        result.errors.length > 0
          ? ` First error: ${result.errors[0].reason}`
          : "";
      setStatus({
        type: result.success_count > 0 ? "success" : "info",
        message: `Import: ${result.success_count} saved, ${result.failed_count} failed.${errPreview}`,
      });
    },
    [refreshCatalog]
  );

  const handleRecordUpdated = useCallback((updated: Molecule) => {
    setCatalog((c) => upsertRow(c, updated));
    setResults((r) => upsertRow(r, updated));
    if (singleResult?.id === updated.id) setSingleResult(updated);
  }, [singleResult?.id]);

  const handleRecordDeleted = useCallback((id: string) => {
    setCatalog((c) => removeRow(c, id));
    setResults((r) => removeRow(r, id));
    if (singleResult?.id === id) setSingleResult(null);
    setSelectedId(null);
    setStatus({ type: "info", message: "Record deleted." });
  }, [singleResult?.id]);

  const displayRows =
    mode === "browse"
      ? catalog
      : mode === "exact" && singleResult
        ? [singleResult]
        : results;

  const resultsTitle =
    mode === "browse"
      ? `All registered structures (${catalog.length})`
      : "Results";

  return (
    <>
      <header className="app-header">
        <h1>ISISlike — Chemical Inventory & ELN</h1>
        <p>
          Phase 1.5: Manage compound records — view, edit, delete, import, and
          search via RDKit before Supabase.
        </p>
      </header>

      <div className="app-layout">
        <section className="panel">
          <div className="panel-header">Structure Editor (Ketcher)</div>
          <div className="panel-body">
            <div className="mode-tabs">
              {(
                [
                  ["save", "Draw & Save"],
                  ["exact", "Exact Search"],
                  ["substructure", "Substructure"],
                  ["similarity", "Similarity"],
                  ["browse", "See All"],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  className={mode === m ? "active" : ""}
                  onClick={() => {
                    if (m === "browse") {
                      void handleSeeAll();
                    } else {
                      setMode(m);
                      setStatus(null);
                    }
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <ErrorBoundary
              fallback={
                <div className="status error">
                  Structure editor failed to load. Try hard refresh (Cmd+Shift+R).
                  Results panel still works if the backend is running.
                </div>
              }
            >
              <KetcherEditor onReady={setKetcher} />
            </ErrorBoundary>

            {mode === "similarity" && (
              <div className="threshold-row">
                <label htmlFor="threshold">Min. Tanimoto:</label>
                <input
                  id="threshold"
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                />
              </div>
            )}

            {mode === "browse" && (
              <p className="browse-hint">
                Browse every structure saved in the database. Use search tabs to
                filter by exact match, substructure, or similarity.
              </p>
            )}

            <div className="toolbar">
              {mode === "save" && (
                <button
                  type="button"
                  className="primary"
                  disabled={loading || !ketcher}
                  onClick={handleSave}
                >
                  Save Structure
                </button>
              )}
              {mode === "exact" && (
                <button
                  type="button"
                  className="primary"
                  disabled={loading || !ketcher}
                  onClick={handleExact}
                >
                  Exact Search
                </button>
              )}
              {mode === "substructure" && (
                <button
                  type="button"
                  className="primary"
                  disabled={loading || !ketcher}
                  onClick={handleSubstructure}
                >
                  Substructure Search
                </button>
              )}
              {mode === "similarity" && (
                <button
                  type="button"
                  className="primary"
                  disabled={loading || !ketcher}
                  onClick={handleSimilarity}
                >
                  Similarity Search
                </button>
              )}
              {mode === "browse" && (
                <button
                  type="button"
                  className="primary"
                  disabled={catalogLoading}
                  onClick={() => void handleSeeAll()}
                >
                  {catalogLoading ? "Loading…" : "Refresh all"}
                </button>
              )}
            </div>

            {status && (
              <div className={`status ${status.type}`}>{status.message}</div>
            )}
          </div>
        </section>

        <section className="panel panel-results">
          <div className="panel-header">{resultsTitle}</div>
          <div className="panel-body">
            {catalogError && (
              <div className="status error">{catalogError}</div>
            )}
            <div className="toolbar" style={{ marginTop: 0 }}>
              <MoleculeImport
                onImported={(r) => void handleImported(r)}
                disabled={catalogLoading}
              />
              {mode !== "browse" && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => void handleSeeAll()}
                >
                  See all registered ({catalog.length || "…"})
                </button>
              )}
            </div>
            {mode === "browse" && catalogLoading && (
              <p className="empty">Loading structures…</p>
            )}
            <MoleculeTable
              rows={displayRows}
              showSimilarity={mode === "similarity"}
              selectedId={selectedId}
              onRowClick={(row) => setSelectedId(row.id)}
              emptyMessage={
                mode === "browse"
                  ? "No structures registered yet. Draw one, import a file, or use Save Structure."
                  : "No results yet. Run a search or click See all registered."
              }
            />
          </div>
        </section>
      </div>

      <MoleculeDetailDrawer
        moleculeId={selectedId}
        onClose={() => setSelectedId(null)}
        onUpdated={handleRecordUpdated}
        onDeleted={handleRecordDeleted}
      />
    </>
  );
}
