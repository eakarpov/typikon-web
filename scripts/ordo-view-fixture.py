"""Образец для src/lib/ordoView.test.ts: шаги служб и подачи, которые им
ставит движок (typikon-rules/src/assemble.apply_view).

Подачу сайт накладывает сам, по таблицам движка, — и сверяется с ним этим
образцом. Пересобрать, когда в движке меняются роли или подачи:

    python3 scripts/ordo-view-fixture.py ../typikon-rules > src/lib/ordoView.fixture.json
"""
import copy
import datetime
import json
import pathlib
import sqlite3
import sys

src = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "../typikon-rules") / "src"
sys.path.insert(0, str(src.resolve()))

import day_options  # noqa: E402
from assemble import ROLE_NOTEBOOKS, apply_view, assemble, source_books  # noqa: E402
from ordo_service import VIEW_RULES  # noqa: E402

KEEP = ("kind", "role", "speaker", "position", "voiced")
con = sqlite3.connect(f"file:{src / 'data.db'}?mode=ro", uri=True)
views = ["full", "positions", "schema"] + [f"role:{r}" for r, _ in ROLE_NOTEBOOKS if r]
out = {"view_rules": VIEW_RULES, "services": []}
for date, service in (("2026-09-27", "vsenoshchnoe"), ("2026-09-27", "liturgy"),
                      ("2026-03-11", "compline")):
    u, day, variants = day_options.day_and_variants(con, datetime.date.fromisoformat(date))
    b = day_options.build_for(con, u, day, variants[0], service, readings=False)
    steps = assemble(con, b["ordo_id"], source_books(con, b["sources"]), b["context"],
                     b["plan"], b["settings"], b["shapes"])
    out["services"].append({
        "date": date, "service": service,
        "steps": [{k: s.get(k) for k in KEEP if s.get(k) is not None} for s in steps],
        "displays": {v: [s["display"] for s in apply_view(copy.deepcopy(steps), v)]
                     for v in views},
    })
json.dump(out, sys.stdout, ensure_ascii=False, separators=(",", ":"))
