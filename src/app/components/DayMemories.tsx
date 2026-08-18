import {SIGN_GLYPHS} from "@/utils/signs";
import {IDayMemories} from "@/lib/signs/dayMemories";

const SignGlyph = ({sign}: {sign: string}) => {
    const glyph = SIGN_GLYPHS[sign];
    if (!glyph) return null;

    return (
        <span className={glyph.color === "red" ? "text-red-600" : "text-black"}>
            {glyph.glyph}
        </span>
    );
};

// Информационный блок памятей дня из месяцеслова Типикона (/admin/signs) — справочно,
// не влияет на состав выдаваемых текстов и недоступен для редактирования отсюда.
const DayMemories = ({memories}: {memories?: IDayMemories | null}) => {
    if (!memories || (!memories.default && memories.secondary.length === 0)) return null;

    return (
        <div className="font-serif flex flex-col space-y-1">
            {memories.default && (
                <p>
                    <SignGlyph sign={memories.default.sign} /> <b>{memories.default.name}</b>
                </p>
            )}
            {memories.secondary.length > 0 && (
                <div className="flex flex-col text-slate-600">
                    {memories.secondary.map((memory) => (
                        <p key={memory.id}>{memory.name}</p>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DayMemories;
