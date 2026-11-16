#!/usr/bin/env python3
"""Builds the Kopa Life search pages (static HTML, served through rewrites in next.config.mjs):
  /states                 all 36 states + FCT          -> public/seo/states/index.html
  /states/<slug>          one page per state            -> public/seo/states/<slug>.html
  /nysc-slang             NYSC slang dictionary         -> public/seo/nysc-slang.html
  /nysc-camp-guide        camp guide + packing list     -> public/seo/nysc-camp-guide.html
plus public/sitemap.xml and public/robots.txt.
State facts come from the game itself (game3d-src/js/naija.js, game3d-src/osm/*.json).
Run:  python3 scripts/build-seo.py   (optional: --shots DIR with <ID>_street.jpg / <ID>_landmark.jpg game screenshots)
"""
import json, re, os, sys, html, datetime, glob
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://kopalife.com.ng'
OUT = os.path.join(ROOT, 'public', 'seo')
TODAY = datetime.date.today().isoformat()
E = lambda s: html.escape(str(s), quote=True)

src = open(os.path.join(ROOT, 'game3d-src', 'js', 'naija.js'), encoding='utf-8').read()
STATES = json.loads(re.search(r'export const STATES = (\[.*?\]);\n', src, re.S).group(1))
ZONES = json.loads(re.search(r'export const ZONES = (\{.*?\});\n', src, re.S).group(1))
OSM = {}
for f in glob.glob(os.path.join(ROOT, 'game3d-src', 'osm', '*.json')):
    d = json.load(open(f, encoding='utf-8')); OSM[d['id']] = d

def slug(st): return 'fct' if st['id'] == 'FC' else re.sub(r'[^a-z0-9]+', '-', st['name'].lower()).strip('-')
def sname(st): return 'the FCT' if st['id'] == 'FC' else st['name'] + ' State'
def short(st): return 'FCT' if st['id'] == 'FC' else st['name']

# ---- screenshots -> webp (1200 wide) -------------------------------------------------
shots = None
if '--shots' in sys.argv: shots = sys.argv[sys.argv.index('--shots') + 1]
IMG = os.path.join(OUT, 'img'); os.makedirs(IMG, exist_ok=True)
if shots:
    from PIL import Image
    for f in glob.glob(os.path.join(shots, '*_*.jpg')):
        sid, kind = os.path.basename(f)[:-4].split('_', 1)
        st = next((s for s in STATES if s['id'] == sid), None)
        if not st: continue
        im = Image.open(f).convert('RGB'); im.thumbnail((1200, 1200))
        im.save(os.path.join(IMG, f'{slug(st)}-{kind}.webp'), 'WEBP', quality=72, method=6)
def img(st, kind):
    p = f'{slug(st)}-{kind}.webp'
    return f'/seo/img/{p}' if os.path.exists(os.path.join(IMG, p)) else None

# ---- shared page shell -----------------------------------------------------------------
FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Inter:wght@400;600&display=swap">'
NAV = '''<nav><div class="wrap"><a href="/" aria-label="Kopa Life home"><img src="/brand/kopalife-logo-light.svg" alt="Kopa Life" width="128" height="34" style="height:32px;width:auto"></a>
<div class="links"><a class="opt" href="/states">States</a><a class="opt" href="/nysc-camp-guide">Camp guide</a><a class="opt" href="/nysc-slang">Slang</a><a class="btn sm" href="/play">Play free</a></div></div></nav>'''
FOOT = f'''<footer><div class="wrap"><div><b>Kopa Life</b> · the corper game<br>A fictional game about the NYSC service year, built by a serving corper.<br>Not affiliated with or endorsed by the National Youth Service Corps.<br>Map data © <a href="https://www.openstreetmap.org/copyright" rel="noopener">OpenStreetMap contributors</a> (ODbL).</div>
<div class="cols"><div><b>Play</b><a href="/play">Play free</a><a href="/">Home</a></div><div><b>Guides</b><a href="/nysc-camp-guide">NYSC camp guide</a><a href="/nysc-camp-guide#packing-list">Camp packing list</a><a href="/nysc-slang">NYSC slang</a><a href="/privacy">Privacy</a></div><div><b>States</b><a href="/states/lagos">Lagos</a><a href="/states/fct">FCT Abuja</a><a href="/states/oyo">Oyo</a><a href="/states/rivers">Rivers</a><a href="/states">All 37 →</a></div></div></div></footer>'''

