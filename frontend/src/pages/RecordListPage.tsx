import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getDatabase,
  listFields,
  listRecords,
  recordValueDisplay,
  type Database,
  type DatabaseRecord,
  type FieldDefinition,
} from "../api/databases";
import RecordDetailDrawer from "../components/RecordDetailDrawer";
import StructureImage from "../components/StructureImage";

export default function RecordListPage() {
  const { id: databaseId } = useParams<{ id: string }>();
  const [database, setDatabase] = useState<Database | null>(null);
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [records, setRecords] = useState<DatabaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DatabaseRecord | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!databaseId) return;
    setLoading(true);
    setError(null);
    try {
      const [db, defs, recs] = await Promise.all([
        getDatabase(databaseId),
        listFields(databaseId),
        listRecords(databaseId),
      ]);
      setDatabase(db);
      setFields(defs);
      setRecords(recs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [databaseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const valueFor = (record: DatabaseRecord, fieldId: string) => {
    const v = record.values.find((x) => x.field_id === fieldId);
    return recordValueDisplay(v);
  };

  const handleSaved = (saved: DatabaseRecord) => {
    setRecords((prev) => {
      const i = prev.findIndex((r) => r.id === saved.id);
      if (i < 0) return [saved, ...prev];
      const next = [...prev];
      next[i] = saved;
      return next;
    });
    setSelected(saved);
    setCreating(false);
  };

  const handleDeleted = (id: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
    setSelected(null);
  };

  if (!databaseId) {
    return (
      <main className="page-main">
        <p className="empty">Missing database id.</p>
      </main>
    );
  }

  return (
    <main className="page-main">
      <div className="page-breadcrumb">
        <Link to="/databases">Databases</Link>
        <span aria-hidden="true"> / </span>
        <span>{database?.name ?? "…"}</span>
        <span aria-hidden="true"> / </span>
        <span>Records</span>
        <Link
          to={`/databases/${databaseId}/fields`}
          className="breadcrumb-action"
        >
          Manage fields →
        </Link>
      </div>

      <section className="panel">
        <div className="panel-header">
          Records
          <button
            type="button"
            className="primary header-action"
            disabled={fields.length === 0}
            onClick={() => {
              setCreating(true);
              setSelected(null);
            }}
          >
            New record
          </button>
        </div>
        <div className="panel-body">
          {fields.length === 0 && !loading && (
            <p className="empty">
              Define fields before adding records.{" "}
              <Link to={`/databases/${databaseId}/fields`}>Go to Field Manager</Link>
            </p>
          )}
          {loading && <p className="empty">Loading…</p>}
          {error && <div className="status error">{error}</div>}

          {!loading && fields.length > 0 && records.length === 0 && (
            <p className="empty">No records yet. Click New record.</p>
          )}

          {!loading && records.length > 0 && (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Structure</th>
                    {fields.map((f) => (
                      <th key={f.id}>{f.name}</th>
                    ))}
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr
                      key={record.id}
                      className={`clickable-row${selected?.id === record.id ? " selected-row" : ""}`}
                      onClick={() => {
                        setCreating(false);
                        setSelected(record);
                      }}
                    >
                      <td>
                        {record.molecule_id ? (
                          <StructureImage
                            moleculeId={record.molecule_id}
                            width={80}
                            height={56}
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                      {fields.map((f) => (
                        <td key={f.id}>{valueFor(record, f.id)}</td>
                      ))}
                      <td>
                        {record.updated_at
                          ? new Date(record.updated_at).toLocaleDateString()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <RecordDetailDrawer
        databaseId={databaseId}
        record={creating ? null : selected}
        isNew={creating}
        onClose={() => {
          setCreating(false);
          setSelected(null);
        }}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
      />
    </main>
  );
}
