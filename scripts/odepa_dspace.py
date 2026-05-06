"""
ODEPA DSpace API Scraper
Busca y descarga archivos Excel de ferias libres desde la Biblioteca Digital de ODEPA.
Items conocidos:
  - Ferias_Pais_PowerBI.xlsx (nacional, 2535 ferias, handle 20.500.12650/73143)
  - Ferias_2022.xlsx (Region Metropolitana, handle 20.500.12650/71922)
"""

import json
import requests
import pandas as pd
from pathlib import Path
from tqdm import tqdm

DSpace_BASE = "https://bibliotecadigital.odepa.gob.cl/server/api"
OUTPUT_DIR = Path("data/odepa_dspace")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Mapeo de codigo de region (1-16) a nombre
REGION_CODE_MAP = {
    1: "Tarapaca",
    2: "Antofagasta",
    3: "Atacama",
    4: "Coquimbo",
    5: "Valparaiso",
    6: "Libertador General Bernardo O'Higgins",
    7: "Maule",
    8: "Biobio",
    9: "La Araucania",
    10: "Los Lagos",
    11: "Aysen del General Carlos Ibanez del Campo",
    12: "Magallanes y de la Antartica Chilena",
    13: "Metropolitana de Santiago",
    14: "Los Rios",
    15: "Arica y Parinacota",
    16: "Nuble",
}

# UUIDs de los items de ferias libres (encontrados via DSpace API)
FERIAS_ITEM_UUIDS = [
    {
        "uuid": "96ab749f-6572-47b1-8f60-8867b2e72ea9",
        "name": "Ferias libres a nivel pais",
        "handle": "20.500.12650/73143",
        "expected_file": "Ferias_Pais_PowerBI.xlsx",
        "region": "nacional",
    },
    {
        "uuid": "cc192820-d9e0-410b-8ec2-b6116dcb81a7",
        "name": "Listado de ferias libres en la Region Metropolitana",
        "handle": "20.500.12650/71922",
        "expected_file": "Ferias_2022.xlsx",
        "region": "Metropolitana de Santiago",
    },
]


def get_bundles(item_uuid):
    """Obtiene los bundles de un item."""
    r = requests.get(f"{DSpace_BASE}/core/items/{item_uuid}/bundles")
    r.raise_for_status()
    data = r.json()
    return data["_embedded"]["bundles"]


def get_bitstreams(bundle_url):
    """Obtiene los bitstreams de un bundle."""
    r = requests.get(bundle_url)
    r.raise_for_status()
    data = r.json()
    return data["_embedded"]["bitstreams"]


def download_bitstream(bitstream, output_path):
    """Descarga un bitstream a disco."""
    content_url = bitstream["_links"]["content"]["href"]
    r = requests.get(content_url)
    r.raise_for_status()
    with open(output_path, "wb") as f:
        f.write(r.content)
    return len(r.content)


