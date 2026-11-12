"use client";
import ServiceOptions from "./ServiceOptions";
import {detailsInput,chooseService,type ServiceDetails,type ServiceMemory} from "@/lib/parish/serviceDetails";
import {SERVICE_CHOICES,serviceLabel} from "@/lib/parish/dayConfig";
import {PART_LABELS,type Part} from "@/lib/parish/types";
import {parishMutation} from "@/lib/parish/client";
import {useParishWrite} from "./useParishWrite";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Gathering } from "@/lib/parish/types";

// Правка прямо в сетке месяца, а не в отдельной админке.
//
// Ответственный правит расписание, глядя на расписание: час, который он ставит,
// имеет смысл только рядом с соседними часами того же дня. Уводить его на
// отдельный экран значило бы просить держать месяц в голове.

const post = (slug:string,body:unknown)=>parishMutation(`/api/parish/${slug}/edits`,'POST',body);

export interface DayMarks {
    sign: string; dayVariant: string; weekday: string;
    dvunadesyaty: boolean; prestolny: boolean; triod: string | null;
}

export const EditGathering = ({ slug, month, g, choices }: {
    slug: string; month: string; g: Gathering; day?: DayMarks; choices?:ServiceMemory[];
}) => {
    const router = useRouter();
    const {pending,error,run:start}=useParishWrite();
    const [time, setTime] = useState(g.time ?? "");
    const [open, setOpen] = useState(false);
    const [compose,setCompose]=useState(false);
    const [services,setServices]=useState(g.services.map(s=>s.key==='liturgy'||s.key==='vespers'&&s.label.startsWith('Литургия')?(s.label.includes('Василия')?'liturgy-basil':s.label.includes('Преждеосвященных')?'liturgy-presanctified':'liturgy-chrysostom'):s.key));
    const [part,setPart]=useState<Part>(g.part);
    const [details,setDetails]=useState<ServiceDetails>(g.details??{});

    const save = (op: "time" | "title" | "cancel", value: Record<string, string>) =>
        start(async () => {
            await post(slug, {
                month, date: g.civil, part: g.part, gatheringKey: g.key, op, value,
                // ОСНОВАНИЕ ЗАПИСЫВАЕТСЯ ВМЕСТЕ С ПРАВКОЙ: только по нему потом
                // и узнаешь, что устав с тех пор передумал
                baseline: { time: g.time, title: g.title },
            });
            setOpen(false);
            router.refresh();
        });

    if(compose)return <span className="block border rounded p-2 my-2 text-sm whitespace-normal">
        <ServicePicker value={services} onChange={setServices} part={part}/>
        <ServiceOptions services={services} value={details} onChange={setDetails} choices={choices}/>
        <label>Время <input type="time" value={time} onChange={e=>setTime(e.target.value)} /></label>
        <PartPicker value={part} onChange={setPart}/>
        <button type="button" disabled={pending||!services.length} className="underline mr-3" onClick={()=>start(async()=>{await post(slug,{month,date:g.civil,part:g.part,gatheringKey:g.key,op:'compose',value:{services,time,part,details:detailsInput(details)},baseline:{}});setCompose(false);router.refresh();})}>Сохранить состав</button>
        <button type="button" disabled={pending} onClick={()=>setCompose(false)}>Отмена</button>
        {error&&<span role="alert" className="block text-red-800">{error}</span>}
    </span>;
    return (
        <span style={{ marginLeft: ".5rem", fontSize: ".8rem", whiteSpace: "normal" }}>
            {error&&<span role="alert" className="block text-red-800">{error}</span>}
            {open ? (
                <>
                    <input
                        type="time" value={time} onChange={e => setTime(e.target.value)}
                        style={{ border: "1px solid #ccc", padding: "0 .2rem", width: "6rem" }}
                    />
                    <button type="button" disabled={pending}
                            onClick={() => { void save("time", { time }); }}
                            style={{ marginLeft: ".3rem", color: "#1c5a8a" }}>
                        поставить
                    </button>
                    <button type="button" onClick={() => setOpen(false)}
                            style={{ marginLeft: ".3rem", color: "#999" }}>
                        отмена
                    </button>
                </>
            ) : (
                <>
                    <button type="button" onClick={() => setOpen(true)}
                            style={{ color: "#1c5a8a" }}>
                        Изменить время
                    </button>
                    <button type="button" className="ml-2 underline" onClick={()=>setCompose(true)}>Состав служб</button>
                    {!g.cancelled && (
                        <button type="button" disabled={pending}
                                onClick={() => save("cancel", {})}
                                style={{ marginLeft: ".5rem", color: "#8a1c1c" }}>
                            Не служим
                        </button>
                    )}
                    {g.edited&&<a className="ml-2 underline" href={`/parish/${slug}/rules`}>Постоянные настройки</a>}
                </>
            )}
        </span>
    );
};

