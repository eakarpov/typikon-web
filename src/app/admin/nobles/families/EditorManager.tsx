import Editor from "@/app/admin/nobles/families/Editor";

const AdminEditorManager = async ({ itemPromise }: any) => {
    const [value, err] = await itemPromise;

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
