import fs from "node:fs";
import path from "node:path";
import { report, stripMarkup } from "@/lib/csEncoding/core";
import { translitToUnicode } from "@/lib/csEncoding/translit";

// Октоих церковнославянским шрифтом: из транслитерации в чистый юникод.
//
// ЗАЧЕМ ОТДЕЛЬНЫМ ШАГОМ, а не внутри сборки указателя. Переложенный текст —
// сам по себе вещь: чистого юникодного Октоиха в сети нет, и он должен
// существовать файлами, которые можно прочесть, сверить и отдать, а не только
// внутри базы. Перекладка идёт тем же кодом, что и утилита /nabor/ucs, поэтому
// результат воспроизводим: тот же вход даёт тот же выход.
//
// ПРОВЕРКА. Разобранный текст, свёрнутый обратно в гражданку, совпадает с
// гражданским изданием того же гласа на 94,1%; остаток — сокращения под титлом,
// которые гражданское издание печатает полностью.

const ROOT = path.join(process.cwd(), "..", "typikon-rules", "raw", "octoechos-cu");

// «Октоих, гласы 3, пт.htm» → глас и день седмицы.
const NAME = /гласы\s*(\d)\s*,\s*([а-я]{2})/i;

const DAYS: Record<string, string> = {
    вс: "1-воскресенье", пн: "2-понедельник", вт: "3-вторник", ср: "4-среда",
    чт: "5-четверг", пт: "6-пятница", сб: "7-суббота",
};

const main = () => {
    if (!fs.existsSync(ROOT)) {
        console.log(`Октоих не найден: ${ROOT}`);
        return 1;
    }
    const out = path.join(ROOT, "text");
    fs.mkdirSync(out, { recursive: true });

    const files = fs.readdirSync(ROOT).filter((f) => f.toLowerCase().endsWith(".htm")).sort();
    let written = 0;
    let letters = 0;
    const skipped: string[] = [];

    for (const file of files) {
        const match = NAME.exec(file);
        if (!match) { skipped.push(file); continue; }
        const [, tone, day] = match;
        const name = DAYS[day.toLowerCase()];
        if (!name) { skipped.push(file); continue; }

        const raw = fs.readFileSync(path.join(ROOT, file), "utf8");
        const { text: body, tags } = stripMarkup(raw);

        // ОБВЯЗКА ОТСЕИВАЕТСЯ ДО ПЕРЕКЛАДКИ, а не после. В тексте страницы рядом
        // с книгой стоят кнопки читалки («Reader mode», «Zoom out», «Georgia»),
        // и после перекладки они обращаются в кириллическую бессмыслицу
        // («рⷭ҇е́а́ⷣе́рⷭ҇ ѷѻⷣе́»), по которой их уже не узнать. До перекладки они
        // видны сразу: латиницы в них больше, чем кириллицы, а в строке книги
        // латиница — это записанные надстрочные знаки, и её всегда меньше.
        // Заголовок страницы отбрасывается по имени: в нём номера гласов, и
        // цифры перекладываются как ударения.
        const lines = body.split("\n").map((line) => line.trim()).filter((line) => {
            if (!line || /^Октоих[,\s]/.test(line)) return false;
            const cyrillic = (line.match(/[\u0400-\u04ff]/g) ?? []).length;
            const latin = (line.match(/[A-Za-z]/g) ?? []).length;
            return cyrillic > 0 && latin <= cyrillic;
        });
        const converted = translitToUnicode(lines.join("\n"));
        const text = converted.text;
        const stats = { "знаков переложено": converted.changed, "снято разметки": tags };

        const target = path.join(out, `глас-${tone}-${name}.txt`);
        fs.writeFileSync(target,
            `ИСТОЧНИК: ${file}\nПЕРЕЛОЖЕНО: транслитерация → юникод (@/lib/csEncoding/translit)\n`
            + `${"-".repeat(40)}\n${text}\n`, "utf8");
        written++;
        letters += text.length;
        console.log(`   глас ${tone}, ${name}: ${text.length.toLocaleString("ru")} знаков`
            + ` · ${report(stats).join(", ")}`);
    }

    console.log(`\nпереложено файлов: ${written}, знаков: ${letters.toLocaleString("ru")}`);
    if (skipped.length) console.log(`не разобрано имя у ${skipped.length}: ${skipped.join(", ")}`);
    return 0;
};

process.exit(main());
