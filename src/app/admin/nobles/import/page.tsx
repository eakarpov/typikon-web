import {getBatches} from "@/app/admin/nobles/import/api";
import {Suspense} from "react";
import AdminEditorManager from "@/app/admin/nobles/import/EditorManager";
import {hasAdminRights} from "@/lib/admin";

const NoblesImportAdmin = () => {
    const itemPromise = getBatches();
    return (
        <div>
            <p>
                Импорт родословных из внешних источников
            </p>
            <Suspense fallback={<div>Loading...</div>}>
                <AdminEditorManager itemPromise={itemPromise} />
            </Suspense>
        </div>
    );
};

export default hasAdminRights(NoblesImportAdmin);
