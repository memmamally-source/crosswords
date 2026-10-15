#!/usr/bin/env python3
"""Rates every answer in words/*.txt as easy, medium or hard and writes
words/levels.json. Puzzles mix a few hard answers in with easier ones.

The rating uses how common the answer is in everyday English (the wordfreq
package: pip install wordfreq). Answers made of several words are rated by
their rarest part. Answers missing from levels.json count as medium.

Run after adding words:  python3 tools/rate-words.py && node tools/build-words.js
"""
import functools, glob, json, os
from wordfreq import zipf_frequency

ROOT = os.path.join(os.path.dirname(__file__), '..')
EASY_AT = 3.5   # Zipf frequency at or above this: easy (e.g. KOALA is about 3)
HARD_BELOW = 2.5  # below this: hard (e.g. OROGENY is about 2)


@functools.lru_cache(None)
def commonness(answer):
    word = answer.lower()
    score = zipf_frequency(word, 'en')
    if score >= 1.5:
        return score
    best = 0
    for i in range(2, len(word) - 1):
        left, right = word[:i], word[i:]
        a, b = zipf_frequency(left, 'en'), zipf_frequency(right, 'en')
        if a > 0 and b > 0:
            best = max(best, min(a, b) - 0.6)
    return max(score, best)


def main():
    easy, hard = set(), set()
    for path in sorted(glob.glob(os.path.join(ROOT, 'words', '*.txt'))):
        for line in open(path, encoding='utf8'):
            line = line.strip()
            if not line or line.startswith('#') or '|' not in line:
                continue
            answer = ''.join(c for c in line.split('|')[0].upper() if 'A' <= c <= 'Z')
            score = commonness(answer)
            if score >= EASY_AT:
                easy.add(answer)
            elif score < HARD_BELOW:
                hard.add(answer)
    out = os.path.join(ROOT, 'words', 'levels.json')
    with open(out, 'w', encoding='utf8') as f:
        json.dump({'easy': sorted(easy), 'hard': sorted(hard)}, f, separators=(',', ':'))
        f.write('\n')
    print(f'Wrote words/levels.json: {len(easy)} easy, {len(hard)} hard')


if __name__ == '__main__':
    main()
