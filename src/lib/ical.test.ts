import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCalendar } from "@/lib/ical";

const STAMP = new Date("2026-08-24T10:00:00Z");

const build = (summary: string, description?: string) =>
    buildCalendar({
        name: "Уставные чтения",
        description: "Чтения дня",
        stamp: STAMP,
        events: [{ uid: "20260824@typikon.su", date: "20260824", summary, description }],
    });

const lines = (ics: string) => ics.split("\r\n").filter(Boolean);

test("календарь собирается с обязательными полями", () => {
    const ics = build("Память святаго");

    for (const required of ["BEGIN:VCALENDAR", "VERSION:2.0", "CALSCALE:GREGORIAN", "END:VCALENDAR"]) {
        assert.ok(ics.includes(required), `нет ${required}`);
    }
    assert.ok(ics.includes("DTSTAMP:20260824T100000Z"));
});

test("строки разделены CRLF", () => {
    // Часть календарных клиентов отказывается читать файл с обычным переводом строки.
    const ics = build("Память");
    assert.ok(ics.includes("\r\n"));
    assert.ok(!/[^\r]\n/.test(ics), "найден перевод строки без возврата каретки");
    assert.ok(ics.endsWith("\r\n"));
});

test("суточное событие заканчивается следующим днём", () => {
    const ics = build("Память");
    assert.ok(ics.includes("DTSTART;VALUE=DATE:20260824"));
    assert.ok(ics.includes("DTEND;VALUE=DATE:20260825"));
});

test("конец месяца переносится на первое число", () => {
    const ics = buildCalendar({
        name: "Т", description: "Т", stamp: STAMP,
        events: [{ uid: "u", date: "20260831", summary: "Память" }],
    });
    assert.ok(ics.includes("DTEND;VALUE=DATE:20260901"), "31 августа должно закрываться 1 сентября");
});

test("строки не длиннее 75 октетов даже на кириллице", () => {
    // Кириллица в UTF-8 занимает по два байта: если считать символы, а не октеты,
    // строки выходят вдвое длиннее допустимого.
    const ics = build("Па́мять ".repeat(30));
    const tooLong = lines(ics).filter((l) => Buffer.byteLength(l, "utf8") > 75);
    assert.equal(tooLong.length, 0, `слишком длинных строк: ${tooLong.length}`);
});

test("свёртка не разрезает символ пополам", () => {
    const ics = build("я".repeat(200));
    // Битый UTF-8 при обратном разборе превратится в символ замены.
    assert.ok(!ics.includes("�"), "в файле появился повреждённый символ");

    const unfolded = ics.replace(/\r\n /g, "");
    assert.ok(unfolded.includes(`SUMMARY:${"я".repeat(200)}`), "текст не собирается обратно");
});

test("продолжение свёрнутой строки начинается с пробела", () => {
    const ics = build("Па́мять ".repeat(30));
    const continuations = lines(ics).filter((l) => l.startsWith(" "));
    assert.ok(continuations.length > 0, "длинная строка должна была свернуться");
});

test("спецсимволы экранируются", () => {
    const ics = build("До: раз, два; три\\четыре", "Первая строка\nвторая");

    assert.ok(ics.includes("раз\\, два\\; три\\\\четыре"), "запятая, точка с запятой и слэш");
    assert.ok(ics.includes("Первая строка\\nвторая"), "перевод строки внутри значения");
    // И при этом сам файл не должен получить лишних настоящих переводов строки.
    assert.equal(lines(ics).filter((l) => l.startsWith("DESCRIPTION")).length, 1);
});

test("без описания поле не выводится", () => {
    const ics = build("Память");
    assert.ok(!ics.includes("DESCRIPTION:"));
});

test("события идут в том же порядке, в каком переданы", () => {
    const ics = buildCalendar({
        name: "Т", description: "Т", stamp: STAMP,
        events: [
            { uid: "a", date: "20260824", summary: "Первое" },
            { uid: "b", date: "20260825", summary: "Второе" },
        ],
    });
    assert.ok(ics.indexOf("UID:a") < ics.indexOf("UID:b"));
    assert.equal(lines(ics).filter((l) => l === "BEGIN:VEVENT").length, 2);
    assert.equal(lines(ics).filter((l) => l === "END:VEVENT").length, 2);
});
