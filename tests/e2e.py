# Tests de bout en bout (Playwright + Chromium, caméra simulée, MediaPipe remplacé par tests/fake-vision.js).
# Lancer depuis la racine du dépôt :  python3 tests/e2e.py   (option --shots DOSSIER pour garder des captures)
import json, os, sys, threading, time, functools, http.server
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = sys.argv[sys.argv.index("--shots") + 1] if "--shots" in sys.argv else None
PORT = 8765

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), functools.partial(Quiet, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f"http://127.0.0.1:{PORT}/index.html"
FAKE = open(os.path.join(ROOT, "tests", "fake-vision.js")).read()

fails, errors = [], []
def check(cond, msg):
    print(("  ok   " if cond else "  ÉCHEC ") + msg)
    if not cond: fails.append(msg)

def new_page(browser, storage=None, landscape=False):
    ctx = browser.new_context(viewport={"width": 844, "height": 390} if landscape else {"width": 390, "height": 844}, device_scale_factor=2, permissions=["camera"])
    ctx.route("**/js/vision.js", lambda r: r.fulfill(status=200, content_type="text/javascript", body=FAKE))
    ctx.route("https://fonts.googleapis.com/**", lambda r: r.abort())
    ctx.add_init_script("window.__said = []; navigator.serviceWorker && (navigator.serviceWorker.register = () => Promise.resolve());")
    if storage is not None:
        ctx.add_init_script(f"if (!sessionStorage.__init) {{ localStorage.clear(); {''.join(f'localStorage.setItem({json.dumps(k)}, {json.dumps(json.dumps(v))});' for k, v in storage.items())} sessionStorage.__init = 1; }}")
    p = ctx.new_page()
    p.on("pageerror", lambda e: errors.append(str(e)))
    p.on("console", lambda m: m.type == "error" and "fonts" not in m.text and "ERR_FAILED" not in m.text and errors.append(m.text))
    p.goto(URL); p.wait_for_timeout(400)
    return p

def shot(p, name):
    if SHOTS: os.makedirs(SHOTS, exist_ok=True); p.screenshot(path=os.path.join(SHOTS, name + ".png"))

def visible(p, sel): return p.locator(sel).is_visible()
def cfg(p): return p.evaluate("JSON.parse(localStorage.getItem('pompesCfg'))")
def hist(p): return p.evaluate("JSON.parse(localStorage.getItem('muscuHistory') || '[]')")

with sync_playwright() as pw:
    browser = pw.chromium.launch(args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"])

    print("1. Premier lancement : profil puis plan")
    p = new_page(browser, storage={})
    check(visible(p, "#onb"), "l'accueil des nouveaux utilisateurs s'affiche")
    check(not visible(p, "#tabbar"), "pas de barre d'onglets pendant le profil")
    p.fill("#onbName", "Léa"); p.click("#onbNext")
    shot(p, "01-onb-gabarit"); p.click("#onbNext")                     # gabarit
    p.click("[data-lvl='1']"); p.click("#onbNext")                      # niveau
    p.click("[data-goal='forme']"); p.click("#onbNext")                 # objectif
    p.click("[data-ex='curls']"); p.click("[data-ex='planche']"); p.click("[data-gg='tabata']"); p.click("#onbNext")
    p.click("[data-pw='3']"); p.click("[data-mn='20']"); p.click("#onbNext")
    shot(p, "02-onb-plan")
    check("Ton plan" in p.inner_text("#onbBody"), "aperçu du plan")
    p.click("#onbNext")
    check(visible(p, "#home") and visible(p, "#tabbar"), "arrivée sur l'accueil avec 4 onglets")
    check("Salut Léa" in p.inner_text("#helloTitle"), "salutation avec le prénom")
    check(p.locator("#todayGo").count() == 1, "bouton « Commencer » de la séance du jour")
    c = cfg(p)
    check(c["v"] == 2 and len([s for s in c["seances"] if s.get("plan")]) >= 2, "plan enregistré (séances du plan)")
    shot(p, "03-accueil")

    print("2. Séance du jour avec caméra")
    c["delay"] = 0
    c["seances"][0]["blocks"] = [{"exo": "pompes", "sets": 2, "reps": 2, "arms": "both", "load": 0}]
    c["seances"][0]["rest"] = 15
    p.evaluate(f"localStorage.setItem('pompesCfg', {json.dumps(json.dumps(c))})"); p.reload(); p.wait_for_timeout(300)
    p.click("#todayGo")
    p.wait_for_timeout(1500)
    check(visible(p, "#workout") and not visible(p, "#loading"), "écran de séance, détection chargée")
    shot(p, "04-seance")
    p.wait_for_timeout(9000)
    said = p.evaluate("window.__said")
    check(any("Série terminée" in s for s in said), "première série comptée jusqu'au bout")
    check(visible(p, "#rest"), "écran de repos entre les séries")
    shot(p, "05-repos")
    p.click("#restSkip"); p.wait_for_timeout(9000)
    check(visible(p, "#done"), "résumé de fin")
    shot(p, "06-resume")
    H = hist(p)
    check(len(H) == 1 and H[0]["sid"] == c["seances"][0]["id"] and sum(s["n"] for s in H[0]["sets"]) >= 4, "séance enregistrée avec son identifiant de séance")
    p.click("#rpe [data-r='2']")
    check(hist(p)[0].get("rpe") == 2, "ressenti enregistré")
    p.click("#doneOk")
    check(visible(p, "#home"), "retour à l'accueil")
    check("1/3" in p.inner_text("#weekCard"), "semaine : 1 séance sur 3")
    check(p.inner_text("#todayCard").find(c["seances"][1]["name"].upper()) >= 0 or c["seances"][1]["name"] in p.inner_text("#todayCard"), "la séance du jour passe à la suivante du plan")

    print("3. Onglet Séances, catalogue et éditeur")
    p.click("[data-tab='seances']")
    check(visible(p, "#seances") and p.locator("#seMine .row-item").count() >= 2, "Mes séances : séances du plan")
    shot(p, "07-seances")
    p.click("#seTabs [data-t='cat']"); shot(p, "08-catalogue")
    p.click("[data-ce='curls']")
    check(visible(p, "#edit"), "l'éditeur s'ouvre sur l'exercice choisi")
    p.click("[data-f='load'][data-d='1']"); p.click("[data-f='load'][data-d='1']"); p.click("[data-arms='sep']")
    p.click("#edAdd"); p.click("[data-add='g:gainage']")
    check(p.locator("#edList .blk").count() == 2, "exercice sans caméra ajouté à la séance")
    p.fill("#edName", "Bras + gainage"); p.click("#edSave")
    shot(p, "09-editeur")
    p.click("#edClose")
    p.click("#seTabs [data-t='mine']")
    check("Bras + gainage" in p.inner_text("#seMine"), "la séance perso apparaît dans Mes séances")
    s = [x for x in cfg(p)["seances"] if x["name"] == "Bras + gainage"][0]
    check(s["blocks"][0]["load"] == 2 and s["blocks"][0]["arms"] == "sep" and s["blocks"][1]["exo"] == "g:gainage", "réglages de la séance enregistrés")

    print("4. Séance mixte : caméra puis coach vocal")
    c = cfg(p); s = [x for x in c["seances"] if x["name"] == "Bras + gainage"][0]
    s["blocks"][0].update({"sets": 1, "reps": 1, "arms": "both"}); s["blocks"][1]["p"] = {"rounds": 1, "work": 5, "rest": 0}
    p.evaluate(f"localStorage.setItem('pompesCfg', {json.dumps(json.dumps(c))})"); p.reload(); p.wait_for_timeout(300)
    p.click("[data-tab='seances']"); p.click(f"[data-go='{s['id']}']")
    p.wait_for_timeout(7000)
    check(visible(p, "#guided"), "enchaînement automatique sur la séance guidée")
    for _ in range(12):
        if visible(p, "#done"): break
        p.click("#gpNextBtn"); p.wait_for_timeout(250)
    p.wait_for_timeout(500)
    check(visible(p, "#done") and "Bras + gainage" in p.inner_text("#doneTitle"), "résumé global de la séance mixte")
    runs = {h["run"] for h in hist(p)}
    check(len(hist(p)) >= 2 and len(runs) == 2, "les deux étapes comptent pour une seule séance")
    p.click("#doneOk")

    print("5. Progrès et Profil")
    p.click("[data-tab='progres']"); shot(p, "10-progres")
    check(p.locator("#prHist .row-item").count() == 2, "historique : une ligne par séance")
    check(p.locator("#prRecs .rec").count() >= 1, "records affichés")
    p.click("[data-tab='profil']"); shot(p, "11-profil")
    check("Léa" in p.inner_text("#meHead"), "profil : prénom")
    p.click("#ecoSw"); p.click("#trigSeg [data-v='hand']"); p.click("[data-delay='5']")
    c = cfg(p)
    check(c["eco"] and c["trigger"] == "hand" and c["delay"] == 5, "réglages de séance enregistrés")
    p.click("#meProfile [data-step='5']")
    check(visible(p, "#onb") and "enregistrer" in p.inner_text("#onbNext").lower(), "modification du rythme depuis le profil")
    p.click("[data-pw='2']"); p.click("#onbNext")
    check(visible(p, "#profil") and cfg(p)["profile"]["perWeek"] == 2, "rythme mis à jour")
    check("Bras + gainage" in [x["name"] for x in cfg(p)["seances"]], "les séances perso survivent au recalcul du plan")

    print("6. Démarrage par la main")
    c = cfg(p); c["delay"] = 0; c["trigger"] = "hand"
    p.evaluate(f"localStorage.setItem('pompesCfg', {json.dumps(json.dumps(c))})"); p.reload(); p.wait_for_timeout(300)
    p.click("[data-tab='seances']"); p.click("#seTabs [data-t='cat']"); p.click("[data-ce='pompes']"); p.click("#edStart")
    p.wait_for_timeout(1200)
    check("✋" in p.inner_text("#count"), "attend la main ouverte")
    p.evaluate("window.__hand = true"); p.wait_for_timeout(2500); p.evaluate("window.__hand = false")
    p.wait_for_timeout(3000)
    check("✋" not in p.inner_text("#count"), "la main ouverte lance la série")
    p.click("#pauseBtn"); check(visible(p, "#pauseOv"), "pause")
    p.locator("#stopBtn").dispatch_event("pointerdown"); p.wait_for_timeout(1200)
    check(visible(p, "#done") or visible(p, "#home"), "arrêt par appui maintenu")
    p.close()

    print("7. Migration depuis la version précédente")
    old = {"onboarded": True, "weight": 72, "profile": {"name": "Tom", "level": 2, "goal": "force", "exos": ["pompes", "squats"], "guided": [], "perWeek": 2, "minutes": 30},
           "saved": [{"name": "Ma séance", "plan": True, "blocks": [{"exo": "pompes", "sets": 3, "reps": 10}]}, {"name": "Perso", "rest": 60, "blocks": [{"exo": "squats", "sets": 2, "reps": 15, "rest": 60}]}],
           "perExo": {"pompes": {"sets": 4, "reps": 14, "rest": 90, "load": 0}}, "prog": [], "goalSessions": 2, "exo": "pompes", "reps": 12, "sets": 4, "rest": 90}
    p = new_page(browser, storage={"pompesCfg": old, "muscuHistory": [{"t": 1700000000000, "dur": 600000, "sets": [{"exo": "pompes", "n": 20, "best": 20}]}]})
    c = cfg(p)
    check(c["v"] == 2 and c["profile"]["weight"] == 72 and "weight" not in c and "saved" not in c, "réglages migrés (poids dans le profil)")
    check([x["name"] for x in c["seances"] if not x.get("plan")] == ["Perso"] and any(x.get("plan") for x in c["seances"]), "séances perso conservées, plan recalculé")
    check(c["memo"]["pompes"]["reps"] == 14, "derniers réglages par exercice conservés")
    check(visible(p, "#home"), "l'appli démarre sur l'accueil")
    p.click("[data-tab='progres']")
    check("20" in p.inner_text("#prRecs"), "ancien historique lisible")
    p.close()

    print("8. Paysage")
    p = new_page(browser, storage={"pompesCfg": {"v": 2, "onboarded": True, "profile": {"name": "Léa", "level": 2, "goal": "forme", "exos": ["pompes", "squats"], "guided": [], "perWeek": 3, "minutes": 30}, "seances": [], "delay": 3}}, landscape=True)
    p.evaluate("1"); shot(p, "12-paysage-accueil")
    check(visible(p, "#home"), "accueil en paysage")
    p.click("[data-tab='seances']"); p.click("#seTabs [data-t='cat']"); p.click("[data-ce='squats']"); p.click("#edStart"); p.wait_for_timeout(1500)
    shot(p, "13-paysage-seance")
    check(visible(p, "#count") and visible(p, "#pauseBtn"), "séance en paysage : compteur et commandes visibles")
    p.close()

    browser.close()

print()
if errors: print("Erreurs JavaScript :", *errors, sep="\n  ")
print("RÉSULTAT :", "OK" if not fails and not errors else f"{len(fails)} échec(s), {len(errors)} erreur(s)")
sys.exit(1 if fails or errors else 0)
