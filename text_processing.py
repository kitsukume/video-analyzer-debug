import sys
import os
import json
from collections import Counter

def analyze_text(text_path):
    try:
        with open(text_path, 'r', encoding='utf-8') as file:
            text = file.read()

        words = text.lower().split()
        word_count = len(words)
        word_frequency = Counter(words)
        top_words = word_frequency.most_common(10)
        return json.dumps({"word_count": word_count, "top_words": top_words})

    except Exception as e:
        return f"An error occurred: {e}"

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python text_processing.py <text_path>")
        sys.exit(1)

    text_path = sys.argv[1]
    if not os.path.exists(text_path):
        print(f"Error: Text file not found at {text_path}")
        sys.exit(1)
    result = analyze_text(text_path)
    print(result)