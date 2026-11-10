const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object) => ({ "application/json": { schema } });
const response = (name: string) => ({ description: "Успешный ответ; Cache-Control: no-store", content: json(ref(name)) });
const error = (description: string) => ({ description, content: json(ref("Error")) });
const authError = error("Нет ключа (unauthorized) или нет входа (session_required). Нужны и ключ API, и сессия пользователя.");
const body = (name: string) => ({ required: true, content: json(ref(name)) });
const id = { type: "string", pattern: "^[a-fA-F0-9]{24}$" };
const revision = { type: "integer", minimum: 0 };
const text = (maxLength: number) => ({ type: "string", minLength: 1, maxLength });
const token = { type: ["string", "null"], pattern: "^[a-f0-9]{48}$" };
const sharingProperties = { id: text(160), revision, noteRevision: revision, published: { type: "boolean" }, shareToken: token };
const selection = {
    type: "object", required: ["mode"],
    description: "Для mode=day обязательны date и service; для mode=study — ordo.",
    properties: { mode: { type: "string", enum: ["day", "study"] }, date: { type: "string", format: "date" },
        ...Object.fromEntries(["service", "ordo", "variant", "ustav", "part", "lang"].map(name => [name, { type: "string" }])) },
};
const companionContent = { title: text(300), nodeTitle: text(300), nodeId: text(512), contentHash: text(256), selection, text: text(10000) };
const companionProperties = { ...companionContent, updatedAt: { type: "string", format: "date-time" } };

export const noteSchemas = {
    CompanionNoteRequest: {
        type: "object", required: ["id", "expectedUserId", "sessionKey", "nodeId", "contentHash", "title", "nodeTitle", "selection", "text", "expectedRevision", "published"],
        properties: { id, expectedUserId: { type: "string" }, sessionKey: text(512), ...companionContent,
            expectedRevision: revision, expectedSharingRevision: { ...revision, default: 0 }, published: { type: "boolean" } },
    },
    CompanionPersonalNote: {
        type: "object", required: ["id", "sessionKey", "nodeId", "contentHash", "title", "nodeTitle", "selection", "text", "revision", "sharingRevision", "shareToken", "published", "updatedAt"],
        properties: { id, sessionKey: text(512), ...companionProperties, revision, sharingRevision: revision, shareToken: token, published: { type: "boolean" } },
    },
    CompanionNoteList: { type: "object", required: ["userId", "notes"], properties: {
        userId: { type: "string" }, notes: { type: "array", maxItems: 100, items: ref("CompanionPersonalNote") },
    } },
    CompanionNoteSaved: { type: "object", required: ["userId", "note"], properties: { userId: { type: "string" }, note: ref("CompanionPersonalNote") } },
    SharedCompanionNote: { type: "object", required: ["note"], properties: { note: {
        type: "object", required: Object.keys(companionProperties), properties: companionProperties,
    } } },
    NoteSharingRequest: { type: "object", required: ["id", "expectedUserId", "expectedRevision", "published"], properties: {
        id: text(160), expectedUserId: { type: "string" }, expectedRevision: revision, expectedNoteRevision: { ...revision,
            description: "Обязательно при published=true: версия текста, просмотренного перед публикацией." }, published: { type: "boolean" },
    } },
    NoteSharingResult: { type: "object", required: ["userId", ...Object.keys(sharingProperties)], properties: { userId: { type: "string" }, ...sharingProperties } },
    NoteSharingState: { allOf: [ref("NoteSharingResult"), { type: "object", required: ["preview"], properties: {
        preview: { type: "object", required: ["text", "quote"], properties: { text: { type: "string" }, quote: { type: "string" } } },
    } }] },
    SharedUserNote: { type: "object", required: ["note"], properties: { note: {
        type: "object", required: ["text", "source", "updatedAt"], properties: {
            text: { type: "string" }, updatedAt: { type: "string", format: "date-time" }, source: {
                type: "object", required: ["title", "href", "quote"], properties: {
                    title: { type: "string" }, href: { type: "string", description: "Относительный адрес источника; может быть пустым." }, quote: { type: "string" },
                },
            },
        },
    } } },
};

export const notePaths = (personal: object[]) => {
    const publicRead = (schema: string) => ({ get: {
        tags: ["Личные заметки"], summary: "Опубликованная заметка по секретной ссылке", security: [],
        description: "Ключ API и вход не нужны. Доступ действует до отзыва ссылки владельцем. Ответ не кэшируется и не содержит владельца и приватных идентификаторов заметки.",
        parameters: [{ name: "token", in: "path", required: true, schema: { type: "string", pattern: "^[a-f0-9]{48}$" } }],
        responses: { "200": response(schema), "404": error("Заметка не опубликована, удалена или ссылка отозвана"), "503": error("Заметка временно недоступна") },
    } });
    return {
        "/api/v2/companion/notes": {
            get: { tags: ["Личные заметки"], summary: "Личные заметки к части службы", security: personal,
                parameters: ["sessionKey", "nodeId"].map(name => ({ name, in: "query", required: true, schema: text(512) })),
                responses: { "200": response("CompanionNoteList"), "400": error("Укажите sessionKey и nodeId"), "401": authError, "500": error("Заметки временно недоступны") } },
            post: { tags: ["Личные заметки"], summary: "Сохранить заметку Спутника и её доступ", security: personal,
                description: "Не более 70000 символов в теле. expectedUserId должен совпасть с сессией; версии защищают от одновременных изменений на разных устройствах.",
                requestBody: body("CompanionNoteRequest"), responses: { "200": response("CompanionNoteSaved"), "400": error("Неверная заметка"), "401": authError,
                    "409": error("Изменился пользователь, текст или доступ к заметке"), "500": error("Не удалось сохранить заметку") } },
        },
        "/api/v2/notes/sharing": {
            get: { tags: ["Личные заметки"], summary: "Настройки доступа и предварительный просмотр своей заметки", security: personal,
                parameters: [{ name: "id", in: "query", required: true, schema: text(160) }],
                responses: { "200": response("NoteSharingState"), "400": error("Неверный адрес заметки"), "401": authError, "404": error("Заметка не найдена") } },
            post: { tags: ["Личные заметки"], summary: "Опубликовать заметку или отозвать ссылку", security: personal,
                description: "Не более 2000 символов в теле. expectedRevision — версия доступа; при публикации expectedNoteRevision должна совпасть с версией просмотренного текста. Отзыв ссылки делает прежний token недействительным.",
                requestBody: body("NoteSharingRequest"), responses: { "200": response("NoteSharingResult"), "400": error("Неверная настройка доступа"), "401": authError,
                    "404": error("Заметка не найдена"), "409": error("Изменился пользователь, текст или доступ"), "500": error("Не удалось изменить доступ") } },
        },
        "/api/v2/notes/shared/{token}": publicRead("SharedUserNote"),
        "/api/v2/companion/notes/shared/{token}": publicRead("SharedCompanionNote"),
    };
};
