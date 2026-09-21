/**
 * Способы входа — в одном месте, потому что их знают четверо: страница входа
 * (что нарисовать), `/api/login` (что принять), `sessions` (под каким ключом
 * положить) и `users` (по какому полю искать).
 *
 * VK здесь больше нет. Учётные записи с `auth.vk` остались в базе нетронутыми —
 * это данные, а не способ входа, — но войти по ним нельзя, и если такие записи
 * есть у живых читателей, им нужен способ привязать себе другой вход. Отдельная
 * работа, и её объём виден только по базе.
 */
export const AUTH_KEY = {
    Google: "google",
    Telegram: "telegram",
    Yandex: "yandex",
} as const;

export type Provider = keyof typeof AUTH_KEY;

export const isProvider = (value: unknown): value is Provider =>
    typeof value === "string" && value in AUTH_KEY;