def page(path, title, desc, body, ld, image='/brand/og.jpg', kind='article'):
    url = SITE + path
    lds = ''.join(f'<script type="application/ld+json">{json.dumps(x, ensure_ascii=False)}</script>' for x in ld)
    return f'''<!doctype html>
<html lang="en-NG">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{E(title)}</title>
<meta name="description" content="{E(desc)}">
<link rel="canonical" href="{url}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:type" content="{kind}"><meta property="og:site_name" content="Kopa Life"><meta property="og:locale" content="en_NG">
<meta property="og:title" content="{E(title)}"><meta property="og:description" content="{E(desc)}"><meta property="og:url" content="{url}"><meta property="og:image" content="{SITE}{image}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{E(title)}"><meta name="twitter:description" content="{E(desc)}"><meta name="twitter:image" content="{SITE}{image}">
<meta name="theme-color" content="#0b1a12">
<link rel="icon" href="/brand/kopalife-mark.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/brand/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest">
{FONTS}
<link rel="stylesheet" href="/seo/site.css">
{lds}
</head>
<body>
{NAV}
<main>
{body}
</main>
{FOOT}
</body>
</html>
'''

def crumbs(items):  # [(name, path)]
    vis = ' › '.join(f'<a href="{p}">{E(n)}</a>' if p else E(n) for n, p in items)
    ld = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": n, **({"item": SITE + p} if p else {})} for i, (n, p) in enumerate(items)]}
    return f'<div class="crumbs">{vis}</div>', ld

def cta(text, sub, href='/play'):
    return f'<section class="cta"><div><h2>{text}</h2><p>{sub}</p></div><a class="btn" href="{href}">Play free now →</a></section>'

TRANSPORT = {'danfo': 'danfo buses', 'keke': 'keke (tricycles)', 'okada': 'okada (motorbikes)', 'bus': 'buses', 'BRT bus': 'BRT buses', 'drop taxi': 'drop taxis',
             'green taxi': 'green taxis', 'shuttle bus': 'shuttle buses', 'ride app': 'ride-hailing apps', 'adaidaita sahu (keke)': 'adaidaita sahu (keke)'}
CLIMATE = {'humid': 'hot and humid most of the year', 'savanna': 'hot, dry savanna weather with a rainy season', 'harmattan': 'hot days and dusty harmattan mornings',
           'riverine': 'humid, wet and surrounded by water', 'cool': 'cooler than most of Nigeria, especially in the mornings'}
def lst(xs):
    xs = list(xs)
    return xs[0] if len(xs) == 1 else ', '.join(xs[:-1]) + ' and ' + xs[-1]
def costline(c):
    if c >= 0.98: return 'the most expensive in the game: Lagos prices'
    if c >= 0.85: return 'on the high side, close to Lagos'
    if c >= 0.7: return 'cheaper than Lagos'
    return 'among the cheapest in the game'

