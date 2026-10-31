'use client';
import {useRef,useState} from 'react';
import {ReadingToolbar,useReadingFocus} from './ReadingFocus';
import {DAY_SLOT_ORDER, TextType} from "@/utils/texts";
import DayTitle from "@/app/components/DayTitle";
import DayPartReading from "@/app/components/DayPartReading";

// Порядок слотов живёт в @/utils/texts — им же пользуется публичное API.
const DAY_FIELDS = DAY_SLOT_ORDER;

const DayFullContent = ({ item, paschal }: { item: any; paschal?: boolean }) => {
    const mode=useReadingFocus();
    const [current,setCurrent]=useState(0);
    const heading=useRef<HTMLHeadingElement>(null);
    if (!item) return null;
    const steps=DAY_FIELDS.flatMap(field=>(item[field]?.items??[]).map((reading:any,index:number)=>({field,reading,index})));
    const selected=steps[Math.min(current,Math.max(0,steps.length-1))];
    const move=(next:number)=>{setCurrent(next);heading.current?.focus();heading.current?.scrollIntoView({block:'start'})};
    if(mode.focus&&selected)return <div className="reading-column w-full min-w-0 py-2">
        <ReadingToolbar mode={mode}/>
        <h2 tabIndex={-1} ref={heading} className="font-bold py-2">Чтение {current+1} из {steps.length}</h2>
        <DayPartReading value={{...item[selected.field],items:[selected.reading]}} valueName={selected.field} paschal={paschal}/>
        <nav data-reading-nav aria-label="Переход между чтениями дня" className="flex gap-3 flex-wrap py-4">
            <button className="min-h-11 border rounded p-3 disabled:opacity-50" disabled={current===0} onClick={()=>move(current-1)}>← Предыдущее чтение</button>
            <button className="min-h-11 border rounded p-3 disabled:opacity-50" disabled={current>=steps.length-1} onClick={()=>move(current+1)}>Следующее чтение →</button>
        </nav>
    </div>;

    return (
        <div className="reading-column w-full min-w-0"><ReadingToolbar mode={mode}/><div className="flex flex-col pt-2 md:flex-row">
            <div className="w-full md:w-1/4 md:shrink-0 md:pr-4">
                <ul className="space-y-2">
                    {DAY_FIELDS.map((field) => (
                        <DayTitle key={field} value={item[field]} valueName={field} />
                    ))}
                </ul>
            </div>
            <div className="flex min-w-0 flex-col flex-1 space-y-4">
                {DAY_FIELDS.map((field) => (
                    <DayPartReading key={field} value={item[field]} valueName={field} paschal={paschal} />
                ))}
            </div>
        </div></div>
    );
};

export default DayFullContent;
