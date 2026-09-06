import test from "node:test";
import assert from "node:assert/strict";
import { inspect } from "@/lib/csEncoding/inspect";

const flags = (text: string) => inspect(text).summary.map((s) => s.flag);

test("буква со своими надстрочными — один кластер", () => {
    const { clusters } = inspect("гдⷭ҇ь");
    assert.equal(clusters.length, 3);   // г, д с выносной и покрытием, ь
    assert.equal(clusters[1].base.char, "д");
    assert.deepEqual(clusters[1].marks.map((m) => m.klass), ["superscript", "pokrytie"]);
    assert.equal(clusters[1].marks[0].name, "выносная с");
});

test("выносная без покрытия находится, с покрытием — нет", () => {
    // Ровно то место, что записано в ROADMAP открытым вопросом: «Алфавит
    // духовный» набран без покрытия, а собрание стоит на «гдⷭ҇ѣ».
    assert.ok(flags("гдⷭѣ").includes("superscript-no-pokrytie"));
    assert.ok(!flags("гдⷭ҇ѣ").includes("superscript-no-pokrytie"));
});

test("паразитное титло перед ударением видно", () => {
    // Показываем, а не чиним молча: чинит ввоз, а это окно только называет.
    assert.ok(flags("б҃́а").includes("accent-after-titlo"));
    assert.ok(!flags("бж҃іей").includes("accent-after-titlo"));
});

test("надстрочный без буквы перед ним", () => {
    assert.ok(flags("́аз").includes("mark-before-base"));
    assert.ok(!flags("а́з").includes("mark-before-base"));
});

test("чужая буква внутри слова", () => {
    // Латинская C в «Гроб Твой Спасе» — та самая, что живёт в собрании.
    assert.ok(flags("Cпа́се").includes("latin-in-word"));
    assert.ok(!flags("Спа́се").includes("latin-in-word"));
});

test("знак частной области — след старой перекодировки", () => {
    assert.ok(flags("а\uE000б").includes("private-use"));
});

test("два ударения на одной букве", () => {
    assert.ok(flags("а́̀").includes("two-accents"));
});

test("незнакомый знак называется блоком, а не выдумкой", () => {
    const { clusters } = inspect("ᴥ");
    assert.match(clusters[0].base.name, /блок/);
});
