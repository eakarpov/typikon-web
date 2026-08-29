import { Suspense } from "react";
import Content from "./Content";
import { getLinks, type LinkTarget } from "./api";
import { hasAdminRights } from "@/lib/admin";

const AdminAkathistSaints = ({ searchParams }: { searchParams: Record<string, string | undefined> }) => {
    const status = searchParams.status || "pending";
    const target = (searchParams.target === "memory" ? "memory" : "akathist") as LinkTarget;
    const data = getLinks(status, target);

    return (
        <div className="flex flex-col">
            <Suspense fallback={<div>Loading...</div>}>
                <Content dataPromise={data} status={status} target={target} />
            </Suspense>
        </div>
    );
};

export default hasAdminRights(AdminAkathistSaints);
