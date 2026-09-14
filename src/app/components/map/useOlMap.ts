'use client';
import { DependencyList, useEffect, useRef } from "react";
import type Map from "ol/Map";

// Общий порядок жизни карты OpenLayers: построить на узле, переспросить размер,
// снять с узла при уходе. Вынесено из карты храма (@/app/temples/[slug]/TempleMap),
// где изъян с пустой подложкой был впервые разобран и починен.
//
// РАЗМЕР НАДО ПЕРЕСПРОСИТЬ. Карта меряет узел в тот миг, когда её строят, а
// строится она из эффекта — вёрстка к этому моменту ширины ещё не дала, и карта
// запоминает ширину 0. Дальше она решает, что покрывать нечего, и НЕ ЗАПРАШИВАЕТ
// НИ ОДНОЙ ПЛИТКИ: подложка остаётся пустой, а слои поверх рисуются.
//
// Наблюдатель, а не один updateSize: ширина меняется и потом — при повороте
// телефона и когда рядом разворачивается меню. И один раз сразу следующим кадром:
// наблюдатель сообщает об ИЗМЕНЕНИИ, а если узел к первому замеру уже стоял в
// своей ширине, менять нечего — и неверно снятый размер так и остался бы.
export const useOlMap = (build: (target: HTMLDivElement) => Map, deps: DependencyList) => {
    const target = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!target.current) return;
        const map = build(target.current);

        const resize = new ResizeObserver(() => map.updateSize());
        resize.observe(target.current);
        const frame = requestAnimationFrame(() => map.updateSize());

        // Карту обязательно снимаем с узла: без этого переход на соседнюю
        // страницу оставляет прежнюю карту висеть на том же месте.
        return () => {
            cancelAnimationFrame(frame);
            resize.disconnect();
            map.setTarget(undefined);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    return target;
};
