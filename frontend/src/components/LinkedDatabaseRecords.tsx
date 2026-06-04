import { Link } from "react-router-dom";
import {
  recordValueDisplay,
  type LinkedDatabaseRecord,
  type RecordValue,
} from "../api/databases";

interface Props {
  records: LinkedDatabaseRecord[];
  compact?: boolean;
}

function formatValue(v: RecordValue): string {
  return recordValueDisplay(v);
}

function summarizeFields(rec: LinkedDatabaseRecord): string {
  if (!rec.values.length) return "";
  return rec.values
    .map((v) => `${v.field_name ?? "Field"}: ${formatValue(v)}`)
    .join(" · ");
}

export default function LinkedDatabaseRecords({ records, compact }: Props) {
  if (!records.length) {
    return compact ? null : (
      <p className="linked-records-empty">No linked database records.</p>
    );
  }

  if (compact) {
    return (
      <div className="linked-records linked-records-compact">
        {records.map((rec) => {
          const summary = summarizeFields(rec);
          return (
            <div key={rec.record_id} className="linked-records-chip">
              <Link to={`/databases/${rec.database_id}/records`}>
                {rec.database_name}
              </Link>
              {summary && (
                <span className="linked-records-chip-meta">{summary}</span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="linked-records">
      <div className="linked-records-title">Database records</div>
      <ul className="linked-records-list">
        {records.map((rec) => (
          <li key={rec.record_id} className="linked-records-item">
            <Link to={`/databases/${rec.database_id}/records`}>
              {rec.database_name}
            </Link>
            <code className="linked-records-smiles">{rec.canonical_smiles}</code>
            {rec.values.length > 0 && (
              <dl className="linked-records-fields">
                {rec.values.map((v) => (
                  <div key={v.field_id}>
                    <dt>{v.field_name ?? "Field"}</dt>
                    <dd>{formatValue(v)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