# ---- one page per state ---------------------------------------------------------------
def state_page(st):
    z = ZONES[st['zone']]; o = OSM.get(st['id'], {}); s = slug(st); nm = short(st)
    lms = [l[1] if isinstance(l, list) else l for l in o.get('lm', [])][:6]
    lgas = st['lgas']; urban = [l for l, t in lgas if t == 'u']
    street, lmimg = img(st, 'street'), img(st, 'landmark')
    camp = st['camp']
    title = f'{nm} NYSC Camp & Corper Life in {nm} · Kopa Life'
    desc = (f'Posted to {sname(st)}? See the {nm} orientation camp ({camp}), all {len(lgas)} LGAs you can be posted to, how corpers get around in {st["capital"]}, '
            f'and play the service year on real {st["capital"]} streets, free in your browser.')
    cr, crld = crumbs([('Kopa Life', '/'), ('States', '/states'), (nm, None)])
    same_zone = [x for x in STATES if x['zone'] == st['zone'] and x['id'] != st['id']]
    hero = (f'<figure class="hero-img"><img src="{street}" alt="{('A real ' + E(st["capital"]) + ' street') if o else 'A street'} rebuilt in 3D in Kopa Life, with a corper in khaki" width="1200" height="675" fetchpriority="high"></figure>'
            + (f'<figcaption>{E(o["road"])}, {E(st["capital"])}, rebuilt in the game from OpenStreetMap data.</figcaption>' if o.get("road") else f'<figcaption>A street in {E(st["capital"])}, rebuilt in the game from OpenStreetMap data.</figcaption>' if o else f'<figcaption>The street you start on after posting in {E(nm)}. Real {E(st["capital"])} map data is coming soon.</figcaption>')) if street else ''
    lm_html = ''
    if lms:
        lm_html = f'<h2 id="landmarks">Landmarks you will see in {E(nm)}</h2><p>Walk around your posting in the game and these real places sit on the skyline and on your phone map:</p><ul class="chips">' + ''.join(f'<li>{E(l)}</li>' for l in lms) + '</ul>'
        if lmimg: lm_html += f'<figure class="hero-img" style="margin-top:20px"><img src="{lmimg}" alt="Rooftops and streets of {E(st["capital"])} in Kopa Life" width="1200" height="675" loading="lazy"></figure><figcaption>Looking out over {E(st["capital"])} in the game.</figcaption>'
    flav = f'<p>{E(st["flav"])}</p>' if st.get('flav') else ''
    body = f'''<article class="wrap narrow">
{cr}
<header class="page"><span class="kick">{E(z["name"])} · {E(st["nick"])}</span>
<h1>Serving in {E(sname(st))}: camp, LGAs and corper life</h1>
<p class="lead" style="margin-top:16px">Your call-up letter says {E(nm)}. Here is what that means: where the orientation camp is, which LGAs you can be posted to, and what daily life looks like in {E(st["capital"])}. Then play it, on real {E(st["capital"])} streets.</p></header>
{hero}
<div class="facts"><div><span>Orientation camp</span><b>{E(camp)}</b></div><div><span>Capital</span><b>{E(st["capital"])}</b></div><div><span>LGAs</span><b>{len(lgas)}{' area councils' if st['id']=='FC' else ''}</b></div><div><span>Local greeting</span><b>{E(z["greet"][0])}</b></div></div>
<h2 id="camp">The {E(nm)} orientation camp</h2>
<p>Corpers deployed to {E(sname(st))} report to the orientation camp at <b>{E(camp)}</b> for about three weeks of registration, kitting, swearing-in, parade, SAED lectures and evenings at the mammy market. At the end of camp, everyone gets a posting letter to a PPA in one of the state's LGAs.</p>
<div class="note">Camp locations can change between batches, for example when a camp is being renovated or for security reasons. Always confirm with your call-up letter and the official NYSC portal before you travel.</div>
<p>In Kopa Life your service year starts at the camp gate too. A soldier checks your call-up letter, you queue for registration, collect your khaki and jungle boots, and learn drills with your platoon. Our <a href="/nysc-camp-guide">NYSC camp guide</a> has the full packing list and daily routine.</p>
<h2 id="lgas">LGAs in {E(nm)} you can be posted to</h2>
<p>{E(sname(st))} has {len(lgas)} {'area councils' if st['id']=='FC' else 'local government areas'}. Your posting letter names one of them, and that LGA's NYSC office is where you do monthly clearance and meet your LGI. Busier, more urban areas are outlined in green.</p>
<ul class="chips">{''.join(f'<li class="{"u" if t=="u" else ""}">{E(l)}</li>' for l, t in lgas)}</ul>
<p class="cap" style="margin-top:12px">{len(urban)} of {len(lgas)} {'is a busier urban area' if len(urban)==1 else 'are busier urban areas'} in the game: more corpers, longer clearance queues and a louder group chat.</p>
<h2 id="life">Corper life in {E(st["capital"])}</h2>
<p>The weather is {E(CLIMATE.get(st["climate"], st["climate"]))}. To get around, corpers use {E(lst(TRANSPORT.get(t, t) for t in st["transport"]))}. In the game, food and transport prices in {E(nm)} are {costline(st["cost"])}.</p>
{flav}
<p>Local languages you will hear: {E(z["lang"])}. Expect greetings like <i>“{E(z["greet"][0])}”</i> and <i>“{E(z["greet"][1])}”</i>. At the buka you will find {E(lst(z["foods"][:4]))}, with {E(z["drink"])} to wash it down.</p>
{lm_html}
{cta(f'Play your service year in {E(nm)}', f'Start with the {E(nm)} call-up letter, report to camp, and get posted to a real {E(st["capital"])} street. Free, no download.', f'/play?state={st["id"]}')}
<h2>Other states in the {E(z["name"])}</h2>
<div class="grid">{''.join(card(x) for x in same_zone)}</div>
<p style="margin-top:22px"><a href="/states">See all 36 states and the FCT →</a> · <a href="/nysc-slang">NYSC slang dictionary</a></p>
</article>'''
    ld = [crld, {"@context": "https://schema.org", "@type": "Article", "headline": f'Serving in {sname(st)}: camp, LGAs and corper life',
                 "description": desc, "inLanguage": "en-NG", "dateModified": TODAY, "mainEntityOfPage": SITE + f'/states/{s}',
                 **({"image": SITE + street} if street else {}),
                 "about": {"@type": "AdministrativeArea", "name": sname(st), "containedInPlace": {"@type": "Country", "name": "Nigeria"}},
                 "author": {"@type": "Person", "name": "Uthman Abdulganiyu"}, "publisher": {"@type": "Organization", "name": "Kopa Life", "url": SITE, "logo": SITE + "/brand/icon-512.png"}}]
    return page(f'/states/{s}', title, desc, body, ld, image=street or '/brand/og.jpg')

