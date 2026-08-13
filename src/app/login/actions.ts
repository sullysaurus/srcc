"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { hasSupabaseEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const signInSchema = z.object({ email: z.string().trim().email(), password: z.string().min(8).max(200) });

export async function signIn(formData: FormData) {
  if (!hasSupabaseEnv) redirect("/login?error=configure_supabase");
  const parsed = signInSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) redirect("/login?error=invalid_credentials");
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) redirect("/login?error=invalid_credentials");
  redirect("/");
}
