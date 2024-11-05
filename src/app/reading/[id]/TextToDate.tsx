import {memo, Suspense} from "react";
import Link from "next/link";
import {getDayByText} from "@/app/reading/[id]/api";
import {CalendarIcon} from "@heroicons/react/24/outline";

const TextToDateContent = async ({ itemPromise }) => {
    const [day] = await itemPromise;

    if (!day) return null;

    if (!day.monthIndex && !day.week?.penticostration && !day.week?.triodion) return null;

    return (
        <span className="pr-4 text-amber-800 cursor-pointer flex flex-row items-center">
            <Link href={!!day.monthIndex ? `/calendar/${day.id}`
                : day.week?.penticostration ? `/penticostarion/${day.id}`
                    : `/triodion/${day.id}`}>
                День&nbsp;
            </Link>
            <CalendarIcon className="w-4 h-4" />
        </span>
    );
};

const TextToDate = ({ id }: { id: string }) => {
    const itemPromise = getDayByText(id);

    return (
        <Suspense fallback={<div>Loading...</div>}>
            {/* @ts-expect-error Async Server Component */}
            <TextToDateContent itemPromise={itemPromise} />
        </Suspense>
    );


};

export default memo(TextToDate);
