import type { SaintWork } from "./saintWorks";
export const SAINT_WORK_LABELS: Record<string, string> = { service: "Служба", troparion: "Тропарь", kontakion: "Кондак", magnification: "Величание", canon: "Канон" };
export function saintWorkHref(work: Pick<SaintWork, "reader" | "id" | "language">) {
    const id = encodeURIComponent(work.id);
    if (work.reader === "service") return `/memories/${id}?lang=${encodeURIComponent(work.language || "")}#service`;
    return `/${work.reader === "canon" ? "canons" : "chants"}/${id}`;
}
