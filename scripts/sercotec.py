"""
Sercotec Scraper - Catastro Nacional de Ferias Libres
Busca datos abiertos de ferias libres desde Sercotec y catastroferiaslibres.cl
"""

import json
import requests
from pathlib import Path
from tqdm import tqdm

OUTPUT_DIR = Path("data/sercotec")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

SERCOTEC_URLS = [
    "https://catastroferiaslibres.cl",
    "https://explorador.sercotec.cl",
    "https://www.sercotec.cl",
]


def try_fetch_data():
    """Intenta obtener datos desde las fuentes de Sercotec."""
    print("=" * 60)
    print("  Sercotec Scraper - Catastro Ferias Libres")
    print("=" * 60)
    
    all_ferias = []
    
    # Intentar varios endpoints conocidos de Sercotec
    api_endpoints = [
        # API de datos abiertos (posibles endpoints)
        "https://catastroferiaslibres.cl/api/ferias",
        "https://catastroferiaslibres.cl/data/ferias.json",
        "https://catastroferiaslibres.cl/wp-json/wp/v2/ferias",
        "https://explorador.sercotec.cl/api/datos/ferias_libres",
        "https://www.sercotec.cl/wp-json/wp/v2/feria",
    ]
    
    for url in api_endpoints:
        try:
            print(f"[Sercotec] Intentando: {url}")
            r = requests.get(url, timeout=15, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }, allow_redirects=True)
            
            if r.status_code == 200:
                content_type = r.headers.get("Content-Type", "")
                if "json" in content_type:
                    data = r.json()
                    print(f"[Sercotec] Datos JSON encontrados en {url}")
                    if isinstance(data, list):
                        for row in data:
                            row["fuente"] = "sercotec"
                            row["url_origen"] = url
                        all_ferias.extend(data)
                    elif isinstance(data, dict):
                        if "ferias" in data:
                            for row in data["ferias"]:
                                row["fuente"] = "sercotec"
                            all_ferias.extend(data["ferias"])
                        else:
                            for key in ["data", "results", "records", "items"]:
                                if key in data and isinstance(data[key], list):
                                    for row in data[key]:
                                        row["fuente"] = "sercotec"
                                    all_ferias.extend(data[key])
                                    break
                    print(f"[Sercotec] Extraidas {len(all_ferias)} ferias de {url}")
                    break
                elif "csv" in content_type or "text" in content_type:
                    csv_path = OUTPUT_DIR / "ferias_sercotec.csv"
                    with open(csv_path, "wb") as f:
                        f.write(r.content)
                    print(f"[Sercotec] CSV descargado: {csv_path}")
                    break
                elif "html" in content_type:
                    print(f"[Sercotec] Respuesta HTML, no JSON directo en {url}")
            else:
                print(f"[Sercotec] {url} -> status {r.status_code}")
        except Exception as e:
            print(f"[Sercotec] Error con {url}: {e}")
    
    if not all_ferias:
        print("[Sercotec] No se encontraron APIs JSON directas.")
        print("[Sercotec] Los datos pueden requerir scraping de la UI o usar Playwright.")
        print("[Sercotec] Fuentes web a explorar manualmente:")
        for url in SERCOTEC_URLS:
            print(f"  - {url}")
    
    # Guardar resultado
    output_json = Path("data/sercotec_ferias.json")
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(all_ferias, f, ensure_ascii=False, indent=2)
    
    print(f"\n[Sercotec] Total ferias extraidas: {len(all_ferias)}")
    print(f"[Sercotec] Datos guardados en: {output_json}")
    
    return all_ferias


if __name__ == "__main__":
    try_fetch_data()
