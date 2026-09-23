// Подача собранной службы: какой шаг показать крупно, какой зачином, какой
// скрыть.
//
// Почему здесь, а не в движке. Шаги суточного круга приходят БЕЗ подачи — как
// `ordo.json` в пакете .ordo (typikon-rules/spec/package.md: «подачу
// накладывает читатель»), — и переключение «указания → полное → тетрадь
// чтеца» не стоит нового запроса. Но накладывается подача по ТАБЛИЦАМ движка
// (`OrdoViewRules`, из assemble.ROLE_VIEWS и соседей), а не по своей копии:
// здесь только ход apply_view (assemble.py), и он проверяется тестом на тех же
// шагах.
//
// Шаги не выбрасываются никогда, даже скрытые: порядок службы и есть то, ради
// чего на неё смотрят.
import type { OrdoDisplay, OrdoStep, OrdoViewRules } from "@/lib/ordo";

/** Роль шага, приведённая к одному имени. null — не назван никто. */
export const roleOf = (step: OrdoStep, rules: OrdoViewRules): string | null => {
    let raw: string | null | undefined = step.role || step.speaker;
    if (!raw) {
        if (step.kind === "position" && rules.readPositions.includes(step.position ?? "")) {
            return "read";
        }
        raw = rules.defaultRole[step.kind];
    }
    if (!raw) return null;
    return rules.roleAliases[raw] ?? raw;
};

/**
 * Подача для одного шага. `view` — full | positions | schema | role:<роль>.
 * Незнакомая подача — полная: лучше показать всё, чем спрятать службу.
 */
export const displayOf = (step: OrdoStep, view: string, rules: OrdoViewRules): OrdoDisplay => {
    const kind = step.kind;
    if (view === "positions") return kind === "position" || kind === "table" ? "full" : "hidden";
    if (view === "schema") return "cue";
    if (view.startsWith("role:")) {
        const role = view.slice(5);
        const planKey = rules.roleAliases[role] ?? role;
        const plan = rules.roleViews[planKey] ?? {};
        // заголовок блока — скелет службы: по нему находят себя в чине
        if (kind === "include") return "full";
        const mine = roleOf(step, rules);
        const key = mine ?? "";
        let display: OrdoDisplay = key in plan ? plan[key] : (plan["*"] ?? "full");
        // ТАЙНАЯ МОЛИТВА ИЕРЕЯ хору не нужна вовсе; возглас нужен — на него
        // лик отвечает «Аминь»
        if (planKey === "sung" && mine === "prayers" && step.voiced === "secret") {
            display = "hidden";
        }
        return display;
    }
    return "full";
};

/**
 * Шаги с проставленной подачей — новыми объектами: исходные остаются
 * нейтральными, и следующая подача накладывается на них же.
 * Вложенные шаги канона получают подачу своего места.
 */
export const applyView = (steps: OrdoStep[], view: string, rules: OrdoViewRules): OrdoStep[] =>
    steps.map(step => {
        const display = displayOf(step, view, rules);
        if (!step.items?.length) return { ...step, display };
        return {
            ...step,
            display,
            items: step.items.map(it => it.is_nested_step
                ? { ...it, step: { ...it.step, display: displayOf(it.step, view, rules) } }
                : it),
        };
    });

/** Подачи, которые можно выбрать: указания, три движковых и тетради ролей. */
export interface ViewChoice { key: string; label: string }

export const UKAZANIYA = "ukazaniya";

export const viewChoices = (rules: Pick<OrdoViewRules, "views" | "notebooks">): ViewChoice[] => [
    { key: UKAZANIYA, label: "Богослужебные указания" },
    ...Object.entries(rules.views).map(([key, label]) => ({ key, label })),
    ...rules.notebooks.map(n => ({ key: `role:${n.role}`, label: `Тетрадь: ${n.label}` })),
];
