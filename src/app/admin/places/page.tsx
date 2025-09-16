import {getItems} from "@/app/admin/places/api";
import {Suspense} from "react";
import AdminEditorManager from "@/app/admin/places/EditorManager";
import {hasAdminRights} from "@/lib/admin";

const PlacesAdmin = () => {
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

export default hasAdminRights(PlacesAdmin);
