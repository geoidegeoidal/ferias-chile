"""
ODEPA DSpace API Scraper
Busca y descarga archivos Excel de ferias libres desde la Biblioteca Digital de ODEPA.
Base URL: https://bibliotecadigital.odepa.gob.cl/server/api/
"""

import os
import re
import json
import requests
from pathlib import Path
from tqdm import tqdm

DSpace_BASE = "https://bibliotecadigital.odepa.gob.cl/server/api"
OUTPUT_DIR = Path("data/odepa_dspace")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def search_ferias_items():
    """Busca items con subject='FERIAS LIBRES' y tipo='Base de datos'."""
    params = {
        "query": "ferias",
        "dsoType": "ITEM",
        "size": 50,
        "sort": "dc.date.issued,DESC",
    }
    # Filtro por subject y tipo
    url = f"{DSpace_BASE}/discover/search/objects"
    full_url = url + "?query=ferias&dsoType=ITEM&f.subject=FERIAS%20LIBRES,equals&f.tiporecurso=Base%20de%20datos%20y%20repertorio%20t%C3%A9cnico,equals&size=50"
    
    print("[ODEPA] Buscando items de ferias libres en DSpace...")
    r = requests.get(full_url)
    r.raise_for_status()
    data = r.json()
    
    items = data["_embedded"]["searchResult"]["_embedded"]["objects"]
    results = []
    for obj in items:
        io = obj["_embedded"]["indexableObject"]
        results.append({
            "uuid": io["uuid"],
            "title": io["name"],
            "handle": io.get("handle"),
            "metadata": io.get("metadata", {}),
            "bundles_url": io["_links"]["bundles"]["href"],
        })
    
    print(f"[ODEPA] Encontrados {len(results)} items de ferias libres (tipo base de datos)")
    return results


def get_bundles(item):
    """Obtiene los bundles de un item."""
    r = requests.get(item["bundles_url"])
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


def parse_excel(filepath):
    """Parsea un archivo Excel de ferias y retorna lista de dicts."""
    import pandas as pd
    
    df = pd.read_excel(filepath, engine="openpyxl")
    
    # Normalizar nombres de columnas (manejar encoding)
    col_map = {}
    for c in df.columns:
        normalized = c.strip().lower()
        if "latitud" in normalized:
            col_map[c] = "latitud"
        elif "longitud" in normalized or "long" in normalized:
            col_map[c] = "longitud"
        elif "comuna" in normalized:
            col_map[c] = "comuna"
        elif "nombre" in normalized and "archivo" not in normalized:
            col_map[c] = "nombre_feria"
        elif "dia" in normalized and "horario" not in normalized and "postura" not in normalized:
            col_map[c] = "dia_principal"
        elif "calle_principal" in normalized or "calle principal" in normalized:
            col_map[c] = "calle_principal"
        elif "calle_inicio" in normalized or "calle inicio" in normalized:
            col_map[c] = "calle_inicio"
        elif "calle_t" in normalized or "calle termino" in normalized:
            col_map[c] = "calle_termino"
        elif "dias_de_postura" in normalized or "dias postura" in normalized:
            col_map[c] = "dias_postura"
        elif "horario" in normalized:
            col_map[c] = "horario"
        elif "num_puesto" in normalized or "puesto" in normalized:
            col_map[c] = "num_puestos"
        elif "region" in normalized:
            col_map[c] = "region"
    
    df = df.rename(columns=col_map)
    
    # Extraer columnas relevantes
    relevant = [
        "nombre_feria", "comuna", "region", "latitud", "longitud",
        "calle_principal", "calle_inicio", "calle_termino",
        "dias_postura", "horario", "num_puestos", "dia_principal"
    ]
    available = [c for c in relevant if c in df.columns]
    result = df[available].to_dict(orient="records")
    
    return result


def run():
    """Ejecuta el scraper completo de ODEPA DSpace."""
    print("=" * 60)
    print("  ODEPA DSpace Scraper - Ferias Libres")
    print("=" * 60)
    
    items = search_ferias_items()
    
    all_ferias = []
    
    for item in tqdm(items, desc="Procesando items"):
        title = item["title"]
        print(f"\n[ODEPA] Procesando: {title}")
        
        bundles = get_bundles(item)
        original_bundle = None
        for b in bundles:
            if b["name"] == "ORIGINAL":
                original_bundle = b
                break
        
        if not original_bundle:
            print(f"  -> Sin bundle ORIGINAL, saltando")
            continue
        
        bitstreams = get_bitstreams(original_bundle["_links"]["bitstreams"]["href"])
        
        for bs in bitstreams:
            filename = bs["name"]
            if not filename.endswith((".xlsx", ".xls", ".csv")):
                continue
            
            output_path = OUTPUT_DIR / filename
            size = download_bitstream(bs, output_path)
            print(f"  -> Descargado: {filename} ({size} bytes)")
            
            # Parsear
            try:
                data = parse_excel(output_path)
                for row in data:
                    row["fuente"] = "odepa_dspace"
                    row["archivo_origen"] = filename
                    row["region_origen"] = item["metadata"].get("dc.coverage.spatial", [{}])[0].get("value", "")
                    row["fecha_datos"] = item["metadata"].get("dc.coverage.temporal", [{}])[0].get("value", "")
                all_ferias.extend(data)
                print(f"  -> Parseadas {len(data)} ferias")
            except Exception as e:
                print(f"  -> Error parseando {filename}: {e}")
    
    # Guardar resultado consolidado
    output_json = Path("data/odepa_dspace_ferias.json")
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(all_ferias, f, ensure_ascii=False, indent=2)
    
    print(f"\n[ODEPA] Total ferias extraidas: {len(all_ferias)}")
    print(f"[ODEPA] Datos guardados en: {output_json}")
    
    return all_ferias


if __name__ == "__main__":
    run()
