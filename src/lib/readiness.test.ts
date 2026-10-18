import { test } from "node:test";
import assert from "node:assert/strict";
import { deploymentReadiness } from "./readiness";

test("готовность подтверждает номер сборки и живую базу", async () => {
    let pinged = false;
    assert.deepEqual(await deploymentReadiness(async () => "build-42\n", async () => {
        pinged = true;
    }), { status: "ready", buildId: "build-42" });
    assert.ok(pinged);
});

test("недоступная база, отсутствующая и пустая сборка — неготовность без деталей", async () => {
    const fail = async () => { throw new Error("private connection details"); };
    assert.deepEqual(await deploymentReadiness(async () => "build", fail), { status: "unavailable" });
    assert.deepEqual(await deploymentReadiness(fail, async () => true), { status: "unavailable" });
    assert.deepEqual(await deploymentReadiness(async () => " \n", async () => true), { status: "unavailable" });
});

test("зависшая база не удерживает проверку готовности", async () => {
    assert.deepEqual(await deploymentReadiness(async () => "build", () => new Promise(() => {}), 10),
        { status: "unavailable" });
});
