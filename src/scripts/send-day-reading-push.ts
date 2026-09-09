import "@/scripts/lib/env";
import { credentials, sendData } from "@/lib/push/fcm";
import { devicesAwaitingReading, forgetDevice, localDate } from "@/lib/push/devices";

// ТОЛЧОК О ЧТЕНИЯХ ДНЯ. Запускается кроном раз в час.
//
// **Час у каждого свой.** Восемь утра не всеобщее время: кто-то читает до
// работы, кто-то накануне вечером, чтобы успеть на вечерню. Устройство присылает
// свой час вместе с ключом доставки, и рассылка спрашивает не «у кого сейчас
// восемь», а «у кого сейчас ЕГО час» — по его же поясу.
//
// **Толчок пустой, как и у помянника.** Здесь дело не в тайне — чтения дня
// открыты всем, — а в том, что текст всё равно складывается на устройстве: там
// уже лежит день, там же выбран шрифт и размер, и там же ворота «сегодня уже
// говорили». Слать готовую строку значило бы держать вторую копию правила на
// сервере, чтобы она однажды разошлась с первой.
//
// Кому не выбран час, тому не пишем вовсе: молчание тут и есть выбор.

const main = async () => {
    const creds = (() => {
        try { return credentials(); } catch (e) { console.error(String(e)); process.exit(1); }
    })();
    if (!creds) {
        console.error(
            "Отправка не настроена. Положите ключ служебной записи файлом и укажите путь:\n" +
            "  GOOGLE_APPLICATION_CREDENTIALS=/etc/typikon/fcm-service-account.json",
        );
        process.exit(1);
    }

    const now = new Date();
    const devices = await devicesAwaitingReading(now);
    if (!devices.length) {
        console.log(`${now.toISOString()}: устройств, у которых сейчас их час, нет`);
        return;
    }

    let sent = 0, forgotten = 0, failed = 0;

    for (const device of devices) {
        const date = localDate(device.timeZone, now);
        if (!date) continue;

        const outcome = await sendData(device.token, { kind: "reading", date }, creds);
        if (outcome === "sent") sent += 1;
        if (outcome === "failed") failed += 1;
        if (outcome === "gone") {
            await forgetDevice(device.userId, device.token);
            forgotten += 1;
        }
    }

    console.log(
        `${now.toISOString()}: устройств ${devices.length}, ` +
        `разбужено ${sent}, забыто ${forgotten}, не вышло ${failed}`,
    );
};

main().then(() => process.exit(0)).catch((e) => {
    console.error(e);
    process.exit(1);
});
