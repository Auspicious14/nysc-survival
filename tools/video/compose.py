#!/usr/bin/env python3
"""Cut game clips into a finished vertical video: python3 compose.py ad|gameplay
Each segment: (clip, in_s, out_s, caption_png_or_None). Voices come from clips/<clip>.json (logged by scenes.js),
plus EXTRA voice lines placed by hand. Music: the game's own Afrobeat track, ducked under the voices."""
import json, subprocess, sys, os
FPS = 30; VOICE = '/home/claude/nysc3d/voice/'; MUSIC = '/home/claude/nysc3d/audio/afrobeat1.mp3'
ENC = ['-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', str(FPS)]
VID = {  # voice ids by text (from voice/script.json)
    'last_stop': '01de92c3', 'rumour': '544ec33a', 'pure_water': None, 'fall_in': 'c4eb71d4', 'puff': None,
}
script = json.load(open('/home/claude/nysc3d/voice/script.json'))
def vid(text): return next(x['id'] for x in script if x['text'] == text)

EDL = {
  'ad': [
    ('gate', 2.0, 5.7, 'ad1'), ('parade', 1.0, 4.2, 'ad2'), ('phone', 0.6, 3.4, 'ad3'), ('phone', 6.6, 8.6, 'ad3b'),
    ('clearance', 4.6, 8.4, 'ad4'), ('street', 1.0, 4.2, 'ad5'), ('result', 0.6, 2.6, 'ad6'), ('END', 0, 3.6, None)],
  'gameplay': [
    ('gate', 0.0, 9.6, 'k1'), ('register', 0.2, 5.0, 'k2'), ('kit', 0.2, 6.0, 'k3'), ('social', 0.4, 8.6, 'k4'), ('parade', 0.4, 8.4, 'k5'),
    ('posting', 0.6, 7.2, 'k6'), ('street', 0.0, 6.0, 'k7'), ('phone', 0.4, 9.4, 'k8'), ('ppa', 0.4, 6.6, 'k9'), ('clearance', 0.4, 10.8, 'k10'),
    ('result', 0.4, 5.6, 'k11'), ('END', 0, 4.0, None)],
}
EXTRA = {  # (clip, at_seconds_in_clip, voice id): sounds the game plays at random (hawkers, conductors) or that fit the moment
  ('street', 1.3): vid('Secretariat! Secretariat! Enter quick!'),
  ('street', 3.6): vid('Enter with your change o!'),
  ('phone', 2.6): vid('Na rumour! LGI never talk am!'),
  ('clearance', 1.0): vid('Who said no clearance without CDS card?!'),
}
def dur(f): return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).decode())

def build(name):
    segs = EDL[name]; os.makedirs('tmp', exist_ok=True); parts = []; voices = []; t = 0.0
    for i, (clip, a, b, cap) in enumerate(segs):
        out = f'tmp/{name}_{i:02d}.mp4'; d = b - a
        if clip == 'END':
            vf = f"loop=-1:1,trim=duration={d},fade=in:0:9,format=yuv420p"
            cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', 'ov/endcard.jpg', '-vf', vf, *ENC, out + '.tmp.mp4']
        else:
            src = f'clips/{clip}.mp4'
            if cap:
                fc = f"[0:v]trim=start={a}:end={b},setpts=PTS-STARTPTS[v];[1:v]format=rgba,fade=in:st=0:d=0.18:alpha=1[c];[v][c]overlay=0:0:shortest=0,format=yuv420p"
                cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-loop', '1', '-framerate', str(FPS), '-t', str(d), '-i', f'ov/{cap}.png', '-filter_complex', fc, '-t', str(d), *ENC, out + '.tmp.mp4']
            else:
                cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-ss', str(a), '-to', str(b), '-i', src, *ENC, out + '.tmp.mp4']
            # voices that start inside this segment
            log = json.load(open(f'clips/{clip}.json'))['voices']
            for k, v in enumerate(log):
                if v['ev'] != 'play': continue
                s = v['f'] / FPS
                nxt = next((w for w in log[k + 1:] if w['ev'] == 'play' or (w['ev'] == 'stop' and w['src'] == v['src'])), None)
                e = nxt['f'] / FPS if nxt else 99
                if e - s < 0.3: continue  # the game cut it off at once
                if a - 0.5 <= s < b and min(e, b) - max(s, a) >= 0.6: voices.append((t + max(0, s - a), min(e, b) - max(s, a), VOICE + v['src'], max(0, a - s)))
            for (c, at), idv in EXTRA.items():
                if c == clip and a <= at < b: voices.append((t + at - a, b - at, VOICE + idv + '.mp3'))
        subprocess.run(cmd, check=True); os.replace(out + '.tmp.mp4', out); parts.append(out); t += d
    open('tmp/list.txt', 'w').write(''.join(f"file '{os.path.abspath(p)}'\n" for p in parts))
    silent = f'tmp/{name}_v.mp4'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', 'tmp/list.txt', '-c', 'copy', silent], check=True)
    total = dur(silent)
    # audio: music bed (ducked by the voices) + voices
    ins = ['-i', MUSIC]; f = []; labels = []
    for j, v in enumerate(voices):
        start, length, path = v[0], max(0.2, v[1]), v[2]; off = v[3] if len(v) > 3 else 0
        ins += ['-i', path]
        f.append(f"[{j+2}:a]atrim=start={off}:duration={length},asetpts=PTS-STARTPTS,afade=t=out:st={max(0, length-0.12)}:d=0.12,aresample=44100,aformat=channel_layouts=stereo,volume=1.9,adelay={int(start*1000)}|{int(start*1000)}[v{j}]")
        labels.append(f'[v{j}]')
    mus_in = 0 if name == 'ad' else 0
    f.append(f"[1:a]atrim=start={mus_in}:duration={total},asetpts=PTS-STARTPTS,aresample=44100,aformat=channel_layouts=stereo,volume=0.42,afade=t=in:d=0.4,afade=t=out:st={total-1.6}:d=1.6[mus]")
    if labels:
        f.append(f"{''.join(labels)}amix=inputs={len(labels)}:normalize=0,apad=whole_dur={total}[vox]")
        f.append("[vox]asplit=2[vox1][vox2]")
        f.append("[mus][vox1]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=350[duck]")
        f.append("[duck][vox2]amix=inputs=2:normalize=0,alimiter=limit=0.95,atrim=duration=" + str(total) + "[a]")
    else:
        f.append("[mus]anull[a]")
    out = f'out/kopalife_{name}.mp4'; os.makedirs('out', exist_ok=True)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', silent, *ins, '-filter_complex', ';'.join(f), '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out + '.tmp.mp4'], check=True)
    os.replace(out + '.tmp.mp4', out)
    print(name, 'duration', round(dur(out), 2), 'voices', len(voices))
    for v in voices: print('  ', round(v[0], 2), round(v[1], 2), os.path.basename(v[2]))

if __name__ == '__main__':
    for n in sys.argv[1:]: build(n)
