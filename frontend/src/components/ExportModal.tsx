import { useEffect, useMemo, useState } from "react";
import {
  customExport,
  DEFAULT_EXPORT_ATTRIBUTES,
  EXPORT_ATTRIBUTE_OPTIONS,
  fetchExportConfig,
  previewExport,
  type ExportAttributeKey,
  type ExportConfig,
  type ExportFieldSort,
  type ExportFilters,
  type ExportFormat,
  type ExportPreviewChemical,
} from "../api/export";
import {
  addExportHistory,
  buildFilterSummary,
  deleteExportHistoryEntry,
  deleteExportTemplate,
  listExportHistory,
  listExportTemplates,
  saveExportTemplate,
  type ExportHistoryEntry,
  type ExportTemplate,
} from "../lib/exportStorage";

interface Props {
  open: boolean;
  onClose: () => void;
}

const EMPTY_FILTERS: ExportFilters = {
  canonical_smiles: "",
  formula: "",
  name: "",
};

export default function ExportModal({ open, onClose }: Props) {
  const [config, setConfig] = useState<ExportConfig | null>(null);
  const [filters, setFilters] = useState<ExportFilters>({ ...EMPTY_FILTERS });
  const [allChemicals, setAllChemicals] = useState(false);
  const [attributes, setAttributes] = useState<ExportAttributeKey[]>([
    ...DEFAULT_EXPORT_ATTRIBUTES,
  ]);
  const [fieldSort, setFieldSort] = useState<ExportFieldSort>("alphabetical");
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [previewChemicals, setPreviewChemicals] = useState<
    ExportPreviewChemical[]
  >([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewed, setPreviewed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [history, setHistory] = useState<ExportHistoryEntry[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  useEffect(() => {
    if (!open) return;
    setTemplates(listExportTemplates());
    setHistory(listExportHistory());
    void fetchExportConfig().then(setConfig);
  }, [open]);

  const selectedCount = useMemo(
    () => previewChemicals.filter((c) => selectedIds.has(c.id)).length,
    [previewChemicals, selectedIds]
  );

  if (!open) return null;

  const handleFilterChange = (key: keyof ExportFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setAllChemicals(false);
    setPreviewed(false);
  };

  const toggleAttribute = (key: ExportAttributeKey) => {
    setAttributes((prev) =>
      prev.includes(key) ? prev.filter((a) => a !== key) : [...prev, key]
    );
  };

  const selectAllAttributes = () => {
    setAttributes([...DEFAULT_EXPORT_ATTRIBUTES]);
  };

  const deselectAllAttributes = () => {
    setAttributes([]);
  };

  const applyPreviewResult = (chemicals: ExportPreviewChemical[]) => {
    setPreviewChemicals(chemicals);
    setSelectedIds(new Set(chemicals.map((c) => c.id)));
    setPreviewed(true);
  };

  const buildFilterPayload = (): ExportFilters => {
    const payload: ExportFilters = {};
    if (filters.canonical_smiles?.trim()) {
      payload.canonical_smiles = filters.canonical_smiles.trim();
    }
    if (filters.formula?.trim()) {
      payload.formula = filters.formula.trim();
    }
    if (filters.name?.trim()) {
      payload.name = filters.name.trim();
    }
    return payload;
  };

  const handlePreview = async (opts?: { all?: boolean }) => {
    setLoading(true);
    setError(null);
    const useAll = opts?.all ?? allChemicals;
    try {
      const chemicals = await previewExport(buildFilterPayload(), {
        allChemicals: useAll,
      });
      if (useAll) setAllChemicals(true);
      applyPreviewResult(chemicals);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
      setPreviewChemicals([]);
      setSelectedIds(new Set());
      setPreviewed(true);
    } finally {
      setLoading(false);
    }
  };

  const toggleChemical = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllChemicals = () => {
    setSelectedIds(new Set(previewChemicals.map((c) => c.id)));
  };

  const deselectAllChemicals = () => {
    setSelectedIds(new Set());
  };

  const handleExport = async () => {
    const ids = previewChemicals
      .filter((c) => selectedIds.has(c.id))
      .map((c) => c.id);
    if (ids.length === 0) return;

    setExporting(true);
    setError(null);
    try {
      const { blob, filename } = await customExport(ids, attributes, {
        format,
        fieldSort,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);

      addExportHistory({
        chemicalCount: ids.length,
        format,
        fieldSort,
        filterSummary: buildFilterSummary(filters, allChemicals),
        filters: { ...filters },
        attributes: [...attributes],
        chemicalIds: ids,
      });
      setHistory(listExportHistory());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleSaveTemplate = () => {
    const name = templateName.trim();
    if (!name) {
      setError("Enter a template name to save.");
      return;
    }
    saveExportTemplate(name, {
      filters: { ...filters },
      attributes: [...attributes],
      fieldSort,
      format,
    });
    setTemplates(listExportTemplates());
    setTemplateName("");
    setError(null);
  };

  const handleLoadTemplate = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;
    setFilters({
      canonical_smiles: template.filters.canonical_smiles ?? "",
      formula: template.filters.formula ?? "",
      name: template.filters.name ?? "",
    });
    setAttributes([...template.attributes]);
    setFieldSort(template.fieldSort);
    setFormat(template.format);
    setAllChemicals(false);
    setPreviewed(false);
    setSelectedTemplateId(templateId);
  };

  const handleDeleteTemplate = () => {
    if (!selectedTemplateId) return;
    deleteExportTemplate(selectedTemplateId);
    setTemplates(listExportTemplates());
    setSelectedTemplateId("");
  };

  const handleRestoreHistory = (entry: ExportHistoryEntry) => {
    setFilters({
      canonical_smiles: entry.filters.canonical_smiles ?? "",
      formula: entry.filters.formula ?? "",
      name: entry.filters.name ?? "",
    });
    setAttributes([...entry.attributes]);
    setFieldSort(entry.fieldSort);
    setFormat(entry.format);
    setAllChemicals(entry.filterSummary === "All chemicals");
    setPreviewed(false);
  };

  const handleReExportHistory = async (entry: ExportHistoryEntry) => {
    setExporting(true);
    setError(null);
    try {
      const { blob, filename } = await customExport(
        entry.chemicalIds,
        entry.attributes,
        { format: entry.format, fieldSort: entry.fieldSort }
      );
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Re-export failed");
    } finally {
      setExporting(false);
    }
  };

  const canExport = previewed && selectedCount > 0 && !exporting;
  const exportDisabled = config && !config.enabled;
  const needsKey =
    config?.require_key && !import.meta.env.VITE_EXPORT_API_KEY;

  return (
    <>
      <button
        type="button"
        className="drawer-backdrop"
        aria-label="Close export dialog"
        onClick={onClose}
      />
      <div
        className="export-modal"
        role="dialog"
        aria-labelledby="export-modal-title"
      >
        <header className="detail-drawer-header">
          <h2 id="export-modal-title">Custom Export</h2>
          <button type="button" className="secondary" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="detail-drawer-body export-modal-body">
          {exportDisabled && (
            <div className="status error">
              Export is disabled on this server.
            </div>
          )}
          {needsKey && (
            <div className="status info">
              This server requires an export API key. Set{" "}
              <code>VITE_EXPORT_API_KEY</code> in your environment.
            </div>
          )}

          <section className="export-modal-section">
            <h3>Saved templates</h3>
            <div className="export-inline-row">
              <select
                value={selectedTemplateId}
                onChange={(e) => handleLoadTemplate(e.target.value)}
                aria-label="Load export template"
              >
                <option value="">Load template…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="secondary"
                disabled={!selectedTemplateId}
                onClick={handleDeleteTemplate}
              >
                Delete
              </button>
            </div>
            <div className="export-inline-row" style={{ marginTop: "0.5rem" }}>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Template name"
                aria-label="Template name"
              />
              <button
                type="button"
                className="secondary"
                onClick={handleSaveTemplate}
              >
                Save template
              </button>
            </div>
          </section>

          <section className="export-modal-section">
            <h3>Filter chemicals by</h3>
            <div className="detail-form">
              <label>
                Canonical SMILES
                <input
                  type="text"
                  value={filters.canonical_smiles ?? ""}
                  onChange={(e) =>
                    handleFilterChange("canonical_smiles", e.target.value)
                  }
                  placeholder="Exact match (canonicalized)"
                  disabled={allChemicals}
                />
              </label>
              <label>
                Formula
                <input
                  type="text"
                  value={filters.formula ?? ""}
                  onChange={(e) => handleFilterChange("formula", e.target.value)}
                  placeholder="Exact match"
                  disabled={allChemicals}
                />
              </label>
              <label>
                Name
                <input
                  type="text"
                  value={filters.name ?? ""}
                  onChange={(e) => handleFilterChange("name", e.target.value)}
                  placeholder="Partial match"
                  disabled={allChemicals}
                />
              </label>
            </div>
            <div className="export-inline-row">
              <button
                type="button"
                className="primary"
                disabled={loading || !!exportDisabled}
                onClick={() => void handlePreview()}
              >
                {loading ? "Searching…" : "Search / Preview"}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={loading || !!exportDisabled}
                onClick={() => void handlePreview({ all: true })}
              >
                Load all chemicals
              </button>
            </div>
          </section>

          <section className="export-modal-section">
            <h3>Attributes to include</h3>
            <div className="export-inline-row" style={{ marginBottom: "0.5rem" }}>
              <button
                type="button"
                className="secondary"
                onClick={selectAllAttributes}
              >
                Select all
              </button>
              <button
                type="button"
                className="secondary"
                onClick={deselectAllAttributes}
              >
                Deselect all
              </button>
            </div>
            <div className="export-attribute-list">
              {EXPORT_ATTRIBUTE_OPTIONS.map((opt) => (
                <label key={opt.key} className="export-attribute-item">
                  <input
                    type="checkbox"
                    checked={attributes.includes(opt.key)}
                    onChange={() => toggleAttribute(opt.key)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </section>

          <section className="export-modal-section">
            <h3>Export options</h3>
            <div className="export-options-grid">
              <label>
                Field column order
                <select
                  value={fieldSort}
                  onChange={(e) =>
                    setFieldSort(e.target.value as ExportFieldSort)
                  }
                >
                  <option value="alphabetical">Alphabetical</option>
                  <option value="definition_order">Field definition order</option>
                </select>
              </label>
              <label>
                File format
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as ExportFormat)}
                >
                  <option value="xlsx">XLSX (one sheet per chemical)</option>
                  <option value="csv">CSV (zip, one file per chemical)</option>
                </select>
              </label>
            </div>
          </section>

          <section className="export-modal-section">
            <h3>Preview</h3>
            {!previewed ? (
              <p className="empty" style={{ margin: 0 }}>
                Run Search / Preview or Load all chemicals to see results.
              </p>
            ) : previewChemicals.length === 0 ? (
              <p className="empty" style={{ margin: 0 }}>
                No chemicals found.
              </p>
            ) : (
              <div>
                <div className="export-inline-row" style={{ marginBottom: "0.5rem" }}>
                  <span style={{ fontSize: "0.875rem" }}>
                    {selectedCount} of {previewChemicals.length} selected
                  </span>
                  <button
                    type="button"
                    className="secondary"
                    onClick={selectAllChemicals}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={deselectAllChemicals}
                  >
                    Deselect all
                  </button>
                </div>
                <ul className="export-preview-checklist">
                  {previewChemicals.map((c) => (
                    <li key={c.id}>
                      <label className="export-preview-check-item">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(c.id)}
                          onChange={() => toggleChemical(c.id)}
                        />
                        <span>{c.name?.trim() || c.canonical_smiles}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {history.length > 0 && (
            <section className="export-modal-section">
              <h3>Export history</h3>
              <ul className="export-history-list">
                {history.map((entry) => (
                  <li key={entry.id} className="export-history-item">
                    <div className="export-history-meta">
                      <strong>
                        {new Date(entry.timestamp).toLocaleString()}
                      </strong>
                      <span>
                        {entry.chemicalCount} chemical
                        {entry.chemicalCount !== 1 ? "s" : ""} · {entry.format.toUpperCase()}
                      </span>
                      <span className="export-history-filters">
                        {entry.filterSummary}
                      </span>
                    </div>
                    <div className="export-inline-row">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => handleRestoreHistory(entry)}
                      >
                        Restore settings
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        disabled={exporting || !!exportDisabled}
                        onClick={() => void handleReExportHistory(entry)}
                      >
                        Re-export
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => {
                          deleteExportHistoryEntry(entry.id);
                          setHistory(listExportHistory());
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {error && <div className="status error">{error}</div>}
        </div>

        <div className="detail-actions export-modal-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            disabled={!canExport || !!exportDisabled || !!needsKey}
            onClick={() => void handleExport()}
          >
            {exporting
              ? "Exporting…"
              : format === "csv"
                ? "Export CSV (zip)"
                : "Export XLSX"}
          </button>
        </div>
      </div>
    </>
  );
}
