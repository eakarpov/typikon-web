import TextsForm from "@/app/admin/texts/TextsForm";
import {hasAdminRights} from "@/lib/admin";

const AdminTexts = () => {

    return (
        <TextsForm />
    );
};

export default hasAdminRights(AdminTexts);
