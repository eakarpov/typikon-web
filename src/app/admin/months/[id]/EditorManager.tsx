import Editor from "@/app/admin/months/[id]/Editor";

const AdminEditorManager = async ({ itemPromise }: any) => {
    const value = await itemPromise;
    console.log(value);

    if (!value) {
        return (
            <div>
                <p>
                    Данные не получены. Редактирование недоступно.
                </p>
            </div>
        );
    }

    return <Editor value={value} />;
};

export default AdminEditorManager;
