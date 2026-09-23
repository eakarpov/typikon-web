# Архитектура

Как устроен сайт «Уставные чтения» (typikon.info): из каких частей он состоит, где лежат данные,
как распределены слои кода и в каком порядке выкладываются изменения. Что открыто — в
[ROADMAP.md](ROADMAP.md); почему принято то или иное решение — в архиве [docs/archive/](docs/archive/README.md).

## Состав системы

```
                         ┌───────────────── сервер ─────────────────────────────────────┐
 браузер, приложение ──▶ │ nginx ──▶ Next.js (127.0.0.1:3000) ──▶ MongoDB (5 баз)        │
 обходчики, API          │   │            │  │                                            │
                         │   │            │  ├──▶ nobles.db      (SQLite, родословная)     │
                         │   │            │  ├──▶ data.db        (SQLite, корпус песнопений)│
                         │   │            │  └──▶ typikon-ordo   (Python, 127.0.0.1:8767)  │
                         │   │            │          └──▶ data.db, rules/**.yaml          │
                         │   ├──▶ /dump/  (выгрузка корпуса, /var/www/typikon-data)       │
                         │   └──▶ /app/   (сборки приложения, /var/www/typikon-app-releases)│
                         │ cron ──▶ npm run … (посты канала, толчки, записки, копии)      │
                         └──────────────────────────────────────────────────────────────┘
```

- **Сайт** — Next.js 14.2 (React 18), один процесс под systemd (`typikon-web-new.service`: Node 22,
  `127.0.0.1:3000`, пользователь `admin`, каталог `/var/www/typikon.su/typikon-web`). Наружу
  смотрит только nginx.
- **Служба устава `typikon-ordo`** собирает последование службы. Это код соседнего репозитория
  **typikon-rules** (`src/ordo_service.py`); сайт обращается к ней по `ORDO_SERVICE_URL`, наружу она
  не проксируется. Устав — конструктор по правилам `rules/typikon`, и второй его реализации на
  TypeScript нет намеренно: две реализации разошлись бы на первой правке правила.
- **nginx** раздаёт выгрузку корпуса и сборки приложения сам, мимо Next. Ограничения для
  обходчиков — `typikon-bots.conf` (в `http{}`) и `typikon-bots-server.conf` (в `server{}`).
- **Мобильное приложение** (Android, Flutter) живёт в отдельном репозитории и обращается к API.

Развёртывание машины с нуля описано в `DEPLOY.md` (файл не хранится в git: в нём адреса и
доступы); выкладка изменений — в [scripts/README.md](scripts/README.md).

## Хранилища

| Хранилище | Что в нём | Откуда берётся |
|---|---|---|
| Mongo `typikon` | корпус: тексты, дни, месяцы, седмицы, книги, Библия, святцы, храмы, места, указатели | правится в админке и скриптами; на прод едет дампом (`release:db`) |
| Mongo `typikon-users` | пользователи, `sessions`, ключи API и их расход, приходы (`parishSettings`, `parishSchedules`, `templeClaims`, …), помянник, место чтения, посты канала, реестр святынь (`relics`) и находки обходчика (`relicCandidates`, `relicCrawl`) | пишется **только на проде**; дампом не накатывается никогда |
| Mongo `typikon-csl` | словарь церковнославянского, ударения, указатель написаний | `release-csl` |
| Mongo `typikon-news` | лента новостей | `news-db-release.sh` |
| Mongo `typikon-meta` | посещения и их помесячные итоги | пишется сайтом |
| SQLite `nobles.db` (`SQLITE_DB`) | родословная: персоны, семьи, государства, правления; FTS-поиск | в каталоге сайта |
| SQLite `data.db` (`RULES_DB`) | корпус песнопений typikon-rules: Октоих, Минеи, Триоди, Ирмологий, правила устава, зачины, цитаты; FTS5 | собирается `build_db.py` в typikon-rules, едет `release:rules-db` |

Три правила, на которых держится раскладка:

- **Контент отдельно от пользовательского.** Контентные базы накатываются `mongorestore --drop`;
  всё, что пишут пользователи и приходы, живёт в `typikon-users`, иначе выкладка базы его бы стёрла.
- **`data.db` лежит рядом с каталогом сайта, а не внутри.** Его читают двое — сайт и служба
  устава, — а в каталоге сайта идут `git pull`, `npm ci` и сборка; `git clean -fdx` удалил бы его
  у обоих. Файл открывается один раз на процесс, поэтому после замены процесс перезапускается
  (скрипт выкладки делает это сам).
- **`data.db` — артефакт сборки**, а не редактируемая база: руками его не правят, а пересобирают.

Подключения: Mongo — `src/lib/mongodb.ts` (один клиент, в разработке — через `global`); SQLite —
`src/lib/sqlite.ts` и `src/lib/rulesDb.ts` (корпус открывается только на чтение; нет файла —
разделы песнопений отвечают пусто, остальной сайт работает).

## Слои кода

