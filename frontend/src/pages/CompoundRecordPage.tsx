import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getMolecule,
  getMoleculeDatabaseRecords,
  type MoleculeDatabaseRecord,
  type MoleculeDatabaseRecordFilters,
  type MoleculeDetail,
} from "../api/cheminformatics";
import { recordValueDisplay } from "../api/databases";
import StructureImage from "../components/StructureImage";

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
const DEFAULT_PAGE_SIZE = 25;

const EMPTY_FILTERS: MoleculeDatabaseRecordFilters = {
  source_database: "",
  field_name: "",
  keyword: "",
  date_from: "",
  date_to: "",
};

type SortKey = "source_database" | "created_at" | "updated_at" | `field:${string}`;
type SortDir = "asc" | "desc";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

function valueForRecord(record: MoleculeDatabaseRecord, fieldName: string): string {
  const v = record.values.find(
    (x) => (x.field_name ?? "").toLowerCase() === fieldName.toLowerCase()
  );
  return recordValueDisplay(v);
}

function sortRecords(
  rows: MoleculeDatabaseRecord[],
  sortKey: SortKey,
  sortDir: SortDir
): MoleculeDatabaseRecord[] {
  const dir = sortDir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    let av: string;
    let bv: string;
    if (sortKey === "source_database") {
      av = a.source_database;
      bv = b.source_database;
    } else if (sortKey === "created_at") {
      av = a.created_at ?? "";
      bv = b.created_at ?? "";
    } else if (sortKey === "updated_at") {
      av = a.updated_at ?? "";
      bv = b.updated_at ?? "";
    } else {
      const fieldName = sortKey.slice("field:".length);
      av = valueForRecord(a, fieldName);
      bv = valueForRecord(b, fieldName);
    }
    const cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" });
    return cmp * dir;
  });
}

interface SortableThProps {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}

