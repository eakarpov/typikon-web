'use client';
import { useMyTemple } from '@/app/components/MyTempleProvider';
import type { MyTempleValue } from '@/lib/myTemple/core';
export { MY_TEMPLE_KEY, readLocalTemple as readMyTemple } from '@/lib/myTemple/core';
export type { MyTempleValue } from '@/lib/myTemple/core';

export default function MyTemple({ slug, name }: MyTempleValue) {
    const value = useMyTemple();
    const mine = value.temple?.slug === slug;
    return <div className="font-serif mt-4 space-y-2">
        {value.loading ? <p role="status">Загружаю выбранный храм…</p> : <>
            {mine ? <p>Это ваш храм. <button type="button" className="underline min-h-11 px-2 py-2 disabled:opacity-50" disabled={value.busy} onClick={value.clear}>Убрать выбор</button></p> : <button type="button" disabled={value.busy || !!value.error} onClick={() => value.choose({ slug, name })} className="min-h-11 border border-amber-800 text-amber-800 rounded px-3 py-2 disabled:opacity-50">Это мой храм</button>}
            {value.temple && !mine && <p className="text-sm break-words">Сейчас выбран: {value.temple.name}</p>}
            <p className="text-sm text-slate-600">{value.owner === 'guest' ? 'Выбор хранится в этом браузере. Войдите, чтобы сохранить его в учётной записи.' : 'Выбор сохраняется в вашей учётной записи. Он не даёт прав на изменение расписания прихода.'}</p>
        </>}
        {value.error && <p role="alert">{value.error} <button className="underline min-h-11 px-2" disabled={value.busy} onClick={value.reload}>Обновить данные</button></p>}
    </div>;
}
