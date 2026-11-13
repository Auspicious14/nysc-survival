"""Build voice/script.json for the Gemini voice notebook.
Inputs: captured_lines.json (tools/capture_lines.js) + fixed lines found in js/game.js (bubbles, drill commands, SAY()).
Expands {PRN} {TCH} {BOSS} {STATE} into every zone/state, skips lines with a player/LGA/PPA name (those use the browser voice).
Usage: python3 tools/make_voice_script.py captured_lines.json voice/script.json
"""
import json, re, sys, zlib

src = open('js/game.js', encoding='utf-8').read()
cap = json.load(open(sys.argv[1], encoding='utf-8'))
OUT = sys.argv[2] if len(sys.argv) > 2 else 'voice/script.json'

def clean(t):  # must match speak() in game.js exactly, or the game will not find the file
    t = re.sub(r'<[^>]+>', '', t)
    t = re.sub('[\U0001F300-\U0001FAFF☀-➿]', '', t)
    t = re.sub(r'₦\s?([\d,]+)', r'\1 naira', t)
    t = re.sub(r'[“”"]', '', t)
    return re.sub(r'\s+', ' ', t).strip()

def fnv(t):
    h = 0x811c9dc5
    for b in t.encode('utf-8'): h = ((h ^ b) * 0x01000193) & 0xffffffff
    return format(h, '08x')

ZONES = {'SW': ('Mr. Adebayo', 'Mrs. Okon', 'Matron Folake', 'Mr. Bankole'), 'SE': ('Mr. Okonkwo', 'Mrs. Eze', 'Matron Ngozi', 'Mr. Obinna'),
         'SS': ('Mr. Ebiere', 'Mrs. Okon', 'Matron Tamara', 'Mrs. Ofure'), 'NC': ('Mr. Terna', 'Mrs. Abdullahi', 'Matron Ladi', 'Mr. Danladi'),
         'NE': ('Malam Bello', 'Mrs. Hauwa', 'Matron Fatima', 'Mr. Garba'), 'NW': ('Malam Sani', 'Mrs. Zainab', 'Matron Hadiza', 'Mr. Yusuf')}
ACCENT = {'': 'a natural Nigerian English accent, the way an everyday Lagos person talks',
          'SW': 'a natural Nigerian English accent with a soft Yoruba lilt', 'SE': 'a natural Nigerian English accent with an Igbo lilt',
          'SS': 'a natural South-South Nigerian English accent, relaxed and Pidgin-friendly', 'NC': 'a natural Middle Belt Nigerian English accent',
          'NE': 'a natural Northern Nigerian English accent with a Hausa lilt', 'NW': 'a natural Northern Nigerian English accent with a Hausa lilt'}
STATES = [(m.group(1), m.group(2)) for m in re.finditer(r'"id":"(\w\w)","name":"([^"]+)"', open('js/naija.js', encoding='utf-8').read())]
ZONE_OF = {}
for z, codes in {'SW': 'EK LA OG OD OS OY', 'SE': 'AB AN EB EN IM', 'SS': 'AK BY CR DT ED RV', 'NC': 'BE FC KG KW NR NG PL', 'NE': 'AD BA BO GB TR YB', 'NW': 'JG KD KN KT KB SO ZA'}.items():
    for c in codes.split(): ZONE_OF[c] = z

MALE = ['Charon', 'Fenrir', 'Orus', 'Puck', 'Algenib', 'Iapetus', 'Enceladus', 'Umbriel', 'Algieba', 'Rasalgethi', 'Alnilam', 'Schedar', 'Achird', 'Zubenelgenubi', 'Sadachbia', 'Sadaltager']
FEMALE = ['Kore', 'Leda', 'Aoede', 'Zephyr', 'Callirrhoe', 'Autonoe', 'Despina', 'Erinome', 'Laomedeia', 'Achernar', 'Gacrux', 'Pulcherrima', 'Vindemiatrix', 'Sulafat']
FIXED = [(r'soldier|security', 'Fenrir', 'a strict Nigerian soldier at the camp gate, firm and loud'), (r'marshal', 'Algenib', 'a Nigerian army drill marshal shouting commands on the parade ground'),
         (r'principal|adebayo|okonkwo|ebiere|terna|malam', 'Charon', 'an experienced Nigerian school principal, firm but fatherly'),
         (r'matron', 'Sulafat', 'a no-nonsense Nigerian hospital matron'), (r'mrs\.|vice principal|teacher', 'Gacrux', 'a motherly Nigerian schoolteacher'),
         (r'lgi|official|query', 'Orus', 'a Nigerian government official reading an announcement, calm and formal'), (r'tolu', 'Kore', 'a friendly young Nigerian woman, a fellow corper'),
         (r'emeka', 'Puck', 'a playful young Nigerian man, a fellow corper'), (r'chioma|cds sec', 'Leda', 'a busy young Nigerian woman, the CDS secretary'),
         (r'mc spicy|dj', 'Zubenelgenubi', 'a hype Nigerian party MC'), (r'mummy', 'Vindemiatrix', 'a loving Nigerian mother'),
         (r'conductor|keke|driver', 'Rasalgethi', 'a fast-talking Lagos bus conductor'), (r'president', 'Schedar', 'a serious Nigerian CDS group president'),
         (r'mr\. bankole|mr\. obinna|mr\. danladi|mr\. garba|mr\. yusuf|manager|head of admin', 'Schedar', 'a Nigerian office manager, polite but busy'),
         (r'ofure|coordinator', 'Achernar', 'a Nigerian office manager, polite but busy'), (r'front desk|receptionist|nurse', 'Despina', 'a Nigerian receptionist')]

