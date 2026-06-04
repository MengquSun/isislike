import * as XLSX from "xlsx";
import type { Molecule } from "../api/cheminformatics";
import LinkedDatabaseRecords from "./LinkedDatabaseRecords";
import StructureImage from "./StructureImage";

interface Props {
  rows: Molecule[];
  showSimilarity?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: Molecule) => void;
  selectedId?: string | null;
}

export default function MoleculeTable({
  rows,
  showSimilarity,
  emptyMessage = "No results yet.",
  onRowClick,
  selectedId,
}: Props) {
  const exportExcel = () => {
    const data = rows.map((r) => ({
      ID: r.id,
      Name: r.name ?? "",
      "Canonical SMILES": r.canonical_smiles,
      "Mol. Weight": r.molecular_weight ?? "",
      Formula: r.molecular_formula ?? "",
      Notes: r.notes ?? "",
      ...(showSimilarity ? { Similarity: r.similarity ?? "" } : {}),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Molecules");
    XLSX.writeFile(wb, "molecules_export.xlsx");
  };

  if (rows.length === 0) {
    return <p className="empty">{emptyMessage}</p>;
  }

  return (
    <>
      <div className="toolbar" style={{ marginTop: 0, marginBottom: "0.5rem" }}>
        <button type="button" className="secondary" onClick={exportExcel}>
          Export to Excel
        </button>
        <span style={{ fontSize: "0.875rem", color: "#6b7280" }}>
          {rows.length} result{rows.length !== 1 ? "s" : ""}
          {onRowClick ? " · click a row for details" : ""}
        </span>
      </div>
      <ul className="molecule-cards">
        {rows.map((r) => (
          <li
            key={r.id}
            className={
              onRowClick
                ? `molecule-card${selectedId === r.id ? " selected" : ""}`
                : "molecule-card"
            }
            onClick={onRowClick ? () => onRowClick(r) : undefined}
            onKeyDown={
              onRowClick
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onRowClick(r);
                    }
                  }
                : undefined
            }
            role={onRowClick ? "button" : undefined}
            tabIndex={onRowClick ? 0 : undefined}
          >
            <div className="molecule-card-structure">
              <StructureImage
                moleculeId={r.id}
                alt={r.name?.trim() || r.canonical_smiles}
              />
            </div>
            <div className="molecule-card-body">
              <div className="molecule-card-title">
                {r.name?.trim() || "Unnamed compound"}
              </div>
              <dl className="molecule-card-meta">
                <div>
                  <dt>Formula</dt>
                  <dd>{r.molecular_formula ?? "—"}</dd>
                </div>
                <div>
                  <dt>MW</dt>
                  <dd>
                    {r.molecular_weight != null
                      ? r.molecular_weight.toFixed(2)
                      : "—"}
                  </dd>
                </div>
                {showSimilarity && (
                  <div>
                    <dt>Similarity</dt>
                    <dd className="similarity-bar">
                      {r.similarity != null
                        ? `${(r.similarity * 100).toFixed(1)}%`
                        : "—"}
                    </dd>
                  </div>
                )}
              </dl>
              <code className="molecule-card-smiles">{r.canonical_smiles}</code>
              <LinkedDatabaseRecords
                records={r.linked_database_records ?? []}
                compact
              />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
