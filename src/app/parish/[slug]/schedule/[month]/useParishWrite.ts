'use client';
import {useState} from 'react';
export function useParishWrite(){
    const [pending,setPending]=useState(false),[error,setError]=useState('');
    const run=async(action:()=>Promise<void>)=>{
        if(pending)return;
        setPending(true);setError('');
        try{await action();}catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить изменения.');}finally{setPending(false);}
    };
    return {pending,error,run};
}
