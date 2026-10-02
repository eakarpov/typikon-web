import { Suspense } from "react";
import type { Metadata } from "next";
import { ordoOptions, ordoServices } from "@/lib/ordo";
import { ordoManualPackage } from "@/lib/ordoPackage";
import { myFont } from "@/utils/font";
import Controls from "./Controls";
import Ladder from "@/app/components/ordo/Ladder";
import Steps from "@/app/components/ordo/Steps";

// Служба собирается на каждый запрос: она зависит от десятка параметров разом,
// и кэшировать её по адресу незачем — сборка стоит миллисекунды.
//
// Служба приходит ПАКЕТОМ: тот же сборщик, что и весь сайт (spec/package.md,
// ручная ветка /package — собирает по координатам запроса), а не отдельной
// JSON-выдачей. Тела — internal: это наш собственный конструктор.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Последование службы — Уставные чтения",
    description:
        "Служба, собранная по Типикону: канва, наполненная песнопениями книг, с указанием, " +
        "какое правило поставило сюда каждую единицу.",
};

const Ustav = async ({ searchParams }: { searchParams: Record<string, string | undefined> }) => {
    // СПИСОК КАНВ НУЖЕН ПРЕЖД СБОРКИ: сборка по дате слушает СЛУЖБУ, а
    // выбирают здесь канву, и служба при канве записана только в этом
    // списке. Пока его брали разом со сборкой, выбор службы с заданной
    // датой не действовал вовсе — какую бы канву ни выбрали, приходила
    // вечерня.
    const services = await ordoServices();
    const выбранная = services.find(s => s.ordoId === searchParams.ordo);

    // СЛОИ БЕРЁМ ВСЕХ УСТАВОВ РАЗОМ, а отбирает их форма. Служба умеет отдать
    // и один устав (`ordoOptions(ustav)`), но форме нужны все: при смене
    // устава она обязана СБРОСИТЬ знак, которого у нового нет, — пасхальных
    // знаков у дониконовского не написано, — а для этого надо знать чужие
    // слои прежде, чем на них переключились.
    const [options, pkg] = await Promise.all([
        ordoOptions(),
        ordoManualPackage({
            ustav: searchParams.ustav,
            ordo: searchParams.ordo,
            month: searchParams.month,
            day: searchParams.day,
            sign: searchParams.sign,
            dayVariant: searchParams.day_variant,
            feast: searchParams.feast,
            oktoih: searchParams.oktoih,
            predstoyatel: searchParams.predstoyatel,
            lang: searchParams.lang,
            psalms: searchParams.psalms,
            bezDiakona: searchParams.bez_diakona,
            date: searchParams.date,
            prihod: searchParams.prihod,
            prestol: searchParams.prestol,
            service: выбранная?.service ?? undefined,
        }),
    ]);

    // Службы сборки может не быть на этом сервере — отдельный процесс, не сайт.
    // Говорим об этом прямо, а не показываем пустую страницу. 404 с причиной
    // (нет канвы, нет слоя) показываем той же строкой — конструктору важна
    // причина, а не «не отвечает».
    if (pkg.error || !pkg.data) {
        const why = pkg.error?.replace(/^404:\s*/, "") ?? "служба устава не отвечает";
        return (
            <div className={myFont.variable}>
                <p className="font-serif text-slate-600">
                    Сборка последования не удалась: {why}.
                </p>
            </div>
        );
    }

    const built = pkg.data.services[0];
    // Форма должна показывать то, что ПРИМЕНИЛОСЬ, а не то, что пришло в
    // адресе. Умолчания живут в службе устава (не задан день — берётся её
    // собственный), и без этого select молча показывал бы первый пункт списка:
    // «Повечерие великое» при собранной вечерне вседневной.
    //
    // Берём requested_ordo, а не ordo: список служб — это ВОПРОС, а подмена
    // канвы уставом — ответ, и о ней сказано отдельной строкой ниже.
    const nameOf = (ordoId: string) =>
        services.find(s => s.ordoId === ordoId)?.label ?? ordoId;

    const ctx = built.context ?? {};
    const effective: Record<string, string | undefined> = {
        ...searchParams,
        ustav: searchParams.ustav || pkg.data.manifest?.use?.ustav || undefined,
        ordo: searchParams.ordo || built.requestedOrdo || undefined,
        month: searchParams.month || (ctx.month != null ? String(ctx.month) : undefined),
        day: searchParams.day || (ctx.day != null ? String(ctx.day) : undefined),
        day_variant: searchParams.day_variant || ctx.day_variant || undefined,
        predstoyatel: searchParams.predstoyatel || ctx.predstoyatel || undefined,
        lang: searchParams.lang || ctx.lang || undefined,
    };

    return (
        <div className={myFont.variable}>
            <p className="font-serif mb-3">
                Служба, собранная по Типикону: канва, наполненная песнопениями книг.<br />
                <span className="text-slate-500 text-sm">
                    Устав ещё достраивается — у каждого места видно, какое правило его сложило,
                    и пустые места показаны, а не спрятаны.
                </span>
            </p>

            <Suspense>
                <Controls services={services} options={options} params={effective} />
            </Suspense>

            <div className="flex flex-col gap-1 mb-4 font-serif text-sm">
                {built.memories.map(m => (
                    <div key={m.memoryId} className="text-slate-700">{m.label}</div>
                ))}
                {built.typikonWould && (
                    // Канву выбрали руками, и устав с этим выбором не согласен.
                    // Показываем обе стороны: слушаемся человека, но не прячем,
                    // что положено на этот день.
                    <div className="text-xs text-slate-500">
                        Выбрано вручную. Устав на этот день назначил бы
                        «{nameOf(built.typikonWould)}»
                        {built.feastLabel && ` — ${built.feastLabel}`}
                    </div>
                )}
                {built.switchedFrom && (
                    // Подмену канвы надо ВИДЕТЬ: иначе выдача выглядит ответом
                    // не на тот вопрос, который задали. Называем службы так же,
                    // как они названы в списке, — идентификаторы тут ничего не
                    // объясняют тому, кто их не писал.
                    <div className="text-xs text-slate-500">
                        Канва подменена уставом: спрашивали «{nameOf(built.switchedFrom)}»,
                        собрано «{nameOf(built.ordo ?? "")}»
                        {built.feastLabel && ` — ${built.feastLabel}`}
                    </div>
                )}
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                <div className="lg:w-2/3">
                    <Steps steps={built.steps} />
                </div>
                <aside className="lg:w-1/3 lg:border-l lg:pl-4">
                    <Ladder rules={built.rules} />
                </aside>
            </div>
        </div>
    );
};

export default Ustav;
