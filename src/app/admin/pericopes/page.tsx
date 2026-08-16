import Content from "@/app/admin/pericopes/Content";
import {hasAdminRights} from "@/lib/admin";

const AdminPericopes = () => {
    return (
        <div className="flex flex-col">
            <Content />
        </div>
    );
};

export default hasAdminRights(AdminPericopes);