export const AddGathering = ({ slug, month, date, choices }: {
    slug: string; month: string; date: string;choices?:ServiceMemory[];
}) => {
    const router = useRouter();
    const {pending,error,run:start}=useParishWrite();
    const [open, setOpen] = useState(false);
    const [services,setServices]=useState<string[]>(["moleben"]);
    const [details,setDetails]=useState<ServiceDetails>({});
    const [part,setPart]=useState<Part>("utro");
    const title=services.map(key=>serviceLabel(key,"bez-znaka")).join(". ");
    const [time, setTime] = useState("");

    const save = () => start(async () => {
        await post(slug, {
            month, date, part, op: "add",
            // Собственное собрание от устава не зависит и осиротеть не может:
            // ключ ему даётся свой, по дате и названию
            gatheringKey: `${date}:svoyo:${part}:${crypto.randomUUID()}`,
            value: { time, title, services,details:detailsInput(details) },
            baseline: {},
            note: "добавлено руками",
        });
        setOpen(false);
        router.refresh();
    });

    if (!open) {
        return (
            <button type="button" onClick={() => setOpen(true)}
                    style={{ fontSize: ".78rem", color: "#1c5a8a" }}>
                Добавить богослужение
            </button>
        );
    }
    return (
        <div style={{ fontSize: ".8rem", marginTop: ".2rem" }}>
            {error&&<p role="alert" className="text-red-800">{error}</p>}
            <input type="time" value={time} onChange={e => setTime(e.target.value)}
                   style={{ border: "1px solid #ccc", width: "6rem" }} />
            <PartPicker value={part} onChange={setPart}/>
            <ServicePicker value={services} onChange={setServices} part={part}/>
        <ServiceOptions services={services} value={details} onChange={setDetails} choices={choices}/>
            <button type="button" disabled={pending||!services.length} onClick={save}
                    style={{ marginLeft: ".3rem", color: "#1c5a8a" }}>добавить</button>
            <button type="button" onClick={() => setOpen(false)}
                    style={{ marginLeft: ".3rem", color: "#999" }}>отмена</button>
        </div>
    );
};

export const DropEdit = ({ slug, id }: { slug: string; id: string }) => {
    const router = useRouter();
    const {pending,error,run:start}=useParishWrite();
    return (
        <span>{error&&<span role="alert" className="text-red-800">{error} </span>}<button type="button" disabled={pending} style={{ color: "#8a1c1c" }}
                onClick={() => start(async () => {
                    await parishMutation(`/api/parish/${slug}/edits?id=${encodeURIComponent(id)}`,"DELETE");
                    router.refresh();
                })}>
            вернуть уставное
        </button></span>
    );
};

function PartPicker({value,onChange}:{value:Part;onChange:(value:Part)=>void}){
 return <label className="inline-block m-2">Часть суток <select className="border rounded p-1" value={value} onChange={e=>onChange(e.target.value as Part)}>{Object.entries(PART_LABELS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>;
}
function ServicePicker({value,onChange,part}:{value:string[];onChange:(value:string[])=>void;part:Part}){
 return <fieldset className="grid gap-1 my-2"><legend>Службы (часы можно указать отдельно)</legend>{SERVICE_CHOICES.map(([key,label])=><label key={key} className="flex gap-2 items-baseline"><input type="checkbox" checked={value.includes(key)} onChange={e=>onChange(chooseService(value,key,e.target.checked,part))}/>{label}</label>)}</fieldset>;
}
