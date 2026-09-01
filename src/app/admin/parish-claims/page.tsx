import { requires } from "@/lib/admin";
import { getClaims } from "./api";
import Content from "./Content";

// Просит `parish.claims`, а не «администратора»: модератор приходов сюда
// входит, а правящий книги — нет, и это ровно то, ради чего права разделены.
const ParishClaims = async () => <Content claims={await getClaims()} />;

export default requires("parish.claims", ParishClaims);