| Каталог | Что лежит | Правило |
|---|---|---|
| `src/utils/` | чистые функции: подвижный круг, пасхалия, хронология, версификация, цифирь | без базы и без сети; здесь основная масса тестов |
| `src/lib/` | доступ к данным и предметная логика по разделам: `bible`, `parish`, `pomyannik`, `trapeza`, `imeniny`, `accents`, `csEncoding`, `markup`, `api/v2`, `authorize`, … | вся работа с базами идёт отсюда |
| `src/app/` | страницы (App Router) и новые ручки `src/app/api/*`, включая публичный `v2` | тонкий слой над `lib`; у раздела бывает свой `api.ts` с выборками |
| `src/pages/api/` | прежний роутер: `v1` (устаревший), почти вся админка, `calc`, `captcha`, `contact` | новое сюда не пишется |
| `src/scripts/` | около ста десяти скриптов импорта, обслуживания и крона (`tsx`) | окружение грузят сами через `@next/env` |
| `src/data/tunes` | размеченные напевы | |

Известные отступления, записанные в ROADMAP: `src/pages` 18 раз берёт `@/app/**/api`, `src/lib`
трижды — `@/app`; `client.db("typikon")` повторён по месту вызова вместо одной функции;
пасхалия считается в трёх местах.

**Два роутера.** Админка осталась в Pages Router исторически. Отсюда ручка `POST /api/revalidate`:
в Pages Router `revalidateTag` не работает, и админ-редакторы сбрасывают кэш через неё. Направление —
перенести админку в App Router под одну обёртку прав и снять `v1`.

## Кэш

`src/lib/cache.ts`: выборки оборачиваются в `cached()` (обёртка над `unstable_cache`) с тегом
раздела и сроком в час. Теги: `texts`, `days`, `months`, `books`, `weeks`, `signs`, `news`,
`saints`, `bible`, `memories`, `temples`, `parish`, `citations`, `ordo`, `places`, `relics` (последний — на пять минут: принесённая на время святыня должна исчезать в тот же день).

Сброс — `POST /api/revalidate` с заголовком `x-revalidate-token` (`REVALIDATE_TOKEN`) либо от
сессии с правом `content`. Его зовут админ-редакторы (`src/lib/admin/revalidate.ts`), каждый
скрипт, меняющий контент (`src/scripts/lib/revalidate.ts`), и `release-ordo.sh` (тег `ordo`).
Без токена скрипт предупредит, что сайт будет отдавать прежнее до истечения часа.

## Вход и права

- Провайдеры: Google, Telegram, Яндекс (`src/lib/authorize/providers.ts`). Идентификатор
  пользователя сервер получает от провайдера, а не из тела запроса.
- Сессия — JWT (HS256, `SESSION_SECRET`) в httpOnly-cookie `session` и строка в
  `typikon-users.sessions`; обе проверки обязательны. Окно — 7 дней с продлением через
  `/api/prolong`, предел — 90 дней.
- Права — возможности (`content`, `parish.claims`, `parish.grant`, `roles.grant`,
  `commemoration.claims`) и роли, заданные в коде (`src/lib/rights.ts`); выдаются командой
  `npm run roles`. Права на приход — отдельно, `src/lib/parish/access`.
- Проверки: `viewer()`/`can()` в App Router, `checkRightsBack()` в админ-ручках Pages Router
  (при отказе — 404). `SHOW_ADMIN` лишь показывает или скрывает интерфейс админки и защитой не
  является.
- `src/middleware.ts`: отказ изменяющим запросам с сессией и чужим `Origin`; счёт и заголовки
  устаревания на `/api/v1`; заголовки переезда на старом хосте.
- Заголовки безопасности — в `next.config.js`: `nosniff`, HSTS, `Referrer-Policy`,
  `frame-ancestors 'self'` везде, кроме `/embed`.

## Публичный API

- `/api/v2` — описан в `openapi.json` и на странице `/api`. Доступ по трём уровням
  (`src/lib/api/v2/tokens.ts`, `access.ts`): свои страницы — 120 запросов в минуту с адреса; ключ
  тарифа `free` — 30 в минуту и 10 000 в сутки; без ключа — 60 в час, без поиска. Ключи
  пользователь заводит в профиле, ключи приложения и партнёров выпускаются в `/admin/api-tokens`
  или `npm run api:token`.
- `/api/v1` — устаревший; отдаёт `Sunset` и считает оставшихся клиентов.
- Счётчики частоты живут в памяти процесса, суточный расход — в `typikon-users.apiTokenUsage`.

## Фоновые задания

Крон пользователя `admin` на сервере (полный список — `DEPLOY.md`, раздел 13):

| Задание | Когда |
|---|---|
| `channel-posts:generate` — черновики постов канала `@blagoslovie` | 03:00 |
| `channel-posts:publish` — публикация проверенных в `/admin/channel-posts` | 09:00 и 18:00 |
| `push:reading`, `push:pomyannik` — толчки в приложение через FCM | ежечасно (у устройства свой час) |
| `pomyannik:sweep` — снятие имён из прочитанных записок | 04:30 |
| `scripts/mongod_dump.sh` — резервная копия баз | 02:00 |

