import{z}from"zod";
export const proposalViewSchema=z.object({event:z.literal("proposal_viewed"),event_id:z.string().min(1),provider:z.string().min(1).max(80),proposal_id:z.string().min(1),project_id:z.string().min(1),occurred_at:z.string().datetime()}).strict();
