#!/usr/bin/env node
// Deletes expired session rows. Run manually now and then, or wire to a
// scheduled job (Vercel Cron hitting a protected route, or pg_cron) later.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
const { error } = await supabase.rpc("purge_expired_sessions");
if (error) {
  console.error("Failed:", error.message);
  process.exit(1);
}
console.log("Expired sessions purged.");
