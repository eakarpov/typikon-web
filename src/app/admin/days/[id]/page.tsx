import {getItem} from "@/app/admin/days/[id]/api";
import {Suspense} from "react";
import AdminEditorManager from "@/app/admin/days/[id]/EditorManager";
import {hasAdminRights} from "@/lib/admin";

const AdminTextId = async ({ params: { id }, searchParams: { type }}: { params: { id: string }, searchParams: { type: string } }) => {
    const itemPromise = getItem(id, type !== "month");
    return (
        <div>
            <p>
                Это страница элемента
            </p>
            <Suspense fallback={<div>Loading...</div>}>
                {/* @ts-expect-error Async Server Component */}
                <AdminEditorManager itemPromise={itemPromise} />
            </Suspense>
        </div>
    );
};

export default hasAdminRights(AdminTextId);
