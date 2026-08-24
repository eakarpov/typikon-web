import {DAY_SLOT_ORDER, TextType} from "@/utils/texts";
import DayTitle from "@/app/components/DayTitle";
import DayPartReading from "@/app/components/DayPartReading";

// Порядок слотов живёт в @/utils/texts — им же пользуется публичное API.
const DAY_FIELDS = DAY_SLOT_ORDER;

const DayFullContent = ({ item, paschal }: { item: any; paschal?: boolean }) => {
    if (!item) return null;

    return (
        <div className="flex flex-col pt-2 md:flex-row">
            <div className="w-1/4">
                <ul className="space-y-2">
                    {DAY_FIELDS.map((field) => (
                        <DayTitle key={field} value={item[field]} valueName={field} />
                    ))}
                </ul>
            </div>
            <div className="flex flex-col flex-1 space-y-4">
                {DAY_FIELDS.map((field) => (
                    <DayPartReading key={field} value={item[field]} valueName={field} paschal={paschal} />
                ))}
            </div>
        </div>
    );
};

export default DayFullContent;
