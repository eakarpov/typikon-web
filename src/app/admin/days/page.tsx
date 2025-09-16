import DaysForm from "@/app/admin/days/DaysForm";
import {hasAdminRights} from "@/lib/admin";

const AdminDays = () => {
    return (
        <DaysForm />
    );
};

export default hasAdminRights(AdminDays);