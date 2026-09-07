import { randomBytes } from "node:crypto";

// ЧИСТЫЕ ПРАВИЛА ЗАЯВКИ на приём записок: знаки, адрес открытой страницы и
// сличение домена. Отдельно от базы (commemorators) нарочно — тем же приёмом,
// каким разбор избранного отделён от своей службы: правила эти проверяются
// тестом, и тянуть ради теста подключение к Mongo незачем.

/** Знак для письма. Короткий: его переписывают в ответ руками. */
export const newToken = () => `typikon-${randomBytes(5).toString("hex")}`;

/** Код-приглашение. Длиннее знака: по нему открывается приём, и его подбирают. */
export const newInviteCode = () => randomBytes(9).toString("base64url");

/** «Иерей Николай Петров» → «ierey-nikolay-petrov». */
export const slugOf = (title: string): string => {
    const MAP: Record<string, string> = {
        а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
        и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
        с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh",
        щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
    };
    return String(title ?? "").toLowerCase()
        .split("").map(c => MAP[c] ?? c).join("")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "svyaschennik";
};

export type DomainMatch = "exact" | "subdomain" | "different" | "unknown";

export interface DomainCheck {
    match: DomainMatch;
    /** Словами, для человека: он и решает. */
    note: string;
    site: string | null;
    mail: string | null;
}

const hostOf = (raw: string): string | null => {
    const value = String(raw ?? "").trim();
    if (!value) return null;
    try {
        const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
        return url.hostname.toLowerCase().replace(/^www\./, "") || null;
    } catch {
        return null;
    }
};

const mailHostOf = (raw: string): string | null => {
    const parts = String(raw ?? "").trim().toLowerCase().split("@");
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    const host = parts[1].replace(/^www\./, "");
    return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) ? host : null;
};

/** Два последних куска имени: «clergy.mospat.ru» и «mospat.ru» — один домен. */
const registrable = (host: string) => host.split(".").slice(-2).join(".");

/**
 * Сходится ли домен почты с доменом страницы епархии.
 *
 * СЛИЧАЕТ МАШИНА, РЕШАЕТ ЧЕЛОВЕК. Несовпадение — повод спросить, а не отказ: у
 * епархии бывает второй домен, у священника — благочиннический адрес, а у иных
 * епархий клир выложен вовсе на общем портале. И само сравнение здесь грубое:
 * два последних куска имени — не то же, что регистрируемый домен, и на зонах
 * вида «org.ru» оно ошибётся. Уточнять его незачем: за ним стоит человек, а не
 * запрет.
 */
export const checkDomain = (dioceseUrl: string, email: string): DomainCheck => {
    const site = hostOf(dioceseUrl);
    const mail = mailHostOf(email);
    if (!site || !mail) {
        return { match: "unknown", site, mail,
                 note: !site ? "ссылка на епархию не разобрана" : "адрес почты не разобран" };
    }
    if (site === mail) {
        return { match: "exact", site, mail, note: `домен почты тот же: ${site}` };
    }
    if (registrable(site) === registrable(mail)) {
        return { match: "subdomain", site, mail,
                 note: `тот же домен, разные поддомены: ${site} и ${mail}` };
    }
    return { match: "different", site, mail,
             note: `домены разные: страница на ${site}, почта на ${mail} — `
                 + `это повод спросить, а не отказать` };
};
