import {TextType} from "@/utils/texts";
import DayTitle from "@/app/components/DayTitle";
import DayPartReading from "@/app/components/DayPartReading";

const Content = async ({ itemPromise }: { itemPromise: Promise<any> }) => {

    const [item, error] = await itemPromise;

    if (!item || error) {
        return (
            <div>
                Ничего не нашлось
            </div>
        );
    }

    return (
        <div className="flex flex-col pt-2 md:flex-row">
            <div className="w-1/4">
                <ul className="space-y-2">
                    <DayTitle value={item.vigil} valueName={TextType.VIGIL} />
                    <DayTitle value={item.kathisma1} valueName={TextType.KATHISMA_1} />
                    <DayTitle value={item.kathisma2} valueName={TextType.KATHISMA_2} />
                    <DayTitle value={item.kathisma3} valueName={TextType.KATHISMA_3} />
                    <DayTitle value={item.ipakoi} valueName={TextType.IPAKOI} />
                    <DayTitle value={item.polyeleos} valueName={TextType.POLYELEOS} />
                    <DayTitle value={item.song3} valueName={TextType.SONG_3} />
                    <DayTitle value={item.song6} valueName={TextType.SONG_6} />
                    <DayTitle value={item.apolutikaTroparia} valueName={TextType.APOLUTIKA_TROPARIA} />
                    <DayTitle value={item.before1h} valueName={TextType.BEFORE_1h} />
                    <DayTitle value={item.panagia} valueName={TextType.PANAGIA} />
                </ul>
            </div>
            <div className="flex flex-col flex-1 space-y-4">
                <DayPartReading value={item.vigil} valueName={TextType.VIGIL} />
                <DayPartReading value={item.kathisma1} valueName={TextType.KATHISMA_1} />
                <DayPartReading value={item.kathisma2} valueName={TextType.KATHISMA_2} />
                <DayPartReading value={item.kathisma3} valueName={TextType.KATHISMA_3} />
                <DayPartReading value={item.ipakoi} valueName={TextType.IPAKOI} />
                <DayPartReading value={item.polyeleos} valueName={TextType.POLYELEOS} />
                <DayPartReading value={item.song3} valueName={TextType.SONG_3} />
                <DayPartReading value={item.song6} valueName={TextType.SONG_6} />
                <DayPartReading value={item.before1h} valueName={TextType.BEFORE_1h} />
                <DayPartReading value={item.apolutikaTroparia} valueName={TextType.APOLUTIKA_TROPARIA} />
                <DayPartReading value={item.panagia} valueName={TextType.PANAGIA} />
            </div>
        </div>
    );
};

export default Content;
