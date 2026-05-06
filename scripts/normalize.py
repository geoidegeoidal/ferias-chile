"""
Normalizador de datos de ferias libres
Unifica datos de multiples fuentes (ODEPA DSpace, Sercotec, PowerBI)
en un formato estandarizado con coordenadas.

Schema unificado:
{
    "nombre_feria": str,
    "comuna": str,
    "region": str,
    "latitud": float,
    "longitud": float,
    "direccion": str,
    "calle_principal": str,
    "calle_inicio": str,
    "calle_termino": str,
    "dias": str,
    "horario": str,
    "num_puestos": int,
    "fuente": str,
    "archivo_origen": str,
    "fecha_datos": str,
}
"""

import json
import re
from pathlib import Path
from datetime import datetime

DATA_DIR = Path("data")
OUTPUT_JSON = DATA_DIR / "ferias_libres.json"
OUTPUT_CSV = DATA_DIR / "ferias_libres.csv"

# Mapeo de nombres de region a nombres normalizados
REGION_MAP = {
    "arica y parinacota": "Arica y Parinacota",
    "arica": "Arica y Parinacota",
    "tarapaca": "Tarapaca",
    "antofagasta": "Antofagasta",
    "atacama": "Atacama",
    "coquimbo": "Coquimbo",
    "valparaiso": "Valparaiso",
    "valparaíso": "Valparaiso",
    "metropolitana": "Metropolitana de Santiago",
    "metropolitana de santiago": "Metropolitana de Santiago",
    "rm": "Metropolitana de Santiago",
    "santiago": "Metropolitana de Santiago",
    "región metropolitana": "Metropolitana de Santiago",
    "región metropolitana de santiago": "Metropolitana de Santiago",
    "o'higgins": "Libertador General Bernardo O'Higgins",
    "ohiggins": "Libertador General Bernardo O'Higgins",
    "maule": "Maule",
    "nuble": "Ñuble",
    "ñuble": "Ñuble",
    "biobio": "Biobio",
    "biobío": "Biobio",
    "bio bio": "Biobio",
    "araucania": "La Araucania",
    "la araucanía": "La Araucania",
    "los rios": "Los Rios",
    "los ríos": "Los Rios",
    "los lagos": "Los Lagos",
    "aysen": "Aysen del General Carlos Ibanez del Campo",
    "aysén": "Aysen del General Carlos Ibanez del Campo",
    "magallanes": "Magallanes y de la Antartica Chilena",
}

# Bounding box de Chile continental para validar coordenadas
CHILE_BBOX = {
    "lat_min": -56.0,
    "lat_max": -17.0,
    "lon_min": -76.0,
    "lon_max": -66.0,
}


def normalize_region(region_str):
    """Normaliza el nombre de region."""
    if not region_str or not isinstance(region_str, str):
        return ""
    
    region_str = region_str.strip().lower()
    
    # Limpiar prefijos comunes
    for prefix in ["región de ", "region de ", "región del ", "region del "]:
        if region_str.startswith(prefix):
            region_str = region_str[len(prefix):]
    
    # Buscar en el mapa
    for key, value in REGION_MAP.items():
        if key in region_str:
            return value
    
    return region_str.title()


def normalize_comuna(comuna_str):
    """Normaliza el nombre de comuna."""
    if not comuna_str or not isinstance(comuna_str, str):
        return ""
    return comuna_str.strip().title()


def validate_coords(lat, lon):
    """Valida que las coordenadas esten dentro de Chile."""
    try:
        lat = float(lat)
        lon = float(lon)
    except (ValueError, TypeError):
        return False
    
    return (
        CHILE_BBOX["lat_min"] <= lat <= CHILE_BBOX["lat_max"]
        and CHILE_BBOX["lon_min"] <= lon <= CHILE_BBOX["lon_max"]
    )


def build_direccion(row):
    """Construye una direccion legible desde los campos de calle."""
    parts = []
    for key in ["calle_principal", "calle_inicio", "calle_termino"]:
        val = row.get(key, "")
        if val and isinstance(val, str) and val.strip() and val.strip().lower() != "nan":
            parts.append(val.strip())
    
    if parts:
        return " entre ".join(parts)
    
    return row.get("direccion", row.get("calle_principal", ""))


