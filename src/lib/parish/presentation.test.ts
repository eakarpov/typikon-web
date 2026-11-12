import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const bundlePromise=build({stdin:{contents:`
const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
const {EditGathering}=require('./src/app/parish/[slug]/schedule/[month]/Edit.tsx');
const {Rules}=require('./src/app/parish/[slug]/rules/Rules.tsx');
const ServiceOptions=require('./src/app/parish/[slug]/schedule/[month]/ServiceOptions.tsx').default;
const MorningLiturgies=require('./src/app/parish/[slug]/schedule/[month]/MorningLiturgies.tsx').default;
const DayTitle=require('./src/app/parish/[slug]/schedule/DayTitle.tsx').default;
const {defaultPractice}=require('./src/lib/parish/practice.ts');
exports.editor=(cancelled)=>renderToStaticMarkup(React.createElement(EditGathering,{slug:'test',month:'2026-11',g:{key:'g',civil:'2026-11-15',part:'vecher',time:'17:00',title:'Вечерня',services:[{key:'vespers',label:'Вечерня'}],cancelled}}));
exports.rules=(count)=>{const practice=defaultPractice('RU');practice.liturgies.sunday=count;return renderToStaticMarkup(React.createElement(Rules,{slug:'test',practice,timezone:'Europe/Moscow',zones:['Europe/Moscow'],calendarAvailable:true}));};
exports.options=()=>renderToStaticMarkup(React.createElement(ServiceOptions,{services:['moleben','compline'],value:{moleben:{memories:Array.from({length:4},(_,i)=>({memoryId:String(i),label:'Святой '+i})),akathist:true},compline:{memories:[]}},onChange(){}}));
exports.morning=()=>renderToStaticMarkup(React.createElement(MorningLiturgies,{slug:'test',period:'2026-11',day:{date:'2026-11-15',dayConfig:{memories:[],sign:null,morningService:'typica'}}}));
exports.title=(sign)=>renderToStaticMarkup(React.createElement(DayTitle,{day:{sign,date:'2026-11-13',label:'Полиелей, седмичный день',triodLabel:null,memories:[{memoryId:'a',label:'Святой'}]}}));
`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'cjs',write:false,external:['react','react-dom/server'],jsx:'automatic',plugins:[{name:'router',setup(b){b.onResolve({filter:/^next\/navigation$/},()=>({path:'router',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'exports.useRouter=()=>({refresh(){}});'}));}}]});

async function views(){const bundle=await bundlePromise,holder={exports:{}};new Function('require','module','exports',bundle.outputFiles![0].text)(require,holder,holder.exports);return holder.exports as {rules:(n:number)=>string;title:(sign:string)=>string;options:()=>string;morning:()=>string;editor:(cancelled:boolean)=>string};}
test('форма показывает нужные утренние варианты и только одну вечернюю службу',async()=>{
 const ui=await views();
 const one=ui.rules(1),two=ui.rules(2),three=ui.rules(3);
 assert.doesNotMatch(one,/aria-label="Воскресенье — ранняя/);assert.doesNotMatch(one,/aria-label="Воскресенье — поздняя/);
 assert.match(two,/aria-label="Воскресенье — ранняя — утро"/);assert.match(two,/aria-label="Воскресенье — поздняя — вечер"/);assert.doesNotMatch(two,/aria-label="Воскресенье — обычная/);
 assert.match(three,/aria-label="Воскресенье — поздняя — утро"/);assert.match(three,/aria-label="Воскресенье — средняя — утро"/);assert.doesNotMatch(three,/aria-label="Воскресенье — (ранняя|поздняя) — вечер"/);
 assert.match(one,/>Время</);assert.match(one,/>Состав</);assert.doesNotMatch(one,/Пасха|Страстная|Двенадцать Евангелий/);
});
test('знак после имени: киноварь для славословия и чёрный для шестеричной, без текстового варианта дня',async()=>{
 const ui=await views(),red=ui.title('slavoslovie'),black=ui.title('shesterichnaya');
 assert.match(red,/Святой<span/);assert.match(red,/#b21f1f/);assert.match(black,/#000/);assert.match(red,/🕃/);assert.doesNotMatch(red,/седмичный|Полиелей|воскресный/);
});

test('параметры службы содержат отдельные лимиты памятей, акафист и вариант изобразительных',async()=>{
 const ui=await views(),options=ui.options(),morning=ui.morning();
 assert.match(options,/до 4 памятей \(4\/4\)/);assert.match(options,/до 2 памятей \(0\/2\)/);assert.match(options,/Молебен с акафистом/);
 assert.match(morning,/<option value="typica" selected="">Изобразительны/);assert.doesNotMatch(morning,/Литургий утром/);
});

test('редактор предлагает возврат отменённой службы вместо повторной отмены',async()=>{
 const ui=await views(),cancelled=ui.editor(true),active=ui.editor(false);
 assert.match(cancelled,/>Вернуть богослужение<\/button>/);assert.doesNotMatch(cancelled,/>Не служим<\/button>/);
 assert.doesNotMatch(active,/>Вернуть богослужение<\/button>/);assert.match(active,/>Не служим<\/button>/);
});
