import PlanManager from './PlanManager';
export const metadata = { title: 'Личный план чтения', robots: { index: false, follow: false } };
export default function Page() { return <main className="py-4 space-y-4"><h1 className="text-xl font-bold">Личный план чтения</h1><PlanManager /></main>; }