def parse_excel(filepath, default_region=None):
    """
    Parsea archivo Excel de ferias.
    Maneja tanto archivos regionales como el nacional (con columna REGION numerica).
    """
    import unicodedata

    def normalize_col(col):
        """Normaliza nombre de columna removiendo acentos y caracteres especiales."""
        # NFKD decompose: 'ó' -> 'o' + combining acute accent
        nfkd = unicodedata.normalize("NFKD", col.lower())
        # Keep only ASCII characters
        ascii_str = nfkd.encode("ascii", "ignore").decode("ascii")
        return ascii_str.replace(" ", "_")

    df = pd.read_excel(filepath, engine="openpyxl")

    col_map = {}
    for c in df.columns:
        clean = normalize_col(c)
        
        if "latitud" in clean:
            col_map[c] = "latitud"
        elif "longitud" in clean or "long" in clean:
            col_map[c] = "longitud"
        elif clean == "comuna" or "comuna" in clean and "nombre" not in clean:
            col_map[c] = "comuna"
        elif "nombre" in clean and "archivo" not in clean:
            col_map[c] = "nombre_feria"
        elif "dia" in clean and "hora" not in clean and "post" not in clean:
            col_map[c] = "dia_principal"
        elif "calle_principal" in clean:
            col_map[c] = "calle_principal"
        elif "calle_inicio" in clean:
            col_map[c] = "calle_inicio"
        elif "calle_termino" in clean or "calle_t" in clean:
            col_map[c] = "calle_termino"
        elif "dias" in clean and "post" in clean:
            col_map[c] = "dias_postura"
        elif "horario" in clean:
            col_map[c] = "horario"
        elif "num_puesto" in clean or "puesto" in clean:
            col_map[c] = "num_puestos"
        elif "region" in clean:
            col_map[c] = "region_codigo"
        elif clean == "id":
            col_map[c] = "id_origen"
        elif "n" in clean and len(clean) <= 2:
            col_map[c] = "num_puestos_raw"

    df = df.rename(columns=col_map)

    # Si hay columna region_codigo (archivo nacional), mapear codigos a nombres
    if "region_codigo" in df.columns:
        df["region"] = df["region_codigo"].map(REGION_CODE_MAP)
    elif default_region:
        df["region"] = default_region
    else:
        df["region"] = ""

    # Seleccionar columnas relevantes
    relevant = [
        "nombre_feria", "comuna", "region", "latitud", "longitud",
        "calle_principal", "calle_inicio", "calle_termino",
        "dias_postura", "horario", "num_puestos", "dia_principal",
        "id_origen"
    ]
    available = [c for c in relevant if c in df.columns]
    result = df[available].to_dict(orient="records")

    return result


def run():
    """Ejecuta el scraper completo de ODEPA DSpace."""
    print("=" * 60)
    print("  ODEPA DSpace Scraper - Ferias Libres")
    print("=" * 60)

    all_ferias = []

    for item_info in tqdm(FERIAS_ITEM_UUIDS, desc="Procesando items"):
        title = item_info["name"]
        print(f"\n[ODEPA] Procesando: {title}")

        try:
            bundles = get_bundles(item_info["uuid"])
        except Exception as e:
            print(f"  -> Error obteniendo bundles: {e}")
            continue

        original_bundle = None
        for b in bundles:
            if b["name"] == "ORIGINAL":
                original_bundle = b
                break

        if not original_bundle:
            print("  -> Sin bundle ORIGINAL, saltando")
            continue

        bitstreams = get_bitstreams(original_bundle["_links"]["bitstreams"]["href"])

        for bs in bitstreams:
            filename = bs["name"]
            if not filename.endswith((".xlsx", ".xls", ".csv")):
                continue

            output_path = OUTPUT_DIR / filename
            size = download_bitstream(bs, output_path)
            print(f"  -> Descargado: {filename} ({size:,} bytes)")

            try:
                data = parse_excel(output_path, default_region=item_info.get("region"))
                for row in data:
                    row["fuente"] = "odepa_dspace"
                    row["archivo_origen"] = filename
                    row["region_origen"] = item_info.get("region", "")
                all_ferias.extend(data)
                print(f"  -> Parseadas {len(data)} ferias")
            except Exception as e:
                print(f"  -> Error parseando {filename}: {e}")

    # Guardar resultado consolidado
    output_json = Path("data/odepa_dspace_ferias.json")
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(all_ferias, f, ensure_ascii=False, indent=2)

    # Stats
    regiones = set(r.get("region") for r in all_ferias if r.get("region"))
    
    print(f"\n{'=' * 60}")
    print(f"[ODEPA] Total ferias extraidas: {len(all_ferias)}")
    print(f"[ODEPA] Regiones cubiertas: {len(regiones)}")
    print(f"[ODEPA] Regiones: {sorted(regiones)}")
    print(f"[ODEPA] Datos guardados en: {output_json}")

    return all_ferias


if __name__ == "__main__":
    run()
