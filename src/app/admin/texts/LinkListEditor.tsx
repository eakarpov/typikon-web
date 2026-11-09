'use client';
import { useId } from "react";
export default function LinkListEditor({ label, values, onChange }: { label: string; values: string[]; onChange: (values: string[]) => void }) {
    const id = useId();
    return <fieldset className="my-2"><legend>{label}</legend><ul className="space-y-2">
        {values.map((value, index) => <li className="flex gap-2" key={index}>
            <label className="sr-only" htmlFor={`${id}-${index}`}>{label} {index + 1}</label>
            <input id={`${id}-${index}`} type="url" className="border-2 flex-1 min-w-0" value={value} onChange={event => onChange(values.map((old, i) => i === index ? event.target.value : old))} />
            <button type="button" onClick={() => onChange(values.filter((_, i) => i !== index))}>Удалить</button>
        </li>)}
    </ul><button type="button" className="underline py-2" onClick={() => onChange([...values, ""])}>Добавить ссылку</button></fieldset>;
}
