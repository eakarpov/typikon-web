import Link from "next/link";
import { MONTH_OF } from "@/utils/chantLabels";
import type { OrdoFastingRule } from "@/lib/ordo";
import { trapezaDay } from "@/lib/trapeza/store";
import {
    chosenVariant,
    disputedGroups,
    estateLabel,
    estatesOf,
    isOurInference,
    shiftDay,
    signIsThreshold,
    todayCivil,
    variantDisagreement,
    verdictOf,
    whyOf,
} from "@/lib/trapeza/core";

// День трапезы. Порядок разделов — порядок убывания достоверности: сперва
// оговорка, потом слова книги, потом наши выводы о них.

const dateLabel = (date: string) => {
    const [y, m, d] = date.split("-").map(Number);
    return `${d} ${MONTH_OF[m]} ${y}`;
};

/** Правило целиком: чем сказано, откуда взято и с какой оговоркой. */
const Rule = ({ rule, actualSign }: { rule: OrdoFastingRule; actualSign: string | null }) => {
    const why = whyOf(rule);
    const ours = isOurInference(rule);

    return (
        <div className="border-l-2 border-slate-200 pl-3 mt-2">
            {ours && (
                // Признаться в своём выводе надо ДО цитаты: после неё читатель
                // уже принял его за слова книги.
                <p className="text-sm font-serif text-amber-700">
                    Это наш вывод, а не слова книги: Типикон говорит, когда постятся, а когда
                    не постятся — молчит. Строка стоит здесь, чтобы у всякого дня был ответ.
                </p>
            )}
            <p className="font-serif text-slate-800">{rule.label}</p>
            <p className="text-xs text-slate-500 font-serif">Типикон, глава {rule.chapter}</p>
            {rule.citation && (
                <blockquote className="font-serif text-slate-700 mt-1 pl-3 border-l border-slate-200">
                    {rule.citation}
                </blockquote>
            )}
            {rule.note && (
                // Оговорка записи показывается ВСЕГДА и дословно: у иных правил
                // она важнее самого правила — «не могущии же сохранити дву дней
                // первых, ядят хлеб и квас по вечерни».
                <p className="font-serif text-sm text-slate-600 mt-1">{rule.note}</p>
            )}
            {why.length > 0 && (
                <p className="text-xs text-slate-500 font-serif mt-1">
                    Выбрано тем, что назвало этот день: {why.map(p => p.text).join(" · ")}
                </p>
            )}
            {signIsThreshold(rule, actualSign) && (
                <p className="text-xs text-amber-700 font-serif mt-1">
                    Правило сказано о службе со знаком «{rule.sign}», а сегодня знак выше. Мы
                    читаем знак как нижнюю границу разрешения, а не как один разряд; книга так
                    прямо не говорит.
                </p>
            )}
        </div>
    );
};

const Estate = ({ title, rules, actualSign, absent }: {
    title: string;
    rules: OrdoFastingRule[];
    actualSign: string | null;
    absent?: string;
}) => {
    // Спорные правила сюда не идут: они разобраны ниже, своим разделом, где
    // видно оба чтения разом. Показать их и тут значило бы напечатать одно и
    // то же дважды, а первым разом — как будто ответ один.
    const settled = rules.filter(r => !r.disputed);
    const disputed = rules.length - settled.length;

    return (
    <section className="flex-1 min-w-[18rem]">
        <h2 className="font-serif font-bold text-sm">{title}</h2>
        {disputed > 0 && (
            <p className="font-serif text-slate-700 mt-1">
                Книга даёт два ответа — главы расходятся, разбор ниже.
            </p>
        )}
        {rules.length === 0
            ? <p className="font-serif text-slate-600 mt-1">{absent}</p>
            : settled.map(rule => (
                <div key={rule.ruleId}>
                    <p className="font-serif text-slate-900 mt-1">
                        {verdictOf(rule)}
                        {rule.inherited && (
                            <span className="text-xs text-slate-500"> — по общему правилу</span>
                        )}
                    </p>
                    <Rule rule={rule} actualSign={actualSign} />
                </div>
            ))}
    </section>
    );
};

