export const PRIEST_RANKS: Record<string, string> = {
    ierey: 'Иерей', protoierey: 'Протоиерей', ieromonah: 'Иеромонах',
    igumen: 'Игумен', arhimandrit: 'Архимандрит', episkop: 'Епископ',
    arhiepiskop: 'Архиепископ', mitropolit: 'Митрополит',
};
export class DirectGrantError extends Error {
    constructor(message: string, public status = 400) { super(message); }
}
export interface PriestDetails {
    rank: string; name: string; title: string; diocese: string; dioceseUrl: string | null;
    place: string | null; about: string | null; donationDetails: string | null;
}
const text = (value: unknown, max: number, label: string, required = false) => {
    if (value !== undefined && value !== null && typeof value !== 'string') throw new DirectGrantError(`Проверьте поле «${label}»`);
    const result = String(value ?? '').trim();
    if ((required && !result) || result.length > max) throw new DirectGrantError(`${label}: ${required ? 'обязательное поле, ' : ''}не больше ${max} символов`);
    return result;
};
export const normalizeGrantEmail = (raw: unknown) => {
    const email = text(raw, 254, 'Почта', true).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new DirectGrantError('Проверьте адрес почты');
    return email;
};
export function parsePriestDetails(raw: any): PriestDetails {
    if (typeof raw?.rank !== 'string' || !Object.hasOwn(PRIEST_RANKS, raw.rank)) throw new DirectGrantError('Выберите священнический сан');
    const name = text(raw.name, 120, 'Имя и фамилия', true);
    const diocese = text(raw.diocese, 200, 'Епархия', true);
    const dioceseUrl = text(raw.dioceseUrl, 300, 'Страница епархии');
    if (dioceseUrl) {
        let url: URL;
        try { url = new URL(dioceseUrl); } catch { throw new DirectGrantError('Проверьте ссылку на епархию'); }
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new DirectGrantError('Нужна ссылка http или https на епархию');
    }
    return { rank: raw.rank, name, title: `${PRIEST_RANKS[raw.rank]} ${name}`, diocese,
        dioceseUrl: dioceseUrl || null, place: text(raw.place, 200, 'Место служения') || null,
        about: text(raw.about, 1000, 'Описание') || null,
        donationDetails: text(raw.donationDetails, 1000, 'Реквизиты') || null };
}
