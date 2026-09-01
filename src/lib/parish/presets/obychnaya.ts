import type { ParishRule } from "../types";

// ОБЫЧНАЯ ПРИХОДСКАЯ ПРАКТИКА — с чего приход начинает, а не то, чем он
// кончит. Это умолчание существует затем, чтобы ответственному было что ПРАВИТЬ:
// составлять расписание с нуля он и так умеет, а вот сказать «у нас не так»
// про готовую строку куда быстрее, чем сочинить её.
//
// Ничего уставного здесь нет ни в одной строке. Устав не знает часов вовсе:
// единственное место, где Типикон называет время (гл. 8, «в субботу в начале
// 4-го часа»), считает часы от восхода и сам оговаривает неприменимость к
// России. Всё, что ниже, — обычай, и записан он как обычай.
export const obychnaya: ParishRule[] = [
    {
        key: "ne-sluzhim",
        label: "Повечерие и полунощница",
        when: {},
        note: "на приходе не служатся; полунощница — монастырская служба, "
            + "великое повечерие возвращается Великим постом отдельным правилом",
        then: { drop: ["compline", "midnight", "vespers-small"] },
    },
    {
        key: "utrenya-nakanune",
        label: "Утреня вечером",
        when: { part: "utro", hasService: ["matins"] },
        note: "утреня служится вечером накануне вместе с вечерней — и в будни, "
            + "где бдения нет: люди работают, и утром до литургии на неё "
            + "никто не придёт. Это наш обычай, а не устав: устав ставит "
            + "утреню утром",
        then: {
            move: [{
                services: ["matins", "hour-1"], to: "vecher", dayOffset: -1,
                note: "утреня и первый час перенесены на вечер накануне — "
                    + "обычай прихода, а не указание устава",
            }],
        },
    },
    {
        key: "vecher",
        label: "Вечернее богослужение",
        when: { part: "vecher" },
        note: "в семнадцать часов",
        then: { set: { part: "vecher", time: "17:00" } },
    },
    {
        key: "vsenoshchnoe",
        label: "Всенощное бдение",
        when: { part: "vecher", hasService: ["vsenoshchnoe"] },
        note: "где устав назначил бдение, служим бдением, а не вечерней с "
            + "утреней порознь",
        then: { choose: ["vsenoshchnoe"], set: { part: "vecher", duration: 150 } },
    },
    {
        key: "utro",
        label: "Литургия",
        when: { part: "utro" },
        note: "в девять; часы читаются перед нею и отдельно не объявляются",
        then: { set: { part: "utro", time: "09:00", duration: 105 } },
    },
    {
        key: "voskresenie",
        label: "Литургия в воскресенье",
        when: { part: "utro", dayVariant: ["voskresny"] },
        note: "в воскресенье позже: людям добираться",
        then: { set: { part: "utro", time: "09:30", duration: 120 } },
    },
    {
        key: "subbota-panihida",
        label: "Панихида по субботам",
        when: { part: "utro", dayVariant: ["subbotny"] },
        note: "по литургии, не отдельным приходом в храм",
        then: { add: [{ part: "utro", services: ["panihida"] }] },
    },
    {
        key: "dvunadesyaty",
        label: "Двунадесятый праздник",
        when: { part: "utro", dvunadesyaty: true },
        note: "две литургии: ранняя и поздняя — в праздник храм не вмещает всех разом",
        then: {
            gatherings: [
                { part: "utro", time: "07:00", title: "Ранняя Литургия", duration: 90 },
                { part: "utro", time: "09:30", title: "Поздняя Литургия", duration: 120 },
            ],
        },
    },
    {
        key: "prestolny",
        label: "Престольный праздник",
        when: { part: "utro", prestolny: true },
        note: "поздняя литургия и крестный ход по ней",
        then: {
            set: { part: "utro", time: "09:30", duration: 150 },
            add: [{ part: "utro", services: ["krestny-hod"] }],
        },
    },
];
