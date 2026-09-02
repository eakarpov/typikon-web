"use client";

import { useEffect, useRef, useState } from "react";

// Линейная запись рисуется abcjs — на клиенте, потому что рисует она в DOM.
//
// Библиотека грузится динамически, уже после того как страница показана: сам
// напев (ABC) приходит с сервера строкой и виден в разметке, а abcjs добавляет
// к нему стан. Без этого нотный движок попадал бы в общий бандл ко всем
// страницам сайта, включая те, где нот нет и не будет.

const Staff = ({ abc }: { abc: string }) => {
    const box = useRef<HTMLDivElement>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        import("abcjs")
            .then(abcjs => {
                if (cancelled || !box.current) return;
                // Ширину задаём числом, а не «по контейнеру»: в колене
                // четыре ноты, и растянутые на всю ширину экрана они разъезжаются
                // так, что строка перестаёт читаться как строка.
                abcjs.renderAbc(box.current, abc, {
                    staffwidth: 560,
                    scale: 0.9,
                    paddingtop: 0,
                    paddingbottom: 0,
                });
            })
            .catch(() => { if (!cancelled) setFailed(true); });
        return () => { cancelled = true; };
    }, [abc]);

    if (failed) {
        // Нотный движок не загрузился — показываем сам напев текстом. ABC
        // читается глазами и вставляется в любой нотный редактор, так что это
        // не заглушка, а рабочий запасной вид.
        return (
            <pre className="text-xs text-slate-600 bg-slate-50 p-2 rounded overflow-x-auto">{abc}</pre>
        );
    }

    return <div ref={box} className="overflow-x-auto" />;
};

export default Staff;
