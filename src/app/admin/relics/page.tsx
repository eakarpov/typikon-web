import { requires } from "@/lib/admin";
import { listRelics } from "@/lib/pilgrimage/relicsStore";
import Content from "./Content";

// Реестр святынь: предложения ждут разбора сверху, принятое — ниже.
export const dynamic = "force-dynamic";

const Relics = async () => {
    const [pending, approved, rejected] = await Promise.all([
        listRelics("pending"), listRelics("approved"), listRelics("rejected"),
    ]);
    return <Content pending={pending} approved={approved} rejected={rejected} />;
};

export default requires("content", Relics);