def card(x):
    im = img(x, 'street')
    pic = f'<img src="{im}" alt="{E(x["capital"])} in Kopa Life" width="1200" height="675" loading="lazy">' if im else ''
    return f'<a href="/states/{slug(x)}">{pic}<div><b>{E(short(x))}</b><small>Camp: {E(x["camp"])}</small></div></a>'

# ---- states index ----------------------------------------------------------------------------
def states_index():
    cr, crld = crumbs([('Kopa Life', '/'), ('States', None)])
    order = ['SW', 'SE', 'SS', 'NC', 'NE', 'NW']
    secs = ''.join(f'<h2 id="{z.lower()}">{E(ZONES[z]["name"])}</h2><div class="grid">' + ''.join(card(x) for x in STATES if x['zone'] == z) + '</div>' for z in order)
    body = f'''<div class="wrap">{cr}
<header class="page"><span class="kick">36 states + the FCT</span><h1>NYSC orientation camps by state</h1>
<p class="lead" style="margin-top:16px">Where is the camp, which LGAs can you be posted to, and what is corper life like there? Pick your state from your call-up letter. Every state in Kopa Life is built on its real streets.</p></header>
<div class="note">Camp locations here are the ones used in the game. They can change between batches, so always confirm with your call-up letter and the official NYSC portal.</div>
{secs}
{cta('Got your call-up letter?', 'Play the service year in your state: camp, posting, CDS, clearance and POP.')}
</div>'''
    ld = [crld, {"@context": "https://schema.org", "@type": "ItemList", "name": "NYSC orientation camps by state", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "url": SITE + f'/states/{slug(x)}', "name": f'{short(x)} NYSC camp'} for i, x in enumerate(STATES)]}]
    return page('/states', 'NYSC Orientation Camps in All 36 States + FCT · Kopa Life',
                'Find the NYSC orientation camp for your state, the LGAs you can be posted to and what corper life is like there. All 36 states and the FCT, each playable on real streets in Kopa Life.',
                body, ld, kind='website')

