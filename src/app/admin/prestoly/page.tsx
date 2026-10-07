import { requires } from "@/lib/admin";
import {
    countPrestolFindings, listPrestolGroups, listTempleFindings,
} from "@/lib/pilgrimage/prestolReview";
import type { PrestolStatus } from "@/lib/pilgrimage/prestolSources";
import Content from "./Content";

// РАЗБОР НАХОДОК ПРЕСТОЛОВ.
//
// Догадка о престоле не факт, пока её не увидел человек: до этого она ни в
// карточке храма, ни в уставе. Здесь её и разбирают — целым классом («все
// „Николы“ из имени») или поштучно (находка обходчика с отрывком).

export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const num = (v: string | string[] | undefined, fallback: number) => {
    const n = Number(one(v));
    return Number.isFinite(n) && n >= 0 ? n : fallback;
};

const GROUPS_PAGE = 300;
const TEMPLES_PAGE = 40;

const Prestoly = async ({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) => {
    const view = one(searchParams.view) === "temples" ? "temples" : "groups";
    const source = one(searchParams.source);
    const dedication = one(searchParams.dedication);
    const search = one(searchParams.search).trim();

    const status: PrestolStatus = "pending";
    const sources = source ? [source] : undefined;
    const offset = num(searchParams.offset, 0);

    const counts = await countPrestolFindings();

    const groups = view === "groups"
        ? await listPrestolGroups({ status, sources, search, offset, limit: GROUPS_PAGE })
        : { items: [], total: 0 };

    const temples = view === "temples"
        ? await listTempleFindings({ status, sources, dedication: dedication || undefined, search, offset, limit: TEMPLES_PAGE })
        : { items: [], total: 0 };

    return (
        <Content view={view} counts={counts} groups={groups} temples={temples}
                 source={source} dedication={dedication} search={search} offset={offset}
                 pageSize={view === "groups" ? GROUPS_PAGE : TEMPLES_PAGE} />
    );
};

export default requires("content", Prestoly);
