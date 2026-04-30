import { z } from "zod";

export const ConditionResultSchema = z.object({
  condition: z.string(),
  success: z.boolean(),
});
export type ConditionResult = z.infer<typeof ConditionResultSchema>;

export const EndpointResultSchema = z.object({
  status: z.number().int().nonnegative().optional(),
  hostname: z.string().optional(),
  duration: z.number().int().nonnegative(),
  errors: z.array(z.string()).default([]),
  conditionResults: z.array(ConditionResultSchema).default([]),
  success: z.boolean(),
  timestamp: z.string().datetime({ offset: true }),
});
export type EndpointResult = z.infer<typeof EndpointResultSchema>;

export const EndpointEventSchema = z.object({
  type: z.enum(["START", "HEALTHY", "UNHEALTHY"]),
  timestamp: z.string().datetime({ offset: true }),
});
export type EndpointEvent = z.infer<typeof EndpointEventSchema>;

export const EndpointStatusSchema = z.object({
  name: z.string().min(1),
  group: z.string().optional(),
  key: z.string().min(1),
  results: z.array(EndpointResultSchema).default([]),
  events: z.array(EndpointEventSchema).default([]),
});
export type EndpointStatus = z.infer<typeof EndpointStatusSchema>;

export const EndpointStatusesSchema = z.array(EndpointStatusSchema);
export type EndpointStatuses = z.infer<typeof EndpointStatusesSchema>;
