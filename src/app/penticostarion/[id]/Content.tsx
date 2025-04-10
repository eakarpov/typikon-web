import {TextType} from "@/utils/texts";
import DayTitle from "@/app/components/DayTitle";
import CountMeta from "@/app/meta/CountMeta";
import DayPartReading from "@/app/components/DayPartReading";

const Content = async ({ itemPromise }: { itemPromise: Promise<any> }) => {

    const item = await itemPromise;

    if (!item) {
        return (
          <div>
              Ничего не нашлось
          </div>
        );
    }

    return (
        <div className="flex flex-col">
            <CountMeta />
            <h1 className="font-bold font-serif">
                {item.name}
            </h1>
            <p className="text-stone-400 font-serif">
                Если чтения отсутствуют - значит, по данному дню еще не были добавлены тексты.
            </p>
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
                        <DayTitle value={item.h3} valueName={TextType.H3} />
                        <DayTitle value={item.h6} valueName={TextType.H6} />
                        <DayTitle value={item.h9} valueName={TextType.H9} />
                    </ul>
                </div>
                <div className="flex flex-col flex-1 space-y-4">
                    <DayPartReading value={item.vigil} valueName={TextType.VIGIL} paschal />
                    <DayPartReading value={item.kathisma1} valueName={TextType.KATHISMA_1} paschal />
                    <DayPartReading value={item.kathisma2} valueName={TextType.KATHISMA_2} paschal />
                    <DayPartReading value={item.kathisma3} valueName={TextType.KATHISMA_3} paschal />
                    <DayPartReading value={item.ipakoi} valueName={TextType.IPAKOI} paschal />
                    <DayPartReading value={item.polyeleos} valueName={TextType.POLYELEOS} paschal />
                    <DayPartReading value={item.song3} valueName={TextType.SONG_3} paschal />
                    <DayPartReading value={item.song6} valueName={TextType.SONG_6} paschal />
                    <DayPartReading value={item.before1h} valueName={TextType.BEFORE_1h} paschal />
                    <DayPartReading value={item.apolutikaTroparia} valueName={TextType.APOLUTIKA_TROPARIA} paschal />
                    <DayPartReading value={item.panagia} valueName={TextType.PANAGIA} paschal />
                    <DayPartReading value={item.h3} valueName={TextType.H3} paschal />
                    <DayPartReading value={item.h6} valueName={TextType.H6} paschal />
                    <DayPartReading value={item.h9} valueName={TextType.H9} paschal />
                </div>
            </div>
        </div>
    );
};

export default Content;
