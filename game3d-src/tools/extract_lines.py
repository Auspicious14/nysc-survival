"""Collect every fixed line the game speaks into voice/lines.json for YarnGPT.
Run: python3 tools/extract_lines.py   (from the game folder)"""
import re, json, unicodedata
src = open('js/game.js', encoding='utf-8').read()
def clean(t):
    t = re.sub(r'<[^>]+>', '', t)
    t = re.sub('[\U0001F300-\U0001FAFF☀-➿]', '', t)
    t = re.sub(r'₦\s?([\d,]+)', r'\1 naira', t)
    t = re.sub(r'[“”"]', '', t)
    return re.sub(r'\s+', ' ', t).strip()
def fnv(t):
    h = 0x811c9dc5
    for b in t.encode('utf-8'): h = ((h ^ b) * 0x01000193) & 0xffffffff
    return format(h, '08x')
VOICE = [(r'soldier|security', 'jude'), (r'registration|officer|chioma|cds secretary', 'chinenye'), (r'kit store|uche', 'emma'), (r'marshal', 'umar'),
         (r'mc spicy|tolu', 'idera'), (r'chidinma|bisi|nurse|ronke|okon|aunty', 'joke'), (r'adebayo|principal|president', 'tayo'), (r'photographer|tailor|musa|conductor|keke', 'osagie'), (r'lgi|query', 'remi')]
def voice_for(who, female):
    w = (who or '').lower()
    for pat, v in VOICE:
        if re.search(pat, w): return v
    return 'zainab' if female else 'jude'
lines = {}
def add(text, who='', female=False):
    t = clean(text)
    if len(t) < 3 or '${' in text: return
    i = fnv(t)
    if i not in lines: lines[i] = {'id': i, 'text': t, 'voice': voice_for(who, female)}
# dialogue panels: ask('Who', '"text"' ...  and  ask('Who', `"text"` (static only)
for m in re.finditer(r"ask\('([^']+)',\s*'((?:[^'\\]|\\.)*)'", src): add(m.group(2).replace("\\'", "'"), m.group(1), bool(re.search(r'tolu|chioma|mama|aunty|nurse|mc spicy|bisi|ronke|chidinma|okon|officer', m.group(1), re.I)))
# quoted speech inside toasts: Who: "text"
for m in re.finditer(r"toast\(\s*'([^'\\]*(?:\\.[^'\\]*)*)'", src):
    s = m.group(1).replace("\\'", "'"); q = re.match(r'^([^:"]{1,40}):?\s*"([^"]+)"', s) or re.search(r'"([^"]{4,})"', s)
    if q: add(q.group(q.lastindex), q.group(1) if q.lastindex > 1 else '', False)
# fixed spoken versions of changing lines: SAY('...') right after an ask(...)
for m in re.finditer(r"ask\('([^']+)'[\s\S]{0,1600}?SAY\('((?:[^'\\]|\\.)*)'\)", src):
    who = m.group(1); add(m.group(2).replace("\\'", "'"), who, bool(re.search(r'tolu|chioma|mama|aunty|nurse|mc spicy|bisi|ronke|chidinma|okon|officer', who, re.I)))
for m in re.finditer(r"SAY\('((?:[^'\\]|\\.)*)'\)", src): add(m.group(1).replace("\\'", "'"), '', False)
# speech bubbles
for m in re.finditer(r"bubble:\s*\[([^\]]+)\]", src):
    for b in re.findall(r"'((?:[^'\\]|\\.)*)'", m.group(1)): add(b.replace("\\'", "'"), 'bubble', False)
for c in ['RIGHT… TURN!', 'LEFT… TURN!', 'ABOUT… TURN!', 'PLATOON 5… ATTENTION!', 'STAND… AT EASE!']: add(c, 'marshal')
OVERRIDE = [(r'what is the answer', 'regina'), (r"don finish|khaki, white shorts", 'emma'), (r'Right thumb', 'chinenye'), (r'transport money|punctuality|JSS2 teacher', 'tayo'),
            (r'posting is out', 'remi'), (r'Secretariat!|Ojota|Enter with your change|One chance', 'osagie'), (r'TURN!|ATTENTION|AT EASE|fall in', 'umar'),
            (r'Lagos! I|Who is going to Ikeja|Kano', 'onye'), (r'How far|collect alert', 'emma'), (r'clearance without CDS card|Na rumour|official post', 'jude'), (r'Make some noise|Who get the energy|DJ, play', 'idera')]
for l in lines.values():
    for pat, v in OVERRIDE:
        if re.search(pat, l['text'], re.I): l['voice'] = v; break
json.dump(sorted(lines.values(), key=lambda x: x['id']), open('voice/lines.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(lines), 'lines →', 'voice/lines.json')
