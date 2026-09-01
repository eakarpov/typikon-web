import type { ParishRule } from "../types";

// СТРАСТНАЯ И ПАСХА. Единственная неделя года, расписание которой настоятель
// и без нас помнит наизусть, — и ровно потому она здесь: её надо не вывести,
// а НЕ СОВРАТЬ. Часы взяты обиходные, русские приходские; служба и её состав
// пришли от устава и правятся не здесь.
//
// Правила эти самые точные в системе: paschaOffset весит больше всего, и
// потому они ложатся поверх и обычной практики, и великопостной, ничего не
// «выключая».
export const strastnaya: ParishRule[] = [
    {
        key: "strastnaya-utro",
        label: "Страстная: утро",
        when: { triod: ["strastnaya"], part: "utro" },
        note: "утреня, часы и изобразительны — в восемь",
        then: {
            set: { part: "utro", time: "08:00" },
            move: [{ services: ["matins", "hour-1"], to: "utro", dayOffset: 0,
                     note: "на Страстной утреня служится утром своего дня" }],
        },
    },
    {
        key: "strastnaya-den",
        label: "Страстная: Преждеосвященная и Литургия Василия Великого",
        when: { triod: ["strastnaya"], part: "den" },
        note: "устав ставит её днём; на приходе служится сразу по часах",
        then: { set: { part: "den", time: "09:00", duration: 120 } },
    },
    {
        key: "strastnaya-vecher",
        label: "Страстная: великое повечерие",
        when: { triod: ["strastnaya"], part: "vecher" },
        note: "в семнадцать",
        then: { keep: ["compline"], set: { part: "vecher", time: "17:00" } },
    },
    {
        key: "chetvertok-vecher",
        label: "Двенадцать Евангелий",
        // Утреня Великого Пятка, и служится она вечером Четвертка — так
        // ставит её сам устав, а не приход. Здесь только час и имя.
        when: { paschaOffset: -2, part: "vecher" },
        note: "утреня Великого Пятка с чтением двенадцати Страстных Евангелий",
        then: {
            set: { part: "vecher", time: "18:00", title: "Утреня с чтением "
                + "двенадцати Страстных Евангелий", duration: 180 },
        },
    },
    {
        key: "pyatok-chasy",
        label: "Царские часы",
        when: { paschaOffset: -2, part: "utro" },
        note: "часы Великого Пятка — царские: на каждом паримия, Апостол и "
            + "Евангелие, и служатся все четыре вместе. Изобразительны входят "
            + "в самый их чин и отдельно не объявляются",
        then: { set: { part: "utro", time: "08:00", title: "Царские часы" } },
    },
    {
        key: "pyatok-vynos",
        label: "Вынос Плащаницы",
        when: { paschaOffset: -2, part: "den" },
        note: "вечерня с выносом Плащаницы; устав говорит «при часе 10-м дне»",
        then: { set: { part: "den", time: "14:00", title: "Вечерня с выносом "
                + "Плащаницы", duration: 90 } },
    },
    {
        key: "pyatok-pogrebenie",
        label: "Погребение",
        when: { paschaOffset: -1, part: "vecher" },
        note: "утреня Великой Субботы с погребением и крестным ходом; служится "
            + "вечером Великого Пятка",
        then: {
            set: { part: "vecher", time: "18:00", title: "Утреня с чином "
                + "погребения", duration: 150 },
            add: [{ part: "vecher", services: ["krestny-hod"] }],
        },
    },
    {
        key: "pascha-noch",
        label: "Пасхальная ночь",
        when: { paschaOffset: 0, part: "noch" },
        note: "полунощница, крестный ход, заутреня и Литургия — одним стоянием",
        then: {
            set: { part: "noch", time: "23:30", title: "Полунощница. Крестный ход. "
                + "Пасхальная заутреня и Литургия", duration: 240 },
            keep: ["midnight"],
            add: [{ part: "noch", services: ["krestny-hod"] }],
            // НОЧЬ ПРИНАДЛЕЖИТ ДВУМ ЧИСЛАМ, и расписание должно назвать то, в
            // которое приходят: служба начинается в половине двенадцатого
            // ночи с СУББОТЫ на воскресенье, и в строке воскресенья её искать
            // поздно — прихожанин опоздает на сутки.
            move: [{
                services: ["midnight", "matins", "liturgy", "hour-1", "hour-3",
                           "hour-6", "hours", "krestny-hod"],
                to: "noch", dayOffset: -1,
                note: "пасхальная ночь начинается вечером Великой Субботы",
            }],
        },
    },
    {
        key: "svetlyi-ponedelnik-vecher",
        label: "Вечером Пасхи службы нет",
        // Стояние это принадлежит уже Светлому понедельнику, потому и условие
        // на нём: вечерня Пасхи отслужена днём, и второй в этот вечер не бывает.
        when: { paschaOffset: 1, part: "vecher" },
        note: "вечерня Пасхи отслужена днём; вечером храм не собирается",
        then: { drop: ["vespers", "matins", "compline", "vsenoshchnoe", "hour-1", "hour-9"] },
    },
    {
        key: "svetlaya-utro",
        label: "Светлая седмица: утро",
        // На Светлой утреня НЕ уходит на вечер накануне: пасхальная утреня
        // служится утром, сразу перед литургией, и крестным ходом по ней.
        // Иначе выйдет, что приход служит её дважды или не служит вовсе.
        when: { triod: ["svetlaya-sedmica"], part: "utro" },
        note: "пасхальная утреня, литургия и крестный ход — одним собранием",
        then: {
            set: { part: "utro", time: "09:00", duration: 150 },
            move: [{ services: ["matins", "hour-1"], to: "utro", dayOffset: 0,
                     note: "пасхальная утреня служится утром, перед литургией" }],
            add: [{ part: "utro", services: ["krestny-hod"] }],
        },
    },
    {
        key: "subbota-bez-panihidy",
        label: "На Страстной панихид нет",
        when: { triod: ["strastnaya"] },
        note: "Великая Суббота — не родительская: заупокойное её служба несёт "
            + "в себе, и панихиды сверх неё не бывает",
        then: { drop: ["panihida"] },
    },
    {
        key: "pascha-den",
        label: "Пасхальная вечерня",
        when: { paschaOffset: 0, part: "den" },
        note: "вечерня самой Пасхи, днём — единственная в году",
        then: { set: { part: "den", time: "14:00", duration: 60 } },
    },
    {
        key: "pascha-vecher",
        label: "Пасха: вечера службы нет",
        // На саму Пасху вечернее собрание отменяется целиком: вечерня уже
        // была днём, а вечером служить нечего — приход разошёлся по домам.
        when: { paschaOffset: 0, part: "vecher" },
        note: "вечером Пасхи службы нет: вечерня отслужена днём",
        then: { drop: ["compline", "vespers", "matins", "vsenoshchnoe", "hour-9"] },
    },
];