# ---- slang dictionary -----------------------------------------------------------------------
SLANG = [
    ('Corper / Kopa', 'A serving NYSC member. Written “corper”, said “kopa”. You will hear it everywhere, from the bus park to your PPA. It is also where this game gets its name.'),
    ('Otondo', 'Street slang for a corper, usually teasing. Walk past a market in khaki and someone will shout it.'),
    ('Call-up letter', 'The letter that tells you which state you have been deployed to and when to report to camp. Print it: the soldier at the gate will ask for it.'),
    ('Mobilisation', 'The whole process of registering, getting your call-up letter and being sent to camp.'),
    ('Batch and stream', 'Corpers are mobilised in batches through the year (Batch A, B and C), and a batch can be split into streams that go to camp at different times.'),
    ('State code', 'Your NYSC number, for example LA/25B/1234: state, year, batch and your number. You will write it on everything for a year.'),
    ('Orientation camp', 'The three-week course that starts the service year: registration, kitting, swearing-in, drills, lectures and SAED.'),
    ('Kitting', 'Collecting your NYSC kit at camp: khaki, crested vest, white T-shirts and shorts, jungle boots, canvas, socks, belt and cap.'),
    ('Khaki', 'The NYSC uniform. You wear it to CDS, clearance and official events, and people will know you are a corper from a distance.'),
    ('Jungle boots (JB)', 'The boots that come with your kit. Breaking them in during parade is a rite of passage.'),
    ('Swearing-in', 'The ceremony early in camp where corpers take the oath and officially become corps members.'),
    ('Platoon', 'Your group in camp. Platoons compete in drills, sports, cooking, dance and parade, and the rivalry is real.'),
    ('Parade', 'Morning drills on the parade ground: attention, stand at ease, right turn, left turn, about turn, and practice for the passing-out ceremony.'),
    ('Man O’ War', 'The paramilitary and adventure training sessions in camp, known for early mornings, obstacle courses and a lot of shouting.'),
    ('Bugle', 'The sound that wakes the camp before sunrise. You will hear it in your dreams.'),
    ('Mammy market', 'The camp market: food, drinks, phone charging, photocopies, barbing, and the best place to gist at night.'),
    ('SAED', 'Skills Acquisition and Entrepreneurship Development. Lectures and training in camp, and later during service, on skills like fashion, ICT, agriculture and cosmetology.'),
    ('PPA', 'Place of Primary Assignment: the school, hospital, office or organisation where you work during your service year.'),
    ('Posting letter', 'The letter you get at the end of camp that names your PPA.'),
    ('Rejection letter', 'When a PPA says they cannot take you. You return to your LGA office for reposting.'),
    ('Acceptance letter', 'The letter from your PPA confirming they have taken you. Submit it so your records are complete.'),
    ('LGI', 'Local Government Inspector: the NYSC official in charge of corpers in your LGA. Your clearance, CDS and many of your questions go through the LGI.'),
    ('ZI', 'Zonal Inspector: the NYSC official over a zone that covers several LGAs.'),
    ('CDS', 'Community Development Service. A weekly day when corpers meet in CDS groups and work on projects for the community. Attendance counts.'),
    ('Clearance', 'The monthly check, often with a thumbprint or biometric scan, that confirms you are at your post. No clearance can mean no allowance for that month.'),
    ('Allawee', 'The monthly federal allowance paid to corpers. Also the reason for a lot of group-chat messages around month end.'),
    ('Corpers’ lodge', 'Accommodation set aside for corpers in some places. Quality varies, and so do the roommates.'),
    ('Redeployment', 'Moving to another state after camp, usually on health, marriage or security grounds and with approval.'),
    ('Sapa', 'Being broke. Common in the days before allawee lands.'),
    ('POP', 'Passing Out Parade: the end of the service year, when you collect your Certificate of National Service and say goodbye to khaki.'),
]
def slang_page():
    cr, crld = crumbs([('Kopa Life', '/'), ('NYSC slang', None)])
    letters = sorted(set(t[0][0].upper() for t in SLANG))
    terms = ''.join(f'<div id="{re.sub("[^a-z0-9]+","-",t.lower()).strip("-")}"><dt>{E(t)}</dt><dd>{E(d)}</dd></div>' for t, d in SLANG)
    body = f'''<article class="wrap narrow">{cr}
<header class="page"><span class="kick">Dictionary · {len(SLANG)} words</span><h1>NYSC slang: every word you will hear in your service year</h1>
<p class="lead" style="margin-top:16px">From “otondo” at the bus stop to “allawee” at month end. The words corpers use, explained simply, from the camp gate to POP.</p></header>
<dl class="terms">{terms}</dl>
<div class="note">Words and meanings vary from camp to camp and state to state. Heard one we missed? Tell us and we will add it.</div>
{cta('Hear all of it in the game', 'Soldiers, the LGI, conductors and your group chat speak exactly like this in Kopa Life.')}
<p><a href="/nysc-camp-guide">NYSC camp guide and packing list →</a></p>
</article>'''
    ld = [crld, {"@context": "https://schema.org", "@type": "DefinedTermSet", "name": "NYSC slang dictionary", "url": SITE + '/nysc-slang', "inLanguage": "en-NG",
                 "hasDefinedTerm": [{"@type": "DefinedTerm", "name": t, "description": d} for t, d in SLANG]}]
    return page('/nysc-slang', 'NYSC Slang Dictionary: Otondo, Allawee, PPA, CDS & More · Kopa Life',
                f'{len(SLANG)} NYSC words every corper hears, explained simply: otondo, kopa, allawee, PPA, CDS, LGI, SAED, mammy market, clearance, POP and more.', body, ld)

