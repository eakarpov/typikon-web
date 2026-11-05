import {createHash} from 'node:crypto';
import type {Run,SourceEntry,SourceExample} from './types';

// These source layouts mark a quotation and place a chapter/verse citation next to it.
// Italics or church-coloured text alone are not evidence of an example.
const reference = (text:string):string|null => {
    const value=text.replace(/\s+/gu,' ').trim();
    return /^(?:[1-4]\s*)?[А-Яа-яЁёѣіѳ]{1,24}\.?\s+\d{1,3}\s*[:,]\s*\d{1,3}(?:\s*[-–]\s*\d{1,3})?\.?$/u.test(value)?value:null;
};

export function sourceExamples(source:SourceEntry):SourceExample[]{
    const kind=source.sourceCode==='Св'?'emphasis':'church';
    if(!['ГлтНЗ','Св','Дч*','Дч'].includes(source.sourceCode))return [];
    const found=new Map<string,SourceExample>();
    for(const paragraph of source.paragraphs){
        const runs=paragraph.runs;
        for(let i=0;i<runs.length;i++){
            if(runs[i].kind!==kind)continue;
            let end=i,quote=runs[i].text;
            while(end+1<runs.length){
                if(runs[end+1].kind===kind){quote+=runs[++end].text;continue;}
                if(/^[\s\[\],;:.!?…—–]*$/u.test(runs[end+1].text)&&runs[end+2]?.kind===kind){quote+=runs[end+1].text+runs[end+2].text;end+=2;continue;}
                break;
            }
            let citation:string|null=null;
            if(source.sourceCode==='ГлтНЗ'){
                let before=i-1;
                while(before>=0&&/^[\s:;,]*$/u.test(runs[before].text))before--;
                if(before>=0&&runs[before].kind==='emphasis')citation=reference(runs[before].text);
            }else{
                // A parenthesized citation must immediately follow this quotation.
                const tail=runs.slice(end+1).map((r:Run)=>r.text).join('');
                const match=/^\s*\(([^()]*)\)/u.exec(tail);
                if(match)citation=reference(match[1]);
            }
            i=end;
            quote=quote.trim();
            if(!citation||!/[А-Яа-яЁёѠ-ӿꙀ-ꚟ]/u.test(quote))continue;
            const anchors=source.anchors.filter(a=>a.status==='source-numbered'&&a.text.includes(quote));
            const id=createHash('sha256').update([source.id,'example',quote,citation].join('\0')).digest('hex');
            found.set(id,{id,quote,citation,sourceId:source.id,sourceTitle:source.title,sourceVersion:source.version,anchorId:anchors.length===1?anchors[0].id:null,script:kind==='church'?'church':'source',basis:'styled-citation'});
        }
    }
    return [...found.values()];
}
