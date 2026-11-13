export const COMMEMORATION_SUFFIXES = ["kinsfolk", "child", "children"] as const;
export type CommemorationSuffix = typeof COMMEMORATION_SUFFIXES[number];
export function cleanCommemorationSuffix(value: unknown): CommemorationSuffix | null {
    if (value == null || value === "") return null;
    if (typeof value !== "string" || !COMMEMORATION_SUFFIXES.some(key => key === value)) {
        throw new Error("Неизвестная приписка к имени.");
    }
    return value as CommemorationSuffix;
}

export const COMMEMORATION_SUFFIX_CHURCH: Record<CommemorationSuffix, string> = {
    kinsfolk: "со сро́дники", child: "со ча́домъ", children: "со ча́ды",
};
