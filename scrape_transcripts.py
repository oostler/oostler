import re
import os
import time
import random
from youtube_transcript_api import YouTubeTranscriptApi

# All 25 videos from the playlist
videos = [
    ("NNnIGh9g6fA", "1. Introduction to Human Behavioral Biology"),
    ("Y0Oa4Lp5fLE", "2. Behavioral Evolution"),
    ("oKNAzl-XN4I", "3. Behavioral Evolution II"),
    ("_dRXA1_e30o", "4. Molecular Genetics I"),
    ("dFILgg9_hrU", "5. Molecular Genetics II"),
    ("e0WZx7lUOrY", "6. Behavioral Genetics I"),
    ("RG5fN6KrDJE", "7. Behavioral Genetics II"),
    ("P388gUPSq_I", "8. Recognizing Relatives"),
    ("ISVaoLlW104", "9. Ethology"),
    ("5031rWXgdYo", "10. Introduction to Neuroscience I"),
    ("uqU9lmFztOU", "11. Introduction to Neuroscience II"),
    ("yETVsV4zfFw", "12. Endocrinology"),
    ("kAfz0yAcOyQ", "13. Advanced Neurology and Endocrinology"),
    ("CAOnSbDSaOw", "14. Limbic System"),
    ("LOY3QH_jOtE", "15. Human Sexual Behavior I"),
    ("95OP9rSjxzw", "16. Human Sexual Behavior II"),
    ("JPYmarGO5jM", "17. Human Sexual Behavior III & Aggression I"),
    ("wLE71i4JJiM", "18. Aggression II"),
    ("EtVfoIkVSu8", "19. Aggression III"),
    ("BqP4_4kr7-0", "20. Aggression IV"),
    ("_njf8jwEGRo", "21. Chaos and Reductionism"),
    ("o_ZuWbX-CyE", "22. Emergence and Complexity"),
    ("SIOQgY1tqrU", "23. Language"),
    ("nEnklxGAmak", "24. Schizophrenia"),
    ("-PpDq1WUtAw", "25. Individual Differences"),
]

output_dir = "/home/user/oostler/transcripts"

def safe_filename(title):
    return re.sub(r'[<>:"/\\|?*]', '', title).strip()

def fetch_with_retry(video_id, max_retries=5):
    delays = [5, 15, 30, 60, 120]
    for attempt in range(max_retries):
        try:
            api = YouTubeTranscriptApi()
            fetched = api.fetch(video_id)
            return "\n".join(entry.text for entry in fetched)
        except Exception as e:
            if attempt < max_retries - 1:
                delay = delays[attempt] + random.uniform(0, 5)
                print(f"    Attempt {attempt+1} failed, retrying in {delay:.0f}s...")
                time.sleep(delay)
            else:
                raise

for i, (video_id, title) in enumerate(videos):
    filename = safe_filename(title) + ".txt"
    filepath = os.path.join(output_dir, filename)

    if os.path.exists(filepath):
        print(f"[{i+1}/25] Skipping (already saved): {title}")
        continue

    print(f"[{i+1}/25] Fetching: {title} ({video_id})...")
    try:
        text = fetch_with_retry(video_id)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(f"{title}\n{'='*len(title)}\n\n")
            f.write(text)
        print(f"  Saved: {filename}")
        # Polite delay between successful requests
        if i < len(videos) - 1:
            delay = random.uniform(3, 8)
            time.sleep(delay)
    except Exception as e:
        print(f"  FAILED: {e}")

# Summary
saved = [f for f in os.listdir(output_dir) if f.endswith(".txt")]
print(f"\nDone. {len(saved)}/25 transcripts saved.")
