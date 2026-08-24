import Manager from "@/app/admin/api-tokens/Manager";
import type { AdminTokenView } from "@/app/admin/api-tokens/api";
import { SCOPES, TIERS, type Tier } from "@/lib/api/v2/tokens";

// Тарифы и разделы приходят в клиентскую часть props'ами, а не импортом: модуль правил
// тянет node:crypto и в браузерную сборку ему нельзя.
const tiers = (Object.keys(TIERS) as Tier[]).map((id) => ({ id, ...TIERS[id], scopes: [...TIERS[id].scopes] }));

const Content = async ({ itemsPromise }: { itemsPromise: Promise<[AdminTokenView[] | null, any]> }) => {
    const [items, error] = await itemsPromise;

    if (error || !items) {
        return <div>Ошибка получения</div>;
    }

    return <Manager items={items} tiers={tiers} scopes={[...SCOPES]} />;
};

export default Content;
