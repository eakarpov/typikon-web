import {getItems} from "@/app/admin/reports/api";
import {Suspense} from "react";
import AdminEditorManager from "@/app/admin/reports/EditorManager";

const PlacesAdmin = async () => {
    if (!process.env.SHOW_ADMIN) {
        return null;
    }
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

export default PlacesAdmin;
