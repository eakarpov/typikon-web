import { test } from "node:test";
import assert from "node:assert/strict";
import { parseOrdoDay, parseOrdoServices } from "@/lib/api/v2/ordoParams";

// Разбор параметров ручек /api/v2/ordo/*. Ошибка здесь — либо отказ честному
// клиенту, либо пропуск мусора в службу устава, которая читает файлы правил
// по имени из запроса, поэтому пределы проверяются тестами отдельно от ручек.

const url = (path: string) => new URL(path, "https://typikon.info");

test("день: дата обязательна и строга", () => {
    assert.equal(parseOrdoDay(url("/api/v2/ordo/day")).ok, false);
    assert.equal(parseOrdoDay(url("/api/v2/ordo/day?date=")).ok, false);
    assert.equal(parseOrdoDay(url("/api/v2/ordo/day?date=2026-9-26")).ok, false);
    assert.equal(parseOrdoDay(url("/api/v2/ordo/day?date=26.09.2026")).ok, false);
    // Формат верный, но календаря такого нет.
    assert.equal(parseOrdoDay(url("/api/v2/ordo/day?date=2026-02-30")).ok, false);
    assert.equal(parseOrdoDay(url("/api/v2/ordo/day?date=2026-09-26")).ok, true);
});

test("день: устав опционален и не длиннее слага", () => {
    const bare = parseOrdoDay(url("/api/v2/ordo/day?date=2026-09-26"));
    assert.ok(bare.ok && bare.value.ustav === null);

    const named = parseOrdoDay(url("/api/v2/ordo/day?date=2026-09-26&ustav=pre-nikonian/old-rite"));
    assert.ok(named.ok && named.value.ustav === "pre-nikonian/old-rite");

    const junk = parseOrdoDay(url(`/api/v2/ordo/day?date=2026-09-26&ustav=${"x".repeat(200)}`));
    assert.ok(junk.ok && junk.value.ustav === null);
});

test("службы: service повторяемый, с пределом", () => {
    const one = parseOrdoServices(url("/api/v2/ordo/services?date=2026-09-26&service=vespers"));
    assert.ok(one.ok && one.value.services.length === 1 && one.value.services[0] === "vespers");

    const two = parseOrdoServices(url("/api/v2/ordo/services?date=2026-09-26&service=vespers&service=liturgy"));
    assert.ok(two.ok && two.value.services.length === 2);

    const none = parseOrdoServices(url("/api/v2/ordo/services?date=2026-09-26"));
    assert.ok(none.ok && none.value.services.length === 0);

    const tooMany = parseOrdoServices(
        url(`/api/v2/ordo/services?date=2026-09-26&${Array.from({ length: 17 }, (_, i) => `service=s${i}`).join("&")}`),
    );
    assert.equal(tooMany.ok, false);
});

test("службы: вариант и язык — короткие слова", () => {
    const parsed = parseOrdoServices(
        url("/api/v2/ordo/services?date=2026-09-26&variant=polyeleos&service=liturgy&lang=cs"),
    );
    assert.ok(parsed.ok);
    if (parsed.ok) {
        assert.equal(parsed.value.variant, "polyeleos");
        assert.equal(parsed.value.lang, "cs");
    }
});
