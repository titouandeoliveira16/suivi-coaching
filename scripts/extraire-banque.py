"""Extrait la banque de séances du moteur depuis le catalogue scientifique de Coach.

Usage : python3 scripts/extraire-banque.py chemin/vers/coach/catalogue/seances.json
Écrit src/moteur/banque.json. Les séances « méthode » et « profil » restent dans Coach ;
le VTT devient du vélo avec `terrain: "vtt"` ; la force devient « renfo ».
"""
import json
import sys
from pathlib import Path

SPORTS = {"velo": "velo", "vtt": "velo", "course": "course", "force": "renfo"}


def reference(r):
    if isinstance(r, str):
        return r
    return f"{r['auteurs'].split(',')[0].strip()} {r['annee']}"


def convertir(s):
    d = {k: s[k] for k in ("id", "famille", "nom", "objectif", "resume", "unite", "zone", "rpe", "niveau", "dureeMin")}
    d["sport"] = SPORTS[s["sport"]]
    d["deroule"] = s.get("deroule", [])
    d["phases"] = s.get("quand", {}).get("phases", s.get("phases", []))
    d["conseils"] = s.get("conseils", [])
    d["preuve"] = {"niveau": s["preuve"]["niveau"], "references": [reference(r) for r in s["preuve"].get("references", [])]}
    if s.get("exercices"):
        d["exercices"] = s["exercices"]
    if s["sport"] == "vtt":
        d["terrain"] = "vtt"
    if s.get("disciplines"):
        d["disciplines"] = s["disciplines"]
    return d


def main(chemin):
    catalogue = json.loads(Path(chemin).read_text(encoding="utf-8"))
    seances = [convertir(s) for s in catalogue["seances"] if s["sport"] in SPORTS]
    sortie = {"source": f"Catalogue scientifique de Coach (version {catalogue['version']}, {catalogue['majLe']})", "seances": seances}
    cible = Path(__file__).resolve().parent.parent / "src" / "moteur" / "banque.json"
    cible.write_text(json.dumps(sortie, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(seances)} séances écrites dans {cible}")


if __name__ == "__main__":
    main(sys.argv[1])
