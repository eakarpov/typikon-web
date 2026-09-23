import { requires } from "@/lib/admin";
import { listProposals } from "@/lib/saintProposals";
import Content from "./Content";

// Святые из памятей Минеи, которых импорт не решился завести сам.
export const dynamic = "force-dynamic";

const SaintProposals = async () => <Content groups={await listProposals("new")} />;

export default requires("content", SaintProposals);
