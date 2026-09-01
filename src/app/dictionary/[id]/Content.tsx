import React from "react";
import Link from "next/link";
import type { Form, LexemeView, ParticipleView } from "@/app/dictionary/[id]/api";
import { GRID } from "@/lib/morphology/decline";
import type { AdjSlot, Slot, VerbSlot } from "@/lib/morphology/decline";

// Сетки повторяют книжные построчно — те самые таблицы А. Е. Полякова, по которым
// написаны парадигмы. Так их можно сверять глазами, не переводя из одной раскладки
// в другую, и так же читаются пустоты: пусто здесь значит «книга этой формы не даёт»,
// а не «у нас не хватило кода».

const LABELS: Record<string, string> = {
    S: "существительное", A: "прилагательное", V: "глагол",
    APRO: "местоимение-прилагательное", SPRO: "местоимение-существительное",
    ADVPRO: "местоимение-наречие", NUM: "числительное", ANUM: "порядковое числительное",
    ADV: "наречие", PR: "предлог", CONJ: "союз", PART: "частица", INTJ: "междометие",
    PARENTH: "вводное слово",
    m: "мужской род", f: "женский род", n: "средний род",
    anim: "одушевлённое", inan: "неодушевлённое", persn: "личное имя",
    topn: "название места", poss: "притяжательное", comp: "сравнительная степень",
    ipf: "несовершенный вид", pf: "совершенный вид",
    intr: "непереходный", tr: "переходный", tran: "переходный",
};

const CASES: [string, string][] = [
    ["nom", "Им."], ["gen", "Род."], ["acc", "Вин."],
    ["dat", "Дат."], ["ins", "Тв."], ["loc", "Пред."], ["voc", "Зв."],
];

const NUMBERS: [string, string][] = [["sg", "Ед. ч."], ["du", "Дв. ч."], ["pl", "Мн. ч."]];

const ADJ_ROWS: [AdjSlot, string][] = [
    ["sgMNomAcc", "ед. м. им./вин."], ["sgNNomAcc", "ед. ср. им./вин."],
    ["sgMNGen", "ед. м./ср. род."], ["sgMAcc", "ед. м. вин."],
    ["sgMNDat", "ед. м./ср. дат."], ["sgMNLoc", "ед. м./ср. пред."],
    ["sgMNIns", "ед. м./ср. тв."], ["sgMVoc", "ед. м. зв."],
    ["sgFNom", "ед. ж. им."], ["sgFAcc", "ед. ж. вин."], ["sgFGen", "ед. ж. род."],
    ["sgFDatLoc", "ед. ж. дат./пред."], ["sgFIns", "ед. ж. тв."],
    ["plMNom", "мн. м. им."], ["plMAccFNomAcc", "мн. м. вин., мн. ж. им./вин."],
    ["plNNomAcc", "мн. ср. им./вин."], ["plGenLoc", "мн. род./пред."],
    ["plDat", "мн. дат."], ["plIns", "мн. тв."],
    ["duMNomAcc", "дв. м. им./вин."], ["duNFNomAcc", "дв. ср./ж. им./вин."],
    ["duGenLoc", "дв. род./пред."], ["duDatIns", "дв. дат./тв."],
];

const VERB_GROUPS: { title: string; rows: [VerbSlot, string][] }[] = [
    {
        title: "Настоящее время",
        rows: [
            ["presSg1", "ед. 1 л."], ["presSg2", "ед. 2 л."], ["presSg3", "ед. 3 л."],
            ["presDu1", "дв. 1 л."], ["presDu23", "дв. 2–3 л."],
            ["presPl1", "мн. 1 л."], ["presPl2", "мн. 2 л."], ["presPl3", "мн. 3 л."],
        ],
    },
    {
        title: "Повелительное наклонение",
        rows: [
            ["impSg23", "ед. 2–3 л."], ["impDu1", "дв. 1 л."], ["impDu2", "дв. 2 л."],
            ["impPl1", "мн. 1 л."], ["impPl2", "мн. 2 л."],
        ],
    },
    {
        title: "Имперфект",
        rows: [
            ["imperfSg1", "ед. 1 л."], ["imperfSg23", "ед. 2–3 л."],
            ["imperfDu1", "дв. 1 л."], ["imperfDu23", "дв. 2–3 л."],
            ["imperfPl1", "мн. 1 л."], ["imperfPl2", "мн. 2 л."], ["imperfPl3", "мн. 3 л."],
        ],
    },
    {
        title: "Аорист",
        rows: [
            ["aorSg1", "ед. 1 л."], ["aorSg23", "ед. 2–3 л."],
            ["aorDu1", "дв. 1 л."], ["aorDu23", "дв. 2–3 л."],
            ["aorPl1", "мн. 1 л."], ["aorPl2", "мн. 2 л."], ["aorPl3", "мн. 3 л."],
        ],
    },
    {
        title: "Неспрягаемые формы",
        rows: [
            ["inf", "инфинитив"],
            ["partPerf", "причастие перфекта"],
            ["partPresActSg", "причастие настоящего действительное, ед. м./ср."],
        ],
    },
];

/**
 * Формы одной ячейки. Выписанная в словаре стоит первой и набрана прямо, порождённая
 * по парадигме — серым: читателю должно быть видно, где свидетельство, а где вывод.
 */
