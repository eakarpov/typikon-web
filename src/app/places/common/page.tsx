import { Metadata } from "next";
import Link from "next/link";
import { myFont } from "@/utils/font";
import { setMeta } from "@/lib/meta";
import { slavicPlaces } from "@/lib/places/query";
import { ERA_COLORS, eraOf } from "@/lib/places/centuries";
import SlavicMap from "./SlavicMap";

// Карта славянских поселений. С 2026-09-15 — не отдельные файлы, а места общего
// указателя с собранием «slavic» (scripts/places/import-slavic-map.ts): у каждого
// поселения своя страница, щелчок по точке ведёт на неё.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Карта славянских поселений",
    description: "Славянские поселения до XIV века и торговые пути: по времени основания, со страницей каждого места.",
};

const CommonPlaces = async () => {
    setMeta();
    const { points, routes } = await slavicPlaces();

    return (
        <div className={`pt-2 ${myFont.variable}`}>
            <div className="font-serif text-sm"><Link href="/places" className="text-red-900">← к указателю мест</Link></div>
            <h1 className="font-serif text-2xl mt-1">Карта славянских поселений (до XIV века)</h1>
            <p className="font-serif text-sm mt-1 flex flex-wrap gap-x-4">
                <span style={{ color: ERA_COLORS.ancient }}>● основаны до V века</span>
                <span style={{ color: ERA_COLORS.early }}>● с V по X век</span>
                <span style={{ color: ERA_COLORS.medieval }}>● с X по XIV век</span>
                <span className="text-blue-700">— торговые пути</span>
                <span className="text-slate-500">поселений: {points.length}</span>
            </p>
            <div className="mt-2">
                <SlavicMap
                    points={points.map((p) => ({ ...p, era: eraOf(p.from) }))}
                    routes={routes}
                />
            </div>
        </div>
    );
};

export default CommonPlaces;
