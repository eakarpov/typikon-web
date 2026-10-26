import { test } from "node:test";
import assert from "node:assert/strict";
import { createPlaybackPlan } from "./playback";

test("расписание использует высоты и длительности kruczie", async () => {
    const plan = (await createPlaybackPlan("*н1 г2 н!", 120)).value!;
    assert.equal(plan.tones[0].hz, 440);
    assert.deepEqual(plan.tones.map(n => n.start), [0, .5, 1.5]);
    assert.deepEqual(plan.tones.map(n => n.duration), [.5, 1, .25]);
    assert.equal(plan.duration, 1.75);
    assert.ok(plan.tones.every(n => n.soundingDuration > 0 && n.soundingDuration < n.duration));
});
test("изменение темпа масштабирует время, не меняя высоты и точек", async () => {
    const slow = (await createPlaybackPlan("#г1. Ьс2.", 60)).value!;
    const fast = (await createPlaybackPlan("#г1. Ьс2.", 120)).value!;
    assert.deepEqual(slow.tones.map(n => n.duration), [1.5, 3]);
    assert.deepEqual(fast.tones.map(n => n.duration), [.75, 1.5]);
    assert.deepEqual(slow.tones.map(n => n.hz), fast.tones.map(n => n.hz));
    assert.equal(slow.duration, 2 * fast.duration);
});
test("повторные ноты артикулируются отдельно, структурные знаки не добавляют звуков", async () => {
    const plan = (await createPlaybackPlan("& г1 / г1 \\", 96)).value!;
    assert.equal(plan.tones.length, 2);
    assert.equal(plan.tones[0].hz, plan.tones[1].hz);
    assert.ok(plan.tones[0].start + plan.tones[0].soundingDuration < plan.tones[1].start);
});
test("неизвестные обозначения, речитация, пустая запись и неверный темп не проигрываются частично", async () => {
    for (const [raw, bpm] of [["г1 ???", 96], ["г1 н...", 96], ["", 96], ["г1", 0], ["г1", NaN]] as const) {
        const result = await createPlaybackPlan(raw, bpm);
        assert.equal(result.value, null);
        assert.ok(result.diagnostics.some(d => d.severity === "error"));
    }
});
