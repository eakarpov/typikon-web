// Загружает .env.production/.env.development так же, как это делает сам Next.js (next dev/start),
// только для отдельно запускаемых скриптов (next.config.js/сервер этот файл не трогают).
// Важно: этот импорт должен быть первым в файле-точке входа, раньше любых модулей,
// которые читают process.env на этапе загрузки (например, @/lib/mongodb).
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
