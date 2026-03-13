import os
import chromadb
from sentence_transformers import SentenceTransformer

TRANSCRIPTS_DIR = "/home/user/oostler/transcripts"
DB_PATH = "/home/user/oostler/.rag_db"
CHUNK_SIZE = 500  # words per chunk
CHUNK_OVERLAP = 50

def chunk_text(text, size=CHUNK_SIZE, overlap=CHUNK_OVERLAP):
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i:i+size])
        chunks.append(chunk)
        i += size - overlap
    return chunks

def build_index():
    print("Loading embedding model...")
    model = SentenceTransformer("all-MiniLM-L6-v2")
    client = chromadb.PersistentClient(path=DB_PATH)

    try:
        client.delete_collection("transcripts")
    except:
        pass
    collection = client.create_collection("transcripts")

    files = sorted(f for f in os.listdir(TRANSCRIPTS_DIR) if f.endswith(".txt"))
    all_chunks, all_ids, all_meta = [], [], []

    for fname in files:
        path = os.path.join(TRANSCRIPTS_DIR, fname)
        with open(path, encoding="utf-8") as f:
            text = f.read()
        lecture = fname.replace(".txt", "")
        chunks = chunk_text(text)
        for i, chunk in enumerate(chunks):
            all_chunks.append(chunk)
            all_ids.append(f"{lecture}_{i}")
            all_meta.append({"lecture": lecture, "chunk": i})
        print(f"  Indexed {len(chunks)} chunks from: {fname}")

    print(f"\nEmbedding {len(all_chunks)} chunks...")
    embeddings = model.encode(all_chunks, show_progress_bar=True).tolist()
    collection.add(documents=all_chunks, embeddings=embeddings, ids=all_ids, metadatas=all_meta)
    print(f"\nDone. {len(all_chunks)} chunks indexed.")

def query(question, n=5):
    model = SentenceTransformer("all-MiniLM-L6-v2")
    client = chromadb.PersistentClient(path=DB_PATH)
    collection = client.get_collection("transcripts")
    embedding = model.encode([question]).tolist()
    results = collection.query(query_embeddings=embedding, n_results=n)
    docs = results["documents"][0]
    metas = results["metadatas"][0]
    return [(meta["lecture"], doc) for meta, doc in zip(metas, docs)]

if __name__ == "__main__":
    build_index()
