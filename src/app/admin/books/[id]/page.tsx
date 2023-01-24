import {getItem} from "@/app/admin/books/[id]/api";
import {Suspense} from "react";
import AdminEditorManager from "@/app/admin/books/[id]/EditorManager";

const AdminBookId = async ({ params: { id }}: { params: { id: string }}) => {
    if (!process.env.SHOW_ADMIN) {
        return null;
    }
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

export default AdminBookId;
