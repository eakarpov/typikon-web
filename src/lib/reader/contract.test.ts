import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv from 'ajv';
import fixtures from '@/data/reader/contract-fixtures.json';
import evidence from '@/data/reader/assertion-fixtures.json';
import spec from '@/data/reader/openapi.json';
import { validate, revision, type Obj } from './core';
import { checkRead, checkPassport, checkHistoricalDate } from './acceptance';

test('all DTO schemas compile; golden wire exchanges, error envelopes and malformed requests',()=>{
    const ajv=new Ajv({allErrors:true,unknownFormats:'ignore',logger:false});ajv.addSchema({$id:'contract',components:spec.components},'contract');
    for(const name of Object.keys(spec.components.schemas))assert.ok(ajv.compile({$ref:'contract#/components/schemas/'+name}));
    for(const item of fixtures.examples){validate(item.responseSchema,item.response);if('requestSchema'in item)validate(String(item.requestSchema),(item as Obj).request);}
    for(const item of fixtures.errorExamples as Obj[])validate(item.schema??'ReaderError',item.value??item.response);
    for(const item of fixtures.invalidSchemaExamples)assert.throws(()=>validate(item.schema,item.value));
});
test('golden read/passport messages obey cross-field and evidence-reference contracts',()=>{
    for(const item of fixtures.examples){if(item.responseSchema==='ReadResponse')checkRead((item.response as Obj).data);if(item.responseSchema==='PassportResponse')checkPassport((item.response as Obj).data,Object.values(fixtures.passportDescriptors).find(d=>d.sourceId===(item.response as Obj).data.sourceId));}
    for(const descriptor of Object.values(fixtures.passportDescriptors)){assert.match(revision('pr1',descriptor),/^pr1_[a-f0-9]{64}$/);}
});
test('four shape-valid negative packets cannot cross body, profile, window or occurrence boundaries',()=>{
    for(const item of fixtures.semanticInvalidExamples){validate(item.schema,item.value);assert.throws(()=>checkRead(item.value.data),item.id);}
});
test('historical dates keep their calendar, precision and uncertainty; invalid chronology is rejected',()=>{
    for(const item of evidence.syntheticFixtures.dateExamples)checkHistoricalDate(item.value);
    const valid={type:'historical_date',kind:'point',calendar:'gregorian',precision:'day',approximate:false,rawLabel:'synthetic',point:{year:1900,month:2,day:28}};
    checkHistoricalDate(valid);assert.throws(()=>checkHistoricalDate({...valid,point:{year:1900,month:2,day:29}}));
    checkHistoricalDate({...valid,calendar:'julian',point:{year:1900,month:2,day:29}});
    assert.throws(()=>checkHistoricalDate({...valid,point:{year:1900}}));assert.throws(()=>checkHistoricalDate({...valid,point:{year:0,month:1,day:1}}));
});
