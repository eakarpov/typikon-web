import { Suspense } from "react";
import Content from "./Content";
import { getLinks } from "./api";
import { hasAdminRights } from "@/lib/admin";

const AdminAkathistSaints = ({ searchParams }: { searchParams: Record<string, string | undefined> }) => {
    const status = searchParams.status || "pending";
    const data = getLinks(status);

    return (
        <div className="flex flex-col">
            <Suspense fallback={<div>Loading...</div>}>
                <Content dataPromise={data} status={status} />
            </Suspense>
        </div>
    );
};

export default hasAdminRights(AdminAkathistSaints);
