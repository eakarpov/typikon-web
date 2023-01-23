import DaysForm from "@/app/admin/days/DaysForm";

const AdminDays = () => {
    if (!process.env.SHOW_ADMIN) {
        return null;
    }
    return (
        <DaysForm />
    );
};

export default AdminDays;