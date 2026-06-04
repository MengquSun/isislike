import { useEffect, useState } from "react";
import { listMolecules, type Molecule } from "../api/cheminformatics";
import type { FieldDefinition } from "../api/databases";

interface Props {
  fields: FieldDefinition[];
  values: Record<string, string | number | null>;
  moleculeId: string | null;
  onValuesChange: (values: Record<string, string | number | null>) => void;
  onMoleculeIdChange: (id: string | null) => void;
}

export default function DynamicRecordForm({
  fields,
  values,
  moleculeId,
  onValuesChange,
  onMoleculeIdChange,
}: Props) {
  const [molecules, setMolecules] = useState<Molecule[]>([]);

  useEffect(() => {
    void listMolecules(200).then(setMolecules).catch(() => setMolecules([]));
  }, []);

  const setField = (fieldId: string, value: string | number | null) => {
    onValuesChange({ ...values, [fieldId]: value });
  };

  return (
    <div className="detail-form">
      <label htmlFor="record-molecule">Primary structure (optional)</label>
      <select
        id="record-molecule"
        value={moleculeId ?? ""}
        onChange={(e) =>
          onMoleculeIdChange(e.target.value ? e.target.value : null)
        }
      >
        <option value="">— None —</option>
        {molecules.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name || m.canonical_smiles.slice(0, 48)}
          </option>
        ))}
      </select>

      {fields.map((field) => {
        const id = `field-${field.id}`;
        const val = values[field.id];

        if (field.field_type === "select") {
          const choices = field.options?.choices ?? [];
          return (
            <div key={field.id}>
              <label htmlFor={id}>{field.name}</label>
              <select
                id={id}
                value={val != null ? String(val) : ""}
                onChange={(e) =>
                  setField(field.id, e.target.value || null)
                }
              >
                <option value="">—</option>
                {choices.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          );
        }

        if (field.field_type === "number") {
          return (
            <div key={field.id}>
              <label htmlFor={id}>{field.name}</label>
              <input
                id={id}
                type="number"
                step="any"
                value={val != null ? String(val) : ""}
                onChange={(e) =>
                  setField(
                    field.id,
                    e.target.value === "" ? null : Number(e.target.value)
                  )
                }
              />
            </div>
          );
        }

        if (field.field_type === "date") {
          return (
            <div key={field.id}>
              <label htmlFor={id}>{field.name}</label>
              <input
                id={id}
                type="date"
                value={val != null ? String(val) : ""}
                onChange={(e) =>
                  setField(field.id, e.target.value || null)
                }
              />
            </div>
          );
        }

        return (
          <div key={field.id}>
            <label htmlFor={id}>{field.name}</label>
            <input
              id={id}
              type="text"
              value={val != null ? String(val) : ""}
              onChange={(e) => setField(field.id, e.target.value || null)}
            />
          </div>
        );
      })}
    </div>
  );
}
