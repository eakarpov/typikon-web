import { handle, options } from "@/lib/study/api";
export const dynamic = "force-dynamic";
export const OPTIONS = options;
export const GET = (req: Request) => handle(req, "personal");