# ---- camp guide + packing list ----------------------------------------------------------
PACK = [
    ('Documents', ['Printed call-up letter', 'Your statement of result or certificate, plus photocopies', 'School ID card and a government ID (NIN slip or similar)', 'Medical fitness certificate, if your call-up letter asks for it', 'Passport photographs on a white background (bring plenty)', 'A waterproof folder or envelope to keep all of it dry']),
    ('Clothes', ['White T-shirts and white shorts (several of each)', 'White socks and white canvas/tennis shoes', 'Slippers for the hostel and bathroom', 'Comfortable casual clothes for evenings', 'Nightwear and enough underwear for a few days between washes', 'A sweater or jacket if you are posted somewhere cool, like Plateau']),
    ('Hostel life', ['Bucket and bowl', 'Padlock and key for your box or locker', 'Bedsheet, pillow and a light blanket', 'Mosquito net or repellent', 'Rechargeable lamp or torch', 'Power bank (charging points get crowded)', 'Plate, spoon, cup and a small flask', 'Hangers, a rope or line, and washing powder']),
    ('Personal care', ['Toiletries, towel and sanitary products', 'Any medication you take, with your prescription', 'Basic first aid: plasters, pain relief, ORS', 'Sunscreen or a cap for long hours on the parade ground']),
    ('Money', ['Cash in small notes for the mammy market', 'Your bank app working and your BVN details handy', 'A little extra for transport after camp']),
]
DAY = [('Before sunrise', 'The bugle wakes the camp. Morning devotion, then out to the parade ground.'),
       ('Morning', 'Parade drills, Man O’ War training, then breakfast.'),
       ('Midday', 'Lectures in the hall: NYSC rules, security, health and career talks.'),
       ('Afternoon', 'SAED sessions and platoon activities.'),
       ('Evening', 'Sports, social nights, and the mammy market for food, charging and gist.'),
       ('Night', 'Back to the hostel for lights out. Tomorrow starts early again.')]
