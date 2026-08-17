import SignsListView from "@/app/admin/signs/SignsListView";
import {SignsListResult} from "@/lib/signs/list";

const AdminEditorManager = async ({ itemPromise, searchParams }: { itemPromise: Promise<[SignsListResult, null]>; searchParams: Record<string, string | undefined> }) => {
    const [result] = await itemPromise;

    if (!result || result.error) {
        return (
            <div>
                <p>
                    Данные не получены.
                </p>
            </div>
        );
    }

    return <SignsListView result={result} searchParams={searchParams} />;
};

export default AdminEditorManager;
