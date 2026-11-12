import {getTemple} from "@/lib/temples";
import {settingsFor} from "@/lib/parish/settings";
import {periodKeyForDate} from "@/lib/parish/period";
import {notFound} from "next/navigation";
import { redirect } from "next/navigation";

// У прихода один вход — текущий период в выбранном ведущим формате. Отдельной карточки ему пока не нужно:
// всё, что о храме известно, уже показано на /temples/[slug], а сюда приходят
// за расписанием.
const Page = async ({ params,searchParams }: { params: Promise<{ slug: string }>;searchParams:Promise<{edit?:string}> }) => {
    const { slug } = await params;
    const temple=await getTemple(slug);if(!temple)notFound();
    const settings=await settingsFor(temple);
    const date=new Intl.DateTimeFormat('en-CA',{timeZone:settings.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const month=periodKeyForDate(date,settings.schedulePeriod??'month');
    const query=await searchParams;
    redirect(`/parish/${slug}/schedule/${month}${query.edit==="1"?"?edit=1":""}`);
};

export default Page;
