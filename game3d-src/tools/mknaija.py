import json, re, sys
src = json.load(open(sys.argv[1]))['states']
norm = lambda s: re.sub(r'[^a-z]', '', s.lower())
CAMPS = {
 'AB': ('Umunna, Bende LGA', 'Bende'), 'AD': ('Damare, Girei LGA (Lapondo Road)', 'Girei'), 'AK': ('Ikot Itie Udung, Nsit Atai LGA', 'Nsit Atai'),
 'AN': ('Umuawulu/Mbaukwu, Awka South LGA', 'Awka South'), 'BA': ('Wailo, Ganjuwa LGA (KM 60)', 'Ganjuwa'), 'BY': ('Kaiama, Kolokuma/Opokuma LGA', 'Kolokuma/Opokuma'),
 'BE': ('Wannune, Tarka LGA (Makurdi–Gboko Road)', 'Tarka'), 'BO': ('Maiduguri (Arabic Teachers College)', 'Maiduguri'), 'CR': ('Obubra, Obubra LGA', 'Obubra'),
 'DT': ('Issele-Uku, Aniocha North LGA', 'Aniocha North'), 'EB': ('Afikpo (Macgregor College)', 'Afikpo North'), 'ED': ('Okada, Ovia North-East LGA', 'Ovia North-East'),
 'EK': ('Ise/Emure LGA', 'Ise/Orun'), 'EN': ('Awgu LGA', 'Awgu'), 'FC': ('Kubwa, Bwari Area Council', 'Bwari'), 'GB': ('Amada, Gombe–Bauchi Highway (KM 21)', 'Akko'),
 'IM': ('Eziama Obaire, Nkwerre LGA', 'Nkwerre'), 'JG': ('Fanisau, Dutse LGA', 'Dutse'), 'KD': ('Kurmin Mashi, Kaduna', 'Kaduna North'), 'KN': ('Kusala Dam, Karaye LGA', 'Karaye'),
 'KT': ('Mani Road, Katsina', 'Katsina'), 'KB': ('Dakingari, Suru LGA', 'Suru'), 'KG': ('Asaya, Kabba/Bunu LGA', 'Kabba/Bunu'), 'KW': ('Yikpata, Edu LGA', 'Edu'),
 'LA': ('Iyana-Ipaja, Agege', 'Agege'), 'NR': ('Keffi (Magaji Dan-Yamusa camp)', 'Keffi'), 'NG': ('Paiko, Paikoro LGA', 'Paikoro'), 'OG': ('Sagamu, Ikenne Road', 'Sagamu'),
 'OD': ('Ikare-Akoko, Akoko North-East LGA', 'Akoko North-East'), 'OS': ('Ede, Ede North LGA', 'Ede North'), 'OY': ('Iseyin (Government Technical College)', 'Iseyin'),
 'PL': ('Doi-Du, Jos South LGA', 'Jos South'), 'RV': ('Nonwa-Gbam, Tai LGA', 'Tai'), 'SO': ('Wamakko, Wamakko LGA', 'Wamako'), 'TR': ('Sibre, Airport Road, Jalingo', 'Jalingo'),
 'YB': ('Dazigau, Nangere LGA (Potiskum–Kano Road)', 'Nangere'), 'ZA': ('Tsafe, Tsafe LGA', 'Tsafe'),
}
ZONE = {'SW': ['EK','LA','OG','OD','OS','OY'], 'SE': ['AB','AN','EB','EN','IM'], 'SS': ['AK','BY','CR','DT','ED','RV'], 'NC': ['BE','FC','KG','KW','NR','NG','PL'], 'NE': ['AD','BA','BO','GB','TR','YB'], 'NW': ['JG','KD','KN','KT','KB','SO','ZA']}
ZOF = {c: z for z, cs in ZONE.items() for c in cs}
URB = { # urban (U) and semi-urban (S) LGAs; everything else is treated as rural
 'AB': ('Aba North,Aba South,Umuahia North', 'Umuahia South,Osisioma,Ohafia'), 'AD': ('Yola North,Yola South', 'Girei,Mubi North,Numan'), 'AK': ('Uyo', 'Eket,Ikot Ekpene,Itu,Oron'),
 'AN': ('Awka South,Onitsha North,Onitsha South,Nnewi North', 'Idemili North,Ekwusigo,Awka North'), 'BA': ('Bauchi', 'Katagum,Misau'), 'BY': ('Yenagoa', 'Sagbama'),
 'BE': ('Makurdi', 'Gboko,Otukpo,Katsina-Ala'), 'BO': ('Maiduguri,Jere', 'Biu'), 'CR': ('Calabar Municipal,Calabar South', 'Ikom,Ogoja,Yakuur'),
 'DT': ('Oshimili South,Warri South,Uvwie', 'Ughelli North,Ika South,Sapele,Warri North'), 'EB': ('Abakaliki', 'Ebonyi,Afikpo North'), 'ED': ('Oredo,Egor,Ikpoba-Okha', 'Etsako West,Esan West,Esan Central'),
 'EK': ('Ado Ekiti', 'Ikere,Oye,Ijero'), 'EN': ('Enugu North,Enugu South,Enugu East', 'Nsukka,Udi'), 'FC': ('Abuja Municipal Area Council', 'Bwari,Gwagwalada,Kuje'), 'GB': ('Gombe', 'Akko,Billiri'),
 'IM': ('Owerri Municipal,Owerri North,Owerri West', 'Orlu,Okigwe'), 'JG': ('Dutse', 'Hadejia,Kazaure'), 'KD': ('Kaduna North,Kaduna South,Chikun', 'Igabi,Zaria,Sabon Gari,Jema\'a'),
 'KN': ('Kano Municipal,Fagge,Dala,Gwale,Nasarawa,Tarauni', 'Ungogo,Kumbotso'), 'KT': ('Katsina', 'Funtua,Daura'), 'KB': ('Birnin Kebbi', 'Argungu,Yauri'),
 'KG': ('Lokoja', 'Okene,Kabba/Bunu,Idah,Ankpa'), 'KW': ('Ilorin West,Ilorin East,Ilorin South', 'Offa,Irepodun'), 'LA': ('Agege,Ajeromi-Ifelodun,Alimosho,Amuwo-Odofin,Apapa,Eti Osa,Ifako-Ijaiye,Ikeja,Kosofe,Lagos Island,Lagos Mainland,Mushin,Ojo,Oshodi-Isolo,Somolu,Surulere', 'Ikorodu,Badagry,Ibeju-Lekki,Epe'),
 'NR': ('Lafia,Karu', 'Keffi,Akwanga,Nasarawa'), 'NG': ('Chanchaga,Bosso', 'Suleja,Bida,Kontagora'), 'OG': ('Abeokuta South,Abeokuta North,Ado-Odo/Ota', 'Sagamu,Ijebu Ode,Ifo,Obafemi Owode'),
 'OD': ('Akure South', 'Akure North,Ondo West,Owo,Akoko South-West'), 'OS': ('Osogbo,Olorunda', 'Ife Central,Ilesa East,Ilesa West,Ede North,Iwo'), 'OY': ('Ibadan North,Ibadan North-East,Ibadan North-West,Ibadan South-East,Ibadan South-West', 'Ogbomosho North,Oyo,Akinyele,Egbeda,Iseyin,Saki West'),
 'PL': ('Jos North,Jos South', 'Shendam,Pankshin,Mangu'), 'RV': ('Port Harcourt,Obio/Akpor', 'Eleme,Ikwerre,Oyigbo,Bonny'), 'SO': ('Sokoto North,Sokoto South', 'Wamako'),
 'TR': ('Jalingo', 'Wukari,Takum'), 'YB': ('Damaturu', 'Potiskum,Nguru'), 'ZA': ('Gusau', 'Kaura Namoda,Talata Mafara'),
}
COST = {'LA': 1.0, 'FC': 1.05, 'RV': 0.95, 'OG': 0.8, 'OY': 0.75, 'EN': 0.75, 'AN': 0.8, 'DT': 0.8, 'ED': 0.75, 'AK': 0.75, 'KD': 0.7, 'KN': 0.7, 'PL': 0.7, 'CR': 0.7, 'IM': 0.75, 'AB': 0.75, 'KW': 0.65, 'NR': 0.75}
CLIMATE = {'PL': 'cool', 'BY': 'riverine', 'RV': 'humid', 'AK': 'humid', 'CR': 'humid', 'DT': 'humid', 'LA': 'humid'}
for c in ZONE['NE'] + ZONE['NW']: CLIMATE.setdefault(c, 'harmattan')
for c in ['KW', 'NG', 'KG', 'BE', 'NR', 'FC']: CLIMATE.setdefault(c, 'savanna')
TRANSPORT = { # local flavour; what you see on the road
 'LA': ['danfo', 'keke', 'BRT bus', 'ride app'], 'FC': ['green taxi', 'shuttle bus', 'ride app'], 'KN': ['adaidaita sahu (keke)', 'okada', 'bus'], 'RV': ['drop taxi', 'keke', 'bus'],
}
CULT = {
 'SW': dict(lang='Yoruba', greet=['Ẹ káàárọ̀ o, corper!', 'Corper, ẹ kú iṣẹ́ o!', 'Ṣé àlàáfíà ni?', 'Omo, the sun is not smiling today.'], foods=['Amala & ewedu', 'Ofada rice & ayamase', 'Ewa agoyin & bread', 'Puff-puff', 'Akara & pap'], drink='Zobo', market='Mama Put', bus='danfo', musics='Fuji & Afrobeats'),
 'SE': dict(lang='Igbo', greet=['Corper, nnọọ!', 'Kedụ?', 'Ndeewo o!', 'Biko, how market today?'], foods=['Abacha & ugba', 'Okpa', 'Ofe onugbu & fufu', 'Nkwobi', 'Ji mmiri oku (yam pepper soup)'], drink='Palm wine (no be for PPA o)', market='Mama Nkechi', bus='shuttle bus', musics='Highlife & Afrobeats'),
 'SS': dict(lang='Pidgin', greet=['How far, corper?', 'Abeg welcome!', 'Wetin dey happen?', 'Ah ah, corper, you don chop?'], foods=['Banga soup & starch', 'Bole & fish', 'Afang soup & eba', 'Edikaikong', 'Fish pepper soup'], drink='Chapman', market='Mama Ebi', bus='taxi', musics='Afrobeats & Owigiri'),
 'NC': dict(lang='Hausa / Yoruba / Tiv / Nupe', greet=['Sannu, corper!', 'Ẹ káàbọ̀ o!', 'Corper, you are welcome.', 'Ina kwana?'], foods=['Pounded yam & egusi', 'Tuwo shinkafa & miyan kuka', 'Suya', 'Masa', 'Kunu'], drink='Kunu', market='Mama Rakiya', bus='keke', musics='Afrobeats & Highlife'),
 'NE': dict(lang='Hausa / Kanuri / Fulfulde', greet=['Sannu da zuwa, corper!', 'Ina kwana?', 'Jam na?', 'Barka da rana!'], foods=['Tuwo masara & miyan kuka', 'Masa & miyan taushe', 'Kilishi', 'Fura da nono', 'Dambu'], drink='Fura da nono', market='Mama Hauwa', bus='keke', musics='Hausa pop & Afrobeats'),
 'NW': dict(lang='Hausa', greet=['Sannu, corper!', 'Ina kwana?', 'Barka da zuwa!', 'Yaya aiki?'], foods=['Tuwo shinkafa & miyan kuka', 'Masa', 'Suya', 'Kosai', 'Fura da nono'], drink='Kunu', market='Mama Aisha', bus='keke', musics='Hausa pop & Afrobeats'),
}
FLAV = { # one honest line of flavour per state for the posting letter / camp card
 'LA': 'Traffic, hustle and the fastest group chats in the country.', 'FC': 'Wide roads, green taxis, ministries everywhere and Aso Rock on the horizon.',
 'KW': 'Calm Ilorin streets, dundun drums and amala that will not disappoint you.', 'KN': 'Ancient city walls, the Kurmi market, and a keke called adaidaita sahu.',
 'RV': 'Port Harcourt "drop" taxis, soot on the windscreen, and fish pepper soup.', 'PL': 'Cold Jos mornings. Bring a sweater. Yes, in Nigeria.',
 'EN': 'Coal City hills, Udi road bends and okpa at every junction.', 'OY': 'Brown rooftops of Ibadan, amala at Bodija, and very long streets.',
 'BO': 'Hot days, cool harmattan nights, and very warm hospitality.', 'BY': 'Rivers, creeks and boats. Some PPAs are a boat ride away.',
 'CR': 'Calabar carnival, edikaikong soup and Obudu mountain air.', 'KB': 'Home of the Argungu fishing festival and rice fields.',
}
FIX = {'Yola North/Jimeta': 'Yola North', 'Oshimili South/Oshimili': 'Oshimili South', 'Atigbo': 'Atisbo', 'Shagamu': 'Sagamu'}
def tag(code, lgas):
    u, s = URB.get(code, ('', ''))
    U = {norm(x) for x in u.split(',') if x}; S = {norm(x) for x in s.split(',') if x}
    out = []; hit = set()
    for l in lgas:
        n = norm(FIX.get(l['name'], l['name'])); t = 'r'
        if n in U: t = 'u'; hit.add(n)
        elif n in S: t = 's'; hit.add(n)
        out.append([FIX.get(l['name'], l['name']), t])
    miss = (U | S) - hit
    return out, miss
