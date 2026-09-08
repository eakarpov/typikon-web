import "@/scripts/lib/env";
import { credentials, sendData } from "@/lib/push/fcm";
import { devicesAtLocalHour, forgetDevice, localDate } from "@/lib/push/devices";
import { listPersons } from "@/lib/pomyannik/service";
import { upcoming } from "@/lib/pomyannik/reckoning";

// ТОЛЧОК О ПОМИНАЛЬНОМ ДНЕ. Запускается кроном раз в час.
//
// Приложение умеет напоминать и само, но показывает напоминание тогда, когда
// система даст фоновой задаче окно — то есть когда придётся, а иной день и
// никогда. Толчок приходит в минуту. Кто чем пользуется, человек выбирает в
// настройках приложения; сюда попадают только те, кто выбрал сервер, — они и
// присылают ключ доставки.
//
// **Час считается по поясу устройства, а не по нашему.** Восемь утра в
// Петропавловске и восемь утра в Калининграде — одиннадцать часов разницы, и
// рассылка «в восемь по Москве» будила бы половину страны затемно.
//
// **Имён не отправляется.** Мы смотрим, ЕСТЬ ли у человека сегодня поминальный
// день, и, если есть, будим приложение пустым сообщением. Что сказать, оно
// решает само по своему зеркалу — тем же правилом, что и без сети. Гнать имена
// родни через чужие серверы ради удобства нельзя: приложение по той же причине
// отказалось и от отложенных уведомлений системы.

const HOUR = Number(process.env.POMYANNIK_PUSH_HOUR ?? 8);

const main = async () => {
    let creds;
    try {
        creds = credentials();
    } catch (e) {
        // Путь к ключу задан, а прочитать его не вышло: настройка сделана
        // наполовину, и это надо сказать словами, а не «послано 0».
        console.error(String(e));
        process.exit(1);
    }
    if (!creds) {
        console.error(
            "Отправка не настроена. Положите ключ служебной записи файлом и укажите путь:\n" +
            "  GOOGLE_APPLICATION_CREDENTIALS=/etc/typikon/fcm-service-account.json",
        );
        process.exit(1);
    }

    const now = new Date();
    const devices = await devicesAtLocalHour(HOUR, now);
    if (!devices.length) {
        console.log(`${now.toISOString()}: устройств с местным ${HOUR}-м часом нет`);
        return;
    }

    // Помянник у человека один, а телефонов может быть несколько: считаем раз
    // на хозяина, а не раз на устройство.
    const hasToday = new Map<string, boolean>();
    let sent = 0, quiet = 0, forgotten = 0, failed = 0;

    for (const device of devices) {
        const date = localDate(device.timeZone, now);
        if (!date) continue;

        const key = `${device.userId}|${date}`;
        if (!hasToday.has(key)) {
            const persons = await listPersons(device.userId);
            // Один день, а не окно: спрашиваем ровно про сегодня по месту
            // устройства.
            hasToday.set(key, upcoming(persons, date, 0).length > 0);
        }

        if (!hasToday.get(key)) {
            quiet += 1;
            continue;
        }

        const outcome = await sendData(device.token, { kind: "pomyannik", date }, creds);
        if (outcome === "sent") sent += 1;
        if (outcome === "failed") failed += 1;
        if (outcome === "gone") {
            // Ключ мёртв: переустановили или снесли приложение. Забываем, иначе
            // рассылка год за годом стучится в пустоту.
            await forgetDevice(device.userId, device.token);
            forgotten += 1;
        }
    }

    console.log(
        `${now.toISOString()}: устройств ${devices.length}, ` +
        `разбужено ${sent}, промолчали ${quiet}, забыто ${forgotten}, не вышло ${failed}`,
    );
};

main().then(() => process.exit(0)).catch((e) => {
    console.error(e);
    process.exit(1);
});
