import { test } from "node:test";
import assert from "node:assert/strict";
import { lengthSec, midiToHz, tonesOf, wholeNoteSec, type AudioNote } from "@/lib/tunes/notation/playback";

// Числа взяты не из головы: голоса ниже сняты с разбора настоящего напева —
// «Глас 3, тропари (греческий распев)», первые ноты сопрано и баса, как их
// отдаёт abcjs (`setUpAudio`): доли целой ноты, высота числом MIDI.

const soprano: AudioNote[] = [
    { pitch: 67, start: 0, duration: 0.25, volume: 85 },
    { pitch: 67, start: 0.25, duration: 0.25, volume: 85 },
    { pitch: 67, start: 0.5, duration: 0.25, volume: 85 },
    { pitch: 69, start: 0.75, duration: 0.5, volume: 95 },
];
const bass: AudioNote[] = [
    { pitch: 52, start: 0, duration: 0.25, volume: 85 },
    { pitch: 52, start: 0.25, duration: 0.25, volume: 85 },
];

test("высота считается равномерным строем от ля первой октавы", () => {
    assert.equal(midiToHz(69), 440);
    assert.equal(Math.round(midiToHz(60) * 100) / 100, 261.63); // до первой октавы
    assert.equal(Math.round(midiToHz(81)), 880); // октавой выше — вдвое
});

test("темп считается в четвертях, а доли — от целой ноты", () => {
    // 180 четвертей в минуту: четверть — треть секунды, целая — 4/3.
    assert.equal(Math.round(wholeNoteSec(180) * 1000), 1333);
    assert.equal(Math.round(wholeNoteSec(96) * 1000), 2500);
});

test("подряд идущие ноты одной высоты не сливаются", () => {
    // Главное свойство распева: восемь слогов на одной ноте. Без зазора это
    // один длинный гудок, и услышать, что их восемь, нельзя.
    const tones = tonesOf([soprano], 96);
    const first = tones[0];
    const second = tones[1];
    assert.equal(first.hz, second.hz);
    assert.ok(first.till < second.at, "нота должна отзвучать до начала следующей");
    assert.ok(second.at - first.till > 0.03, "зазор должен быть слышен");
});

test("зазор не съедает короткую ноту целиком", () => {
    // Шестнадцатая на скором темпе короче самого зазора; звучать она обязана.
    const quick: AudioNote[] = [{ pitch: 67, start: 0, duration: 0.0625, volume: 90 }];
    const [tone] = tonesOf([quick], 200);
    assert.ok(tone.till > tone.at, "нота не может отзвучать раньше, чем началась");
    assert.ok(tone.till - tone.at >= (tone.till - tone.at) / 2);
});

test("голоса сходятся в один поток по времени", () => {
    const tones = tonesOf([soprano, bass], 96);
    assert.equal(tones.length, soprano.length + bass.length);
    // По порядку звучания, а не по голосам: движок расписывает их по времени.
    for (let i = 1; i < tones.length; i += 1) assert.ok(tones[i].at >= tones[i - 1].at);
    // Первое созвучие — бас и сопрано разом.
    assert.equal(tones[0].at, 0);
    assert.equal(tones[1].at, 0);
    assert.deepEqual([tones[0].hz < tones[1].hz], [true]);
});

test("громкость делится между голосами", () => {
    const [alone] = tonesOf([soprano], 96);
    const [together] = tonesOf([soprano, bass], 96);
    assert.ok(together.gain < alone.gain, "четыре партии в полную силу дают перегруз");
});

test("пустое не звучит", () => {
    assert.deepEqual(tonesOf([], 96), []);
    assert.deepEqual(tonesOf([[]], 96), []);
    assert.deepEqual(tonesOf([soprano], 0), []);
    assert.equal(lengthSec([]), 0);
});

test("длительность целого — по последней отзвучавшей ноте", () => {
    const tones = tonesOf([soprano], 96);
    // Последняя нота — половинная от 0.75: конец на 1.25 целой.
    assert.ok(Math.abs(lengthSec(tones) - 1.25 * wholeNoteSec(96)) < 0.1);
});
