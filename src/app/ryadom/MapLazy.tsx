"use client";
import dynamic from "next/dynamic";

// OpenLayers тяжёл, и в общий кусок страницы ему незачем: грузится, когда
// дело доходит до карты, и только в браузере — на сервере ему рисовать нечего.
const MapLazy = dynamic(() => import("./NearbyMap"), {
    ssr: false,
    loading: () => <div className="w-full h-80 rounded border border-slate-200 bg-slate-50" />,
});

export default MapLazy;
