// Загрузка напевов из файлов данных.
//
// Хранятся они в репозитории (src/data/tunes), а не в базе, и это решение, а не
// временная мера. Напев — не запись пользователя, а выверенный текст: правится
// он редко, обсуждается подолгу, и всякая правка мелодии должна быть видна в
// истории вместе с тем, кто и зачем её внёс. База даёт удобство правки с сайта
// и отнимает ровно это. Читатели напевов ходят сюда через один интерфейс,
// поэтому подложить под него Mongo, когда понадобится редактор, можно будет не
// трогая ни раскладку, ни нотации.
//
// Проверка при загрузке — не педантизм: содержание записи идёт параллельно
// шагам напева, и разошедшиеся длины означают, что часть мелодии молча не
// пропоётся. Такое надо видеть, а не искать потом глазами по нотному стану.

import traditionsData from "@/data/tunes/traditions.json";
import znamennyMaly from "@/data/tunes/znamenny-maly.json";
import obihodPartes from "@/data/tunes/obihod-partes.json";
import obihodMsk from "@/data/tunes/obihod-msk.json";
import { groupsOf } from "./apply";
import type { Locality, Score, Tradition, Tune } from "./types";

export interface TuneLibrary {
    traditions: Tradition[];
    localities: Locality[];
    tunes: Tune[];
    /** Что не сошлось в данных. Пустой список — всё в порядке. */
    problems: string[];
}

const checkScore = (tune: Tune, score: Score, problems: string[]) => {
    const where = `${tune.id}/${score.notation}/${score.voice}`;
    for (const variant of tune.variants ?? []) {
        const content = score.variants?.[variant.id];
        if (!content) {
            problems.push(`${where}: нет содержания для варианта «${variant.id}»`);
            continue;
        }
        if (content.length !== variant.steps.length) {
            problems.push(
                `${where}: вариант «${variant.id}» — ${variant.steps.length} шагов напева ` +
                `против ${content.length} в записи`,
            );
        }
    }
    for (const key of Object.keys(score.variants ?? {})) {
        if (!(tune.variants ?? []).some(v => v.id === key)) {
            problems.push(`${where}: в записи есть вариант «${key}», какого нет в напеве`);
        }
    }
    if (score.lines.length !== tune.lines.length) {
        problems.push(`${where}: в напеве ${tune.lines.length} строк, в записи ${score.lines.length}`);
    }
    tune.lines.forEach((line, i) => {
        const content = score.lines[i];
        if (!content) return;
        if (content.length !== line.steps.length) {
            problems.push(
                `${where}: строка ${i + 1} — ${line.steps.length} шагов напева ` +
                `против ${content.length} в записи`,
            );
        }
        // Пустая ячейка не то же самое, что шаг без содержания: в первой
        // нотация промолчит, а второго не бывает — шаг обязан быть спет.
        content.forEach((v, j) => {
            if (!v.trim()) problems.push(`${where}: строка ${i + 1}, шаг ${j + 1} пуст`);
        });
    });
};

