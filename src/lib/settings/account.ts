import { defaultValues, READING_SETTINGS, type ReadingValues } from "./reading";

/** Whitelist values before putting user data into CSS or an inline script. */
export function sanitizeReadingValues(input: unknown): ReadingValues {
    const result = defaultValues();
    if (!input || typeof input !== "object" || Array.isArray(input)) return result;
    for (const setting of READING_SETTINGS) {
        const value = (input as Record<string, unknown>)[setting.id];
        if (typeof value !== "string") continue;
        if (setting.options ? setting.options.some(option => option.value === value) : /^#[a-f0-9]{6}$/i.test(value)) {
            result[setting.id] = value;
        }
    }
    return result;
}
