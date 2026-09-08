import { preflight, respond } from "@/lib/api/v2/http";
import { authorizeOpen } from "@/lib/api/v2/access";
import { publishedVersion, versionLabel } from "@/lib/appVersion";
import { SITE_URL } from "@/utils/site";

// Какая версия приложения выложена и откуда её взять.
//
// **Эта ручка обязана пережить закрытие v1.** Установленная копия узнаёт о новой
// версии только отсюда; пока проверка версий живёт в первой версии API, её
// закрытие отняло бы у приложения способность узнать о версии, которая переводит
// его на вторую, — и о той, что меняет адрес сайта. Поэтому она появляется в v2
// прежде всего прочего перехода.
//
// **Ключом не запирается** (`authorizeOpen`): отзыв ключа не должен ослеплять
// приложение относительно версии, которая этот отзыв и чинит.
//
// Номер спрашивается у самого выпуска — у имени файла в `public/app`, — а не у
// числа, записанного рядом; см. `lib/appVersion`.

// Каталог выпусков читается на каждый запрос (с минутной памятью внутри), значит
// ответ не статический: выпуск не должен ждать пересборки сайта.
export const dynamic = "force-dynamic";

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request) {
    const access = await authorizeOpen(request, "texts");
    if (access.denied) return access.denied;

    const version = publishedVersion();

    return respond({
        /** Полный номер строкой: то, что показывают человеку. */
        version: versionLabel(version),
        /**
         * Он же тройкой. `major` и `minor` отдаются и первой версией API —
         * приложения, установленные до перехода, читают именно их, и менять
         * смысл этих двух полей нельзя.
         */
        major: version.major,
        minor: version.minor,
        patch: version.patch,
        /** Откуда скачать. Приложение ведёт сюда по нажатию на уведомление. */
        download: `${SITE_URL}/app/app.apk`,
        /**
         * Тот же выпуск под своим номером. Нужен, чтобы скачанное можно было
         * назвать: `app.apk` — копия последнего и версии в себе не несёт.
         */
        archive: `${SITE_URL}/app/app-${versionLabel(version)}.apk`,
    }, { maxAge: 300, access });
}