const checkTune = (
    tune: Tune,
    traditions: Map<string, Tradition>,
    localities: Map<string, Locality>,
    problems: string[],
) => {
    const tradition = traditions.get(tune.traditionId);
    if (!tradition) {
        problems.push(`${tune.id}: традиции «${tune.traditionId}» нет в реестре`);
        return;
    }

    if (tune.locality) {
        const locality = localities.get(tune.locality);
        if (!locality) problems.push(`${tune.id}: извода «${tune.locality}» нет в реестре`);
        else if (locality.traditionId !== tune.traditionId) {
            problems.push(`${tune.id}: извод «${tune.locality}» принадлежит другой традиции`);
        }
    }

    if (!tune.lines.length) problems.push(`${tune.id}: в напеве нет ни одной строки`);

    tune.lines.forEach((line, i) => {
        if (!line.steps.length) {
            problems.push(`${tune.id}: строка ${i + 1} пуста`);
            return;
        }
        // Проверяем ПО ОТРЕЗКАМ, а не по строке целиком: читок и распев в
        // строке не по одному, а по одному НА ГРУППУ. У третьего гласа
        // тропарного в строке два читка и в заключительной два распева, и это
        // не ошибка набора, а её строение.
        groupsOf(line.steps).forEach((group, g) => {
            const where = `${tune.id}: строка ${i + 1}, отрезок ${g + 1}`;
            // Двух читков в отрезке быть не может: раскладка стала бы
            // неоднозначной — непонятно, какой принимает лишние слоги.
            if (group.filter(s => s.flex).length > 1) {
                problems.push(`${where}: больше одного читка`);
            }
            if (group.filter(s => s.stress).length > 1) {
                problems.push(`${where}: больше одного распева`);
            }
        });
    });

    const order = tune.order;
    const used = new Set<number>();
    for (const [where, list] of [["зачине", order.head], ["круге", order.cycle], ["исходе", order.tail]] as const) {
        for (const at of list) {
            if (at < 0 || at >= tune.lines.length) {
                problems.push(`${tune.id}: в ${where} назван строкой ${at + 1}, какой в напеве нет`);
            } else used.add(at);
        }
    }
    if (!used.size) problems.push(`${tune.id}: порядок строк пуст — петь нечего`);
    // Неиспользованная строка — не мелочь: её набрали, а поётся она никогда.
    tune.lines.forEach((_, i) => {
        if (!used.has(i)) problems.push(`${tune.id}: строка ${i + 1} в порядок не входит`);
    });

    const seenVariants = new Set<string>();
    for (const variant of tune.variants ?? []) {
        if (seenVariants.has(variant.id)) {
            problems.push(`${tune.id}: вариант «${variant.id}» объявлен дважды`);
        }
        seenVariants.add(variant.id);
        if (variant.line < 0 || variant.line >= tune.lines.length) {
            problems.push(`${tune.id}: вариант «${variant.id}» правит строку ${variant.line + 1}, какой нет`);
        }
        if (!variant.steps.length) problems.push(`${tune.id}: вариант «${variant.id}» пуст`);
    }

    if (!tune.scores.length) problems.push(`${tune.id}: нет ни одной записи`);

    for (const score of tune.scores) {
        if (!tradition.notations.includes(score.notation)) {
            problems.push(`${tune.id}: традиция не записывается нотацией «${score.notation}»`);
        }
        if (!tradition.voices.includes(score.voice)) {
            problems.push(`${tune.id}: в традиции нет голоса «${score.voice}»`);
        }
        checkScore(tune, score, problems);
    }
};

let cached: TuneLibrary | undefined;

const build = (): TuneLibrary => {
    const traditions = traditionsData.traditions as Tradition[];
    const localities = traditionsData.localities as Locality[];
    // JSON приходит с расширенными типами полей (string вместо литералов),
    // поэтому через unknown: проверяет содержимое checkTune, а не компилятор —
    // файлы данных правятся руками и мимо сборки.
    const tunes = [
        ...(znamennyMaly.tunes as unknown as Tune[]),
        ...(obihodPartes.tunes as unknown as Tune[]),
        ...(obihodMsk.tunes as unknown as Tune[]),
    ];

    const problems: string[] = [];
    const byTradition = new Map(traditions.map(t => [t.id, t]));
    const byLocality = new Map(localities.map(l => [l.id, l]));

    const seen = new Set<string>();
    for (const tune of tunes) {
        if (seen.has(tune.id)) problems.push(`${tune.id}: напев с таким ключом уже есть`);
        seen.add(tune.id);
        checkTune(tune, byTradition, byLocality, problems);
    }

    // Говорим в журнал сервера, а не молчим: страница покажет напев как умеет,
    // но правщик данных должен узнать о расхождении сразу.
    if (problems.length) console.error("напевы: расхождения в данных:\n" + problems.join("\n"));

    return { traditions, localities, tunes, problems };
};

export const tuneLibrary = (): TuneLibrary => {
    if (process.env.NODE_ENV === "development") return build();
    if (!cached) cached = build();
    return cached;
};
