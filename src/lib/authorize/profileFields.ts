/**
 * Что пользователь вправе менять в собственной записи.
 *
 * Прежде тело запроса шло в `$set` целиком: вместе с именем можно было
 * прислать `roles` или `isAdmin` — и стать администратором, либо `auth.*` — и
 * привязать к себе чужой вход. Поэтому здесь не «чёрный список опасного», а
 * белый список разрешённого: всё, чего в нём нет, молча отбрасывается.
 *
 * Идентификаторы входа (`auth.vk.userId` и прочие) в список не входят нарочно:
 * привязка входа — следствие самого входа, проверенного у провайдера, а не
 * строки, набранной в форме.
 */
export const PROFILE_FIELDS = {
    name: 100,
    surname: 100,
    email: 254,
    phone: 32,
} as const;

export type ProfileField = keyof typeof PROFILE_FIELDS;
export type ProfilePatch = Partial<Record<ProfileField, string>>;

export const sanitizeProfilePatch = (data: unknown): ProfilePatch | null => {
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const source = data as Record<string, unknown>;
    const patch: ProfilePatch = {};
    for (const field of Object.keys(PROFILE_FIELDS) as ProfileField[]) {
        if (!(field in source)) continue;
        const value = source[field];
        if (typeof value !== "string") return null;
        const trimmed = value.trim();
        if (trimmed.length > PROFILE_FIELDS[field]) return null;
        patch[field] = trimmed;
    }
    if (patch.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.email)) return null;
    return patch;
};
