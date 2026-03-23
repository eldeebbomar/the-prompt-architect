import os
import time
import json
from apify_client import ApifyClient
from supabase import create_client, Client
from openai import OpenAI
import re

# ==============================================================================
# 🚀 REQUIRED CONFIGURATION
# Replace these with your actual keys before running!
# ==============================================================================
APIFY_API_TOKEN = os.getenv("APIFY_API_TOKEN", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

SUPABASE_URL = "https://gnovkpjawtodjcgizxsh.supabase.co" 
# CRITICAL: The service role key below MUST match 'gnovkpjawtodjcgizxsh'
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

# The root URLs to crawl
START_URLS = [
    {"url": "https://docs.lovable.dev/introduction/welcome"},
    {"url": "https://docs.lovable.dev/features/plan-mode"},
    {"url": "https://docs.lovable.dev/integrations/introduction"},
    {"url": "https://docs.lovable.dev/tips-tricks/best-practice"},
    {"url": "https://docs.lovable.dev/changelog"}
]

# Simple semantic chunker (splits by headers/paragraphs to avoid breaking context)
def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> list[str]:
    # Split by double newline first to preserve paragraphs
    paragraphs = re.split(r'\n\s*\n', text)
    chunks = []
    current_chunk = ""
    
    for p in paragraphs:
        if len(current_chunk) + len(p) < chunk_size:
            current_chunk += p + "\n\n"
        else:
            if current_chunk:
                chunks.append(current_chunk.strip())
            # Handling overlap
            current_chunk = current_chunk[-overlap:] + p + "\n\n" if overlap > 0 else p + "\n\n"
            
    if current_chunk:
        chunks.append(current_chunk.strip())
        
    return chunks

def run():
    print("[START] Starting Apify Website Content Crawler...")
    apify = ApifyClient(APIFY_API_TOKEN)
    openai = OpenAI(api_key=OPENAI_API_KEY)
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # 1. Start the Actor run
    actor_call = apify.actor("apify/website-content-crawler").call(
        run_input={
            "startUrls": START_URLS + [{"url": "https://docs.lovable.dev/sitemap.xml"}], # Sitemap goes here too!
            "useSitemaps": True, # Crucial flag to tell it to parse the sitemap
            "maxCrawlPages": 300, 
            "excludeUrlGlobs": [{"glob": "*/changelog/*"}], 
            "extractHtml": False,
            "removeCookieWarnings": True,
            "markdown": True
        }
    )
    
    dataset_id = actor_call.get("defaultDatasetId")
    print(f"[SUCCESS] Scraping finished! Dataset ID: {dataset_id}")
    
    # 2. Fetch the dataset
    dataset_items = apify.dataset(dataset_id).list_items().items
    print(f"[INFO] Found {len(dataset_items)} pages of documentation.")
    
    # 3. Warning: clear out old embeddings if we are fully resyncing? 
    # This is a full unoptimized clear. In production, delete by URL.
    print("[CLEANUP] Cleaning out old Lovable documentation chunks from Supabase...")
    supabase.table("lovable_docs").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    
    total_chunks = 0
    # 4. Chunk & Embed & Insert
    for item in dataset_items:
        url = item.get("url")
        title = item.get("metadata", {}).get("title", url)
        markdown = item.get("markdown", "")
        
        if not markdown.strip():
            continue
            
        print(f"[CHUNKING] Chunking: {title}...")
        chunks = chunk_text(markdown)
        
        for idx, chunk in enumerate(chunks):
            total_chunks += 1
            # Step 4a: Embed the chunk using OpenAI
            res = openai.embeddings.create(
                input=chunk,
                model="text-embedding-3-small"
            )
            embedding_vector = res.data[0].embedding
            
            # Step 4b: Push to Supabase
            supabase.table("lovable_docs").insert({
                "content": chunk,
                "metadata": {"url": url, "title": title, "chunk_index": idx},
                "embedding": embedding_vector
            }).execute()
            
    print(f"[DONE] RAG Pipeline Complete! Synchronized {total_chunks} chunks into Superbase lovable_docs!")

if __name__ == "__main__":
    run()
