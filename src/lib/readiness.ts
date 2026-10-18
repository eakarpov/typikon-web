export type Readiness = { status: "ready"; buildId: string } | { status: "unavailable" };

/** Проверяет именно работающую сборку и Mongo, без кэша и без выдачи деталей ошибок. */
export const deploymentReadiness = async (
    readBuildId: () => Promise<string>,
    ping: () => Promise<unknown>,
    timeoutMs = 3000,
): Promise<Readiness> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        const [rawId] = await Promise.race([
            Promise.all([readBuildId(), ping()]),
            new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new Error("Readiness timeout")), timeoutMs);
            }),
        ]);
        const buildId = rawId.trim();
        return buildId ? { status: "ready", buildId } : { status: "unavailable" };
    } catch {
        return { status: "unavailable" };
    } finally {
        if (timer) clearTimeout(timer);
    }
};
