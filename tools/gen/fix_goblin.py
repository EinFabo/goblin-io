# convert the original goblin SVGs to the same Scratch-safe layout (viewBox from 0,0)
import sys, os, re
src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
for f in os.listdir(src):
    if not f.endswith(".svg"): continue
    s = open(os.path.join(src, f)).read()
    assert 'viewBox="-48 -52 96 96"' in s
    s = s.replace('width="256" height="256" viewBox="-48 -52 96 96"', 'width="96" height="96" viewBox="0 0 96 96"').replace('<rect x="-48" y="-52"', '<rect x="0" y="0"')
    s = re.sub(r'(<g stroke="[^"]*" stroke-width="[^"]*" stroke-linejoin="round" stroke-linecap="round")( transform="scale\(-1 1\)")?>',
               lambda m: m.group(1) + (' transform="translate(48 52) scale(-1 1)">' if m.group(2) else ' transform="translate(48 52)">'), s, 1)
    assert 'translate(48 52)' in s
    open(os.path.join(dst, f), "w").write(s)
print("goblin converted")
