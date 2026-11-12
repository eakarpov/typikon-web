'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {UserCircleIcon} from '@heroicons/react/20/solid';
import NavPopover from './NavPopover';
const items=[{href:'/profile',label:'Профиль'},{href:'/pomyannik',label:'Помянник'},{href:'/segodnya',label:'Сегодня для меня'}];
export default function ProfileMenu(){
    const pathname=usePathname();
    const active=items.some(item=>pathname===item.href||pathname?.startsWith(item.href+'/'));
    return <NavPopover title="Профиль" active={active} trigger={<UserCircleIcon aria-hidden="true" className="w-4 h-4"/>} className={`cursor-pointer min-w-fit flex items-center ${active?'text-red-600':''}`}>
        {close=>items.map(item=><Link key={item.href} href={item.href} onClick={close} className={`font-serif px-3 py-2 hover:bg-amber-50 ${pathname===item.href||pathname?.startsWith(item.href+'/')?'text-red-600':''}`}>{item.label}</Link>)}
    </NavPopover>;
}
