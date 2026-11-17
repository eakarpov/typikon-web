import { viewer } from '@/lib/rights-server';
import { requires } from "@/lib/admin";
import { getClaims } from "./api";
import Content from "./Content";

// Просит `commemoration.claims`: заявка эта о сане, а не о храме и не о книгах,
// и разбирающий её — не модератор приходов и не правящий содержимое.
const Commemorators = async () => {
    const { caps } = await viewer();
    return <Content claims={await getClaims()} canGrant={caps.has('commemoration.grant')} />;
};

export default requires("commemoration.claims", Commemorators);
