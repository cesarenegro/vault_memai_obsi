import json
import os
import re
import unicodedata

# 1. Stopwords definition identical to scripts/a05-corpus-diversity.mjs
ITALIAN_STOPWORDS = set([
    'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una',
    'del', 'dello', 'della', 'dei', 'degli', 'delle',
    'al', 'allo', 'alla', 'ai', 'agli', 'alle',
    'dal', 'dallo', 'dalla', 'dai', 'dagli', 'dalle',
    'nel', 'nello', 'nella', 'nei', 'negli', 'nelle',
    'col', 'coi', 'sul', 'sullo', 'sulla', 'sui', 'sugli', 'sulle',
    'di', 'a', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra',
    'e', 'ed', 'o', 'od', 'ma', 'se', 'che', 'chi', 'cui', 'non',
    'piu', 'meno', 'come', 'dove', 'quando', 'quale', 'quali',
    'quanto', 'quanti', 'quanta', 'quante',
    'questo', 'questa', 'questi', 'queste',
    'quello', 'quella', 'quelli', 'quelle',
    'suo', 'sua', 'suoi', 'sue', 'loro',
    'nostro', 'nostra', 'nostri', 'nostre',
    'vostro', 'vostra', 'vostri', 'vostre',
    'mio', 'mia', 'miei', 'mie',
    'tuo', 'tua', 'tuoi', 'tue',
    'anche', 'gia', 'cosi', 'solo', 'tutto', 'tutti', 'tutta', 'tutte',
    'molto', 'molti', 'molta', 'molte', 'poco', 'pochi', 'poca', 'poche',
    'essere', 'stato', 'stati', 'stata', 'state', 'sono', 'sei', 'era', 'erano',
    'sara', 'sarebbe', 'sia', 'siano',
    'fare', 'fatto', 'fatta', 'fatti', 'fatte', 'fa', 'fanno', 'faceva',
    'avere', 'ho', 'hai', 'ha', 'abbiamo', 'avete', 'hanno', 'aveva', 'avevano',
    'ad', 'ci', 'vi', 'ne', 'si', 'mi', 'ti', 'li',
    'ogni', 'alcuni', 'alcune', 'alcuno', 'alcuna', 'senza', 'dopo', 'prima',
    'sopra', 'sotto', 'dentro', 'fuori', 'verso', 'contro', 'mediante', 'durante'
])

def extract_tokens(text):
    text = text.lower()
    text = unicodedata.normalize('NFD', text)
    text = re.sub(r'[\u0300-\u036f]', '', text)
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    tokens = text.split()
    return set(t for t in tokens if len(t) >= 3 and not t.isdigit() and t not in ITALIAN_STOPWORDS)

def compute_jaccard(set_a, set_b):
    if not set_a and not set_b:
        return 0.0
    inter = len(set_a & set_b)
    union = len(set_a | set_b)
    return inter / union if union > 0 else 0.0

print("Loaded diversity evaluation functions.")
