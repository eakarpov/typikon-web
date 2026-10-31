import CollectionManager from './CollectionManager';
export const metadata = { title: 'Мои подборки чтений', robots: { index: false, follow: false } };
export default function Page() { return <main className="py-4 space-y-4"><h1 className="text-xl font-bold">Мои подборки чтений</h1><CollectionManager /></main>; }
