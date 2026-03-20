-- Add DELETE and UPDATE policies for conversations table
CREATE POLICY "conversations_delete_own"
ON public.conversations
FOR DELETE
TO authenticated
USING (owns_project(project_id));

CREATE POLICY "conversations_update_own"
ON public.conversations
FOR UPDATE
TO authenticated
USING (owns_project(project_id));