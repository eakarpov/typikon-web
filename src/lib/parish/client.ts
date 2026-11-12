/** Общая проверка записи: интерфейс закрывает форму только после подтверждения сервера. */
export async function parishMutation(path:string,method:'POST'|'DELETE',body?:unknown,request:typeof fetch=fetch):Promise<void>{
    const response=await request(path,{method,...(body!==undefined?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
    if(!response.ok){const value=await response.json().catch(()=>null);throw new Error(typeof value?.error==='string'?value.error:'Не удалось сохранить изменения. Попробуйте ещё раз.');}
}
