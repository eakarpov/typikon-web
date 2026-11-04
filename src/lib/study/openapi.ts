const target = {
  type: "object",
  required: ["kind", "id"],
  properties: {
    kind: { type: "string", enum: ["text", "bible", "chant"] },
    id: { type: "string" },
    edition: { type: "string" },
    chapter: { type: "integer", minimum: 1 },
    verseFrom: { type: "integer", minimum: 1 },
    verseTo: { type: "integer", minimum: 1 },
    statia: { type: "integer", minimum: 1 },
    blockId: { type: "string" },
    endBlockId: { type: "string" },
    sourceHash: { type: "string" },
    quote: { type: "string", maxLength: 20000 },
    prefix: { type: "string" },
    suffix: { type: "string" },
  },
};
const reply = {
  description:
    "Результат операции. Личные данные имеют Cache-Control: private,no-store.",
  content: { "application/json": { schema: { type: "object" } } },
};
export const studySchemas = { StudyTarget: target };
export function studyPaths(personal: any) {
  const paths: any = {};
  const summaries: Record<string, string> = {
    catalog: "Каталог книг и оглавление",
    material: "Исходный текст со стабильными фрагментами",
    related: "Подтверждённые связи выбранного места",
    routes: "Проверенные редакционные маршруты",
    package: "Офлайн-пакет выбранных источников без личных записей",
    personal: "Существующие заметки, подборки и точные позиции пользователя",
    change: "Изменение личной сущности с ревизией и квитанцией",
    publish: "Публикация выбранного состава подборки или отзыв ссылок",
    shared: "Опубликованный снимок без идентификатора владельца",
    plan: "Явное создание личного плана из источников подборки",
  };
  for (const [name, summary] of Object.entries(summaries)) {
    const privateRoute = ["personal", "change", "publish", "plan"].includes(
      name,
    );
    const operation: any = {
      tags: ["Чтения"],
      summary,
      description: privateRoute
        ? "Нужна сессия. Для записи expectedUserId, entity, value, revision, opId. Конфликт возвращает 409 с обеими версиями."
        : "Публичный раздел texts. Отсутствующие материалы обозначаются явно; кандидатные связи не публикуются.",
      ...(privateRoute ? { security: personal } : {}),
      responses: {
        "200": reply,
        "400": { description: "Неверные параметры" },
        "401": { description: "Нужен вход или действующий ключ" },
        "409": { description: "Конфликт версии или входа" },
      },
    };
    paths["/api/v2/study/" + name] = {};
    if (
      [
        "catalog",
        "material",
        "related",
        "routes",
        "personal",
        "shared",
      ].includes(name)
    )
      paths["/api/v2/study/" + name].get = {
        ...operation,
        parameters:
          name === "catalog"
            ? [{ name: "book", in: "query", schema: { type: "string" } }]
            : name === "shared"
              ? [
                  {
                    name: "token",
                    in: "query",
                    required: true,
                    schema: { type: "string" },
                  },
                ]
              : ["material", "related"].includes(name)
                ? [
                    {
                      name: "target",
                      in: "query",
                      required: true,
                      description: "JSON-адрес StudyTarget",
                      schema: { type: "string" },
                    },
                  ]
                : [],
      };
    if (
      ["material", "related", "package", "change", "publish", "plan"].includes(
        name,
      )
    )
      paths["/api/v2/study/" + name].post = {
        ...operation,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: ["material", "related"].includes(name)
                ? {
                    type: "object",
                    required: ["target"],
                    properties: {
                      target: { $ref: "#/components/schemas/StudyTarget" },
                    },
                  }
                : { type: "object" },
            },
          },
        },
      };
  }
  return paths;
}
