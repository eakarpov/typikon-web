export const ONLINE_WINDOW_MS = 5 * 60_000;
export const onlineSessionFilter = (now = new Date()) => ({
    expiresAt: { $gt: now }, lastSeenAt: { $gte: new Date(+now - ONLINE_WINDOW_MS) },
});

/** A lightweight HTTP probe, compatible with Express and its CORS preflight. */
export async function probeService(url: string, method: string) {
    try {
        const response = await fetch(url, { method: "OPTIONS", cache: "no-store", signal: AbortSignal.timeout(2500), redirect: "error" });
        return response.ok && (response.headers.get("allow") || response.headers.get("access-control-allow-methods") || "").split(/\s*,\s*/).includes(method);
    } catch { return false; }
}
