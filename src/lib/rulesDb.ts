import Database from 'better-sqlite3';

type SqliteDb = ReturnType<typeof Database>;

// Второй склад на SQLite — корпус проекта typikon-rules: сами песнопения книг
// (Октоих, Минеи, Триоди, Ирмологий), словарь неизменяемых формул и устав.
//
// Почему не в Mongo, где лежит весь остальной корпус. Этот файл целиком
// пересобирается из разобранных книг и правил (build_db.py удаляет его и
// строит заново), руками в него не правят, и через админку сайта он не
// редактируется. Это артефакт сборки, а не хранилище, — и переносить его в
// документную модель значило бы разложить реляционные связи
// groups -> content_items -> canons по денормализованным копиям и
// переиндексировать 95 тысяч документов после каждой пересборки.
//
// Вдобавок поиск по нему держится на FTS5: токенизатор снимает ударения при
// разборе на слова, и «услыши» находит «услы́ши» без нормализованных копий,
// какие приходится держать для Mongo (см. @/lib/search).
//
// Соединение — одно на процесс и только на чтение: сайт сюда не пишет.
// В dev храним его в global, иначе hot reload пересоздаёт модуль — тот же
// приём, что для nobles.db в @/lib/sqlite и для MongoClient в @/lib/mongodb.

let db: SqliteDb | undefined;

const open = (): SqliteDb | null => {
    const file = process.env.RULES_DB;
    if (!file) return null;
    try {
        return new Database(file, { readonly: true, fileMustExist: true });
    } catch (e) {
        // Файла может не быть — например, корпус ещё не выкладывали на этот
        // сервер. Это не повод ронять сайт: разделы, которым он нужен, скажут
        // об этом сами, а всё остальное работает как работало.
        console.error("corpus of typikon-rules is not available:", e);
        return null;
    }
};

export const rulesDb = (): SqliteDb | null => {
    if (process.env.NODE_ENV === 'development') {
        if (global._rulesDb === undefined) {
            global._rulesDb = open() ?? undefined;
        }
        return global._rulesDb ?? null;
    }

    if (!db) {
        const opened = open();
        if (!opened) return null;
        db = opened;
    }
    return db;
};
