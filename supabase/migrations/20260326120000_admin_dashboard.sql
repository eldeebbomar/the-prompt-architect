-- Add admin flag to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- View: platform overview stats
CREATE OR REPLACE VIEW admin_platform_stats AS
SELECT
  (SELECT COUNT(*) FROM auth.users) AS total_users,
  (SELECT COUNT(*) FROM projects) AS total_projects,
  (SELECT COUNT(*) FROM generated_prompts) AS total_prompts,
  (SELECT COUNT(*) FROM projects WHERE status = 'ready' OR status = 'completed') AS completed_projects,
  (SELECT COUNT(*) FROM projects WHERE status = 'generating') AS generating_projects,
  (SELECT COUNT(*) FROM projects WHERE status = 'discovery') AS discovery_projects,
  (SELECT COALESCE(SUM(amount), 0) FROM credit_transactions WHERE type = 'purchase') AS total_revenue_credits,
  (SELECT COUNT(*) FROM credit_transactions WHERE type = 'purchase') AS total_purchases,
  (SELECT COUNT(*) FROM profiles WHERE referral_count > 0) AS users_with_referrals,
  (SELECT COALESCE(SUM(referral_count), 0) FROM profiles) AS total_referrals;

-- View: daily signups (last 30 days)
CREATE OR REPLACE VIEW admin_daily_signups AS
SELECT
  DATE(created_at) AS day,
  COUNT(*) AS signups
FROM auth.users
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY day;

-- View: daily projects (last 30 days)
CREATE OR REPLACE VIEW admin_daily_projects AS
SELECT
  DATE(created_at) AS day,
  COUNT(*) AS projects
FROM projects
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY day;

-- View: daily revenue (last 30 days)
CREATE OR REPLACE VIEW admin_daily_revenue AS
SELECT
  DATE(created_at) AS day,
  COUNT(*) AS transactions,
  SUM(amount) AS credits_purchased
FROM credit_transactions
WHERE type = 'purchase' AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY day;

-- View: plan distribution
CREATE OR REPLACE VIEW admin_plan_distribution AS
SELECT
  COALESCE(plan, 'free') AS plan,
  COUNT(*) AS user_count
FROM profiles
GROUP BY COALESCE(plan, 'free');

-- RLS: only admins can read admin views
-- (Views inherit the table-level RLS of their underlying tables,
--  but we add an RPC for safe access)
CREATE OR REPLACE FUNCTION get_admin_stats(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_stats JSONB;
BEGIN
  SELECT is_admin INTO v_is_admin FROM profiles WHERE id = p_user_id;
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT jsonb_build_object(
    'total_users', (SELECT COUNT(*) FROM auth.users),
    'total_projects', (SELECT COUNT(*) FROM projects),
    'total_prompts', (SELECT COUNT(*) FROM generated_prompts),
    'completed_projects', (SELECT COUNT(*) FROM projects WHERE status IN ('ready', 'completed')),
    'generating_projects', (SELECT COUNT(*) FROM projects WHERE status = 'generating'),
    'discovery_projects', (SELECT COUNT(*) FROM projects WHERE status = 'discovery'),
    'total_purchases', (SELECT COUNT(*) FROM credit_transactions WHERE type = 'purchase'),
    'total_referrals', (SELECT COALESCE(SUM(referral_count), 0) FROM profiles),
    'daily_signups', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('day', DATE(created_at), 'count', cnt) ORDER BY d), '[]'::jsonb)
      FROM (SELECT DATE(created_at) AS d, COUNT(*) AS cnt FROM auth.users WHERE created_at >= NOW() - INTERVAL '30 days' GROUP BY DATE(created_at)) sub
    ),
    'daily_projects', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('day', DATE(created_at), 'count', cnt) ORDER BY d), '[]'::jsonb)
      FROM (SELECT DATE(created_at) AS d, COUNT(*) AS cnt FROM projects WHERE created_at >= NOW() - INTERVAL '30 days' GROUP BY DATE(created_at)) sub
    ),
    'daily_revenue', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('day', DATE(created_at), 'count', cnt, 'credits', cred) ORDER BY d), '[]'::jsonb)
      FROM (SELECT DATE(created_at) AS d, COUNT(*) AS cnt, SUM(amount) AS cred FROM credit_transactions WHERE type = 'purchase' AND created_at >= NOW() - INTERVAL '30 days' GROUP BY DATE(created_at)) sub
    ),
    'plan_distribution', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('plan', COALESCE(plan, 'free'), 'count', cnt)), '[]'::jsonb)
      FROM (SELECT plan, COUNT(*) AS cnt FROM profiles GROUP BY plan) sub
    )
  ) INTO v_stats;

  RETURN v_stats;
END;
$$;
