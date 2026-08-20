"use client";
import Link from "next/link";

const Editor = ({ value }: { value: any[] }) => {
    return (
        <div className="flex flex-col">
            <p className="mb-4">
                Партии импорта из внешних источников (сейчас — Wikidata). Ничего не попадает в живые
                таблицы, пока партия не смержена.
            </p>
            {value.length === 0 && (
                <p className="text-slate-400">
                    Пока пусто. Запустить: <code>npm run nobles:import-wikidata</code>
                </p>
            )}
            {value.map((b) => (
                <Link
                    href={`/admin/nobles/import/${b.id}`}
                    key={b.id}
                    className="flex flex-row items-center mb-2 border-b pb-2 cursor-pointer hover:bg-slate-50"
                >
                    <p className="w-16">#{b.id}</p>
                    <p className="w-96">{b.label}</p>
                    <p className="w-32 text-slate-400">{b.createdAt?.slice(0, 10)}</p>
                    <p className="w-24">всего: {b.totalNobles}</p>
                    <p className="w-32 text-amber-600">на ревью: {b.pendingNobles}</p>
                    <p className="w-32 text-green-600">одобрено: {b.approvedNobles}</p>
                    <p className="w-32 text-red-600">отклонено: {b.rejectedNobles}</p>
                    <p className="w-32 text-blue-600">смержено: {b.mergedNobles}</p>
                </Link>
            ))}
        </div>
    );
};

export default Editor;
