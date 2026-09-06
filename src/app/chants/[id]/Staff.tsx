"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { lengthSec, tonesOf, wholeNoteSec, type AudioNote } from "@/lib/tunes/notation/playback";

// Линейная запись рисуется abcjs — на клиенте, потому что рисует она в DOM.
//
// Библиотека грузится динамически, уже после того как страница показана: сам
// напев (ABC) приходит с сервера строкой и виден в разметке, а abcjs добавляет
// к нему стан. Без этого нотный движок попадал бы в общий бандл ко всем
// страницам сайта, включая те, где нот нет и не будет.
//
// ЗВУК СВОЙ, А НЕ ЧУЖОЙ. Проигрыватель abcjs звучал бы сэмплами рояля,
// стянутыми на каждую ноту с чужого сервера; почему мы так не делаем и почему
// чистый тон здесь уместнее рояля — разобрано в @/lib/tunes/notation/playback.
// Оттуда же арифметика; здесь только звуковой движок браузера и кнопки.

/** Темпы для слушания, четвертей в минуту. Распев — не танец, скорости малые. */
const SPEEDS: { label: string; qpm: number }[] = [
    { label: "медленно", qpm: 66 },
    { label: "ровно", qpm: 96 },
    { label: "скоро", qpm: 132 },
];

/** Общая громкость. Тон чистый и оттого резкий — в полную силу его слушать нельзя. */
const MASTER_GAIN = 0.22;

const ATTACK_SEC = 0.02;
const RELEASE_SEC = 0.06;

/** Сколько ждать перед первой нотой: движку нужно время расписать голоса. */
const LEAD_SEC = 0.12;

/** За сколько гасить звук по «остановить». */
const FADE_SEC = 0.04;

type Ac = AudioContext & { close: () => Promise<void> };

