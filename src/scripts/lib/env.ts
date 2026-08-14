// Загружает .env.production/.env.development так же, как это делает сам Next.js (next dev/start),
// только для отдельно запускаемых скриптов (next.config.js/сервер этот файл не трогают).
// Важно: этот импорт должен быть первым в файле-точке входа, раньше любых модулей,
// которые читают process.env на этапе загрузки (например, @/lib/mongodb).
//
// По умолчанию грузим .env.production — эти скрипты запускаются по крону/руками на сервере,
// где отдельная переменная NODE_ENV в интерактивной оболочке обычно не выставлена (в отличие от
// systemd-юнита самого сайта). Явно попросить .env.development можно через NODE_ENV=development.
import { loadEnvConfig } from "@next/env";

const isDev = process.env.NODE_ENV === "development";
loadEnvConfig(process.cwd(), isDev);
