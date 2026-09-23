import { requires } from "@/lib/admin";
import { listRelics } from "@/lib/pilgrimage/relicsStore";
import { listCandidates } from "@/lib/pilgrimage/candidates";
import Content from "./Content";

// Реестр святынь: предложения ждут разбора сверху, принятое — ниже.
export const dynamic = "force-dynamic";

const Relics = async () => {
    const [pending, approved, rejected, candidates] = await Promise.all([
        listRelics("pending"), listRelics("approved"), listRelics("rejected"), listCandidates("new", 50),
    ]);
    return <Content pending={pending} approved={approved} rejected={rejected}
                    candidates={candidates.items} candidateTotal={candidates.total} />;
};

export default requires("content", Relics);
