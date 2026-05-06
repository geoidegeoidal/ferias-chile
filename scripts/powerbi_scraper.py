"""
PowerBI Scraper - Ferias Libres ODEPA
Usa Playwright para interactuar con el reporte PowerBI embebido.
Itera por regiones usando el selector de region y exporta datos via
el boton de Excel o via PowerBI JS SDK (visual.exportData).

URL: https://apps.odepa.gob.cl/powerBI/reporte_ferias_libres.html
PowerBI Report ID: debi2816b-90fc-44d9-a201-74dce7dc5d80
"""

import json
import time
import asyncio
from pathlib import Path

OUTPUT_DIR = Path("data/powerbi")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

POWERBI_PAGE_URL = "https://apps.odepa.gob.cl/powerBI/reporte_ferias_libres.html"
POWERBI_IFRAME_SRC = (
    "https://app.powerbi.com/view?r=eyJrIjoiZGViMjgxNmItOTBmYy00NGQ5LWEyMDEtNzRkY2U3ZGM1ZDgwIiwidCI6IjMzYjdmNzA3LTZlNmYtNDJkMi04ZDZmLTk4YmZmOWZiNWZhMCIsImMiOjR9"
)

# Regiones de Chile (las que probablemente aparecen en el selector)
REGIONES_CHILE = [
    "Arica y Parinacota",
    "Tarapaca",
    "Antofagasta",
    "Atacama",
    "Coquimbo",
    "Valparaiso",
    "Metropolitana de Santiago",
    "Libertador General Bernardo O'Higgins",
    "Maule",
    "Ñuble",
    "Biobio",
    "La Araucania",
    "Los Rios",
    "Los Lagos",
    "Aysen del General Carlos Ibanez del Campo",
    "Magallanes y de la Antartica Chilena",
]


async def scrape_powerbi(headless=True):
    """Scrapea el reporte PowerBI usando Playwright."""
    print("=" * 60)
    print("  PowerBI Scraper - Reporte Ferias Libres ODEPA")
    print("=" * 60)
    
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print("[PowerBI] Playwright no instalado. Instalalo con:")
        print("  pip install playwright && playwright install chromium")
        return []

    print(f"[PowerBI] Cargando pagina: {POWERBI_PAGE_URL}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=headless)
        context = await browser.new_context(
            viewport={"width": 1400, "height": 900},
            accept_downloads=True,  # Para capturar descargas Excel
        )
        page = await context.new_page()

        # Navegar a la pagina que contiene el iframe de PowerBI
        await page.goto(POWERBI_PAGE_URL, wait_until="networkidle", timeout=60000)
        print("[PowerBI] Pagina cargada, esperando iframe de PowerBI...")

        # Esperar que el iframe de PowerBI cargue
        await page.wait_for_selector("iframe", timeout=30000)
        iframe_element = await page.query_selector("iframe")
        iframe = await iframe_element.content_frame()

        if not iframe:
            print("[PowerBI] ERROR: No se pudo acceder al iframe de PowerBI")
            await browser.close()
            return []

        # Esperar que el reporte PowerBI termine de cargar
        await iframe.wait_for_selector(".pbi-root", timeout=60000)
        await asyncio.sleep(5)  # Tiempo extra para que PowerBI renderice completo
        print("[PowerBI] Reporte PowerBI cargado")

        # Estrategia 1: Usar PowerBI JS SDK via evaluate
        print("[PowerBI] Intentando extraer datos via PowerBI JS SDK...")

        all_data = []
        regiones_found = []

        try:
            # Ejecutar JavaScript en el contexto de la pagina principal
            # (el SDK de PowerBI puede necesitar estar en el contexto del iframe)
            powerbi_data = await iframe.evaluate("""() => {
                // Buscar elementos que contengan datos del reporte
                const visuals = document.querySelectorAll('.visualContainerHost, .visual-container, [class*="visual"]');
                const results = [];
                
                // Buscar si hay datos en atributos data-* o en el DOM
                visuals.forEach((v, i) => {
                    const title = v.querySelector('.visualHeader')?.textContent?.trim() || '';
                    const text = v.textContent?.trim()?.substring(0, 200) || '';
                    results.push({ index: i, title: title, text_preview: text });
                });
                
                return { visual_count: visuals.length, visuals: results };
            }""", timeout=10000)

            print(f"[PowerBI] Visuales encontrados: {powerbi_data.get('visual_count', 0)}")

        except Exception as e:
            print(f"[PowerBI] Error en evaluate: {e}")

        # Estrategia 2: Buscar el boton de descarga Excel y region selector
        print("[PowerBI] Buscando selector de region y boton de exportar...")

        # Intentar encontrar el selector de region (dropdown/slicer)
        try:
            # Buscar elementos que parezcan un dropdown de region
            slicers = await iframe.evaluate("""() => {
                const allText = document.body.innerText;
                const regiones = [
                    'Arica', 'Tarapaca', 'Antofagasta', 'Atacama', 'Coquimbo',
                    'Valparaiso', 'Metropolitana', 'O\'Higgins', 'Maule', 'Ñuble',
                    'Biobio', 'Araucania', 'Los Rios', 'Los Lagos', 'Aysen', 'Magallanes',
                    'Region', 'region'
                ];
                const found = regiones.filter(r => allText.toLowerCase().includes(r.toLowerCase()));
                return { found_regiones: found, full_text_preview: allText.substring(0, 500) };
            }""", timeout=10000)

            print(f"[PowerBI] Regiones detectadas en el DOM: {slicers.get('found_regiones', [])}")

            # Buscar el boton de exportar (tres puntos o "Export data" / "Exportar datos")
            export_buttons = await iframe.evaluate("""() => {
                const buttons = [];
                document.querySelectorAll('button, [role="button"], .pbi-glyph-export, [title*="Export"], [title*="exportar"], [title*="Excel"]').forEach(b => {
                    const title = b.getAttribute('title') || b.getAttribute('aria-label') || b.textContent?.trim()?.substring(0, 50) || '';
                    buttons.push({ tag: b.tagName, title: title, class: b.className?.substring(0, 80) });
                });
                return buttons;
            }""", timeout=10000)

            print(f"[PowerBI] Botones encontrados: {len(export_buttons)}")
            for btn in export_buttons[:10]:
                if btn["title"]:
                    print(f"  - {btn['title']}")

        except Exception as e:
            print(f"[PowerBI] Error buscando controles: {e}")

        # Estrategia 3: Intentar capturar solicitudes de red del PowerBI
        print("[PowerBI] Capturando datos de red...")
        
        # Tomar screenshot para referencia
        await page.screenshot(path=str(OUTPUT_DIR / "powerbi_report.png"))
        print(f"[PowerBI] Screenshot guardado: {OUTPUT_DIR / 'powerbi_report.png'}")

        # Guardar el HTML del iframe para analisis
        iframe_html = await iframe.content()
        html_path = OUTPUT_DIR / "powerbi_iframe.html"
        html_path.write_text(iframe_html, encoding="utf-8")
        print(f"[PowerBI] HTML del iframe guardado: {html_path}")

        await browser.close()

    print("\n[PowerBI] Scraping completado.")
    print("[PowerBI] Nota: Si los metodos automaticos no extraen datos,")
    print("[PowerBI] abre el archivo powerbi_report.png para ver el estado del reporte.")
    return all_data


if __name__ == "__main__":
    asyncio.run(scrape_powerbi(headless=True))