Крон держится включённым только на одной машине: базы у машин разные, а канал и ключи доставки
общие.

## Проверки

- `npm test` — `node:test` через `tsx`; файлы `*.test.ts` лежат рядом с кодом (около ста десяти).
- `npm run typecheck`, `npm run lint`.
- CI (`.github/workflows/ci.yml`, Node 22) на push в `master` и на pull request: `npm ci`, тесты,
  линтер, типы. `next build` в CI нет: сборка пререндерит карту сайта и календарную ленту и
  требует Mongo.

## Выкладка

Скрипты и цели (`--target prod|test`) — [scripts/README.md](scripts/README.md). Коротко:

| Что изменилось | Команда |
|---|---|
| код сайта | `npm run release` |
| код и база | `npm run release:common` |
| база по частям | `npm run release:db -- texts rest` |
| правила устава | `python3 src/build_db.py` в typikon-rules, затем `npm run release:ustav` |
| только корпус песнопений | `npm run release:rules-db`, затем на сервере `npm run citations:stats -- --write` |
| только код службы устава | `npm run release:ordo` |
| выгрузка корпуса | `npm run release:data` |
| сборка приложения | `bash scripts/release-app.sh X.Y.Z путь.apk` |

Правило устава живёт в двух видах — таблицами внутри `data.db` и файлом, который показывает
«лестница». Поэтому правка устава выкладывается одной командой `release:ustav`, и она
отказывается работать, если корпус старше правил.

## Обслуживание базы

Скрипты по умолчанию делают холостой прогон и печатают план; менять данные — с `-- --apply`.
Порядок существенен.

| Команда | Когда |
|---|---|
| `db:fix-aliases` | до `db:indexes`, иначе уникальный индекс не встанет |
| `db:indexes` | после каждого `mongorestore --drop` и после выкладки, добавившей индексы |
| `db:search-index` | после массовых импортов и **после любой правки `normalizeChurchSlavonic`** |
| `cslav:build` | после правки свёртки написаний, следом за `db:search-index` |
| `db:fix-paragraphs`, `db:fix-accents`, `accents:add` | после импортов текстов |
| `accents:load` | после правки книг, песнопений или `lexems`; локально с `NODE_ENV=development` |
| `relics:crawl` | на сервере, по желанию раз в месяц: обход сайтов храмов, находки на разбор в `/admin/relics` (без `--write` — только показать) |
| `citations:stats`, `names:index`, `health:snapshot` | после выкладки корпуса песнопений или указателя имён |
| `bible:*`, `recompute-bible-canon.ts`, `verify-bible-migration.ts` | после правки `src/lib/bible/mappings.ts` или нового издания |

Полная таблица с пояснениями — [docs/archive/operations.md](docs/archive/operations.md).

## Окружение

Разработка читает `.env.development`, прод — `.env.production`; ни один из них не хранится в git.

- Данные: `MONGODB_URI`, `SQLITE_DB`, `RULES_DB`, `DUMP_DIR`, `DUMP_URL`.
- Служба устава: `ORDO_SERVICE_URL`.
- Вход: `SESSION_SECRET`, `GOOGLE_APP`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_NAME`,
  `YANDEX_CLIENT_ID`, `YANDEX_CLIENT_SECRET`, `YANDEX_REDIRECT_URL`, `SHOW_LOGIN_BUTTON`.
- Админка и кэш: `SHOW_ADMIN`, `REVALIDATE_TOKEN`, `REVALIDATE_URL` (скрипты), `SITE_ORIGINS`.
- Почта: `EMAIL`, `EMAIL_PASSWORD` (SMTP Яндекса).
- Канал и толчки: `TELEGRAM_CHANNEL_ID`, `TELEGRAM_API_BASE`, `TELEGRAM_PROXY_URL`,
  `FCM_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS` (ключ лежит вне дерева проекта).
- Выкладка: `.env.release.<цель>`, образец — [.env.release.example](.env.release.example).

Адрес сайта задан в одном месте — `src/utils/site.ts`.

## Где что записано

| Документ | О чём |
|---|---|
| [README.md](README.md) | что это за проект и как его запустить |
| [ROADMAP.md](ROADMAP.md) | открытые задачи |
| [TODO.md](TODO.md) | найденные дефекты и мелкие хвосты |
| [docs/archive/](docs/archive/README.md) | сделанное с основаниями решений, по темам |
| [scripts/README.md](scripts/README.md) | скрипты выкладки и цели |
| [BIBLE_VERSIFICATION.md](BIBLE_VERSIFICATION.md) | сверка нумераций изданий Библии (генерируется) |
| [LICENSE](LICENSE), [LICENSE-CORPUS.md](LICENSE-CORPUS.md), [licenses/](licenses/) | лицензии кода, корпуса и сторонних файлов |
