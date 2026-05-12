import {getItems} from "@/app/admin/nobles/states/api";
import {Suspense} from "react";
import AdminEditorManager from "@/app/admin/nobles/states/EditorManager";
import {hasAdminRights} from "@/lib/admin";

const NoblesAdmin = () => {
    const itemPromise = getItems();
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

export default hasAdminRights(NoblesAdmin);
