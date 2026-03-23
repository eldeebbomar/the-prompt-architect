-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create the table to store Lovable documentation
create table if not exists public.lovable_docs (
  id uuid primary key default gen_random_uuid(),
  content text,                     -- The actual scraped text chunk from Apify
  metadata jsonb,                   -- Source URL, title, etc.
  embedding vector(1536)            -- OpenAI embeddings use 1536 dimensions
);

-- Turn on Row Level Security (RLS) but make it readable by anyone (so your Edge Functions or n8n can query it)
alter table public.lovable_docs enable row level security;

create policy "Allow public read access to lovable_docs"
  on public.lovable_docs
  for select
  to public
  using (true);

create policy "Allow service role full access to lovable_docs"
  on public.lovable_docs
  for all
  to service_role
  using (true)
  with check (true);

-- Create a function that n8n can call to perform similarity search!
-- This is what the Vector Store Tool in n8n queries securely.
create or replace function match_lovable_docs (
  query_embedding vector(1536),
  match_count int default 5,
  filter jsonb default '{}'
) returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    lovable_docs.id,
    lovable_docs.content,
    lovable_docs.metadata,
    1 - (lovable_docs.embedding <=> query_embedding) as similarity
  from lovable_docs
  -- Using cosine distance `<=>` for OpenAI embeddings
  order by lovable_docs.embedding <=> query_embedding
  limit match_count;
end;
$$;
