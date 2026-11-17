import { requires } from "@/lib/admin";
import data from "@/data/library/coverage.json";
import Coverage from "./Content";
import type { Registry } from "./core";
export const dynamic = "force-dynamic";
function LibraryCoverage() { return <Coverage data={data as Registry} />; }
export default requires("content", LibraryCoverage);
