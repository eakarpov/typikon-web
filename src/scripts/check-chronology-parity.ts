// Сверка нашего счёта чисел года с питоновым (typikon-rules, src/chronology.py).
//
// Зачем. Арифметика хронологии живёт в двух местах: здесь на TypeScript (чтобы
// пособие работало без службы на Python) и там (чтобы сверяться с печатным
// Типиконом). Два счёта одного и того же — известная беда этого проекта:
// «минус тринадцать» зашит в calcDay.ts, тогда как рулзы давно считают разницу
// стилей по-честному. Обещаниями это не лечится, лечится прогоном.
//
// Питонова сторона сверена с книгой на 532 годах великого индиктиона. Значит
// совпадение с ней — это сверка с книгой через одно звено.
//
//   npm run chronology:diff
//   TYPIKON_RULES=/path/to/typikon-rules npm run chronology:diff
import { execFileSync } from "node:child_process";
import path from "node:path";
import * as ch from "@/utils/chronology";

const RULES = process.env.TYPIKON_RULES
    || path.resolve(process.cwd(), "..", "typikon-rules");

const FIRST = Number(process.env.FROM || 988);
const LAST = Number(process.env.TO || 2472);

// Питон просят выдать те же величины тем же порядком. Считает он их сам, из
// своего модуля, — иначе сверка проверяла бы переписанную формулу, а не счёт.
const PY = `
import json, sys
sys.path.insert(0, "src")
import chronology as ch
out = {}
for leto in range(${FIRST} + 5508, ${LAST} + 5509):
    m = ch.year_marks(leto)
    p = ch.church_calendar.church_date(m["pascha"])
    out[leto] = [m["indikt"], m["krug_solntsu"], m["krug_lune"], m["vrutseleto"],
                 m["osnovanie"], m["epakta"], m["klyuch_granits"], p[0], p[1]]
spans = {}
for leto in (6712, 7000, 7533):
    for style in ch.ERA_STYLES:
        a, b = ch.leto_span(leto, style)
        spans[f"{leto}:{style}"] = [a.toordinal(), b.toordinal()]
json.dump({"marks": out, "spans": spans}, sys.stdout, ensure_ascii=False)
`;

const main = () => {
    let raw: string;
    try {
        raw = execFileSync("python3", ["-c", PY], {
            cwd: RULES, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024,
        });
    } catch (e) {
        console.error(`Не вышло спросить питонову сторону в ${RULES}.`);
        console.error("Укажите путь: TYPIKON_RULES=... npm run chronology:diff");
        console.error(String(e).split("\n").slice(0, 3).join("\n"));
        process.exit(2);
        return;
    }
    const theirs = JSON.parse(raw) as {
        marks: Record<string, (number | string)[]>;
        spans: Record<string, [number, number]>;
    };

    let checked = 0;
    const wrong: string[] = [];
    for (const [key, row] of Object.entries(theirs.marks)) {
        const leto = Number(key);
        const m = ch.yearMarks(leto);
        const p = ch.jdnToJulian(m.paschaJdn);
        const ours = [m.indikt, m.krugSolntsu, m.krugLune, m.vrutseleto,
                      m.osnovanie, m.epakta, m.klyuchGranits, p.month, p.day];
        checked += 1;
        ours.forEach((value, i) => {
            if (value !== row[i]) {
                wrong.push(`  лето ${leto}, поле ${i}: питон ${row[i]}, мы ${value}`);
            }
        });
    }

    // Юлианский день против питонова порядкового: у него счёт от 0001-01-01
    // григорианского счёта, то есть ровно на 1721425 меньше нашего.
    const ORDINAL_SHIFT = 1721425;
    let spans = 0;
    for (const [key, [first, last]] of Object.entries(theirs.spans)) {
        const [leto, style] = key.split(":");
        const our = ch.letoSpan(Number(leto), style as ch.EraStyle);
        spans += 1;
        if (our.first - ORDINAL_SHIFT !== first || our.last - ORDINAL_SHIFT !== last) {
            wrong.push(`  промежуток ${key}: питон ${first}..${last}, `
                + `мы ${our.first - ORDINAL_SHIFT}..${our.last - ORDINAL_SHIFT}`);
        }
    }

    console.log(`Сверено лет: ${checked} (${FIRST}–${LAST} от Рождества), `
        + `промежутков: ${spans}`);
    if (wrong.length) {
        console.log(`РАСХОЖДЕНИЙ: ${wrong.length}`);
        console.log(wrong.slice(0, 40).join("\n"));
        process.exit(1);
    }
    console.log("Расхождений нет: счёт тот же, что сверен с печатным Типиконом.");
};

main();
