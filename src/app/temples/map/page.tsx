import { Metadata } from "next";
import Link from "next/link";
import { setMeta } from "@/lib/meta";
import { myFont } from "@/utils/font";
import TemplesMap from "./TemplesMap";

export const metadata: Metadata = {
    title: "Карта храмов",
    description: "Храмы России на карте: где чего больше и как расходятся посвящения.",
};

const TemplesMapPage = ({ searchParams }: { searchParams?: { q?: string; dedication?: string } }) => {
    setMeta();
    const query = searchParams?.q?.trim();
    const dedication = searchParams?.dedication?.trim();

    return (
        <div className={`pt-2 ${myFont.variable}`}>
            <p className="font-serif mb-2">
                Храмы на карте.{" "}
                <Link className="text-amber-800 hover:underline" href="/temples">К указателю</Link>
                {dedication && " — показаны только храмы выбранного посвящения."}
            </p>
            <TemplesMap query={query} dedication={dedication} />
            <p className="font-serif text-sm text-slate-500 mt-2">
                Храмы — из OpenStreetMap (© участники OpenStreetMap, ODbL) и Wikidata (CC0);
                подложка — © участники OpenStreetMap.
            </p>
        </div>
    );
};

export default TemplesMapPage;