FAQ_GUIDE = [
    ('How long is NYSC orientation camp?', 'Orientation camp is about three weeks (21 days) at the start of the service year. Check your call-up letter for your exact dates.'),
    ('What should I not bring to NYSC camp?', 'Many camps do not allow heating appliances like electric kettles, pressing irons or cooking stoves in the hostels. Rules vary, so check your camp’s instructions.'),
    ('What happens after camp?', 'You get a posting letter to a PPA in one of the state’s LGAs. From then on you work at your PPA, attend CDS weekly, and do clearance at your LGA office every month until POP.'),
    ('Do I need to buy white clothes before camp?', 'Your kit includes some white items, but most corpers bring extra white T-shirts, shorts, socks and canvas shoes because you wear them every day and laundry takes time.'),
]
def guide_page():
    cr, crld = crumbs([('Kopa Life', '/'), ('NYSC camp guide', None)])
    pack = ''.join(f'<h3>{E(h)}</h3><ul class="check">' + ''.join(f'<li>{E(i)}</li>' for i in items) + '</ul>' for h, items in PACK)
    day = '<ol class="day">' + ''.join(f'<li><b>{E(t)}.</b> {E(d)}</li>' for t, d in DAY) + '</ol>'
    faq = '<div class="faq">' + ''.join(f'<details><summary>{E(q)}</summary><p>{E(a)}</p></details>' for q, a in FAQ_GUIDE) + '</div>'
    body = f'''<article class="wrap narrow">{cr}
<header class="page"><span class="kick">Guide · from a serving corper</span><h1>NYSC camp guide: what to pack, what to expect</h1>
<p class="lead" style="margin-top:16px">The packing list, the daily routine, and the small things nobody tells you before your three weeks in khaki.</p></header>
<nav class="toc" aria-label="On this page"><a href="#packing-list">Packing list</a><a href="#arrival">Arriving at camp</a><a href="#routine">Daily routine</a><a href="#tips">Survival tips</a><a href="#after-camp">After camp</a><a href="#faq">FAQ</a></nav>
<div class="note">Requirements change from batch to batch. Your call-up letter and the official NYSC portal always come first; this guide fills in the rest.</div>
<h2 id="packing-list">What to take to NYSC camp: the packing list</h2>
{pack}
<h2 id="arrival">Arriving at camp</h2>
<p>At the gate, soldiers check your call-up letter and search your bag. Then comes registration: document checks, a thumbprint, your photographs and a room in the hostel. Kitting follows, where you collect your khaki, crested vest, white T-shirts and shorts, jungle boots and canvas. Expect queues at every step. Arrive early and keep your documents in one folder you can open quickly.</p>
<h2 id="routine">A day in camp</h2>
{day}
<h2 id="tips">Survival tips</h2>
<ul class="check"><li>Label everything you own, especially white clothes and buckets.</li><li>Join your platoon group chat, but confirm important news with officials before acting on it.</li><li>Drink water and use sunscreen. Parade grounds get hot.</li><li>Keep a power bank charged; the charging queue at the mammy market is long at night.</li><li>Make friends across platoons. They will be your information network after camp.</li><li>Rest when you can. Camp is short, and the days start very early.</li></ul>
<h2 id="after-camp">After camp: PPA, CDS and clearance</h2>
<p>At the end of camp you get a posting letter. Report to your PPA, submit your acceptance letter, and get to know your LGA’s NYSC office and LGI. Every week there is CDS with your group. Every month there is clearance, and your allowance depends on it. Then, at the end of the year, POP. Words you don’t know yet? Check the <a href="/nysc-slang">NYSC slang dictionary</a>, or find your state on <a href="/states">the states page</a>.</p>
<h2 id="faq">Questions corpers ask</h2>
{faq}
{cta('Practise camp before you go', 'Kopa Life starts at the camp gate: call-up letter, registration, kitting, parade and the mammy market. Free in your browser.')}
</article>'''
    ld = [crld, {"@context": "https://schema.org", "@type": "Article", "headline": 'NYSC camp guide: what to pack, what to expect', "inLanguage": "en-NG", "dateModified": TODAY,
                 "mainEntityOfPage": SITE + '/nysc-camp-guide', "image": SITE + '/landing/img/parade.jpg', "author": {"@type": "Person", "name": "Uthman Abdulganiyu"},
                 "publisher": {"@type": "Organization", "name": "Kopa Life", "url": SITE, "logo": SITE + "/brand/icon-512.png"}},
          {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in FAQ_GUIDE]}]
    return page('/nysc-camp-guide', 'NYSC Camp Packing List & Survival Guide (2026) · Kopa Life',
                'What to take to NYSC orientation camp, what happens on arrival, the daily routine, and survival tips from a serving corper. Then practise camp in Kopa Life, free.', body, ld, image='/landing/img/parade.jpg')

