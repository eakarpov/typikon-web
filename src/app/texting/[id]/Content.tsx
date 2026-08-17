import {ArrowTopRightOnSquareIcon} from "@heroicons/react/24/outline";
import {ReadinessButton} from "@/app/components/DayPart";
import {cookies} from "next/headers";
import {decrypt} from "@/lib/authorize/sessions";
import {getOwnPendingProposal} from "@/app/texting/[id]/api";
import SubmitForm from "@/app/texting/[id]/SubmitForm";

const Content = async ({ itemPromise, id }: { itemPromise: Promise<[any, any]>, id: string }) => {

    const [item, error] = await itemPromise;

    if (error) {
        return (
            <div>
                Ошибка загрузки
            </div>
        );
    }

    if (!item) {
        return (
            <div>
                Документ не найден
            </div>
        );
    }

    const cookie = (await cookies()).get('session')?.value;
    const session = await decrypt(cookie);
    const userId = session?.userId as string | undefined;

    let pendingProposal = null;
    if (userId) {
        const [proposal] = await getOwnPendingProposal(userId, id);
        if (proposal) {
            pendingProposal = {
                content: proposal.content,
                comment: proposal.comment,
            };
        }
    }

    return (
        <div className="pt-2">
            <h1 className="font-bold font-serif">
                {item.bookName && (
                    <span className="font-normal text-stone-500">{item.bookName}. </span>
                )}
                {item.name}
            </h1>
            {item.description && (
                <p className="font-serif text-stone-600">
                    {item.description}
                </p>
            )}
            <div className="flex flex-row items-center">
                <span className="w-fit text-xs pr-2">
                    <ReadinessButton value={item.readiness} />
                </span>
                {item.link ? (
                    <span className="pr-4 text-amber-800 cursor-pointer flex flex-row items-center">
                        <a href={item.link} target="_blank" rel="noreferrer">
                            Скан текста&nbsp;
                        </a>
                        <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                    </span>
                ) : (
                    <span className="text-stone-400 text-sm">
                        Скан не добавлен
                    </span>
                )}
            </div>
            <SubmitForm textId={id} pendingProposal={pendingProposal} />
        </div>
    );
};

export default Content;
