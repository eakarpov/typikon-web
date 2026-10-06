// Адрес святого из его имени: /saints/{slug}.
//
// ОДНО ПРАВИЛО НА ДВОИХ. Слуг назначают и assign-saint-slugs.ts (пачкой, кому
// ещё не назначено), и new-saint.ts (сразу при заводе записи руками). Считать
// это правило в двух местах нельзя: разойдясь, они дадут два разных адреса для
// одного имени.
//
// Транслитерация и снятие ударений — общие для проекта (slugify в
// @/lib/news/format, normalizeChurchSlavonic в @/utils/churchSlavonic), чтобы
// адреса святых и адреса новостей строились одинаково. Снятие ударений обязано
// идти ДО транслитерации: комбинирующий знак — не буква, и slugify честно
// заменил бы его дефисом («Феофа́но» → «feofa-no»).
import { slugify } from "@/lib/news/format";
import { normalizeChurchSlavonic } from "@/utils/churchSlavonic";

export const saintSlug = (name: string): string => slugify(normalizeChurchSlavonic(name));
