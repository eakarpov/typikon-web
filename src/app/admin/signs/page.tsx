import {hasAdminRights} from "@/lib/admin";

const AdminWeeks = () => {
    return (
        <div className="flex flex-col">
            <p>
                Для добавления/удаления используем базу
            </p>
        </div>
    );
};

export default hasAdminRights(AdminWeeks);