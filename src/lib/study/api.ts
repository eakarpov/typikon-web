import { authorize } from "@/lib/api/v2/access";
import { authorizeUser } from "@/lib/api/v2/user";
import { respondPrivate, fail, preflight } from "@/lib/api/v2/http";
import { targetKey, validateTarget } from "./core";
import { catalog, material, related } from "./material";
import { personal, mutate, publish, shared, notebookPlan } from "./personal";
import { routes } from "./routes";
export function options() {
  const r = preflight();
  r.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  return r;
}
export async function handle(req: Request, action: string) {
  const privateRoute = ["personal", "change", "publish", "plan"].includes(
    action,
  );
  const access = privateRoute
    ? await authorizeUser(req, "texts")
    : await authorize(req, "texts");
  if (access.denied) return access.denied;
  try {
    const url = new URL(req.url);
    let b: any = {};
    if (req.method === "POST") {
      const raw = await req.text();
      if (raw.length > 500000)
        return fail("bad_request", "Слишком большой запрос.");
      b = JSON.parse(raw);
    }
    const target = () =>
      validateTarget(
        b.target ?? JSON.parse(url.searchParams.get("target") ?? "null"),
      );
    const userId = (access as any).userId as string;
    let result: any;
    switch (action) {
      case "catalog":
        result = await catalog(url.searchParams.get("book") ?? undefined);
        break;
      case "material":
        result = await material(target());
        break;
      case "related":
        result = await related(target());
        break;
      case "routes":
        result = routes();
        break;
      case "personal":
        result = { userId, state: await personal(userId) };
        break;
      case "change":
        if (b.expectedUserId !== userId)
          return fail("conflict", "Вход изменился.");
        result = { userId, value: await mutate(userId, b) };
        break;
      case "publish":
        if (b.expectedUserId !== userId)
          return fail("conflict", "Вход изменился.");
        result = await publish(userId, b);
        break;
      case "plan":
        if (b.expectedUserId !== userId)
          return fail("conflict", "Вход изменился.");
        result = await notebookPlan(userId, b);
        break;
      case "shared":
        result = await shared(url.searchParams.get("token") ?? "");
        if (!result)
          return fail("not_found", "Опубликованная копия недоступна.");
        break;
      case "package": {
        if (
          !Array.isArray(b.targets) ||
          !b.targets.length ||
          b.targets.length > 200
        )
          throw Error("Выберите от 1 до 200 материалов.");
        const materials = [],
          missing = [],
          seen = new Set<string>();
        let size = 0;
        for (const raw of b.targets) {
          try {
            const t = validateTarget(raw);
            if (seen.has(targetKey(t))) continue;
            seen.add(targetKey(t));
            const m = await material(t);
            const bytes = Buffer.byteLength(JSON.stringify(m), "utf8");
            size += bytes;
            if (size > 20000000)
              throw Error(
                "Слишком большой пакет. Скачайте материалы по отдельности.",
              );
            materials.push(m);
            missing.push(
              ...m.missing.map((reason) => ({ target: raw, reason })),
            );
          } catch (e) {
            missing.push({ target: raw, reason: (e as Error).message });
          }
        }
        result = {
          schemaVersion: 1,
          createdAt: new Date().toISOString(),
          materials,
          missing,
          complete: !missing.length && materials.length === seen.size,
          bytes: Buffer.byteLength(JSON.stringify(materials), "utf8"),
          editorial: routes(),
        };
        break;
      }
      default:
        return fail("not_found", "Неизвестный ресурс.");
    }
    return respondPrivate(result, { access });
  } catch (e) {
    const message = (e as Error).message;
    if (message === "conflict")
      return new Response(
        JSON.stringify({
          error: {
            code: "conflict",
            message:
              "Запись изменилась на другом устройстве. Обе версии сохранены для выбора.",
            remote: (e as any).remote ?? null,
          },
        }),
        {
          status: 409,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "private,no-store",
          },
        },
      );
    return fail(
      "bad_request",
      /mongo|ECONN|connection|timeout|undefined|buffer/i.test(message)
        ? "Материалы временно недоступны. Повторите загрузку."
        : message,
    );
  }
}
