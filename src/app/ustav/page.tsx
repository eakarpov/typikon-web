import { Suspense } from "react";
import type { Metadata } from "next";
import { buildOrdo, ordoOptions, ordoServices } from "@/lib/ordo";
import { myFont } from "@/utils/font";
import Controls from "./Controls";
import Ladder from "./Ladder";
import Steps from "./Steps";

// Служба собирается на каждый запрос: она зависит от десятка параметров разом,
// и кэшировать её по адресу незачем — сборка стоит миллисекунды.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Последование службы — Уставные чтения",
    description:
        "Служба, собранная по Типикону: канва, наполненная песнопениями книг, с указанием, " +
        "какое правило поставило сюда каждую единицу.",
};

const Ustav = async ({ searchParams }: { searchParams: Record<string, string | undefined> }) => {
    const [services, options, result] = await Promise.all([
        ordoServices(),
        ordoOptions(),
        buildOrdo({
            ordo: searchParams.ordo,
            month: searchParams.month,
            day: searchParams.day,
            sign: searchParams.sign,
            dayVariant: searchParams.day_variant,
            feast: searchParams.feast,
            oktoih: searchParams.oktoih,
            predstoyatel: searchParams.predstoyatel,
            lang: searchParams.lang,
            view: searchParams.view,
            psalms: searchParams.psalms,
            bezDiakona: searchParams.bez_diakona,
            date: searchParams.date,
            prihod: searchParams.prihod,
            prestol: searchParams.prestol,
        }),
    ]);

    // Службы сборки может не быть на этом сервере — отдельный процесс, не сайт.
    // Говорим об этом прямо, а не показываем пустую страницу.
    if (!result) {
        return (
            <div className={myFont.variable}>
                <p className="font-serif text-slate-600">
                    Сборка последования сейчас недоступна: служба устава не отвечает.
                </p>
            </div>
        );
    }

    // Форма должна показывать то, что ПРИМЕНИЛОСЬ, а не то, что пришло в
    // адресе. Умолчания живут в службе устава (не задан день — берётся её
    // собственный), и без этого select молча показывал бы первый пункт списка:
    // «Повечерие великое» при собранной вечерне вседневной.
    //
    // Берём requested_ordo, а не ordo: список служб — это ВОПРОС, а подмена
    // канвы уставом — ответ, и о ней сказано отдельной строкой ниже.
    const nameOf = (ordoId: string) =>
        services.find(s => s.ordoId === ordoId)?.label ?? ordoId;

    const ctx = result.context;
    const effective: Record<string, string | undefined> = {
        ...searchParams,
        ordo: searchParams.ordo || result.requestedOrdo,
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
                {result.memories.map(m => (
                    <div key={m.memoryId} className="text-slate-700">{m.label}</div>
                ))}
                {result.typikonWould && (
                    // Канву выбрали руками, и устав с этим выбором не согласен.
                    // Показываем обе стороны: слушаемся человека, но не прячем,
                    // что положено на этот день.
                    <div className="text-xs text-slate-500">
                        Выбрано вручную. Устав на этот день назначил бы
                        «{nameOf(result.typikonWould)}»
                        {result.feastLabel && ` — ${result.feastLabel}`}
                    </div>
                )}
                {result.switchedFrom && (
                    // Подмену канвы надо ВИДЕТЬ: иначе выдача выглядит ответом
                    // не на тот вопрос, который задали. Называем службы так же,
                    // как они названы в списке, — идентификаторы тут ничего не
                    // объясняют тому, кто их не писал.
                    <div className="text-xs text-slate-500">
                        Канва подменена уставом: спрашивали «{nameOf(result.switchedFrom)}»,
                        собрано «{nameOf(result.ordo)}»
                        {result.feastLabel && ` — ${result.feastLabel}`}
                    </div>
                )}
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                <div className="lg:w-2/3">
                    <Steps steps={result.steps} />
                </div>
                <aside className="lg:w-1/3 lg:border-l lg:pl-4">
                    <Ladder rules={result.rules} />
                </aside>
            </div>
        </div>
    );
};

export default Ustav;
