#!/usr/bin/env node
// Creates (or updates) a user directly in Postgres. Needed because there is
// no Supabase Auth dashboard anymore — this project uses a custom
// username/password system. Use this to create your first admin, and any
// time you need to create a user before the Admin → Users screen exists
// (Phase 2).
//
// Usage:
//   npm run create-user -- --username admin --password 'Str0ngPass!' --fullname "System Admin" --role admin
//
// Requires .env.local to contain NEXT_PUBLIC_SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY (run with `node --env-file=.env.local`, which
// `npm run create-user` already does).

import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import readline from "node:readline/promises";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
      out[key] = value;
    }
  }
  return out;
}

async function promptHidden(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    console.error("Make sure .env.local exists and is filled in (see .env.example).");
    process.exit(1);
  }

  const username = args.username ?? (await promptHidden("Username: "));
  const password = args.password ?? (await promptHidden("Password: "));
  const fullname = args.fullname ?? (await promptHidden("Full name: "));
  const role = args.role ?? "technician";

  if (!["admin", "engineer", "technician"].includes(role)) {
    console.error(`Invalid role "${role}". Must be admin, engineer, or technician.`);
    process.exit(1);
  }
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
    console.error("Username must be 3-32 characters: letters, numbers, underscore, dot, or hyphen only.");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const passwordHash = await bcrypt.hash(password, 12);

  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .ilike("username", username)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("users")
      .update({ password_hash: passwordHash, full_name: fullname, role, is_active: true })
      .eq("id", existing.id);
    if (error) {
      console.error("Failed to update existing user:", error.message);
      process.exit(1);
    }
    console.log(`Updated existing user "${username}" (role: ${role}).`);
    return;
  }

  const { error } = await supabase
    .from("users")
    .insert({ username, password_hash: passwordHash, full_name: fullname, role });

  if (error) {
    console.error("Failed to create user:", error.message);
    process.exit(1);
  }
  console.log(`Created user "${username}" (role: ${role}).`);
}

main();
