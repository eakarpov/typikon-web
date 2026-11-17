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
export const studySchemas = {
  StudyTarget: target,
  StudyReaderAttachment: {
    type:"object",required:["contract","sourceId","address","snapshot","bodyRef","permanentUrl","versionUrl","fragment","passportUrl","editorialStatus","passport"],
    properties:{contract:{const:"cs-reader/1"},sourceId:{$ref:"#/components/schemas/ReaderV1SourceId"},
      address:{$ref:"#/components/schemas/ReaderV1SourceAddress"},snapshot:{$ref:"#/components/schemas/ReaderV1Snapshot"},bodyRef:{$ref:"#/components/schemas/ReaderV1BodyRef"},
      permanentUrl:{type:"string",format:"uri"},versionUrl:{type:"string",format:"uri"},passportUrl:{type:"string"},editorialStatus:{type:"string"},
      fragment:{type:"object",required:["address","url","label"],properties:{address:{$ref:"#/components/schemas/ReaderV1SourceAddress"},url:{type:"string",format:"uri"},label:{type:"string"}}},
      passport:{$ref:"#/components/schemas/ReaderV1PassportData"}},additionalProperties:true,
  },
  StudyMaterialWithReader: {type:"object",required:["target","sourceHash","blocks","metadata","reader"],properties:{target:{$ref:"#/components/schemas/StudyTarget"},sourceHash:{type:"string"},blocks:{type:"array",items:{type:"object"}},metadata:{type:"object"},reader:{$ref:"#/components/schemas/StudyReaderAttachment"}},additionalProperties:true},
};
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
  const material=paths["/api/v2/study/material"];
  material.get.parameters.push({name:"reader",in:"query",required:false,schema:{type:"string",enum:["pilot"]},description:"Совместимое расширение только для выбранной главы Маргарита. Без параметра прежний ответ не меняется."});
  material.post.requestBody.content["application/json"].schema.properties.reader={type:"string",enum:["pilot"]};
  for(const operation of [material.get,material.post]){
    operation.description+=" reader=pilot добавляет reader: паспорт, pinned адрес и ссылку на фрагмент главы без копирования тела. Старый маршрут остаётся deprecated.";
    operation.responses={...operation.responses,"200":{...reply,content:{"application/json":{schema:{oneOf:[{type:"object",not:{required:["reader"]}},{$ref:"#/components/schemas/StudyMaterialWithReader"}]}}}},"404":{description:"Пилотный источник закрыт или не найден"},"410":{description:"Тело изменилось после публикации"},"422":{description:"Этот источник не подключён к опыту"},"503":{description:"Публикация или привязка недоступна"}};
  }
  return paths;
}
