import {getItems} from "@/app/admin/signs/api";
import {Suspense} from "react";
import AdminEditorManager from "@/app/admin/signs/EditorManager";
import {hasAdminRights} from "@/lib/admin";

interface ISearchParams {
    page?: string;
    q?: string;
    month?: string;
    sign?: string;
    source?: string;
    needsReview?: string;
}

const SignsAdmin = ({ searchParams }: { searchParams: ISearchParams }) => {
    const itemPromise = getItems({
        page: searchParams.page ? parseInt(searchParams.page, 10) : 1,
        q: searchParams.q || undefined,
        month: searchParams.month ? parseInt(searchParams.month, 10) : undefined,
        sign: searchParams.sign || undefined,
        source: searchParams.source || undefined,
        needsReview: searchParams.needsReview ? searchParams.needsReview === "true" : undefined,
    });
    return (
        <div>
            <p>
                Месяцеслов Типикона
            </p>
            <Suspense fallback={<div>Loading...</div>}>
                {/* @ts-expect-error Async Server Component */}
                <AdminEditorManager itemPromise={itemPromise} searchParams={searchParams} />
            </Suspense>
        </div>
    );
};

export default hasAdminRights(SignsAdmin);
