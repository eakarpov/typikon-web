import SavedCollections from './SavedCollections';
export const metadata = { title: 'Сохранённые подборки', robots: { index: false, follow: false } };
export default function Page() { return <main className="py-4 space-y-4 max-w-3xl"><h1 className="text-xl font-bold">Сохранённые подборки</h1><SavedCollections /></main>; }