# ---- privacy notice ---------------------------------------------------------------------------
SEC_CONTACT = 'https://github.com/Auspicious14/nysc-survival/security/advisories/new'
def privacy_page():
    cr, crld = crumbs([('Kopa Life', '/'), ('Privacy', None)])
    rows = [
        ('A random device ID', 'Made by your browser when you first play. It is not linked to your name, phone or email.', 'Count players and show how many people are playing', '12 months after you last play'),
        ('The state and LGA you are playing in, and which part of the game', 'For example "Lagos · Ikeja LGA · street".', 'Player counts per state and LGA', '12 months after you last play'),
        ('Your survey answers (optional)', 'Only if you fill in the survey after Chapter 1.', 'Decide what to build next', 'Until the game shuts down, or you ask us to delete them'),
        ('Reports you send', 'The reported player\'s in-game name and message.', 'Keep online chat safe', '6 months'),
        ('Your network (IP) address', 'Seen briefly by our database.', 'Stop people flooding the game with fake players or guessing the admin password', '2 days (failed admin logins: 1 day)'),
    ]
    table = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:15px"><thead><tr>' + ''.join(f'<th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);color:var(--khaki)">{h}</th>' for h in ['What', 'Details', 'Why', 'Kept for']) + '</tr></thead><tbody>' + ''.join('<tr>' + ''.join(f'<td style="vertical-align:top;padding:10px 8px;border-bottom:1px solid var(--line)">{E(c)}</td>' for c in r) + '</tr>' for r in rows) + '</tbody></table></div>'
    body = f'''<article class="wrap narrow">{cr}
<header class="page"><span class="kick">Last updated {TODAY}</span><h1>Privacy</h1>
<p class="lead" style="margin-top:16px">Kopa Life is a free, fictional game about the NYSC service year, made by an independent developer. It is not affiliated with the National Youth Service Corps. We collect as little as we can.</p></header>
<h2>What we collect on this website</h2>
{table}
<h2>What we do not collect</h2>
<ul class="check"><li>Your real name, email, phone number, photos or contacts.</li><li>Your location from GPS. The state you play in is the one you choose in the game.</li><li>No ads, no tracking pixels, and we never sell or share data for marketing.</li></ul>
<h2>What stays on your phone</h2>
<p>Your saved game, your settings and your corper name are kept in your browser's storage on your device. Clearing this site's data in your browser deletes them.</p>
<h2>Playing online</h2>
<p>When you play online, other players in your camp, LGA or PPA can see your corper name, outfit, where you are standing, and the messages you send to everyone. Those messages pass through our realtime service and are not stored. <b>Private messages are encrypted end to end</b>: only you and the person you write to can read them. Phone numbers and links are hidden in chat to protect players from scams. Never share bank details or your home address with someone you met in a game.</p>
<p>Online chat is meant for people aged 18 and over.</p>
<h2>Who helps us run the game</h2>
<p><b>Vercel</b> hosts the website and <b>Supabase</b> runs the database and online play. Map data comes from <a href="https://www.openstreetmap.org/copyright" rel="noopener">OpenStreetMap</a>. They process data only to provide these services.</p>
<h2>Your rights</h2>
<p>Under the Nigeria Data Protection Act 2023 you can ask what we hold about you, ask us to correct or delete it, and complain to the Nigeria Data Protection Commission. Because we do not know who you are, tell us the date and the state you played in, and we will find and delete the matching records.</p>
<h2 id="contact">Contact</h2>
<p>For privacy questions or to report a security problem, write to us through our <a href="{SEC_CONTACT}" rel="noopener">private reporting page</a>. Please do not test the security of the game in a way that affects other players.</p>
</article>'''
    return page('/privacy', 'Privacy · Kopa Life', 'What Kopa Life collects (very little), why, how long we keep it, and your rights under the Nigeria Data Protection Act.', body, [crld], kind='website')

# ---- write everything ----------------------------------------------------------------------
os.makedirs(os.path.join(OUT, 'states'), exist_ok=True)
for st in STATES:
    open(os.path.join(OUT, 'states', slug(st) + '.html'), 'w', encoding='utf-8').write(state_page(st))
open(os.path.join(OUT, 'states', 'index.html'), 'w', encoding='utf-8').write(states_index())
open(os.path.join(OUT, 'nysc-slang.html'), 'w', encoding='utf-8').write(slang_page())
open(os.path.join(OUT, 'nysc-camp-guide.html'), 'w', encoding='utf-8').write(guide_page())
open(os.path.join(OUT, 'privacy.html'), 'w', encoding='utf-8').write(privacy_page())

urls = [('/', '1.0', 'weekly'), ('/play', '0.9', 'weekly'), ('/nysc-camp-guide', '0.8', 'monthly'), ('/nysc-slang', '0.8', 'monthly'), ('/states', '0.8', 'monthly'), ('/privacy', '0.3', 'yearly')] + \
       [(f'/states/{slug(s)}', '0.7', 'monthly') for s in STATES]
sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(
    f'  <url><loc>{SITE}{u}</loc><lastmod>{TODAY}</lastmod><changefreq>{f}</changefreq><priority>{p}</priority></url>\n' for u, p, f in urls) + '</urlset>\n'
open(os.path.join(ROOT, 'public', 'sitemap.xml'), 'w').write(sm)
open(os.path.join(ROOT, 'public', 'robots.txt'), 'w').write(f'User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: {SITE}/sitemap.xml\n')
print('pages:', len(STATES) + 3, 'sitemap urls:', len(urls), 'images:', len(os.listdir(IMG)))
