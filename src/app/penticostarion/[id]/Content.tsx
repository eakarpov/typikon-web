import DayPart from "@/app/components/DayPart";
import {TextType} from "@/utils/texts";
import DayTitle from "@/app/components/DayTitle";
import CountMeta from "@/app/meta/CountMeta";

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
            <h1 className="font-bold">
                {item.name}
            </h1>
            <p className="text-stone-400">
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
                    </ul>
                </div>
                <div className="flex flex-col flex-1 space-y-4">
                    <DayPart value={item.vigil} valueName={TextType.VIGIL} paschal />
                    <DayPart value={item.kathisma1} valueName={TextType.KATHISMA_1} paschal />
                    <DayPart value={item.kathisma2} valueName={TextType.KATHISMA_2} paschal />
                    <DayPart value={item.kathisma3} valueName={TextType.KATHISMA_3} paschal />
                    <DayPart value={item.ipakoi} valueName={TextType.IPAKOI} paschal />
                    <DayPart value={item.polyeleos} valueName={TextType.POLYELEOS} paschal />
                    <DayPart value={item.song3} valueName={TextType.SONG_3} paschal />
                    <DayPart value={item.song6} valueName={TextType.SONG_6} paschal />
                    <DayPart value={item.before1h} valueName={TextType.BEFORE_1h} paschal />
                    <DayPart value={item.apolutikaTroparia} valueName={TextType.APOLUTIKA_TROPARIA} paschal />
                    <DayPart value={item.panagia} valueName={TextType.PANAGIA} paschal />
                </div>
            </div>
        </div>
    );
};

export default Content;
