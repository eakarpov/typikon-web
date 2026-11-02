import {Suspense} from 'react';
import Client from './Client';
export const metadata={title:'Спутник богослужения'};
export default function Page(){return <Suspense fallback={<p>Открываю Спутник…</p>}><Client/></Suspense>;}
