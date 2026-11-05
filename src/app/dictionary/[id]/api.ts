import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { reportError } from "@/lib/reportError";
import { buildLegacyView, type LexemeView, type DictionaryRecord } from "@/lib/csDictionary/legacyView";
export type { Form, ParticipleView, LexemeView } from "@/lib/csDictionary/legacyView";
export const getItem = async (id: string): Promise<[LexemeView | null, unknown]> => {
 try {
  const client=await clientPromise;
  const lexeme=await client.db("typikon-csl").collection("lexems").findOne({_id:new ObjectId(id)});
  return [lexeme?buildLegacyView(lexeme as DictionaryRecord,id):null,null];
 } catch(error) {reportError(error,{where:"app/dictionary/[id]/api#getItem"});return [null,error];}
};
