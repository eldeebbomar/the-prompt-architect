import type { Json } from "@/integrations/supabase/types";

/* ──────── Database Models ──────── */

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  credits: number;
  plan: string;
  revision_limit: number;
  stripe_customer_id: string | null;
  total_credits_purchased: number;
  payment_failed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: string;
  metadata: Json;
  spec_data: Json;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  project_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  phase: string;
  metadata: Json;
  created_at: string;
}

export interface GeneratedPrompt {
  id: string;
  project_id: string;
  sequence_order: number;
  category: string;
  title: string;
  purpose: string;
  prompt_text: string;
  depends_on: number[];
  is_loop: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: string;
  description: string;
  project_id: string | null;
  stripe_payment_id: string | null;
  created_at: string;
}

/* ──────── Webhook Request/Response Shapes ──────── */

export interface DiscoveryWebhookRequest {
  project_id: string;
  message: string;
}

export interface DiscoveryWebhookResponse {
  reply: string;
  phase: string;
  is_complete: boolean;
  spec_data?: Record<string, string | number | boolean | null>;
}

export interface GeneratePromptsRequest {
  project_id: string;
}

export interface GeneratePromptsResponse {
  success: boolean;
  prompt_count: number;
  prompts: Array<{
    category: string;
    sequence_order: number;
    title: string;
    purpose: string;
    prompt_text: string;
    depends_on: number[];
    is_loop: boolean;
  }>;
}

export interface RevisePromptsRequest {
  project_id: string;
  revision_request: string;
  user_id: string;
}

export interface RevisePromptsResponse {
  reply: string;
  changed_prompts: Array<{
    id: string;
    sequence_order: number;
    title: string;
    old_title: string;
    changes_summary: string;
  }>;
  new_prompts: Array<{
    category: string;
    sequence_order: number;
    title: string;
    purpose: string;
    prompt_text: string;
    depends_on: number[];
    is_loop: boolean;
  }>;
  deleted_prompt_ids: string[];
  success: boolean;
}

export interface LoopPromptsRequest {
  project_id: string;
  user_id: string;
}

export interface LoopPromptsResponse {
  success: boolean;
  loop_prompts: Array<{
    title: string;
    purpose: string;
    prompt_text: string;
    category: string;
    repeat_count: number;
  }>;
}

export interface CheckoutRequest {
  price_type: "single" | "pack" | "unlimited";
}

export interface CheckoutResponse {
  url: string;
}

/* ──────── Credit Stats ──────── */

export interface CreditStats {
  credits_remaining: number;
  total_purchased: number;
  total_used: number;
  plan: string;
}
