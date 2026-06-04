# ISISlike — Chemical Inventory & ELN MVP

Phase 1 cheminformatics core: **React + Ketcher** → **FastAPI + RDKit** → **Supabase (pgvector)**.

**Golden rule:** The frontend never writes SMILES to Supabase. All chemical strings are canonicalized and fingerprinted by the Python microservice first.

## Architecture

```
┌─────────────┐     raw SMILES/SMARTS      ┌──────────────────┐     canonical payload     ┌──────────┐
│   Ketcher   │ ─────────────────────────► │ FastAPI + RDKit  │ ────────────────────────► │ Supabase │
│  (React)    │ ◄───────────────────────── │  (port 8000)     │ ◄──────────────────────── │ Postgres │
└─────────────┘     JSON results           └──────────────────┘                           └──────────┘
```

## Phase 1 Features

| Action | Endpoint | Notes |
|--------|----------|-------|
| Draw & Save | `POST /api/molecules/save` | UNIQUE on `canonical_smiles` |
| Exact Search | `POST /api/molecules/search/exact` | Canonical SMILES lookup |
| Substructure | `POST /api/molecules/search/substructure` | SMARTS + `HasSubstructMatch` |
| Similarity | `POST /api/molecules/search/similarity` | pgvector RPC, Tanimoto via cosine |
| Export Excel | Client-side (`xlsx`) | Action 8 wired in results table |

## Phase 1.5 — Record management

After Phase 1 migration, run **`supabase/migrations/002_phase1_5_molecule_fields.sql`** in the Supabase SQL Editor (adds `name`, `notes`, `molfile`, `structure_svg`, `updated_at` trigger).

| Action | Endpoint | Notes |
|--------|----------|-------|
| View record | `GET /api/molecules/{id}` | Detail drawer |
| Update metadata | `PATCH /api/molecules/{id}` | `name`, `notes` only |
| Delete | `DELETE /api/molecules/{id}` | |
| 2D structure | `GET /api/molecules/{id}/structure.svg` | Stored SVG (generated on save/import) |
| Import | `POST /api/molecules/import` | Multipart `.mol`, `.sdf`, or `.xlsx` |

UI: click a results row → right drawer (structure, SMILES, MW, formula, name, notes, save, delete). **Import .mol / .sdf / Excel** in the results panel.

## Phase 2A — Dynamic fields MVP

After Phase 1.5, run **`supabase/migrations/003_phase2a_dynamic_fields.sql`**, **`004_records_canonical_smiles_key.sql`**, and **`005_records_multiple_per_structure.sql`** in the Supabase SQL Editor (`databases`, `field_definitions`, `records` with `canonical_smiles`, `record_values`).

| Area | Routes / pages |
|------|----------------|
| API | `GET/POST /api/databases`, fields under `/api/databases/{id}/fields`, records under `/api/databases/{id}/records` |
| UI | `/databases`, `/databases/:id/fields`, `/databases/:id/records` |

Field types (MVP): `text`, `number`, `date`, `select`. Each record **requires** a canonical SMILES matching a saved molecule; multiple records per structure in the same database are allowed. Molecule search/list responses include `linked_database_records` with dynamic field values.

## Prerequisites

