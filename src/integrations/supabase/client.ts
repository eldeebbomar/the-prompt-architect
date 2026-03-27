import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string) ||
  'https://gnovkpjawtodjcgizxsh.supabase.co';

const SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdub3ZrcGphd3RvZGpjZ2l6eHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjAzNjMsImV4cCI6MjA4OTU5NjM2M30.IsjPQGQVzr85_UbzXJptcsUyC951zL5EDzA1c4nNZms';

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error("Missing Supabase configuration. Please set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.");
}

if (!import.meta.env.VITE_SUPABASE_URL) {
  console.warn('[LovPlan] Using fallback Supabase config — env vars not injected at build time.');
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});