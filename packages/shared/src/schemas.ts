import { z } from "zod";

export const providerIdSchema = z.enum(["whoop", "hevy", "myfitnesspal", "csv", "renpho"]);

export const syncRangeSchema = z.object({
  userId: z.string().uuid(),
  startDate: z.string().date(),
  endDate: z.string().date()
});

export const envSchema = z.object({
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  ALLOWED_EMAILS: z.string().min(1),
  INTERNAL_WORKER_SECRET: z.string().min(12),
  APP_USER_ID: z.string().uuid().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  HEVY_API_KEY: z.string().optional(),
  WHOOP_TOTEM_CREDENTIALS_PATH: z.string().optional(),
  MFP_COOKIE_FILE: z.string().optional(),
  SECRETS_ENCRYPTION_KEY: z.string().optional(),
  RENPHO_EMAIL: z.string().email().optional(),
  RENPHO_PASSWORD: z.string().optional(),
  RENPHO_AREA_CODE: z.string().optional()
});

export type AppEnv = z.infer<typeof envSchema>;