def clean_num_puestos(val):
    """Limpia y convierte numero de puestos a entero."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return int(val)
    if isinstance(val, str):
        match = re.search(r"(\d+)", val)
        if match:
            return int(match.group(1))
    return None


def load_source(filepath):
    """Carga datos de un archivo fuente."""
    if not filepath.exists():
        return []
    
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    print(f"  Cargados {len(data)} registros de {filepath.name}")
    return data


def run():
    """Ejecuta el normalizador de datos."""
    print("=" * 60)
    print("  Normalizador de Datos - Ferias Libres")
    print("=" * 60)
    print()

    all_raw = []

    # Cargar fuentes
    sources = [
        DATA_DIR / "odepa_dspace_ferias.json",
        DATA_DIR / "sercotec_ferias.json",
        DATA_DIR / "powerbi_ferias.json",
    ]

    for src in sources:
        all_raw.extend(load_source(src))

    if not all_raw:
        print("\n[NORM] No hay datos para normalizar.")
        print("[NORM] Ejecuta primero los scrapers:")
        print("  python scripts/odepa_dspace.py")
        print("  python scripts/sercotec.py")
        print("  python scripts/powerbi_scraper.py")
        return

    print(f"\n[NORM] Total registros raw: {len(all_raw)}")

    # Normalizar
    normalized = []
    skipped_coords = 0

    for row in all_raw:
        lat = row.get("latitud") or row.get("lat") or row.get("Latitud")
        lon = row.get("longitud") or row.get("lon") or row.get("Longitud") or row.get("long")

        if lat and lon and not validate_coords(lat, lon):
            skipped_coords += 1

        entry = {
            "nombre_feria": str(row.get("nombre_feria", row.get("NOMBRE", ""))).strip(),
            "comuna": normalize_comuna(row.get("comuna", row.get("COMUNA", ""))),
            "region": normalize_region(row.get("region", row.get("region_origen", ""))),
            "latitud": float(lat) if lat else None,
            "longitud": float(lon) if lon else None,
            "direccion": build_direccion(row),
            "calle_principal": str(row.get("calle_principal", row.get("Calle_Principal", ""))).strip(),
            "calle_inicio": str(row.get("calle_inicio", row.get("Calle_Inicio", ""))).strip(),
            "calle_termino": str(row.get("calle_termino", row.get("Calle_Termino", ""))).strip(),
            "dias": str(row.get("dias_postura", row.get("dias", row.get("Dias_de_Postura", "")))).strip(),
            "horario": str(row.get("horario", row.get("HORARIO", ""))).strip(),
            "num_puestos": clean_num_puestos(row.get("num_puestos", row.get("NUM_PUESTO"))),
            "fuente": str(row.get("fuente", "desconocido")).strip(),
            "archivo_origen": str(row.get("archivo_origen", row.get("url_origen", ""))).strip(),
            "fecha_datos": str(row.get("fecha_datos", "")).strip(),
        }
        normalized.append(entry)

    # Deduplicar por nombre + comuna
    seen = set()
    deduped = []
    for entry in normalized:
        key = (entry["nombre_feria"].lower(), entry["comuna"].lower(), entry["region"].lower())
        if key not in seen:
            seen.add(key)
            deduped.append(entry)

    print(f"[NORM] Registros normalizados: {len(normalized)}")
    print(f"[NORM] Registros con coord invalidas: {skipped_coords}")
    print(f"[NORM] Registros unicos (dedup): {len(deduped)}")

    # Guardar JSON
    output = {
        "metadata": {
            "fecha_extraccion": datetime.now().isoformat(),
            "total_registros": len(deduped),
        },
        "ferias": deduped,
    }

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"\n[NORM] JSON guardado: {OUTPUT_JSON}")

    # Guardar CSV
    try:
        import pandas as pd
        df = pd.DataFrame(deduped)
        df.to_csv(OUTPUT_CSV, index=False, encoding="utf-8-sig")
        print(f"[NORM] CSV guardado: {OUTPUT_CSV}")
    except ImportError:
        print("[NORM] pandas no disponible, CSV no generado")

    # Stats
    print("\n[NORM] Estadisticas:")
    print(f"  Regiones unicas: {len(set(e['region'] for e in deduped if e['region']))}")
    print(f"  Comunas unicas: {len(set(e['comuna'] for e in deduped if e['comuna']))}")
    print(f"  Con coordenadas: {len([e for e in deduped if e['latitud']])}")
    print(f"  Sin coordenadas: {len([e for e in deduped if not e['latitud']])}")

    return output


if __name__ == "__main__":
    run()
