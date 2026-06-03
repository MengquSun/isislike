#!/usr/bin/env python3
"""Insert demo molecules via RDKit + Supabase (run from backend/)."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

# backend/ on path so `app` imports work
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services import rdkit_service, supabase_client

# Raw SMILES — canonicalized by RDKit before insert
DEMO_SMILES = [
    "CCO",           # ethanol
    "CC(=O)O",       # acetic acid
    "c1ccccc1",      # benzene
    "Cc1ccccc1",     # toluene
    "CC(C)O",        # isopropanol
    "CN",            # methylamine
    "CCOCC",         # diethyl ether
    "CC(C)(C)O",     # tert-butanol
]


async def main() -> None:
    print("Seeding demo molecules...")
    ok, skip, fail = 0, 0, 0
    for raw in DEMO_SMILES:
        try:
            props = rdkit_service.canonicalize_smiles(raw)
            await supabase_client.insert_molecule(props)
            print(f"  + {props.canonical_smiles} ({props.molecular_formula})")
            ok += 1
        except ValueError as e:
            if "already exists" in str(e):
                print(f"  ~ skip (exists): {raw}")
                skip += 1
            else:
                print(f"  ! {raw}: {e}")
                fail += 1
        except Exception as e:
            print(f"  ! {raw}: {e}")
            fail += 1
    print(f"Done: {ok} inserted, {skip} skipped, {fail} failed")


if __name__ == "__main__":
    asyncio.run(main())
