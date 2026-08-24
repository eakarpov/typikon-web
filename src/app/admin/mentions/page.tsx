import { Suspense } from "react";
import Content from "@/app/admin/mentions/Content";
import { getAppliedCount, getGroups } from "@/app/admin/mentions/api";
import { hasAdminRights } from "@/lib/admin";

const AdminMentions = () => {
    const groupsData = getGroups();
    const appliedData = getAppliedCount();

    return (
        <div className="flex flex-col">
            <Suspense fallback={<div>Loading...</div>}>
                {/* @ts-expect-error Async Server Component */}
                <Content groupsPromise={groupsData} appliedPromise={appliedData} />
            </Suspense>
        </div>
    );
};

export default hasAdminRights(AdminMentions);
