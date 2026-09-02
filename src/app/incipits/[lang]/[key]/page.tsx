import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getIncipit, type IncipitDetail, type Translation, type Witness } from "@/lib/incipits";
import { csFont, myFont } from "@/utils/font";
import {
    BOOK_LABELS, SERVICE_LABELS, UNIT_LABELS,
    labelOf, memoryAddress, shortPosition, stanzaLabel,
} from "@/utils/chantLabels";
import { bookLanguageLabel, needsChurchFont } from "@/utils/bookLanguages";

// Страница одного зачина.
//
// Нужна не всякому: 91,6 % зачинов встречаются в корпусе ровно один раз, и для
// них список выдачи ведёт сразу в песнопение. Сюда попадают остальные — те, где
// есть что сличать: ирмосы, припевы, формулы, перепечатки одного текста под
// разными памятями.

export const dynamic = "force-dynamic";

// Указателем адресов зачинов не индексируемся: их 182 650, и у девяти десятых
// за адресом стоит ровно одна строка корпуса. Постоянству адреса это не мешает —
// сослаться на него можно, он просто не заводит поисковикам лишних страниц.
const NOINDEX = { index: false, follow: true };

const decode = (raw: string): string => {
    try {
        return decodeURIComponent(raw);
    } catch {
        // Битая экранировка в адресе — не повод падать пятисоткой: зачина с
        // таким ключом всё равно нет, и страница честно скажет «не найден».
        return "";
    }
};

export async function generateMetadata(
    { params }: { params: { lang: string; key: string } },
): Promise<Metadata> {
    const incipit = decode(params.key);
    const found = incipit ? getIncipit(params.lang, incipit) : null;
    if (!found) return { title: "Зачин не найден — Уставные чтения", robots: NOINDEX };

    return {
        title: `${incipit} — Уставные чтения`,
        description: found.text.replace(/\//g, " ").slice(0, 180),
        robots: NOINDEX,
    };
}

const fontFor = (language: string) => (needsChurchFont(language) ? "font-sans-serif" : "");

/** Текст песнопения. Косая черта — разрыв строки, как его печатает корпус. */
const Printed = ({ text, language }: { text: string; language: string }) => (
    <p className={`font-serif text-slate-800 leading-relaxed ${fontFor(language)}`}>
        {text.split("/").map((part, i, all) => (
            <React.Fragment key={i}>
                {part.trim()}
                {i < all.length - 1 && <br />}
            </React.Fragment>
        ))}
    </p>
);

/** Где стоит это вхождение: книга, память, служба, место, глас. */
const WitnessRow = ({ w }: { w: Witness }) => {
    const where = w.akathist
        ? [w.akathist, stanzaLabel(w.unit, w.stanza, w.stanzaKind) || null]
        : [
            labelOf(BOOK_LABELS, w.book),
            w.memory || null,
            memoryAddress(w) || null,
            labelOf(SERVICE_LABELS, w.service),
            shortPosition(w.position) || null,
            w.tone ? `глас ${w.tone}` : null,
            w.ode ? `песнь ${w.ode}` : null,
        ];

    return (
        <li className="font-serif text-sm">
            <Link href={`/chants/${w.id}`} className="text-red-900">
                {labelOf(UNIT_LABELS, w.unit) || "песнопение"}
            </Link>
            <span className="text-slate-500"> · {where.filter(Boolean).join(" · ")}</span>
        </li>
    );
};

const TranslationRow = ({ t }: { t: Translation }) => (
    <li className="flex flex-col">
        <div className="text-xs text-slate-500 font-serif">{bookLanguageLabel(t.language)}</div>
        <Link href={`/chants/${t.id}`} className={`font-serif text-slate-800 ${fontFor(t.language)}`}>
            {t.text.replace(/\s*\/\s*/g, " ").trim().slice(0, 200)}
        </Link>
        {t.evidence && (
            <div className="text-xs text-slate-500 font-serif">{t.evidence}</div>
        )}
    </li>
);

/**
 * Соответствия на других языках, разделённые по тому, на чём они держатся.
 *
 * Это главное на странице, и слить две кучи в одну было бы обманом. Заявленное
 * издателем — не наша работа: у AGES греческий и английский слои стоят на одном
 * ключе, и что одна строка есть перевод другой, сказано книгой. Догадка же
 * построена нами по совпавшему месту службы и бывает ложной: на 2 января место,
 * число строк и глас сошлись у «Правила веры» свт. Сильвестру и у «Ἑτοιμάζου
 * Ζαβουλών» предпразднства — это разные песнопения.
 */
const Correspondences = ({ found }: { found: IncipitDetail }) => {
    if (found.declared.length === 0 && found.supposed.length === 0) {
        return (
            <section className="mt-6">
                <h2 className="font-serif font-bold">На других языках</h2>
                <p className="font-serif text-sm text-slate-600 mt-1">
                    Соответствия не найдено. Это значит, что связь не построена, а не что её
                    нет: греческий с английским связаны ключом издателя, а славянский — только
                    через совпадение места службы, и оно сходится далеко не всегда.
                </p>
            </section>
        );
    }

    return (
        <section className="mt-6 flex flex-col gap-4">
            <h2 className="font-serif font-bold">На других языках</h2>

            {found.declared.length > 0 && (
                <div className="flex flex-col gap-1">
                    <div className="text-xs font-serif px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 self-start">
                        заявлено изданием
                    </div>
                    <ul className="flex flex-col gap-2 mt-1">
                        {found.declared.map(t => <TranslationRow key={t.id} t={t} />)}
                    </ul>
                </div>
            )}

            {found.supposed.length > 0 && (
                <div className="flex flex-col gap-1">
                    <div className="text-xs font-serif px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 self-start">
                        догадка по месту службы
                    </div>
                    <p className="font-serif text-xs text-slate-600">
                        Связано тем, что песнопения стоят на одном месте службы, — и потому
                        бывает неверным: на одно место разные книги ставят разное.
                    </p>
                    <ul className="flex flex-col gap-2 mt-1">
                        {found.supposed.map(t => <TranslationRow key={t.id} t={t} />)}
                    </ul>
                </div>
            )}
        </section>
    );
};

const IncipitPage = ({ params }: { params: { lang: string; key: string } }) => {
    const incipit = decode(params.key);
    const found = incipit ? getIncipit(params.lang, incipit) : null;
    if (!found) notFound();

    return (
        <div className={`${myFont.variable} ${csFont.variable} pt-2`}>
            <Link href="/incipits" className="font-serif text-sm text-red-900">
                ← к указателю зачинов
            </Link>

            <h1 className="font-bold font-serif mt-2">{found.incipit}</h1>
            <p className="text-xs text-slate-500 font-serif">
                {[
                    bookLanguageLabel(found.language),
                    `вхождений: ${found.uses}`,
                ].join(" · ")}
            </p>

            <section className="mt-4">
                <Printed text={found.text} language={found.language} />
                {found.borrowed && (
                    <p className="text-xs text-slate-500 font-serif mt-1">
                        Текста своего у этой строки нет — он взят по ссылке из Ирмология
                        или соседнего канона, как его печатает книга.
                    </p>
                )}
            </section>

            <section className="mt-6">
                <h2 className="font-serif font-bold">
                    Где встречается{found.uses > 1 ? ` (${found.uses})` : ""}
                </h2>
                <ul className="flex flex-col gap-1 mt-2">
                    {found.witnesses.map(w => <WitnessRow key={w.id} w={w} />)}
                </ul>
            </section>

            <Correspondences found={found} />
        </div>
    );
};

export default IncipitPage;
