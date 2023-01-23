import TextsForm from "@/app/admin/texts/TextsForm";

const AdminTexts = () => {
    if (!process.env.SHOW_ADMIN) {
        return null;
    }

    return (
        <TextsForm />
    );
};

export default AdminTexts;
