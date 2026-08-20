import Editor from "@/app/admin/nobles/import/[batchId]/Editor";

const AdminEditorManager = async ({ itemPromise }: any) => {
    const [value, err] = await itemPromise;

    if (!value) {
        return (
            <div>
                <p>
                    Партия не найдена.
                </p>
            </div>
        );
    }

    return <Editor value={value} />;
};

export default AdminEditorManager;
