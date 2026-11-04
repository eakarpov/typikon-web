import dossier from "@/data/study/routes.json";
/** Only checked, source-backed editorial records enter the public catalogue. */
export function routes() {
  return {
    schemaVersion: 1,
    version: dossier.version,
    routes: dossier.routes.filter(
      (r) =>
        r.status === "checked" && r.items.length >= 5 && r.items.length <= 8,
    ),
  };
}
