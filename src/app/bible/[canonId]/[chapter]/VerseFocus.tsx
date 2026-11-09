"use client";
import {useEffect} from 'react';
import {verseSelection} from './verseSelection';
import styles from './VerseFocus.module.css';

export default function VerseFocus({chapterKey}:{chapterKey:string}) {
 useEffect(()=>{
  const root=document.getElementById('bible-chapter');
  if(!root)return;
  const reset=()=>root.querySelectorAll('[data-bible-verse]').forEach(el=>el.classList.remove(styles.highlight));
  const apply=()=>{
   reset();
   const selection=verseSelection(window.location.search,window.location.hash);
   if(!selection)return;
   let first:Element|null=null;
   root.querySelectorAll('[data-bible-verse]').forEach(el=>{
    const number=Number(el.getAttribute('data-bible-verse'));
    if(number>=selection.first&&number<=selection.last){el.classList.add(styles.highlight);first??=el;}
   });
   if(first)(first as Element).scrollIntoView({block:'start',behavior:'auto'});
  };
  const frame=requestAnimationFrame(apply);
  window.addEventListener('hashchange',apply);window.addEventListener('popstate',apply);
  return()=>{cancelAnimationFrame(frame);window.removeEventListener('hashchange',apply);window.removeEventListener('popstate',apply);reset();};
 },[chapterKey]);
 return null;
}