states = []
for s in src:
    c = s['code']; lg, miss = tag(c, s['local_government_areas'])
    if miss: print('MISS', c, miss, file=sys.stderr)
    z = ZOF[c]; nick = s['nicknames']; nick = nick[0] if isinstance(nick, list) else nick
    camp = CAMPS[c]
    states.append(dict(id=c, name=s['name'].replace('Federal Capital Territory', 'FCT'), full=s['name'], capital=s['capital_city'], nick=nick, zone=z, camp=camp[0], campLga=camp[1],
                       cost=COST.get(c, 0.62), climate=CLIMATE.get(c, 'humid' if z in ('SS', 'SE', 'SW') else 'savanna'), transport=TRANSPORT.get(c, ['keke', 'okada', 'bus'] if z not in ('SW',) or c != 'LA' else ['danfo']),
                       flav=FLAV.get(c, ''), lgas=lg))
js = '// Nigeria for NYSC Survival: 36 states + FCT, 774 LGAs, orientation camps, regional flavour.\n' \
     '// LGA names: github.com/skaex/ng.states (GPL-3.0 data file; names are public facts). Camp locations: public listings (legit.ng, 2025) and may change.\n' \
     '// Urban/semi-urban tags, costs, foods, greetings and flavour lines are game design, not official data.\n' \
     'export const ZONES = ' + json.dumps({k: dict(name={'SW': 'South-West', 'SE': 'South-East', 'SS': 'South-South', 'NC': 'North-Central', 'NE': 'North-East', 'NW': 'North-West'}[k], **v) for k, v in CULT.items()}, ensure_ascii=False) + ';\n' \
     'export const STATES = ' + json.dumps(states, ensure_ascii=False, separators=(',', ':')) + ';\n'
open(sys.argv[2], 'w').write(js)
print(len(states), sum(len(s['lgas']) for s in states), 'urban', sum(1 for s in states for l in s['lgas'] if l[1] == 'u'), 'semi', sum(1 for s in states for l in s['lgas'] if l[1] == 's'))
