import {TextType} from "@/utils/texts";
import DayTitle from "@/app/components/DayTitle";
import DayPartReading from "@/app/components/DayPartReading";

// Полный набор полей "дня" (мердж Триоди и календаря или чисто календарный день) —
// единый список для оглавления (DayTitle) и самого чтения (DayPartReading), чтобы
// не расходиться между местами, где рендерится день целиком.
const DAY_FIELDS: TextType[] = [
    TextType.VESPERS_PROKIMENON,
    TextType.VIGIL,
    TextType.KATHISMA_1,
    TextType.KATHISMA_2,
    TextType.KATHISMA_3,
    TextType.IPAKOI,
    TextType.POLYELEOS,
    TextType.GOSPEL_MATINS,
    TextType.SONG_3,
    TextType.SONG_6,
    TextType.APOLUTIKA_TROPARIA,
    TextType.BEFORE_1h,
    TextType.H3,
    TextType.H6,
    TextType.H9,
    TextType.PANAGIA,
    TextType.APOSTLE_LITURGY,
    TextType.GOSPEL_LITURGY,
];

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
