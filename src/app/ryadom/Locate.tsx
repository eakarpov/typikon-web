"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { roundCoord } from "@/lib/pilgrimage/summary";

// Определить место — только по нажатию.
//
// Браузер спрашивает разрешения сам, и спрашивать его без просьбы человека —
// значит получить отказ навсегда: во второй раз окно уже не покажут. Точка
// округляется до километра здесь же, прежде чем попасть в адрес страницы.

const Locate = ({ radiusKm }: { radiusKm: number }) => {
    const router = useRouter();
    const [state, setState] = useState<"idle" | "asking" | "error">("idle");
    const [message, setMessage] = useState("");

    const locate = () => {
        if (!("geolocation" in navigator)) {
            setState("error");
            setMessage("Этот браузер не умеет определять место. Выберите точку на карте.");
            return;
        }
        setState("asking");
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = roundCoord(pos.coords.latitude);
                const lon = roundCoord(pos.coords.longitude);
                router.push(`/ryadom?lat=${lat}&lon=${lon}&r=${radiusKm}`);
                setState("idle");
            },
            (err) => {
                setState("error");
                setMessage(err.code === err.PERMISSION_DENIED
                    ? "Доступ к месту запрещён. Его можно разрешить в настройках браузера — или выбрать точку на карте."
                    : "Место определить не удалось. Выберите точку на карте.");
            },
            // Точность высокая ни к чему: точку всё равно огрубляем до километра.
            { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
        );
    };

    return (
        <div className="font-serif">
            <button type="button" onClick={locate} disabled={state === "asking"}
                    className="border border-amber-800 text-amber-900 rounded px-3 py-1 hover:bg-amber-50 disabled:opacity-60">
                {state === "asking" ? "Определяем…" : "Определить, где я"}
            </button>
            {state === "error" && <p className="text-sm text-slate-600 mt-1">{message}</p>}
        </div>
    );
};

export default Locate;
