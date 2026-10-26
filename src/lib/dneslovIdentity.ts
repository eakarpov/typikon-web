/** Calendar rows are memoes, not memories: their id must not address memories/{id}. */
export function dneslovAddress(row: any): string | null {
    if (row?.memory_id != null) return String(row.memory_id);
    const slug = typeof row?.slug === 'string' && row.slug.trim() ? row.slug.trim() : null;
    if (row?.event_id != null || row?.calendary_id != null || row?.calendary_slug != null) return slug;
    return row?.id == null ? slug : String(row.id);
}

export async function loadDneslovCard(address: string, hint: any,
    fetchJson: (path: string) => Promise<any>) {
    const candidates = [...new Set([
        hint?.memory_id == null ? null : String(hint.memory_id),
        typeof hint?.slug === 'string' ? hint.slug : null,
        address,
    ].filter((v): v is string => typeof v === 'string' && !!v.trim()))];
    let failure: unknown;
    for (const candidate of candidates) {
        try {
            const memory = await fetchJson(`/api/v0/memories/${encodeURIComponent(candidate)}.json`);
            if (!memory?.slug || memory.id == null) throw new Error('Днеслов: неверная память');
            const details = await fetchJson(`/${encodeURIComponent(memory.slug)}.json`);
            if (!details || typeof details !== 'object' || Array.isArray(details) || details.error || details.code >= 400)
                throw new Error('Днеслов: неверная карточка');
            return { memory, details: { ...details, id: memory.id, slug: memory.slug }, slug: memory.slug };
        } catch (e) { failure = e; }
    }
    throw failure ?? new Error('Днеслов: карточка недоступна');
}
