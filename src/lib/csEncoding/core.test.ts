import test from "node:test";
import assert from "node:assert/strict";
import { alreadyUnicode, convertBytes, report } from "@/lib/csEncoding/core";
import { alphabetOf } from "@/lib/csEncoding/alphabets";
import fixture from "@/lib/csEncoding/__fixtures__/alfavit-hip8.json";

const cp1251 = (text: string) => alphabetOf("cp1251").toBytes(text).bytes;

test("HIP восьмибитный ложится в то, что уже лежит в собрании", () => {
    // Золотая пара: сырой файл оцифровки и текст, вставший из него при ввозе.
    // Ступень hip8 до сих пор не была покрыта тестами вовсе — все десять
    // проверок hip.test.ts зовут normalizeHip без этого флага.
    const got = convertBytes(cp1251(fixture.raw), "hip8");
    assert.equal(got.text, fixture.expected);
});

test("отчёт считает сделанное, а не обещанное", () => {
    const got = convertBytes(cp1251(fixture.raw), "hip8");
    const lines = report(got.stats);
    assert.ok(lines.some((l) => /ударен/.test(l)), `в отчёте нет ударений: ${lines.join("; ")}`);
    assert.ok(lines.some((l) => /титл/.test(l)), `в отчёте нет титл: ${lines.join("; ")}`);
    // Числа в отчёте — те же, что в stats: отчёт пересказывает, а не пересчитывает.
    assert.match(lines[0], new RegExp(String(Math.max(...Object.values(got.stats))).replace(/\B(?=(\d{3})+(?!\d))/g, "\\s?")));
});

test("UCS перекладывает байты раскладки", () => {
    // «а» с ударением в UCS — байт 0x61, «і» с камо́рой — 0x87.
    const bytes = Uint8Array.from([0x61, 0x87]);
    const got = convertBytes(bytes, "ucs");
    assert.equal(got.text, "а́і̑".normalize("NFC"));
    assert.equal(got.stats["знаков переложено"], 2);
});

test("UCS не трогает то, чего в раскладке нет", () => {
    // Кириллица верхней половины CP1251 у UCS стоит на своих местах: буква
    // остаётся буквой, и в отчёт это не идёт — иначе он хвалился бы бездельем.
    const got = convertBytes(cp1251("миръ"), "ucs");
    assert.equal(got.text, "миръ");
    assert.equal(got.stats["знаков переложено"], undefined);
});

test("вставка возвращается к байтам обращением декодера", () => {
    // Текст, набранный UCS и прочитанный браузером как CP1251, доезжает до нас
    // знаками вроде «a» и «‡». Обращаем ту же кодовую страницу — и получаем
    // ровно те байты, что стояли в наборе.
    const pasted = new TextDecoder("windows-1251").decode(Uint8Array.from([0x61, 0x87]));
    const { bytes, unknown } = alphabetOf("cp1251").toBytes(pasted);
    assert.equal(unknown, 0);
    assert.deepEqual([...bytes], [0x61, 0x87]);
    assert.equal(convertBytes(bytes, "ucs").text, "а́і̑".normalize("NFC"));
});

test("потерянное до нас считается, а не подставляется", () => {
    // Байт 0x98 в CP1251 не определён: браузер уже подменил его вопросом, и
    // вернуть его нечем. Такие знаки уходят в счёт «потерялось раньше нас».
    const { bytes, unknown } = alphabetOf("cp1251").toBytes("а�и");
    assert.equal(unknown, 1);
    assert.equal(bytes.length, 2);
});

test("юникодный текст перекодировке не отдаётся", () => {
    // Второй прогон портит текст необратимо и правдоподобно, поэтому признак
    // проверяется тестом, а не глазами.
    assert.equal(alreadyUnicode("бг҃ъ"), true);          // титло
    assert.equal(alreadyUnicode("гдⷭ҇ь"), true);          // выносная с покрытием
    assert.equal(alreadyUnicode("а҆зъ"), true);          // звательце
    assert.equal(alreadyUnicode("Пре'жде сея` ма'лыя"), false);   // это HIP
    assert.equal(alreadyUnicode("миръ"), false);
    // А вот HIP с orthlib наполовину юникодный, и случайное титло в нём не повод
    // отказать в работе: рядом стоит его разметка.
    assert.equal(alreadyUnicode("бг҃ъ ди'вный // сея` <::рус> \\дк"), false);
});
