'use client';
import Link from 'next/link';
import { useMyTemple } from './MyTempleProvider';
export default function MyTempleSelection() {
    const value = useMyTemple();
    return <section className="font-serif space-y-2 py-3" aria-label="Мой храм">
        <h2 className="font-bold">Мой храм</h2>
        {value.loading ? <p role="status">Загружаю выбранный храм…</p> : value.temple ? <>
            <Link className="underline break-words" href={`/temples/${value.temple.slug}`}>{value.temple.name}{value.temple.place ? `, ${value.temple.place}` : ''}</Link>
            <p className="text-sm">{value.owner === 'guest' ? 'Сохранён в этом браузере.' : 'Сохранён в учётной записи и доступен на других устройствах.'}</p>
            <div className="flex flex-wrap gap-3"><Link className="underline min-h-11 py-2" href={`/parish/${value.temple.slug}`}>Расписание прихода</Link><button className="underline min-h-11 py-2 disabled:opacity-50" disabled={value.busy} onClick={value.clear}>Убрать выбор</button></div>
        </> : <p>{value.unavailable ? 'Выбранный храм больше недоступен в указателе.' : 'Храм пока не выбран.'} <Link className="underline" href="/temples">Выбрать храм в указателе</Link></p>}
        {value.unavailable && <button className="underline min-h-11 py-2" disabled={value.busy} onClick={value.clear}>Убрать недоступный храм</button>}
        {!value.loading && value.legacy && !value.temple && <div className="border rounded p-3 space-y-2"><p>В этом браузере выбран храм: {value.legacy.name}. Перенесите его в учётную запись, чтобы видеть на других устройствах.</p><button className="min-h-11 border rounded p-2 disabled:opacity-50" disabled={value.busy} onClick={value.migrate}>Перенести выбранный храм</button></div>}
        {value.error && <div role="alert"><p>{value.error}</p><button className="underline min-h-11 py-2" disabled={value.busy} onClick={value.reload}>Обновить данные</button></div>}
    </section>;
}
