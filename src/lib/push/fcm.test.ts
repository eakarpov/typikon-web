import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { credentials, fromFile } from "@/lib/push/fcm";

// Учётные данные отправки. Ошибка здесь молчалива вдвойне: рассылка идёт кроном,
// её никто не смотрит, и «ничего не послано» выглядит ровно как «посылать было
// нечего».

const dir = mkdtempSync(join(tmpdir(), "fcm-"));

const keyFile = (contents: unknown): string => {
    const path = join(dir, `${Math.random().toString(36).slice(2)}.json`);
    writeFileSync(path, JSON.stringify(contents));
    return path;
};

test("ключ читается из файла служебной записи как есть", () => {
    // Файл кладут скачанным из консоли, без правок: переводы строк внутри
    // закрытого ключа настоящие, и разворачивать «\n» тут не нужно.
    const path = keyFile({
        project_id: "typikon-info",
        client_email: "x@typikon-info.iam.gserviceaccount.com",
        private_key: "-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----\n",
    });

    const creds = fromFile(path)!;
    assert.equal(creds.projectId, "typikon-info");
    assert.ok(creds.privateKey.includes("\n"));
});

test("путь задан, а файла нет — это слышно", () => {
    // Настройка, сделанная наполовину. Промолчав, рассылка просто ничего не
    // пошлёт, и это не отличить от «посылать было нечего».
    assert.throws(() => fromFile(join(dir, "нет-такого.json")), /не прочитался/);
});

test("не тот файл — тоже слышно", () => {
    // Подсунуть google-services.json вместо ключа служебной записи легко: оба
    // json, оба из одной консоли.
    const path = keyFile({ project_info: { project_id: "typikon-info" } });
    assert.throws(() => fromFile(path), /не ключ служебной записи/);
});

test("файла нет вовсе — берётся тройка переменных", () => {
    const creds = credentials({
        FCM_PROJECT_ID: "typikon-info",
        FCM_CLIENT_EMAIL: "x@y",
        FCM_PRIVATE_KEY: "-----BEGIN-----\\nMIIE\\n-----END-----",
    } as unknown as NodeJS.ProcessEnv)!;

    // Из .env ключ приходит с «\n» двумя знаками, и не развернув их, получаем
    // «error:1E08010C:DECODER routines» на первой же подписи.
    assert.ok(creds.privateKey.includes("\n"));
    assert.ok(!creds.privateKey.includes("\\n"));
});

test("не настроено вовсе — молчим, а не падаем", () => {
    // Крон не должен получать стек вызовов там, где ответ — «не настроено».
    assert.equal(credentials({} as unknown as NodeJS.ProcessEnv), null);
});

test("файл важнее переменных", () => {
    // Если заведены оба, работает тот, что надёжнее и виднее.
    const path = keyFile({
        project_id: "из-файла", client_email: "x@y", private_key: "k",
    });

    const creds = credentials({
        GOOGLE_APPLICATION_CREDENTIALS: path,
        FCM_PROJECT_ID: "из-переменных",
        FCM_CLIENT_EMAIL: "x@y",
        FCM_PRIVATE_KEY: "k",
    } as unknown as NodeJS.ProcessEnv)!;

    assert.equal(creds.projectId, "из-файла");
});