function SortableTh({ label, sortKey, activeKey, sortDir, onSort }: SortableThProps) {
  const active = activeKey === sortKey;
  return (
    <th>
      <button
        type="button"
        className={`sortable-th${active ? " active" : ""}`}
        onClick={() => onSort(sortKey)}
      >
        {label}
        <span className="sortable-th-indicator" aria-hidden="true">
          {active ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
        </span>
      </button>
    </th>
  );
}

export default function CompoundRecordPage() {
  const { moleculeId } = useParams<{ moleculeId: string }>();
  const [compound, setCompound] = useState<MoleculeDetail | null>(null);
  const [allRecords, setAllRecords] = useState<MoleculeDatabaseRecord[]>([]);
  const [records, setRecords] = useState<MoleculeDatabaseRecord[]>([]);
  const [filters, setFilters] = useState<MoleculeDatabaseRecordFilters>({
    ...EMPTY_FILTERS,
  });
  const [appliedFilters, setAppliedFilters] = useState<MoleculeDatabaseRecordFilters>({
    ...EMPTY_FILTERS,
  });
  const [sortKey, setSortKey] = useState<SortKey>("updated_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordsError, setRecordsError] = useState<string | null>(null);

  const loadCompound = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const row = await getMolecule(id);
      setCompound(row);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load compound");
      setCompound(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAllRecordsForOptions = useCallback(async (id: string) => {
    try {
      const rows = await getMoleculeDatabaseRecords(id);
      setAllRecords(rows);
    } catch {
      setAllRecords([]);
    }
  }, []);

  const loadRecords = useCallback(
    async (id: string, active: MoleculeDatabaseRecordFilters) => {
      setRecordsLoading(true);
      setRecordsError(null);
      try {
        const rows = await getMoleculeDatabaseRecords(id, active);
        setRecords(rows);
      } catch (e) {
        setRecordsError(
          e instanceof Error ? e.message : "Failed to load database records"
        );
        setRecords([]);
      } finally {
        setRecordsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!moleculeId) return;
    void loadCompound(moleculeId);
    void loadAllRecordsForOptions(moleculeId);
  }, [moleculeId, loadCompound, loadAllRecordsForOptions]);

  useEffect(() => {
    if (!moleculeId) return;
    void loadRecords(moleculeId, appliedFilters);
  }, [moleculeId, appliedFilters, loadRecords]);

  useEffect(() => {
    setPage(1);
  }, [appliedFilters, sortKey, sortDir, pageSize]);

  const sourceDatabases = useMemo(() => {
    const names = new Set(allRecords.map((r) => r.source_database));
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [allRecords]);

  const fieldNames = useMemo(() => {
    const names = new Set<string>();
    for (const rec of allRecords) {
      for (const v of rec.values) {
        if (v.field_name) names.add(v.field_name);
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [allRecords]);

  const wideFieldNames = useMemo(() => {
    const names = new Set<string>();
    for (const rec of records) {
      for (const v of rec.values) {
        if (v.field_name) names.add(v.field_name);
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [records]);

  const sortedRecords = useMemo(
    () => sortRecords(records, sortKey, sortDir),
    [records, sortKey, sortDir]
  );

  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const pagedRecords = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sortedRecords.slice(start, start + pageSize);
  }, [sortedRecords, safePage, pageSize]);

  const applyFilters = () => {
    setAppliedFilters({ ...filters });
  };

  const resetFilters = () => {
    setFilters({ ...EMPTY_FILTERS });
    setAppliedFilters({ ...EMPTY_FILTERS });
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "updated_at" || key === "created_at" ? "desc" : "asc");
    }
  };

  if (!moleculeId) {
    return (
      <main className="page-main">
        <p className="empty">Missing compound id.</p>
      </main>
    );
  }

  return (
    <main className="page-main compound-record-page">
      <div className="page-breadcrumb">
        <Link to="/">Structures</Link>
        <span aria-hidden="true"> / </span>
        <span>Compound Record</span>
      </div>

      {loading && <p className="empty">Loading compound…</p>}
      {error && <div className="status error">{error}</div>}

      {compound && !loading && (
        <>
          <section className="panel compound-record-header-panel">
            <div className="panel-header compound-record-panel-header">
              <span className="compound-record-title">
                {compound.name?.trim() || "Unnamed compound"}
              </span>
              <Link to="/" className="secondary header-action">
                ← Back to All Registered
              </Link>
            </div>
            <div className="panel-body compound-record-header">
              <div className="compound-record-summary">
                <StructureImage
                  moleculeId={compound.id}
                  alt={compound.name?.trim() || "2D structure"}
                  className="structure-preview-img"
                  width={280}
                  height={210}
                />
                <dl className="detail-meta compound-record-meta">
                  <div>
                    <dt>Formula</dt>
                    <dd>{compound.molecular_formula ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Molecular weight</dt>
                    <dd>
                      {compound.molecular_weight != null
                        ? compound.molecular_weight.toFixed(4)
                        : "—"}
                    </dd>
                  </div>
                  <div className="compound-record-meta-wide">
                    <dt>Canonical SMILES</dt>
                    <dd>
                      <code>{compound.canonical_smiles}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>{formatDate(compound.created_at)}</dd>
                  </div>
                  <div>
                    <dt>Updated</dt>
                    <dd>{formatDate(compound.updated_at)}</dd>
                  </div>
                  <div className="compound-record-meta-wide">
                    <dt>Notes</dt>
                    <dd>{compound.notes?.trim() || "—"}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              Database Records
              {!recordsLoading && allRecords.length > 0 && (
                <span className="compound-record-count">
                  {records.length} of {allRecords.length} shown
                </span>
              )}
            </div>
            <div className="panel-body">
              <div className="compound-record-filters">
                <label>
                  Source Database
                  <select
                    value={filters.source_database ?? ""}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        source_database: e.target.value,
                      }))
                    }
                  >
                    <option value="">All</option>
                    {sourceDatabases.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Field Name
                  <select
                    value={filters.field_name ?? ""}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, field_name: e.target.value }))
                    }
                  >
                    <option value="">All</option>
                    {fieldNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Keyword
                  <input
                    type="search"
                    placeholder="Search values or fields…"
                    value={filters.keyword ?? ""}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, keyword: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") applyFilters();
                    }}
                  />
                </label>
                <label>
                  Updated from
                  <input
                    type="date"
                    value={filters.date_from ?? ""}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, date_from: e.target.value }))
                    }
                  />
                </label>
                <label>
                  Updated to
                  <input
                    type="date"
                    value={filters.date_to ?? ""}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, date_to: e.target.value }))
                    }
                  />
                </label>
                <div className="compound-record-filter-actions">
                  <button type="button" className="primary" onClick={applyFilters}>
                    Apply
                  </button>
                  <button type="button" className="secondary" onClick={resetFilters}>
                    Reset
                  </button>
                </div>
              </div>

              {recordsLoading && <p className="empty">Loading records…</p>}
              {recordsError && <div className="status error">{recordsError}</div>}

              {!recordsLoading && !recordsError && allRecords.length === 0 && (
                <p className="empty">
                  No database records linked to this compound.
                </p>
              )}

              {!recordsLoading &&
                !recordsError &&
                allRecords.length > 0 &&
                records.length === 0 && (
                  <p className="empty">No records match the current filters.</p>
                )}

              {!recordsLoading && !recordsError && records.length > 0 && (
                <>
                  <div className="compound-record-table-toolbar">
                    <label className="compound-record-page-size">
                      Rows per page
                      <select
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                      >
                        {PAGE_SIZE_OPTIONS.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                    <span className="compound-record-page-info">
                      {(safePage - 1) * pageSize + 1}–
                      {Math.min(safePage * pageSize, sortedRecords.length)} of{" "}
                      {sortedRecords.length}
                    </span>
                  </div>

                  <div className="table-scroll compound-records-table-wrap">
                    <table className="compound-records-table">
                      <thead>
                        <tr>
                          <SortableTh
                            label="Source Database"
                            sortKey="source_database"
                            activeKey={sortKey}
                            sortDir={sortDir}
                            onSort={handleSort}
                          />
                          {wideFieldNames.map((name) => (
                            <SortableTh
                              key={name}
                              label={name}
                              sortKey={`field:${name}`}
                              activeKey={sortKey}
                              sortDir={sortDir}
                              onSort={handleSort}
                            />
                          ))}
                          <SortableTh
                            label="Created"
                            sortKey="created_at"
                            activeKey={sortKey}
                            sortDir={sortDir}
                            onSort={handleSort}
                          />
                          <SortableTh
                            label="Updated"
                            sortKey="updated_at"
                            activeKey={sortKey}
                            sortDir={sortDir}
                            onSort={handleSort}
                          />
                        </tr>
                      </thead>
                      <tbody>
                        {pagedRecords.map((rec) => (
                          <tr key={rec.id}>
                            <td>
                              <Link to={`/databases/${rec.database_id}/records`}>
                                {rec.source_database}
                              </Link>
                            </td>
                            {wideFieldNames.map((name) => (
                              <td key={name}>{valueForRecord(rec, name) || "—"}</td>
                            ))}
                            <td>{formatDateShort(rec.created_at)}</td>
                            <td>{formatDateShort(rec.updated_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <ul className="compound-records-cards">
                    {pagedRecords.map((rec) => (
                      <li key={rec.id} className="compound-record-card">
                        <div className="compound-record-card-header">
                          <Link to={`/databases/${rec.database_id}/records`}>
                            {rec.source_database}
                          </Link>
                          <span className="compound-record-card-dates">
                            {formatDateShort(rec.updated_at)}
                          </span>
                        </div>
                        {rec.values.length > 0 && (
                          <dl className="compound-record-card-fields">
                            {rec.values.map((v) => (
                              <div key={v.field_id}>
                                <dt>{v.field_name ?? "Field"}</dt>
                                <dd>{recordValueDisplay(v)}</dd>
                              </div>
                            ))}
                          </dl>
                        )}
                        <div className="compound-record-card-meta">
                          Created {formatDateShort(rec.created_at)}
                        </div>
                      </li>
                    ))}
                  </ul>

                  {totalPages > 1 && (
                    <nav
                      className="compound-record-pagination"
                      aria-label="Database records pagination"
                    >
                      <button
                        type="button"
                        className="secondary"
                        disabled={safePage <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        Previous
                      </button>
                      <span>
                        Page {safePage} of {totalPages}
                      </span>
                      <button
                        type="button"
                        className="secondary"
                        disabled={safePage >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      >
                        Next
                      </button>
                    </nav>
                  )}
                </>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
