// Житие святого из святцев dneslov.org — то, что раньше браузер клиента тянул
// с чужого сервера сам, в два шага и без защиты от его флапов.
//
// Порядок такой: сначала наш снимок святцев (коллекция dneslov_memories) —
// он отвечает из нашей базы, даже когда dneslov.org лежит, — и только пустой
// снимок отправляет в сеть за догрузкой (saintMemory, таймаут 3 с, в кэш ложится
// только успех). Отдельной ручкой от досье живём по той же причине, по какой
// приложение держит их раздельно: житие стороннее и молчит заметно чаще нас,
// и его молчание не должно уносить с собой имя, дни памяти и тексты.
import { cached, CacheTag } from "@/lib/cache";
import { getSaintByAddress, dneslovIdsOf, snapshotOfMemory } from "@/lib/saints";
import { saintLife } from "@/lib/api/v2/serialize";
import { saintMemory } from "@/lib/dneslov";

export type SaintLifeResult =
    | { status: "ok"; details: any }
    | { status: "no_saint" }
    | { status: "no_link" }
    | { status: "no_details" };

// «Снимка нет и святцы не ответили» — не факт, а минутная непогода: исключением
// оно из кэша не достаётся (unstable_cache помнит только успех), и следующий
// запрос попробует снова. Отлично это от постоянных отрицаний — иначе четверть
// часа флапа dneslov.org легла бы в ответе «жития нет» на сутки.
class LifeUnavailable extends Error {}

const loadSaintLife = cached(async (address: string): Promise<SaintLifeResult> => {
    const saint = await getSaintByAddress(address);
    if (!saint) return { status: "no_saint" };

    const ids = dneslovIdsOf(saint);
    // Бывает и так: запись заведена из нашей памяти, а номера святцев у неё нет
    // (пустые externals) — жить ей не от чего.
    if (!ids.length) return { status: "no_link" };

    // Объединённая нами запись может иметь несколько номеров: один пустой
    // снимок не должен скрывать житие, доступное под другим номером.
    const snapshots = await Promise.all(ids.map(async id => {
        const snapshot = await snapshotOfMemory(id);
        // A header-only snapshot must not prevent fetching the actual life.
        return saintLife(snapshot) ? snapshot : (await saintMemory(id)) ?? snapshot;
    }));
    const available = snapshots.filter(Boolean);
    if (!available.length || (!available.some(d => saintLife(d)) && available.some(d => d._dneslovUnavailable))) {
        throw new LifeUnavailable();
    }
    const details = {
        ...available[0],
        memoes: available.flatMap(d => Array.isArray(d.memoes) ? d.memoes : []),
        events: available.flatMap(d => Array.isArray(d.events) ? d.events : []),
        links: available.flatMap(d => Array.isArray(d.links) ? d.links : []),
    };
    return { status: "ok", details };
}, ["saint-life:v3"], [CacheTag.SAINTS], 86400);

export const saintLifeOf = async (address: string): Promise<SaintLifeResult> => {
    try {
        return await loadSaintLife(address);
    } catch (e) {
        if (e instanceof LifeUnavailable) return { status: "no_details" };
        throw e;
    }
};
