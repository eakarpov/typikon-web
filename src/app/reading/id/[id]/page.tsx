import Route from "../../[id]/Route";
export { generateMetadata } from "../../[id]/Route";
export default function Page(props: { params: { id: string }; searchParams: Record<string, string | string[] | undefined> }) {
    return <Route {...props} idRoute />;
}
