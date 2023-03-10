import {getItem} from "@/app/admin/days/[id]/api";
import {Suspense} from "react";
import AdminEditorManager from "@/app/admin/days/[id]/EditorManager";

const AdminTextId = async ({ params: { id }, searchParams: { type }}: { params: { id: string }, searchParams: { type: string } }) => {
    if (!process.env.SHOW_ADMIN) {
        return null;
    }
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

export default AdminTextId;
