import Route from "./Route";
export { generateMetadata } from "./Route";
export default function Page(props: { params: { id: string }; searchParams: Record<string, string | string[] | undefined> }) {
    return <Route {...props} />;
}
