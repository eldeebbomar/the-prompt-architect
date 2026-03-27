import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

/**
 * Team management for projects.
 *
 * POST { action: "invite", project_id, email, role? }
 *   → { invite: { token, ... } }
 *
 * POST { action: "remove", project_id, member_id }
 *   → { success: true }
 *
 * POST { action: "accept", token }
 *   → { project_id }
 *
 * POST { action: "list", project_id }
 *   → { members: [...], invites: [...] }
 */

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401, corsHeaders);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return json({ error: "Unauthorized" }, 401, corsHeaders);
    }

    const body = await req.json();
    const { action } = body;

    if (action === "invite") {
      const { project_id, email, role = "viewer" } = body;
      if (!project_id || !email) {
        return json({ error: "project_id and email are required" }, 400, corsHeaders);
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return json({ error: "Invalid email format" }, 400, corsHeaders);
      }

      // Validate role
      if (!["viewer", "editor"].includes(role)) {
        return json({ error: "Invalid role. Use 'viewer' or 'editor'" }, 400, corsHeaders);
      }

      // Verify ownership
      const { data: project } = await supabase
        .from("projects")
        .select("id, user_id")
        .eq("id", project_id)
        .single();

      if (!project || project.user_id !== user.id) {
        return json({ error: "Not found or not authorized" }, 403, corsHeaders);
      }

      // Don't allow inviting yourself
      if (email.toLowerCase() === user.email?.toLowerCase()) {
        return json({ error: "You can't invite yourself" }, 400, corsHeaders);
      }

      // Create invite (upsert on project_id + email)
      const { data: invite, error: inviteError } = await supabaseAdmin
        .from("project_invites")
        .upsert(
          {
            project_id,
            invited_email: email.toLowerCase(),
            invited_by: user.id,
            role,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            accepted_at: null,
          },
          { onConflict: "project_id,invited_email" }
        )
        .select()
        .single();

      if (inviteError) throw inviteError;

      return json({ invite }, 200, corsHeaders);
    }

    if (action === "remove") {
      const { project_id, member_id } = body;
      if (!project_id || !member_id) {
        return json({ error: "project_id and member_id are required" }, 400, corsHeaders);
      }

      // Verify ownership via RLS (select will fail if not owner)
      const { error } = await supabase
        .from("project_members")
        .delete()
        .eq("id", member_id)
        .eq("project_id", project_id);

      if (error) throw error;
      return json({ success: true }, 200, corsHeaders);
    }

    if (action === "accept") {
      const { token } = body;
      if (!token) return json({ error: "token required" }, 400, corsHeaders);

      const { data, error } = await supabaseAdmin.rpc("accept_project_invite", {
        p_user_id: user.id,
        p_token: token,
      });

      if (error) throw error;
      if (!data?.ok) {
        return json({ error: data?.reason === "invalid_or_expired" ? "Invite is invalid or has expired" : "Failed to accept invite" }, 400, corsHeaders);
      }

      return json({ project_id: data.project_id }, 200, corsHeaders);
    }

    if (action === "list") {
      const { project_id } = body;
      if (!project_id) return json({ error: "project_id required" }, 400, corsHeaders);

      // Members
      const { data: members } = await supabase
        .from("project_members")
        .select("id, user_id, role, created_at, profiles:user_id(full_name, email, avatar_url)")
        .eq("project_id", project_id);

      // Pending invites (owner only, via RLS)
      const { data: invites } = await supabase
        .from("project_invites")
        .select("id, invited_email, role, created_at, accepted_at")
        .eq("project_id", project_id)
        .is("accepted_at", null);

      return json({ members: members ?? [], invites: invites ?? [] }, 200, corsHeaders);
    }

    return json({ error: "Invalid action" }, 400, corsHeaders);
  } catch (err) {
    console.error("project-team error:", err);
    return json({ error: "Internal server error" }, 500, getCorsHeaders(req));
  }
});

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
