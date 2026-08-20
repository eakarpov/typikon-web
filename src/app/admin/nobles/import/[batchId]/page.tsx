import {getBatchDetail} from "@/app/admin/nobles/import/[batchId]/api";
import {Suspense} from "react";
import AdminEditorManager from "@/app/admin/nobles/import/[batchId]/EditorManager";
import {hasAdminRights} from "@/lib/admin";

const NoblesImportBatchAdmin = ({ params: { batchId }}: { params: { batchId: string }}) => {
    const itemPromise = getBatchDetail(batchId);
    return (
        <div>
            <p>
                Ревью партии импорта #{batchId}
            </p>
            <Suspense fallback={<div>Loading...</div>}>
                {/* @ts-expect-error Async Server Component */}
                <AdminEditorManager itemPromise={itemPromise} />
            </Suspense>
        </div>
    );
};

export default hasAdminRights(NoblesImportBatchAdmin);
