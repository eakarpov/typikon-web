import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { applyView, displayOf, viewChoices } from "@/lib/ordoView";
import type { OrdoStep, OrdoViewRules } from "@/lib/ordo";

// Подачу сайт накладывает сам, но обязан ставить её так же, как движок.
// Образец снят с typikon-rules (scripts/ordo-view-fixture.py): шаги трёх служб
// и подача, которую каждому ставит assemble.apply_view.

const fixture = JSON.parse(readFileSync(join(__dirname, "ordoView.fixture.json"), "utf8"));
const raw = fixture.view_rules;
const rules: OrdoViewRules = {
    views: raw.views,
    roleAliases: raw.role_aliases,
    roleViews: raw.role_views,
    readPositions: raw.read_positions,
    defaultRole: raw.default_role,
    notebooks: raw.notebooks,
};

for (const svc of fixture.services) {
    for (const [view, expected] of Object.entries(svc.displays as Record<string, string[]>)) {
        test(`${svc.date} ${svc.service}: подача ${view} как у движка`, () => {
            const got = svc.steps.map((s: OrdoStep) => displayOf(s, view, rules));
            assert.deepEqual(got, expected);
        });
    }
}

test("applyView не трогает исходные шаги", () => {
    const steps: OrdoStep[] = [{ kind: "text", role: "prayers", text: "Благословен Бог наш" }];
    const shown = applyView(steps, "role:Чтец", rules);
    assert.equal(shown[0].display, "hidden");
    assert.equal(steps[0].display, undefined);
});

test("вложенный шаг канона получает подачу своего места", () => {
    const steps: OrdoStep[] = [{
        kind: "position", position: "canon",
        items: [{ is_nested_step: true, step: { kind: "text", role: "proclaimer" } }],
    }];
    const [canon] = applyView(steps, "role:Диакон", rules);
    assert.equal(canon.items![0].step.display, "loud");
});

test("в выборе подач — указания, подачи движка и тетради", () => {
    const keys = viewChoices(rules).map(v => v.key);
    assert.equal(keys[0], "ukazaniya");
    assert.ok(keys.includes("schema"));
    assert.ok(keys.includes("role:Чтец"));
});
