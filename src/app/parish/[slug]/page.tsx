import { redirect } from "next/navigation";

// У прихода один вход — текущий месяц. Отдельной карточки ему пока не нужно:
// всё, что о храме известно, уже показано на /temples/[slug], а сюда приходят
// за расписанием.
const Page = async ({ params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params;
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    redirect(`/parish/${slug}/schedule/${month}`);
};

export default Page;
