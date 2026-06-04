import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  createField,
  deleteField,
  getDatabase,
  listFields,
  updateField,
  type Database,
  type FieldDefinition,
  type FieldType,
} from "../api/databases";

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Select" },
];

export default function FieldManagerPage() {
  const { id: databaseId } = useParams<{ id: string }>();
  const [database, setDatabase] = useState<Database | null>(null);
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [fieldType, setFieldType] = useState<FieldType>("text");
  const [choicesText, setChoicesText] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!databaseId) return;
    setLoading(true);
    setError(null);
    try {
      const [db, defs] = await Promise.all([
        getDatabase(databaseId),
        listFields(databaseId),
      ]);
      setDatabase(db);
      setFields(defs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [databaseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!databaseId) return;
    const trimmed = name.trim();
    if (!trimmed) return;

    const options =
      fieldType === "select"
        ? {
            choices: choicesText
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          }
        : undefined;

    if (fieldType === "select" && (!options?.choices.length)) {
      setError("Select fields need at least one choice (comma-separated).");
      return;
    }

    setAdding(true);
    setError(null);
    try {
      const nextOrder =
        fields.length > 0
          ? Math.max(...fields.map((f) => f.sort_order)) + 1
          : 0;
      const created = await createField(databaseId, {
        name: trimmed,
        field_type: fieldType,
        options,
        sort_order: nextOrder,
      });
      setFields((prev) => [...prev, created].sort((a, b) => a.sort_order - b.sort_order));
      setName("");
      setChoicesText("");
      setFieldType("text");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Add field failed");
    } finally {
      setAdding(false);
    }
  };

  const moveField = async (field: FieldDefinition, direction: -1 | 1) => {
    if (!databaseId) return;
    const idx = fields.findIndex((f) => f.id === field.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= fields.length) return;
    const other = fields[swapIdx];
    setError(null);
    try {
      await Promise.all([
        updateField(databaseId, field.id, { sort_order: other.sort_order }),
        updateField(databaseId, other.id, { sort_order: field.sort_order }),
      ]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reorder failed");
    }
  };

  const handleDelete = async (field: FieldDefinition) => {
    if (!databaseId) return;
    if (!window.confirm(`Delete field "${field.name}"?`)) return;
    setError(null);
    try {
      await deleteField(databaseId, field.id);
      setFields((prev) => prev.filter((f) => f.id !== field.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  if (!databaseId) {
    return <main className="page-main"><p className="empty">Missing database id.</p></main>;
  }

  return (
    <main className="page-main">
      <div className="page-breadcrumb">
        <Link to="/databases">Databases</Link>
        <span aria-hidden="true"> / </span>
        <span>{database?.name ?? "…"}</span>
        <span aria-hidden="true"> / </span>
        <span>Fields</span>
        <Link
          to={`/databases/${databaseId}/records`}
          className="breadcrumb-action"
        >
          View records →
        </Link>
      </div>

      <section className="panel">
        <div className="panel-header">Field manager</div>
        <div className="panel-body">
          {loading && <p className="empty">Loading…</p>}
          {error && <div className="status error">{error}</div>}

          {!loading && (
            <form className="inline-form" onSubmit={(e) => void handleAdd(e)}>
              <label>
                Field name
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>
              <label>
                Type
                <select
                  value={fieldType}
                  onChange={(e) => setFieldType(e.target.value as FieldType)}
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              {fieldType === "select" && (
                <label>
                  Choices (comma-separated)
                  <input
                    type="text"
                    value={choicesText}
                    onChange={(e) => setChoicesText(e.target.value)}
                    placeholder="Active, Inactive, Archived"
                  />
                </label>
              )}
              <button type="submit" className="primary" disabled={adding}>
                {adding ? "Adding…" : "Add field"}
              </button>
            </form>
          )}

          {!loading && fields.length === 0 && (
            <p className="empty">No fields yet. Add text, number, date, or select fields.</p>
          )}

          {!loading && fields.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Options</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {fields.map((field, idx) => (
                  <tr key={field.id}>
                    <td>
                      <button
                        type="button"
                        className="secondary"
                        disabled={idx === 0}
                        onClick={() => void moveField(field, -1)}
                        aria-label="Move up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        disabled={idx === fields.length - 1}
                        onClick={() => void moveField(field, 1)}
                        aria-label="Move down"
                      >
                        ↓
                      </button>
                    </td>
                    <td>{field.name}</td>
                    <td>{field.field_type}</td>
                    <td>
                      {field.field_type === "select"
                        ? (field.options?.choices ?? []).join(", ")
                        : "—"}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => void handleDelete(field)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  );
}
