'use client';
import { useCallback, useEffect, useRef, useState } from "react";
import { createEngine, addData } from "@/lib/azbuki/chinese/engine";
import { DATASETS, type Engine, type TabId } from "@/lib/azbuki/chinese/types";

// Данные азбуки — 6,8 МБ, и в бандл страницы столько класть нельзя. Поэтому
// они лежат в public/ и забираются по требованию: справочнику хватает словаря
// слогов и справочных таблиц (0,6 МБ), разбору иероглифа нужны ещё чтения
// (4,4 МБ), а полный словарь слов (2,5 МБ) подтягивается только на вкладке
// текста. Уже загруженное переиспользуется: между вкладками ничего не качается
// заново.

const BASE = "/azbuki/chinese/";

const loaded = new Map<string, unknown>();
let engine: Engine | null = null;

async function fetchSet(names: readonly string[]) {
    const missing = names.filter(n => !loaded.has(n));
    await Promise.all(missing.map(async name => {
        const res = await fetch(`${BASE}${name}.json`);
        if (!res.ok) throw new Error(`${name}.json: ${res.status}`);
        loaded.set(name, await res.json());
    }));
    const data: Record<string, unknown> = {};
    for (const name of names) data[name] = loaded.get(name);
    if (engine) return addData(engine, data);
    engine = createEngine(data);
    return engine;
}

export interface EngineState {
    engine: Engine | null;
    error: string | null;
}

/** Движок с данными, нужными этой вкладке. Пока грузится — engine === null. */
export function useEngine(tab: TabId): EngineState {
    const [state, setState] = useState<EngineState>({ engine: null, error: null });
    // Вкладку переключают быстрее, чем приходит ответ; без этой проверки
    // ответ на брошенный запрос перезаписал бы состояние уже другой вкладки.
    const current = useRef<TabId>(tab);

    useEffect(() => {
        current.current = tab;
        let alive = true;
        setState(s => (s.engine && !s.error ? s : { engine: null, error: null }));
        fetchSet(DATASETS[tab]).then(
            e => { if (alive && current.current === tab) setState({ engine: e, error: null }); },
            (err: Error) => { if (alive) setState({ engine: null, error: err.message }); },
        );
        return () => { alive = false; };
    }, [tab]);

    return state;
}

/** Повторить загрузку после ошибки сети. */
export function useRetry() {
    return useCallback(() => window.location.reload(), []);
}