const Day = async ({ date }: { date: string }) => {
    const day = await trapezaDay(date);
    const variant = chosenVariant(day);
    const rules = variant?.fasting ?? [];
    const estates = estatesOf(rules);
    const disputes = disputedGroups(rules);
    const others = variantDisagreement(day);
    const today = todayCivil();

    const nav = (
        <div className="flex gap-4 items-baseline font-serif text-sm mt-6">
            <Link href={`/trapeza/${shiftDay(date, -1)}`} className="text-red-900">← день назад</Link>
            {date !== today && <Link href={`/trapeza/${today}`} className="text-red-900">сегодня</Link>}
            <Link href={`/trapeza/${date.slice(0, 7)}`} className="text-red-900">месяцем</Link>
            <Link href={`/trapeza/${shiftDay(date, 1)}`} className="text-red-900">день вперёд →</Link>
        </div>
    );

    return (
        <div className="flex flex-col gap-4">
            <div>
                <h1 className="font-bold font-serif">Трапеза, {dateLabel(date)}</h1>
                {day && (
                    <p className="text-sm text-slate-500 font-serif">
                        {day.weekdayLabel}
                        {" · "}
                        {day.churchDate.day} {MONTH_OF[day.churchDate.month]} по церковному счёту
                        {day.triodLabel ? ` · ${day.triodLabel}` : ""}
                    </p>
                )}
                {rules[0]?.periodLabel && (
                    // Период — отдельной строкой и только когда он есть: полгода
                    // его нет вовсе, а «обычный день» книга не говорит.
                    <p className="font-serif text-slate-700 mt-1">{rules[0].periodLabel}</p>
                )}
            </div>

            {/* Оговорка стоит вверху, обычным кеглем, а не петитом внизу: без
                неё страницу читают как предписание себе — а сказано в ней о
                монастыре. Тот же приём, что у словаря ударений. */}
            <div className="font-serif text-slate-700">
                <p>
                    Типикон — устав <strong>монастырский</strong>. Здесь сказано, что книга
                    назначает братии обители, а не что положено вам: мера поста мирянина — дело
                    духовника, а не таблицы. Где книга различает монаха и мирянина, различие
                    показано; где не различает — она говорит о монастыре.
                </p>
                <p className="text-sm text-slate-600 mt-1">
                    Книга распоряжается изъявительно — «разрешаем на елей точию, и вино», — и мы
                    передаём этот залог, а не смягчаем его.
                </p>
            </div>

            {!day && (
                <p className="font-serif text-slate-700">
                    Разбор трапезы сейчас недоступен: служба устава не отвечает. День от этого
                    никуда не делся — вернитесь позже.
                </p>
            )}

            {day && !variant && (
                <p className="font-serif text-slate-700">
                    Устав не назвал на этот день ни одной службы, а от службы зависит и трапеза.
                    Посмотреть, что об этом дне знает движок, можно в{" "}
                    <Link href={`/ustav?date=${date}`} className="text-red-900 hover:underline">
                        последовании
                    </Link>.
                </p>
            )}

            {variant && rules.length === 0 && (
                <p className="font-serif text-slate-700">
                    {variant.fastingLabel
                        ? <>Служба устава отвечает прежней сборкой: подпись есть — «{variant.fastingLabel}»,
                            — а разбора нет. Показать правило и главу пока нечем.</>
                        : <>Ни одно правило не назвало этого дня. Это пробел нашей записи, а не
                            молчание книги.</>}
                </p>
            )}

            {rules.length > 0 && (
                <div className="flex flex-wrap gap-8">
                    {estates.common.length > 0 && (
                        <Estate title="Всем" rules={estates.common} actualSign={variant?.sign ?? null} />
                    )}
                    {(estates.mirianin.length > 0 || estates.monah.length > 0) && (
                        <>
                            <Estate
                                title="Мирянам"
                                rules={estates.mirianin}
                                actualSign={variant?.sign ?? null}
                                absent={"Мирянам глава здесь ничего не назначает. Переносить на них "
                                    + "монашеское правило мы не станем: молчание книги — не "
                                    + "разрешение и не запрет, это молчание."}
                            />
                            <Estate
                                title="Монахам"
                                rules={estates.monah}
                                actualSign={variant?.sign ?? null}
                                absent={"Монахам глава здесь ничего не назначает отдельно."}
                            />
                        </>
                    )}
                </div>
            )}

            {disputes.length > 0 && (
                <section>
                    <h2 className="font-serif font-bold text-sm">Главы расходятся</h2>
                    <p className="font-serif text-sm text-slate-600 mt-1">
                        Это расхождение самой книги, а не нашей записи: о вторнике Петрова поста
                        глава 33 говорит «елей и вино точию», а глава 35 — «варение без масла, в
                        9-й час». Выбирать за книгу мы не станем. Где главы разнятся мелочью и
                        сходятся по существу, спором это не объявляется.
                    </p>
                    {disputes.map((group, i) => (
                        <div key={i} className="flex flex-wrap gap-6 mt-2">
                            {group.map(rule => (
                                <div key={rule.ruleId} className="flex-1 min-w-[18rem]">
                                    <p className="font-serif text-slate-900">
                                        По главе {rule.chapter}
                                        {estateLabel(rule.who) ? `, ${estateLabel(rule.who)}` : ""}
                                        : {verdictOf(rule)}
                                    </p>
                                    <Rule rule={rule} actualSign={variant?.sign ?? null} />
                                </div>
                            ))}
                        </div>
                    ))}
                </section>
            )}

            {variant && (
                <section className="text-sm font-serif text-slate-600">
                    <p>
                        Пост зависит от того, какая служба сегодня поётся. Здесь принята та, что
                        назначает устав: «{variant.label}»
                        {variant.markLabel ? ` — ${variant.markLabel}` : ""}.
                    </p>
                    {others.length > 0 && (
                        <p className="mt-1 text-amber-700">
                            При другой допускаемой службе книга назначила бы иначе:{" "}
                            {others.map(v => `«${v.label}» — ${v.fastingLabel ?? "неизвестно"}`).join("; ")}.{" "}
                            <Link href={`/ustav?date=${date}`} className="text-red-900 hover:underline">
                                чем это решается →
                            </Link>
                        </p>
                    )}
                </section>
            )}

            {nav}

            <div className="text-sm font-serif flex flex-wrap gap-4">
                <Link href={`/calculator/${date}`} className="text-red-900 hover:underline">
                    чтения этого дня →
                </Link>
                <Link href={`/ustav?date=${date}`} className="text-red-900 hover:underline">
                    как собрана служба →
                </Link>
            </div>

            <p className="text-xs text-slate-400 font-serif">
                Правила о посте выбраны из Типикона, главы 32, 33, 35, 49, 50 и 51; устав
                иерусалимский, обиход русский синодальный. Другого чина в нашей записи нет вовсе.
                Престольный праздник храма трапезу тоже меняет, но здесь ваш храм неизвестен — в
                приходском расписании он учитывается.
            </p>
        </div>
    );
};

export default Day;
