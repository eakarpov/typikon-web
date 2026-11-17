# Словарный профиль schema=2

Реализован локально для search, lexemes/{id} (включая view=relations) и
source-entries/{id} на существующем /api/v2/cs/. Развёртывание не выполнялось.
Полный отчёт и мобильная приёмка: [М1-04](../../cs-app/docs/m1-04-dictionary-implementation.md).

schema=2 возвращает schemaVersion=2 и dictionaryVersion. version в query
закрепляет именно словарную публикацию. Недоступная версия — 409
version_unavailable, никакой подстановки latest. У source отдельно sourceVersion;
legacy aliases version/publicationVersion сохраняются с прежним смыслом.

Активный read-only файл задаётся CS_DICTIONARY_DB. Сохранённые версии читаются
из CS_DICTIONARY_ARCHIVE_DIR (по умолчанию каталог активного файла) под именем
dictionary-<64 hex version>.sqlite. Внутренние format/state/scopeChecked/version
проверяются; архивное соединение закрывается после запроса. При развёртывании
сохранить прежнюю активную публикацию под этим именем или ссылкой на существующий
неизменяемый файл. Не переписывать открытый активный файл.

Курсор schema=2 связан с публикацией, запросом, направлением, профилем поиска,
limit и позицией. Продолжение требует version; legacy offset не принимается.
Старые клиенты без schema/schema=1 получают прежний latest-формат и offset.
Их ответ помечен X-Dictionary-Schema-Deprecated: true и successor Link,
с CORS expose. В OpenAPI deprecated помечено представление, не сама операция.
Sunset не назначается; старые API, aliases и адаптеры не удаляются.

formOrigin/reviewStatus/evidence отделены от legacy origin stored/generated.
attested/unknown без словарного основания не проецируются в legacy формы.
Новые неизвестные сопоставления не становятся verified. Морфемный ответ слова
дополнительно возвращает dictionaryVersion/morphemeVersion; несовместимый
dictionaryVersion в запросе получает 409 dictionary_version_mismatch.

Проверки: node --import tsx --test src/lib/csDictionary/*.test.ts и
node node_modules/typescript/bin/tsc --noEmit --incremental false.
profile.test.ts проверяет A→B, сохранённую A, B→A, неверные версии/cursors,
OpenAPI и legacy. При M104_WIRE_OUT=<path> сохраняет синтетические wire-примеры
для Dart-проверок. Production/данные/APK/update endpoints не менялись.
