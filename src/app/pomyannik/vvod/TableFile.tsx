'use client';
import { useMemo, useState } from "react";
import { MAX_BATCH, type PersonKind } from "@/lib/pomyannik/types";
import type { ImportedName } from "@/lib/pomyannik/importRows";
import type { ImportSheet, TableOptions } from "@/lib/pomyannik/tableImport";
type TableReader = typeof import("@/lib/pomyannik/tableImport");
const FIELD = "border rounded px-2 py-1 bg-white text-sm max-w-full min-w-0";
const BUTTON = "border rounded px-3 py-2 bg-slate-50 hover:bg-slate-100 text-sm disabled:opacity-50";
export default function TableFile({ onPreview, disabled, kind, onKindChange }: { kind: PersonKind; onKindChange: (kind: PersonKind) => void; onPreview: (names: ImportedName[], source: string) => Promise<void>; disabled: boolean }) {
    const [reader, setReader] = useState<TableReader | null>(null);
    const [source, setSource] = useState<{ bytes: ArrayBuffer; name: string } | null>(null);
    const [sheetNames, setSheetNames] = useState<string[]>([]);
    const [sheetName, setSheetName] = useState("");
    const [sheet, setSheet] = useState<ImportSheet | null>(null);
    const [options, setOptions] = useState<TableOptions>({ encoding: "auto", separator: "auto" });
    const [column, setColumn] = useState("A");
    const [start, setStart] = useState("1");
    const [end, setEnd] = useState("1");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const lock = busy || disabled;
    const displaySheet = (tableReader: TableReader, loaded: ImportSheet) => {
        const selection = tableReader.defaultImportSelection(loaded);
        setSheet(loaded); setColumn(selection.column); setStart(String(selection.start)); setEnd(String(selection.end));
    };
    const open = async (file?: File) => {
        setError(""); setSheet(null); setSource(null); setSheetNames([]);
        if (!file) return;
        setBusy(true);
        try {
            if (file.size > 5 * 1024 * 1024) throw new Error("Файл больше 5 МБ.");
            if (!/\.(xlsx|xls|csv|tsv|txt)$/i.test(file.name)) throw new Error("Выберите файл XLSX, XLS, CSV, TSV или TXT.");
            const bytes = await file.arrayBuffer();
            const tableReader = await import("@/lib/pomyannik/tableImport");
            const names = tableReader.importSheetNames(bytes, file.name);
            setReader(tableReader); setSource({ bytes, name: file.name }); setSheetNames(names); setSheetName(names[0]);
            const defaults: TableOptions = { encoding: "auto", separator: "auto" };
            setOptions(defaults);
            displaySheet(tableReader, tableReader.readImportSheet(bytes, file.name, names[0], defaults));
        } catch (e) { setError(e instanceof Error ? `Не удалось открыть файл: ${e.message}` : "Не удалось открыть файл."); }
        finally { setBusy(false); }
    };
    const reload = async (name: string, next: TableOptions) => {
        if (!source || !reader) return;
        setBusy(true); setError(""); setSheet(null); setSheetName(name); setOptions(next);
        // Даём браузеру показать индикатор перед локальным разбором выбранного листа.
        await new Promise(resolve => setTimeout(resolve, 0));
        try { displaySheet(reader, reader.readImportSheet(source.bytes, source.name, name, next)); }
        catch (e) { setError(e instanceof Error ? `Не удалось прочитать лист: ${e.message}` : "Не удалось прочитать лист."); }
        finally { setBusy(false); }
    };
    const selection = useMemo(() => {
        if (!sheet || !reader) return null;
        try { return { result: reader.selectImportNames(sheet, column, Number(start), Number(end)), error: "" }; }
        catch (e) { return { result: null, error: e instanceof Error ? e.message : "Проверьте диапазон." }; }
    }, [sheet, reader, column, start, end]);
    const plain = source && /\.(csv|tsv|txt)$/i.test(source.name);
    return <section className="border rounded p-3 flex flex-col gap-3 font-serif text-sm" aria-labelledby="file-import-title">
        <h2 id="file-import-title" className="font-bold">Загрузить имена из файла</h2>
        <label className="flex flex-col gap-1">Файл Excel, CSV или текстовый список
            <input type="file" accept=".xls,.xlsx,.csv,.tsv,.txt" disabled={lock}
                onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; void open(file); }} />
        </label>
        <label className="flex flex-col gap-1 self-start max-w-full">Все выбранные имена — в раздел
            <select className={FIELD} value={kind} disabled={lock} onChange={e => onKindChange(e.target.value as PersonKind)}>
                <option value="living">О здравии</option><option value="departed">О упокоении</option>
            </select>
        </label>
        <p className="text-slate-600">Выберите один столбец с именами и диапазон строк: одно имя кириллицей в ячейке, без фамилии и помет. Из TXT берётся одна строка на имя. Другие столбцы не импортируются.</p>
        {source && <p className="break-words">Файл: {source.name}</p>}
        {source && <fieldset disabled={lock} className="flex flex-wrap gap-3 min-w-0">
            {sheetNames.length > 1 && <label className="flex flex-col gap-1 max-w-full">Лист
                <select className={FIELD} value={sheetName} onChange={e => reload(e.target.value, options)}>{sheetNames.map(name => <option key={name} value={name}>{name}</option>)}</select>
            </label>}
            {plain && <label className="flex flex-col gap-1">Кодировка
                <select className={FIELD} value={options.encoding} onChange={e => reload(sheetName, { ...options, encoding: e.target.value as TableOptions["encoding"] })}>
                    <option value="auto">Определить автоматически</option><option value="utf-8">UTF-8</option><option value="windows-1251">Windows-1251</option>
                </select>
            </label>}
            {source.name.toLowerCase().endsWith('.csv') && <label className="flex flex-col gap-1">Разделитель CSV
                <select className={FIELD} value={options.separator} onChange={e => reload(sheetName, { ...options, separator: e.target.value as TableOptions["separator"] })}>
                    <option value="auto">Определить автоматически</option><option value=";">Точка с запятой</option><option value=",">Запятая</option><option value={'\t'}>Табуляция</option>
                </select>
            </label>}
        </fieldset>}
        {sheet && <>
            <fieldset disabled={lock} className="flex flex-wrap gap-3 min-w-0">
                <label className="flex flex-col gap-1 max-w-full">Столбец имён
                    <select className={FIELD} value={column} onChange={e => setColumn(e.target.value)}>
                        {(sheet.columns.length ? sheet.columns : ['A']).map(col => <option key={col} value={col}>{col} — {(sheet.cells[`${col}${sheet.firstRow}`] ?? '').slice(0, 40)}</option>)}
                    </select>
                </label>
                <label className="flex flex-col gap-1">Со строки<input className={`${FIELD} w-28`} type="number" min={1} max={10000} value={start} onChange={e => setStart(e.target.value)} /></label>
                <label className="flex flex-col gap-1">По строку включительно<input className={`${FIELD} w-28`} type="number" min={1} max={10000} value={end} onChange={e => setEnd(e.target.value)} /></label>
            </fieldset>
            <p>Диапазон: <strong>{column}{start}:{column}{end}</strong>. За один раз — до {MAX_BATCH} имён. Заголовок столбца исключите начальной строкой.</p>
            {sheet.clipped && <p className="text-amber-800">Для выбора доступны первые 10 000 строк листа. Имена за этим пределом не загружены.</p>}
            {selection?.error && <p role="alert" className="text-amber-800">{selection.error}</p>}
            {selection?.result && <>
                <p>Выбрано имён: {selection.result.names.length}. Пустых ячеек пропущено: {selection.result.blank}. Ячеек без букв пропущено: {selection.result.nonNames}.</p>
                <div className="overflow-auto max-h-64"><table className="border-collapse w-full text-left">
                    <caption className="text-left text-slate-500">Первые 10 выбранных имён</caption>
                    <thead><tr className="border-b"><th className="p-1">Ячейка</th><th className="p-1">Имя</th></tr></thead>
                    <tbody>{selection.result.names.slice(0, 10).map(entry => <tr key={entry.row} className="border-b"><td className="p-1">{column}{entry.row}</td><td className="p-1 break-words">{entry.name}</td></tr>)}</tbody>
                </table></div>
                <button type="button" className={`${BUTTON} self-start`} disabled={lock} onClick={() => onPreview(selection.result!.names, `${source?.name} · ${sheet.name} · ${column}${start}:${column}${end}`)}>Проверить выбранные имена</button>
            </>}
        </>}
        {busy && <p role="status">Читаем файл…</p>}
        {error && <p role="alert" className="text-amber-800">{error}</p>}
        <p className="text-xs text-slate-500">Файл разбирается на вашем устройстве. На сервер отправятся только выбранные имена после нажатия «Проверить». Запись в помянник — отдельным действием после предпросмотра.</p>
    </section>;
}
