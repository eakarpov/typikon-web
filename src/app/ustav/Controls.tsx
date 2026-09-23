'use client';
import React, { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { OrdoLayer, OrdoOptions, OrdoService } from "@/lib/ordo";
import { MONTH_LABELS } from "@/utils/chantLabels";

// Чем задаётся вопрос к уставу. Состояние держим в адресе страницы, а не в
// компоненте: собранную службу тогда можно переслать ссылкой, и «назад»
// возвращает к прежнему дню, а не к пустой форме.

interface Props {
    services: OrdoService[];
    options: OrdoOptions | null;
    params: Record<string, string | undefined>;
}

const SELECT = "border rounded px-1 py-0.5 text-sm font-serif bg-white";

const Controls = ({ services, options, params }: Props) => {
    const router = useRouter();
    const pathname = usePathname();

    const push = useCallback((changes: Record<string, string>) => {
        const next = new URLSearchParams();
        for (const [k, v] of Object.entries(params)) if (v) next.set(k, v);
        for (const [k, v] of Object.entries(changes)) {
            if (v) next.set(k, v); else next.delete(k);
        }
        router.push(`${pathname}?${next.toString()}`);
    }, [params, pathname, router]);

    // `id` — то, чем пункт отличается от соседа В СПИСКЕ, а не значение поля.
    // У слоёв устава это не одно и то же: «без знака» есть и у никоновского,
    // и у дониконовского, значение у них одно (`sign=bez-znaka`), а слои
    // разные, и различает их layerId.
    const select = (name: string, empty: string | null,
                    options: { key: string | number; label: string; id?: string }[]) => (
        <select className={SELECT} value={params[name] || ""}
                onChange={e => push({ [name]: e.target.value })}>
            {empty !== null && <option value="">{empty}</option>}
            {options.map(o => (
                <option key={o.id ?? o.key} value={String(o.key)}>{o.label}</option>
            ))}
        </select>
    );

    const days = Array.from({ length: 31 }, (_, i) => ({ key: i + 1, label: String(i + 1) }));
    const months = MONTH_LABELS.slice(1).map((label, i) => ({ key: i + 1, label }));
    const prihod = options?.prihods.find(p => p.prihod === params.prihod);

    // ПО КАКОМУ УСТАВУ СЛУЖИМ — вопрос прежде знака, а не рядом с ним: знак,
    // вариант дня и праздничный слой принадлежат уставу, и одного их ключа
    // мало, чтобы назвать слой. Пока устав не спрашивался, списки шли слоями
    // обоих уставов вперемешку: дониконовские пункты ставили те же значения,
    // что никоновские, и выбрать их было нельзя — собиралась никоновская
    // служба, о чём форма молчала.
    //
    // Устав — ось УСТАВА, а не оформления: он решает порядок службы. Редакцию
    // самих слов заявляет извод книги, и это другой вопрос.
    const ustav = params.ustav || options?.ustavy[0]?.ustav || "";
    const своиСлои = (list: OrdoLayer[] | undefined) =>
        (list ?? []).filter(l => l.ustav === ustav);
    const signs = своиСлои(options?.signs);
    const dayVariants = своиСлои(options?.dayVariants);
    const feasts = своиСлои(options?.feasts);

    // СМЕНА УСТАВА СБРАСЫВАЕТ ТО, ЧЕГО У НОВОГО НЕТ. Уставы совпадают не
    // ключ в ключ: пасхальных знаков у дониконовского не написано вовсе, и
    // оставленный знак адресовал бы несуществующий слой — служба собралась бы
    // без единого правила, а форма показала бы пустой выбор.
    const switchUstav = (next: string) => {
        const has = (list: OrdoLayer[], key?: string) =>
            !key || list.some(l => l.ustav === next && l.key === key);
        push({
            ustav: next,
            sign: has(options?.signs ?? [], params.sign) ? (params.sign ?? "") : "",
            day_variant: has(options?.dayVariants ?? [], params.day_variant)
                ? (params.day_variant ?? "") : "",
            feast: has(options?.feasts ?? [], params.feast) ? (params.feast ?? "") : "",
        });
    };

    return (
        <div className="flex flex-col gap-2 mb-4">
            <div className="flex flex-wrap gap-2 items-baseline">
                {select("ordo", null, services.map(s => ({ key: s.ordoId, label: s.label })))}
                {select("day", null, days)}
                {select("month", null, months)}
            </div>

            {options && (
                <>
                    <div className="flex flex-wrap gap-2 items-baseline">
                        <select className={SELECT} value={ustav}
                                onChange={e => switchUstav(e.target.value)}>
                            {options.ustavy.map(u => (
                                <option key={u.ustav} value={u.ustav}>{u.label}</option>
                            ))}
                        </select>
                        {select("sign", "— без устава (показать всё) —",
                            signs.map(s => ({ key: s.key, label: s.label, id: s.layerId })))}
                        {select("day_variant", null,
                            dayVariants.map(s => ({ key: s.key, label: s.label, id: s.layerId })))}
                        {select("feast", "— по дню —", [
                            ...feasts.map(s => ({ key: s.key, label: s.label, id: s.layerId })),
                            // Слой праздника определяется по самому дню; этот
                            // пункт нужен, чтобы сказать «а сегодня не праздник»
                            // и увидеть службу без него.
                            { key: options.feastNone, id: options.feastNone,
                              label: "— не праздничный день —" },
                        ])}
                    </div>
                    <div className="flex flex-wrap gap-2 items-baseline">
                        {select("predstoyatel", null,
                            options.predstoyatel.map(s => ({ key: s.key, label: s.label })))}
                        {select("lang", null,
                            options.languages.map(s => ({ key: s.key, label: s.label })))}
                        {select("view", null,
                            Object.entries(options.views).map(([key, label]) => ({ key, label })))}
                        {select("prihod", "— без прихода —",
                            options.prihods.map(p => ({ key: p.prihod, label: p.prihod })))}
                        {prihod && select("prestol", "— главный —",
                            prihod.prestoly.map(p => ({
                                key: p.key,
                                label: p.label.slice(0, 46) + (p.isMain ? " (главный)" : ""),
                            })))}
                    </div>
                    <div className="flex flex-wrap gap-4 items-baseline text-sm font-serif">
                        <label className="flex gap-1 items-baseline">
                            <input type="checkbox" checked={params.psalms === "1"}
                                   onChange={e => push({ psalms: e.target.checked ? "1" : "" })} />
                            тексты псалмов
                        </label>
                        <label className="flex gap-1 items-baseline">
                            <input type="checkbox" checked={params.bez_diakona === "1"}
                                   onChange={e => push({ bez_diakona: e.target.checked ? "1" : "" })} />
                            без диакона
                        </label>
                        {/* Та же строка на других языках — подстрочником под
                            своей. Состав службы они НЕ меняют: устав решил его
                            до них, а это братья по адресу, приложенные к
                            готовым строкам. Оттого и отдельная ручка, а не
                            второй выбор языка. */}
                        <label className="flex gap-1 items-baseline"
                               title="Под каждой строкой — она же в других книгах. Знак ⇄ значит «перевод заявлен издателем», ~ — «только на том же месте»">
                            <input type="checkbox" checked={!!params.parallel}
                                   onChange={e => push({ parallel: e.target.checked ? "all" : "" })} />
                            языки рядом
                        </label>
                    </div>
                </>
            )}
        </div>
    );
};

export default Controls;