const Cell = ({ forms }: { forms?: Form[] }) => {
    if (!forms?.length) return <span className="text-slate-300">—</span>;

    return (
        <span>
            {forms.map((form, index) => (
                <React.Fragment key={form.value + index}>
                    {index > 0 && <span className="text-slate-300">{" / "}</span>}
                    <span className={form.stored ? "" : "text-slate-500"}>{form.value}</span>
                </React.Fragment>
            ))}
        </span>
    );
};

const Declension = ({ table }: { table: Record<Slot, Form[]> }) => (
    <div className="overflow-x-auto">
        <table className="font-serif border-collapse">
            <thead>
                <tr>
                    <th />
                    {NUMBERS.map(([, label]) => (
                        <th key={label} className="text-left font-bold px-3 py-1">{label}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {CASES.map(([kase, label]) => (
                    <tr key={kase} className="border-t border-slate-200">
                        <th className="text-left font-bold pr-3 py-1 whitespace-nowrap">{label}</th>
                        {NUMBERS.map(([number]) => (
                            <td key={number} className="px-3 py-1">
                                <Cell forms={table[GRID[kase][number]]} />
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const Adjective = ({ table }: { table: { brev: Record<AdjSlot, Form[]>; plen: Record<AdjSlot, Form[]> } }) => (
    <div className="overflow-x-auto">
        <table className="font-serif border-collapse">
            <thead>
                <tr>
                    <th />
                    <th className="text-left font-bold px-3 py-1">Краткая</th>
                    <th className="text-left font-bold px-3 py-1">Полная</th>
                </tr>
            </thead>
            <tbody>
                {ADJ_ROWS.map(([slot, label]) => (
                    <tr key={slot} className="border-t border-slate-200">
                        <th className="text-left font-normal text-slate-600 pr-3 py-1 whitespace-nowrap">{label}</th>
                        <td className="px-3 py-1"><Cell forms={table.brev[slot]} /></td>
                        <td className="px-3 py-1"><Cell forms={table.plen[slot]} /></td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const Conjugation = ({ table }: { table: Record<VerbSlot, Form[]> }) => (
    <div className="flex flex-col gap-5">
        {VERB_GROUPS.map((group) => (
            <div key={group.title}>
                <h3 className="font-serif font-bold mb-1">{group.title}</h3>
                <table className="font-serif border-collapse">
                    <tbody>
                        {group.rows.map(([slot, label]) => (
                            <tr key={slot} className="border-t border-slate-200">
                                <th className="text-left font-normal text-slate-600 pr-3 py-1 whitespace-nowrap align-top">
                                    {label}
                                </th>
                                <td className="px-3 py-1"><Cell forms={table[slot]} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        ))}
    </div>
);

// Причастие показываем той же сеткой, что прилагательное: оно ею и склоняется.
const Participle = ({ participle }: { participle: ParticipleView }) => (
    <div>
        <h3 className="font-serif font-bold mb-1">{participle.title}</h3>
        <Adjective table={participle.table} />
    </div>
);

const Content = async ({ itemsPromise }: { itemsPromise: Promise<[LexemeView | null, unknown]> }) => {
    const [item, error] = await itemsPromise;

    if (error || !item) {
        return (
            <p className="font-serif">
                Такого слова в словаре нет.{" "}
                <Link href="/dictionary" className="underline underline-offset-4">К поиску</Link>.
            </p>
        );
    }

    const marks = item.properties.map((tag) => LABELS[tag] ?? tag).join(", ");

    return (
        <div className="flex flex-col gap-4 max-w-3xl">
            <div>
                <h1 className="font-serif font-bold text-2xl">{item.name}</h1>
                <p className="font-serif text-slate-600">{marks}</p>
            </div>

            {item.known ? (
                <>
                    {item.noun && <Declension table={item.noun} />}
                    {item.adjective && <Adjective table={item.adjective} />}
                    {item.verb && <Conjugation table={item.verb} />}

                    {item.participles?.map((participle) => (
                        <Participle key={participle.title} participle={participle} />
                    ))}

                    {/* Оговорка стоит под таблицей, а не петитом в конце страницы:
                        без неё порождённую форму прочтут как засвидетельствованную. */}
                    <p className="font-serif text-sm text-slate-600">
                        Чёрным — формы, выписанные в словаре; <span className="text-slate-500">серым</span> —
                        порождённые по парадигме <span className="font-mono">{item.scheme}</span> и в словаре
                        не засвидетельствованные. Порождение сверено со словарём: сходится в четырёх
                        случаях из пяти, так что серую форму стоит читать как ожидаемую, а не как
                        удостоверенную.
                    </p>
                </>
            ) : (
                <p className="font-serif text-slate-600">
                    {item.scheme
                        ? <>Парадигма <span className="font-mono">{item.scheme}</span> в таблицах ещё не расписана —
                            показываем только то, что выписано в самом словаре.</>
                        : <>Слово неизменяемое: парадигмы у него нет.</>}
                </p>
            )}

            {item.extra.length > 0 && (
                <div>
                    <h3 className="font-serif font-bold mb-1">Прочие написания словаря</h3>
                    <p className="font-serif text-sm text-slate-600 mb-1">
                        Сокращения под титлом и формы, которые в сетку не ложатся.
                    </p>
                    <ul className="font-serif flex flex-wrap gap-x-4">
                        {item.extra.map((form, index) => (
                            <li key={form.value + index}>
                                {form.value}
                                {form.properties && <span className="text-slate-500 text-sm"> ({form.properties})</span>}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <p className="font-serif text-sm">
                <Link href="/dictionary" className="underline underline-offset-4">Искать другое слово</Link>
            </p>
        </div>
    );
};

export default Content;