const Staff = ({ abc }: { abc: string }) => {
    const box = useRef<HTMLDivElement>(null);
    const [failed, setFailed] = useState(false);

    // Разобранный напев и сама библиотека: нужны кнопке «послушать», а приходят
    // они позже самой разметки — поэтому состоянием, а не ссылкой.
    const [tune, setTune] = useState<{ abcjs: any; visual: any } | null>(null);
    const [playing, setPlaying] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [noAudio, setNoAudio] = useState(false);

    const audio = useRef<Ac | null>(null);
    const started = useRef<{ osc: OscillatorNode[]; master: GainNode; timer: any; cursor: any } | null>(null);

    useEffect(() => {
        let cancelled = false;
        import("abcjs")
            .then(abcjs => {
                if (cancelled || !box.current) return;
                // Ширину задаём числом, а не «по контейнеру»: в колене
                // четыре ноты, и растянутые на всю ширину экрана они разъезжаются
                // так, что строка перестаёт читаться как строка.
                const drawn = abcjs.renderAbc(box.current, abc, {
                    staffwidth: 560,
                    scale: 0.9,
                    paddingtop: 0,
                    paddingbottom: 0,
                });
                if (drawn?.[0]) setTune({ abcjs, visual: drawn[0] });
            })
            .catch(() => { if (!cancelled) setFailed(true); });
        return () => { cancelled = true; };
    }, [abc]);

    /** Снять подсветку со всего, что подсвечено. */
    const unlight = useCallback(() => {
        box.current?.querySelectorAll(".abc-sounding")
            .forEach(el => el.classList.remove("abc-sounding"));
    }, []);

    const stop = useCallback(() => {
        const running = started.current;
        started.current = null;
        if (running) {
            clearTimeout(running.timer);
            running.cursor?.stop();
            // Гасим рампой, а не обрывом: тон, снятый посреди волны, даёт
            // щелчок — тем громче, чем ниже голос.
            const ctx = audio.current;
            const now = ctx?.currentTime ?? 0;
            try {
                running.master.gain.cancelScheduledValues(now);
                running.master.gain.setValueAtTime(running.master.gain.value, now);
                running.master.gain.linearRampToValueAtTime(0, now + FADE_SEC);
            } catch { /* движок уже закрыт */ }
            running.osc.forEach(osc => {
                try { osc.stop(now + FADE_SEC + 0.01); } catch { /* уже отзвучал */ }
            });
        }
        unlight();
        setPlaying(false);
    }, [unlight]);

    const play = useCallback(() => {
        if (!tune) return;
        stop();

        const Ctor = typeof window !== "undefined"
            && ((window as any).AudioContext || (window as any).webkitAudioContext);
        if (!Ctor) { setNoAudio(true); return; }

        const ctx: Ac = audio.current ?? new Ctor();
        audio.current = ctx;
        // Браузер держит звук выключенным, пока его не разбудит действие
        // человека. Нажатие на кнопку им и является.
        void ctx.resume?.();

        // Разбор — abcjs, звук — наш. `setUpAudio` ничего не скачивает: он лишь
        // раскладывает уже разобранный напев по голосам и нотам.
        const tracks: AudioNote[][] = (tune.visual.setUpAudio({})?.tracks ?? [])
            .map((track: any[]) => track.filter(item => item?.cmd === "note"));
        const qpm = SPEEDS[speed].qpm;
        const tones = tonesOf(tracks, qpm);
        if (!tones.length) return;

        const master = ctx.createGain();
        master.gain.value = MASTER_GAIN;
        master.connect(ctx.destination);

        const begin = ctx.currentTime + LEAD_SEC;
        const osc = tones.map(tone => {
            const source = ctx.createOscillator();
            // Треугольная волна, а не синус: синус слышен как писк приборa, а
            // треугольник ближе к органному, и в четырёхголосии голоса в нём
            // различимы.
            source.type = "triangle";
            source.frequency.value = tone.hz;

            const envelope = ctx.createGain();
            const at = begin + tone.at;
            const till = begin + tone.till;
            // Приступ и затухание — не украшение: без них у каждой ноты по
            // щелчку на входе и выходе.
            envelope.gain.setValueAtTime(0, at);
            envelope.gain.linearRampToValueAtTime(tone.gain, at + ATTACK_SEC);
            envelope.gain.setValueAtTime(tone.gain, Math.max(at + ATTACK_SEC, till - RELEASE_SEC));
            envelope.gain.linearRampToValueAtTime(0, till);

            source.connect(envelope);
            envelope.connect(master);
            source.start(at);
            source.stop(till + 0.02);
            return source;
        });

        // Бегунок по нотам ведёт abcjs — тот же счёт времени, что и у звука,
        // только выраженный в четвертях. Своего проигрывателя он при этом не
        // заводит: TimingCallbacks умеет идти рядом с любым звуком.
        let cursor: any = null;
        try {
            cursor = new tune.abcjs.TimingCallbacks(tune.visual, {
                qpm,
                eventCallback: (event: any) => {
                    unlight();
                    if (!event) return;
                    (event.elements ?? []).forEach((group: any[]) =>
                        group.forEach((el: Element) => el.classList.add("abc-sounding")));
                },
            });
            setTimeout(() => cursor?.start(), LEAD_SEC * 1000);
        } catch {
            // Без бегунка слушать можно: он подсказка, а не сам звук.
            cursor = null;
        }

        const timer = setTimeout(() => stop(), (LEAD_SEC + lengthSec(tones)) * 1000 + 200);
        started.current = { osc, master, timer, cursor };
        setPlaying(true);
    }, [tune, speed, stop, unlight]);

    // Уходя со страницы, замолкаем: звук, переживший страницу, выключить нечем.
    useEffect(() => () => {
        started.current?.osc.forEach(osc => { try { osc.stop(); } catch { /* пусто */ } });
        clearTimeout(started.current?.timer);
        started.current?.cursor?.stop();
        void audio.current?.close();
    }, []);

    if (failed) {
        // Нотный движок не загрузился — показываем сам напев текстом. ABC
        // читается глазами и вставляется в любой нотный редактор, так что это
        // не заглушка, а рабочий запасной вид.
        return (
            <pre className="text-xs text-slate-600 bg-slate-50 p-2 rounded overflow-x-auto">{abc}</pre>
        );
    }

    return (
        <div>
            <div ref={box} className="overflow-x-auto" />

            {tune && (
                <div className="flex flex-row flex-wrap items-center gap-2 mt-2">
                    <button
                        type="button"
                        onClick={playing ? stop : play}
                        className="text-xs font-serif px-2 py-1 rounded border bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                    >
                        {playing ? "Остановить" : "Послушать"}
                    </button>
                    {SPEEDS.map((option, i) => (
                        <button
                            key={option.qpm}
                            type="button"
                            // Выбранную скорость называем и словом: цвет виден не всем,
                            // а раздел как раз про доступность.
                            aria-pressed={i === speed}
                            onClick={() => { setSpeed(i); if (playing) stop(); }}
                            className={"text-xs font-serif px-2 py-1 rounded border "
                                + (i === speed
                                    ? "bg-red-900 text-white border-red-900"
                                    : "bg-white text-slate-600 border-slate-300")}
                        >
                            {option.label}
                        </button>
                    ))}
                    <span className="text-[11px] text-slate-400 font-serif">
                        {/* Говорим, что именно услышит человек. Ожидание хора и
                            чистый тон — разные вещи, и обмануть тут легко. */}
                        чистым тоном, не голосом; {Math.round(
                            wholeNoteSec(SPEEDS[speed].qpm) / 4 * 100) / 100} с на слог
                    </span>
                    {noAudio && (
                        <span className="text-[11px] text-amber-700 font-serif">
                            Браузер не даёт звука — послушать не выйдет.
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

export default Staff;
