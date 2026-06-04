import { useCallback, useEffect, useState } from "react";
import {
  createRecord,
  deleteRecord,
  listFields,
  updateRecord,
  valuesMapFromRecord,
  type DatabaseRecord,
  type FieldDefinition,
} from "../api/databases";
import StructureImage from "./StructureImage";
import DynamicRecordForm from "./DynamicRecordForm";

interface Props {
  databaseId: string;
  record: DatabaseRecord | null;
  isNew: boolean;
  onClose: () => void;
  onSaved: (record: DatabaseRecord) => void;
  onDeleted: (id: string) => void;
}

export default function RecordDetailDrawer({
  databaseId,
  record,
  isNew,
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const open = isNew || record !== null;
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [values, setValues] = useState<Record<string, string | number | null>>(
    {}
  );
  const [moleculeId, setMoleculeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const loadFields = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const defs = await listFields(databaseId);
      setFields(defs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load fields");
    } finally {
      setLoading(false);
    }
  }, [databaseId]);

  useEffect(() => {
    if (open) void loadFields();
  }, [open, loadFields]);

  useEffect(() => {
    if (!open) return;
    if (record && !isNew) {
      setValues(valuesMapFromRecord(record));
      setMoleculeId(record.molecule_id ?? null);
    } else {
      setValues({});
      setMoleculeId(null);
    }
    setError(null);
    setStatus(null);
  }, [open, record, isNew]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      if (isNew) {
        const created = await createRecord(databaseId, {
          molecule_id: moleculeId,
          values,
        });
        setStatus("Created.");
        onSaved(created);
      } else if (record) {
        const updated = await updateRecord(databaseId, record.id, {
          molecule_id: moleculeId,
          values,
        });
        setStatus("Saved.");
        onSaved(updated);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!record || isNew) return;
    if (!window.confirm("Delete this record?")) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteRecord(databaseId, record.id);
      onDeleted(record.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="drawer-backdrop"
        aria-label="Close record panel"
        onClick={onClose}
      />
      <aside className="detail-drawer" role="dialog" aria-labelledby="record-drawer-title">
        <header className="detail-drawer-header">
          <h2 id="record-drawer-title">
            {isNew ? "New record" : "Edit record"}
          </h2>
          <button type="button" className="secondary" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="detail-drawer-body">
          {loading && <p className="empty">Loading fields…</p>}
          {error && <div className="status error">{error}</div>}
          {status && <div className="status success">{status}</div>}

          {!loading && moleculeId && (
            <div className="structure-preview">
              <StructureImage moleculeId={moleculeId} width={280} height={180} />
            </div>
          )}

          {!loading && fields.length === 0 && (
            <p className="empty">
              No fields defined. Add fields in Field Manager first.
            </p>
          )}

          {!loading && fields.length > 0 && (
            <DynamicRecordForm
              fields={fields}
              values={values}
              moleculeId={moleculeId}
              onValuesChange={setValues}
              onMoleculeIdChange={setMoleculeId}
            />
          )}

          <div className="detail-actions">
            <button
              type="button"
              className="primary"
              disabled={saving || loading || fields.length === 0}
              onClick={() => void handleSave()}
            >
              {saving ? "Saving…" : isNew ? "Create" : "Save"}
            </button>
            {!isNew && record && (
              <button
                type="button"
                className="danger"
                disabled={deleting}
                onClick={() => void handleDelete()}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
