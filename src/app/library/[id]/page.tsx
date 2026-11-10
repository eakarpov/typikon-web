import Route from "./Route";
export { generateMetadata } from "./Route";
// Canonical redirects preserve query parameters and must run per request.
// Content queries remain cached in api.ts.
export const dynamic = "force-dynamic";
export default function Page(props: { params: { id: string }; searchParams: Record<string, string | string[] | undefined> }) {
    return <Route {...props} />;
}
