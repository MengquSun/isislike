import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createDatabase, listDatabases, type Database } from "../api/databases";

export default function DatabaseListPage() {
  const [databases, setDatabases] = useState<Database[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDatabases(await listDatabases());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load databases");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    setError(null);
    try {
      const created = await createDatabase({
        name: trimmed,
        description: description.trim() || null,
      });
      setDatabases((prev) => [created, ...prev]);
      setName("");
      setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="page-main">
      <section className="panel">
        <div className="panel-header">Database templates</div>
        <div className="panel-body">
          <p className="browse-hint">
            Create a database template, define fields, then add records. Each record
            can link a primary structure from the molecule catalog.
          </p>

          <form className="inline-form" onSubmit={(e) => void handleCreate(e)}>
            <label>
              Name
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Compound library"
                required
              />
            </label>
            <label>
              Description
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
              />
            </label>
            <button type="submit" className="primary" disabled={creating}>
              {creating ? "Creating…" : "Create database"}
            </button>
          </form>

          {error && <div className="status error">{error}</div>}
          {loading && <p className="empty">Loading…</p>}

          {!loading && databases.length === 0 && (
            <p className="empty">No databases yet. Create one above.</p>
          )}

          {!loading && databases.length > 0 && (
            <ul className="database-list">
              {databases.map((db) => (
                <li key={db.id} className="database-card">
                  <div>
                    <strong>{db.name}</strong>
                    {db.description && (
                      <p className="database-card-desc">{db.description}</p>
                    )}
                  </div>
                  <div className="toolbar">
                    <Link
                      to={`/databases/${db.id}/fields`}
                      className="link-button secondary"
                    >
                      Fields
                    </Link>
                    <Link
                      to={`/databases/${db.id}/records`}
                      className="link-button primary"
                    >
                      Records
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
