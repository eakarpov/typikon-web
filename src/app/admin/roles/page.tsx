import { requires } from "@/lib/admin";
import { getGranted } from "./api";
import Content from "./Content";

const Roles = async () => <Content rows={await getGranted()} />;

export default requires("roles.grant", Roles);
