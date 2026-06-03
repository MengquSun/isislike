import * as XLSX from "xlsx";
import type { Molecule } from "../api/cheminformatics";

interface Props {
  rows: Molecule[];
  showSimilarity?: boolean;
  emptyMessage?: string;
}

export default function MoleculeTable({
  rows,
  showSimilarity,
  emptyMessage = "No results yet.",
}: Props) {
  const exportExcel = () => {
    const data = rows.map((r) => ({
      ID: r.id,
      "Canonical SMILES": r.canonical_smiles,
      "Mol. Weight": r.molecular_weight ?? "",
      Formula: r.molecular_formula ?? "",
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
        </span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Canonical SMILES</th>
              <th>Formula</th>
              <th>MW</th>
              {showSimilarity && <th>Similarity</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <code style={{ fontSize: "0.75rem" }}>{r.canonical_smiles}</code>
                </td>
                <td>{r.molecular_formula ?? "—"}</td>
                <td>{r.molecular_weight?.toFixed(2) ?? "—"}</td>
                {showSimilarity && (
                  <td className="similarity-bar">
                    {r.similarity != null
                      ? `${(r.similarity * 100).toFixed(1)}%`
                      : "—"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
