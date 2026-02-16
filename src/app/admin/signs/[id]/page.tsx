import {getItem} from "@/app/admin/signs/[id]/api";
import {Suspense} from "react";
import AdminEditorManager from "@/app/admin/signs/[id]/EditorManager";
import {hasAdminRights} from "@/lib/admin";

const AdminTextId = async ({ params: { id }}: { params: { id: string }}) => {
    const itemPromise = getItem(id);
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
