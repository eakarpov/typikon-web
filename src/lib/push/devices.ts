import clientPromise from "@/lib/mongodb";
import { localHour } from "@/lib/push/zones";

// Часовые пояса живут отдельно: правило, от которого зависит, разбудим мы
// человека в восемь утра или в три ночи, проверяется тестом без базы.
export { knownTimeZone, localDate, localHour } from "@/lib/push/zones";

// УСТРОЙСТВА, КОТОРЫМ МОЖНО ПОСЛАТЬ УВЕДОМЛЕНИЕ.
//
// Заведено ради одного: точности. Приложение умеет напоминать о поминальном дне
// само, но показывает напоминание тогда, когда система даст фоновой задаче окно,
// — то есть когда придётся, а иногда и никогда. Толчок с сервера приходит в
// минуту.
//
// **Имён в толчке нет и не будет.** Приложение нарочно не заводит отложенных
// уведомлений: каждое такое лежит в базе системы до срабатывания, и «Сороковой
// день: Николай» оказался бы там, куда очистка при выходе не дотянется. Через
// чужие серверы те же имена гнать тем более нельзя. Поэтому толчок пустой — он
// лишь будит приложение, а что сказать, приложение берёт из своего зеркала и
// решает тем же правилом, что и без сети.
//
// Отсюда и то, что здесь хранится: чей это телефон, куда стучаться и в каком он
// часовом поясе. Ни имён, ни дат поминовения — они и так в помяннике, и
// дублировать их сюда незачем.

const COLLECTION = "pushDevices";

const devices = async () =>
    (await clientPromise).db("typikon-users").collection(COLLECTION);

export interface PushDevice {
    userId: string;
    /** Ключ доставки, выданный устройству. */
    token: string;
    /** Часовой пояс устройства (IANA): в нём и считается, когда у него утро. */
    timeZone: string;
    platform: string;
    updatedAt: Date;
}

/**
 * Запомнить устройство.
 *
 * Ключ доставки — он же и опознаватель: один и тот же телефон, переустановивший
 * приложение, приходит с новым ключом, а старый умирает сам (и вычищается при
 * первой же неудачной посылке). Ключ при этом привязан к хозяину: сменился
 * вошедший — сменилась и запись, иначе новый хозяин телефона получал бы
 * напоминания прежнего.
 */
export const rememberDevice = async (
    userId: string,
    token: string,
    timeZone: string,
    platform: string,
): Promise<void> => {
    const collection = await devices();
    await collection.updateOne(
        { token },
        { $set: { userId, token, timeZone, platform, updatedAt: new Date() } },
        { upsert: true },
    );
};

/** Забыть устройство: выключили уведомления, вышли из учётной записи. */
export const forgetDevice = async (userId: string, token: string): Promise<boolean> => {
    const collection = await devices();
    // Хозяин — в фильтре, а не в проверке после: чужой ключ нельзя отвязать
    // даже зная его.
    const { deletedCount } = await collection.deleteOne({ userId, token });
    return deletedCount > 0;
};

/** Забыть все устройства хозяина: вышел отовсюду. */
export const forgetAllDevices = async (userId: string): Promise<number> => {
    const collection = await devices();
    const { deletedCount } = await collection.deleteMany({ userId });
    return deletedCount;
};

/** Устройства, у которых сейчас названный час по их собственному поясу. */
export const devicesAtLocalHour = async (hour: number, now: Date = new Date()): Promise<PushDevice[]> => {
    const collection = await devices();
    const all = (await collection.find({}).toArray()) as unknown as PushDevice[];

    return all.filter((device) => localHour(device.timeZone, now) === hour);
};

