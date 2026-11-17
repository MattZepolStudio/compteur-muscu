# Vérifie que chaque $("id") utilisé dans le code existe dans index.html, et qu'aucun id n'est en double.
import re, sys, glob, collections
html = open("index.html").read()
ids = re.findall(r'\bid="([^"]+)"', html)
dup = [k for k, n in collections.Counter(ids).items() if n > 1]
used = set()
for f in glob.glob("js/*.js"):
    used |= set(re.findall(r'\$\("([A-Za-z0-9_-]+)"\)', open(f).read()))
# ids créés dynamiquement par le code (innerHTML)
dyn = set()
for f in glob.glob("js/*.js"):
    dyn |= set(re.findall(r'id="([A-Za-z0-9_-]+)"', open(f).read()))
missing = sorted(used - set(ids) - dyn)
print("ids en double :", dup or "aucun"); print("ids manquants :", missing or "aucun")
sys.exit(1 if dup or missing else 0)
