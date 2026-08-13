import { env } from "@/lib/env";
export function isAuthorizedCron(request:Request){return Boolean(env.CRON_SECRET)&&request.headers.get("authorization")===`Bearer ${env.CRON_SECRET}`}