- [Supabase](https://supabase.com) project with **pgvector** enabled
- Python 3.12+ (RDKit)
- Node.js 20+

## Running locally (full stack)

You need **three pieces** running in this order: **Supabase (cloud DB)** → **Backend** → **Frontend**.

### Prerequisites

| Tool | Version | Check |
|------|---------|--------|
| Node.js | 20+ | `node -v` |
| Python | 3.12+ | `python3 --version` |
| Supabase account | — | [supabase.com/dashboard](https://supabase.com/dashboard) |

Project root (adjust if your path differs):

```bash
cd "/Users/mengqusun/Desktop/澳赛诺/isislike"
```

---

### Step 1 — Supabase (one-time + cloud)

**A. Create / open project**

1. [Supabase Dashboard](https://supabase.com/dashboard) → your project (`lgwofoudcmtnhrjnequv`)
2. Note **Project URL**: `https://lgwofoudcmtnhrjnequv.supabase.co` (no `/rest/v1` suffix)

**B. Run database migration (one-time)**

1. Sidebar → **SQL Editor** → **New query**
2. Open `supabase/migrations/001_phase1_molecules.sql` locally, copy all, paste, **Run**
3. Run `supabase/migrations/002_phase1_5_molecule_fields.sql` the same way (Phase 1.5)
4. Run `supabase/migrations/003_phase2a_dynamic_fields.sql`, `004_records_canonical_smiles_key.sql`, and `005_records_multiple_per_structure.sql` (Phase 2A)
4. Expect: “Success” (no rows returned is normal)

**C. Verify**

- **Table Editor** → table `molecules` exists  
- Or SQL:

```sql
SELECT COUNT(*) FROM molecules;
```

**D. API keys (backend only)**

- **Project Settings** → **API Keys**
- **Secret** key (`sb_secret_...`) → `SUPABASE_SERVICE_ROLE_KEY` in `backend/.env`
- Publishable key is not required for Phase 1 (frontend does not call Supabase directly)

Supabase stays in the cloud; no local Supabase process to start.

---

### Step 2 — Backend (FastAPI + RDKit)

**One-time install**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

**Environment** (`backend/.env`):

```env
SUPABASE_URL=https://lgwofoudcmtnhrjnequv.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
CORS_ORIGINS=http://localhost:5173
```

**Start server** (keep this terminal open):

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

**Health check:** open [http://localhost:8000/health](http://localhost:8000/health) → `{"status":"ok",...}`

**API docs:** [http://localhost:8000/docs](http://localhost:8000/docs)

---

### Step 3 — Frontend (React + Ketcher)

**One-time install**

```bash
cd frontend
npm install
```

**Environment** (`frontend/.env`):

```env
VITE_CHEMINFORMATICS_API_URL=http://localhost:8000
```

**Start dev server** (second terminal):

```bash
cd frontend
npm run dev
```

**App UI:** [http://localhost:5173](http://localhost:5173)

---

### Daily workflow (2 terminals)

| Terminal | Command | URL |
|----------|---------|-----|
| 1 — Backend | `cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000` | :8000 |
| 2 — Frontend | `cd frontend && npm run dev` | :5173 |

Supabase: already running in the cloud (no terminal).

**Demo seed data (optional)**

```bash
cd backend
source .venv/bin/activate
python scripts/seed_molecules.py
```

Inserts 8 common structures (ethanol, benzene, etc.) via RDKit + Supabase.

**Smoke test in the UI**

1. Refresh http://localhost:5173 — **Results** should list molecules from the library API
2. Draw a structure in Ketcher (e.g. ethanol)
3. Tab **Draw & Save** → **Save Structure**
4. Supabase **Table Editor** → `molecules` → new row with `canonical_smiles`

---

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| `503` / Supabase not configured | Check `backend/.env`, restart uvicorn |
| `401` / `403` from Supabase | Wrong or expired secret key in `.env` |
| `409` on save | Duplicate structure (UNIQUE `canonical_smiles`) — expected |
| `relation "molecules" does not exist` | Re-run migration SQL in Supabase |
| Frontend can’t reach API | Backend running? `VITE_CHEMINFORMATICS_API_URL=http://localhost:8000` |
| CORS errors | `CORS_ORIGINS` must include `http://localhost:5173` |
| Ketcher blank / errors | `cd frontend && npm install` (needs ketcher 3.x); hard refresh; check browser console |

---

### What talks to what

```
Browser (5173)  →  FastAPI (8000)  →  Supabase Postgres (cloud)
     Ketcher          RDKit canonicalize      molecules table
     never DB         + fingerprints          + pgvector RPC
```

## API Reference

```http
POST /api/molecules/save
{ "smiles": "CCO", "molfile": "...", "name": "Ethanol", "notes": "..." }

GET    /api/molecules/{id}
PATCH  /api/molecules/{id}     { "name": "...", "notes": "..." }
DELETE /api/molecules/{id}
GET    /api/molecules/{id}/structure.svg
POST   /api/molecules/import   multipart file field: file (.mol | .sdf | .xlsx)

POST /api/molecules/search/exact
{ "smiles": "CCO" }

POST /api/molecules/search/substructure
{ "smarts": "c1ccccc1" }

POST /api/molecules/search/similarity
{ "smiles": "CCO", "match_threshold": 0.7, "match_count": 50 }
```

## 公网部署（Netlify + Render）

让别人用浏览器打开你的站点，见 **[DEPLOY.md](./DEPLOY.md)**：

- **Netlify**：托管前端 → 公网链接
- **Render**：托管 FastAPI + RDKit（Netlify 无法运行后端）
- **Supabase**：数据库保持现有云端项目

## Roadmap

- **Phase 2A (done):** Dynamic databases, custom fields, EAV record values, optional `molecule_id` on records
- **Phase 2B+:** Vendors, batches, inventory, atomic checkout RPC, audit `transactions` table
- **Phase 3:** Structure/parent/reaction field types, multi-structure fields
- **Phase 3:** Additional workflow utilities (export already included)

## Docker (backend only)

```bash
cd backend
docker build -t isislike-cheminformatics .
docker run -p 8000:8000 --env-file .env isislike-cheminformatics
```