NARRATOR = re.compile(r'hostel|your phone|room|letter|list|·|question|task|round|test|assembly|day$|area|talk|report|meeting|book|contribution|saturday|stall', re.I)
def pick_voice(who, female, text):
    w = (who or '').lower()
    if text.startswith('Corper, welcome. We are three nurses'): return 'Sulafat', 'a no-nonsense Nigerian hospital matron'
    if text.startswith('So you are our new corper. Welcome. We resume'): return 'Schedar', 'a Nigerian office manager, polite but busy'
    if re.search(r'uncle corper|aunty corper', text, re.I): return 'Leda', 'a cheeky Nigerian secondary school pupil'
    if NARRATOR.search(w) and not re.search(r'soldier|officer|matron|principal|mr\.|mrs\.', w): return 'Iapetus', 'a calm Nigerian storyteller narrating a game'
    for pat, v, role in FIXED:
        if re.search(pat, w): return v, role
    pool = FEMALE if female else MALE
    return pool[zlib.crc32((w or text[:12]).encode()) % len(pool)], ('a Nigerian woman' if female else 'a Nigerian man') + ' talking casually'

lines = {}
def add(text, who='', female=False, zone='', prio=1):
    t = clean(text)
    if len(t) < 3 or re.search(r'\{(NAME|LGA|PPA)\}|\$\{|undefined| \+ | × ', t): return
    if re.match(r'(Hmm\. The answer|The class claps|✘|Your minutes)', who or '') or (len(t) < 14 and not re.search(r'[!?]', t)): return
    i = fnv(t)
    if i in lines: lines[i]['prio'] = min(lines[i]['prio'], prio); return
    v, role = pick_voice(who, female, t)
    lines[i] = {'id': i, 'text': t, 'voice': v, 'style': f'Say this exactly as written, as {role}, in {ACCENT[zone]}. Sound like a real person in a real conversation, not a radio presenter. Natural pace, small pauses at commas and full stops. Pidgin words are read as Nigerians say them.', 'prio': prio}

def expand(text, who, female):
    toks = set(re.findall(r'\{(PRN|TCH|BOSS|STATE)\}', text + ' ' + who))
    if not toks: return add(text, who, female)
    if 'STATE' in toks:
        for code, name in STATES:
            z = ZONE_OF.get(code, '')
            names = ZONES[z if code != 'LA' else 'SW']
            t = text.replace('{STATE}', name).replace('{PRN}', names[0]).replace('{TCH}', names[1])
            add(t, who.replace('{STATE}', name), female, z, 1 if code == 'LA' else 3)
        return
    for z, names in ZONES.items():
        for bi, boss in enumerate([names[0], names[2], names[3]] if 'BOSS' in toks else [None]):
            t = text.replace('{PRN}', names[0]).replace('{TCH}', names[1])
            w = who.replace('{PRN}', names[0]).replace('{TCH}', names[1])
            if boss: t = t.replace('{BOSS}', boss); w = w.replace('{BOSS}', boss)
            add(t, w, female or bool(re.search(r'mrs|matron|ofure', w, re.I)), z, 1 if z == 'SW' else 2)

for c in cap: expand(c['text'], c.get('who', ''), c.get('female', False))
for m in re.finditer(r"bubble:\s*\[([^\]]+)\]", src):  # bubbles the walk could not reach
    for b in re.findall(r"'((?:[^'\\]|\\.)*)'", m.group(1)): add(b.replace("\\'", "'"), 'bubble', False, '', 2)
for c in ['RIGHT… TURN!', 'LEFT… TURN!', 'ABOUT… TURN!', 'PLATOON 5… ATTENTION!', 'STAND… AT EASE!']: add(c, 'marshal', False, '', 1)
for m in re.finditer(r"SAY\('((?:[^'\\]|\\.)*)'\)", src): add(m.group(1).replace("\\'", "'"), '', False, '', 1)

out = sorted(lines.values(), key=lambda l: (l['prio'], l['voice'], l['id']))
json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(out), 'lines,', sum(len(l['text']) for l in out), 'characters →', OUT, '| by priority:', {p: sum(1 for l in out if l['prio'] == p) for p in (1, 2, 3)})
