import { useEffect, useState } from "react";
import { listMolecules, type Molecule } from "../api/cheminformatics";
import type { FieldDefinition } from "../api/databases";

interface Props {
  fields: FieldDefinition[];
  values: Record<string, string | number | null>;
  smiles: string;
  onValuesChange: (values: Record<string, string | number | null>) => void;
  onSmilesChange: (smiles: string) => void;
}

export default function DynamicRecordForm({
  fields,
  values,
  smiles,
  onValuesChange,
  onSmilesChange,
}: Props) {
  const [molecules, setMolecules] = useState<Molecule[]>([]);

  useEffect(() => {
    void listMolecules(200).then(setMolecules).catch(() => setMolecules([]));
  }, []);

  const setField = (fieldId: string, value: string | number | null) => {
    onValuesChange({ ...values, [fieldId]: value });
  };

  const pickMolecule = (m: Molecule) => {
    onSmilesChange(m.canonical_smiles);
  };

  return (
    <div className="detail-form">
      <label htmlFor="record-smiles">
        Canonical SMILES <span className="required-mark">*</span>
      </label>
      <input
        id="record-smiles"
        type="text"
        required
        value={smiles}
        onChange={(e) => onSmilesChange(e.target.value)}
        placeholder="Must match a structure saved on Structures page"
      />
      <label htmlFor="record-molecule-pick">Pick from catalog</label>
      <select
        id="record-molecule-pick"
        value=""
        onChange={(e) => {
          const m = molecules.find((x) => x.id === e.target.value);
          if (m) pickMolecule(m);
          e.target.value = "";
        }}
      >
        <option value="">— Select registered structure —</option>
        {molecules.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name || m.canonical_smiles.slice(0, 56)}
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
