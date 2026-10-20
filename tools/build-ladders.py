#!/usr/bin/env python3
"""Builds puzzles/ladder.json, the word lists and puzzles for Word Ladder.

Words come from the ENABLE word list (public domain; no proper nouns or
abbreviations), filtered by how common they are in everyday English with the
wordfreq package (`pip install wordfreq`):

  - accepted moves: ENABLE words of 4 or 5 letters with a Zipf frequency of
    at least 1.5, so real but uncommon words are still allowed as steps;
  - common words: Zipf 3.2 or more. Hints and the shortest solution ("par")
    only ever use these, so no puzzle needs an obscure word;
  - start and target words: Zipf 4.0 or more, and not plurals or past
    tenses.

Offensive words are left out everywhere. Every ladder is checked by a
breadth-first search over the common words; its par is the length of the
shortest ladder.

Usage: python3 tools/build-ladders.py path/to/enable1.txt
(ENABLE: https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt)
"""
import json
import random
import string
import sys
from collections import deque
from pathlib import Path

from wordfreq import zipf_frequency

ACCEPT, COMMON, ENDPOINT = 1.5, 3.2, 4.0

# Kept out of the game altogether: vulgar words, slurs, and words mostly used
# as insults or about drugs and violence.
BLOCK = set('''
anal anus arse bitch bitchy boner boobs booby bosom butt butts cocks cocky
coke cokes crack crap craps cunt damn damned dick dicks dildo dyke dykes
fag fags faggy fart farts fuck fucks gook gooks gays homo homos horny jism
jizz kike kikes kill kills lesbo nazi nazis negro nigga nude nudes orgy
pecker penis perv pervs piss pissy poop porn porno prick pube pubes pussy
queer rape raped rapes rapist scum semen sexy shag shit shits slut sluts
smut spic spics spunk suck sucks tits titty turd turds twat vagina wank
whore wog wogs bong bongs dope doped heroin meth stab stabs nuke slay
hooker pimp pimps crotch booze drunk boozy kinky lust lusty cunts sperm feces
urine vomit jihad gypsy lynch moron idiot sissy booty fanny willy boobs bowel
'''.split())

# Allowed as moves (they're real words) but never used in a puzzle, a hint or
# a par: words most people know as names, places or brands, and shortenings.
NOT_COMMON = set('''
aero alan alba alec alps amir anna baba bach berg beth brad brit cain carl
carr chad cobb cole conn cory euro fuji gage hank holt hong howe jake jane
jess jews joey john josh kane kemp kent khan kirk kris lakh lang lars lear
lowe mack marc matt maya mick milo mina modi ness noel offs olds otto para
raja rees ritz rolf rudd ruth saul scot sept shea shes shri sims tate toby
tony tory troy turk vera alar
abbas ariel avant bates benny billy bobby brent brits brock buffy burke calif
chang chevy chico chile china cisco colin congo costa crore devon donna drake
erica fitch garth gemma gimme greek hades hanks harry haute henry hicks hogan
honda japan jenny jerry jesse jimmy johns jones judas kelly kerry kraft kyrie
lacey laura leone levin lewis logan louie louis mamma maria mater mecca molly
momma monte morse nancy paris pedro perry peter petit prima quasi ralph randy
recon riley roger roman romeo rowan sally santo scots sears shawn shiva silva
sonny sykes tammy terra terry tesla texas tommy torah trump twain wales wally
weber welch welsh whats wigan wight swiss dutch turks missy
'''.split())

def neighbours(word, words):
    out = []
    for i, ch in enumerate(word):
        for c in string.ascii_lowercase:
            if c != ch:
                w = word[:i] + c + word[i + 1:]
                if w in words:
                    out.append(w)
    return out

def distances(start, words):
    dist = {start: 0}
    q = deque([start])
    while q:
        w = q.popleft()
        for n in neighbours(w, words):
            if n not in dist:
                dist[n] = dist[w] + 1
                q.append(n)
    return dist

def main(enable_path):
    enable = [w.strip() for w in open(enable_path) if w.strip().isalpha()]
    data = {'v': 1, 'words': {}, 'common': {}, 'ladders': {}}
    rng = random.Random(20261020)
    # Par ranges per word length: (shortest, longest, how many ladders)
    plan = {4: (3, 6, 900), 5: (4, 7, 400)}
    for n, (lo, hi, want) in plan.items():
        z = {w: zipf_frequency(w, 'en') for w in enable if len(w) == n and w not in BLOCK}
        accepted = sorted(w for w, f in z.items() if f >= ACCEPT)
        common = sorted(w for w, f in z.items() if f >= COMMON and w not in NOT_COMMON)
        common_set = set(common)
        # Base forms read best at the ends of a ladder: no plurals or past tenses.
        inflected = lambda w: (w.endswith('s') and not w.endswith('ss')) or w.endswith('ed')
        ends = sorted(w for w, f in z.items() if f >= ENDPOINT and w not in NOT_COMMON and not inflected(w))
        pairs = []
        for a in ends:
            d = distances(a, common_set)
            for b in ends:
                if a < b and lo <= d.get(b, 99) <= hi:
                    pairs.append((a, b, d[b]))
        rng.shuffle(pairs)
        # Spread the words out: each word starts or ends at most two ladders,
        # and the pars are balanced.
        uses, chosen, per_par = {}, [], {}
        cap = want // (hi - lo + 1) + 1
        for a, b, p in pairs:
            if uses.get(a, 0) >= 2 or uses.get(b, 0) >= 2 or per_par.get(p, 0) >= cap:
                continue
            if rng.random() < 0.5:
                a, b = b, a
            chosen.append(f'{a}>{b}:{p}')
            uses[a] = uses.get(a, 0) + 1
            uses[b] = uses.get(b, 0) + 1
            per_par[p] = per_par.get(p, 0) + 1
            if len(chosen) >= want:
                break
        data['words'][str(n)] = ' '.join(accepted)
        data['common'][str(n)] = ' '.join(common)
        data['ladders'][str(n)] = chosen
        print(f'{n} letters: {len(accepted)} accepted, {len(common)} common, {len(ends)} endpoints, '
              f'{len(chosen)} ladders, pars {dict(sorted(per_par.items()))}')
    out = Path(__file__).resolve().parent.parent / 'puzzles' / 'ladder.json'
    out.write_text(json.dumps(data, separators=(',', ':')) + '\n')
    print('wrote', out, out.stat().st_size, 'bytes')

if __name__ == '__main__':
    main(sys.argv[1])
