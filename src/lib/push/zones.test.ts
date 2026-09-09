import { test } from "node:test";
import assert from "node:assert/strict";
import { knownTimeZone, localDate, localHour } from "@/lib/push/zones";

// Часовой пояс устройства. Из него считается, когда у телефона утро, — и ошибка
// здесь будит человека затемно или молчит весь день.

test("восемь утра у каждого своё", () => {
    // Один и тот же миг: 2026-09-09T00:00:00Z.
    const now = new Date("2026-09-09T00:00:00Z");

    assert.equal(localHour("Europe/Kaliningrad", now), 2);
    assert.equal(localHour("Europe/Moscow", now), 3);
    assert.equal(localHour("Asia/Kamchatka", now), 12);
    // Рассылка «в восемь по Москве» пришлась бы Камчатке на пятый час дня, а
    // Калининграду — на шестой утра.
});

test("число тоже своё", () => {
    // За полчаса до полуночи в Москве на Камчатке уже завтра, и спрашивать
    // помянник надо про завтрашнее число, а не про наше.
    const now = new Date("2026-09-08T21:30:00Z");

    assert.equal(localDate("Europe/Moscow", now), "2026-09-09");
    assert.equal(localDate("Asia/Kamchatka", now), "2026-09-09");
    assert.equal(localDate("America/New_York", now), "2026-09-08");
});

test("неизвестный пояс не роняет рассылку", () => {
    // Пояс приходит от устройства, то есть снаружи. `Intl` на неизвестном
    // бросает, и одно кривое устройство положило бы посылку всем остальным.
    assert.equal(localHour("Марс/Олимп", new Date()), null);
    assert.equal(localDate("Марс/Олимп", new Date()), null);
    assert.equal(knownTimeZone("Марс/Олимп"), false);
    assert.equal(knownTimeZone("Europe/Moscow"), true);
});

// Час у каждого свой: рассылка чтений спрашивает не «у кого сейчас восемь», а
// «у кого сейчас ЕГО час».
test("свой час у каждого свой миг", () => {
    const now = new Date("2026-09-09T05:00:00Z");

    // Один и тот же запуск крона застаёт восьмой час в Москве и двенадцатый на
    // Камчатке; кто просил восемь, получит толчок здесь, а не там.
    assert.equal(localHour("Europe/Moscow", now), 8);
    assert.equal(localHour("Asia/Kamchatka", now), 17);
    assert.equal(localHour("Europe/Kaliningrad", now), 7);
});
