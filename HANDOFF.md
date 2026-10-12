# Handoff

## 2026-10-12 — Commit y publicación solicitados

- **Objetivo:** guardar los cambios y subirlos a `origin/master` para actualizar GitHub Pages.
- **Completado:** revisión del estado local/remoto (sin divergencia), 4 regresiones pasan y compilación de producción validada en la sesión anterior.
- **Decisiones:** publicar directamente en `master`, según autorización del usuario; el workflow ejecuta pruebas y build antes de desplegar.
- **Bloqueos:** ninguno al preparar el commit; la publicación depende de que termine GitHub Actions.
- **Próximos pasos:** verificar el push, el resultado del workflow y el sitio público.
- **Commit de esta sesión:** `fix: restore basemap and polish viewer, icons and docs`; base `fe734b8`.

## 2026-10-12 — Recuperar basemap, validar el sitio y mejorar documentación/iconos

- **Objetivo:** reemplazar CARTO caído por un mapa similar, validar el visor y corregir problemas relevantes; crear favicon y README adecuados.
- **Completado:** clon del repositorio; OpenFreeMap Dark/Positron preservando overlays GeoJSON; corrección de sprite; buscador móvil y controles táctiles; paneles accesibles con Escape/foco; slider de puestos y ARIA; búsqueda local inmediata y descarte de respuestas antiguas; error de carga con Reintentar; SW solo en producción y actualización de caché; Ñuble en gráficos/centroides; salida del generador a `web/public/data`; favicon SVG/PNG e iconos PWA; README reescrito y 4 regresiones automatizadas.
- **Decisiones:** reutilizar MapLibre y helpers existentes; no añadir dependencias de producción. Iconos servidos desde `public/`. Mantener los datos publicados sin volver a descargarlos. Fichas limitadas al viewport y desplazables en móviles pequeños; pruebas antes de publicar en GitHub Actions.
- **Verificación:** 4 pruebas de regresión pasan; build de producción correcto; filtros combinados, búsqueda, ambos temas, Ñuble y paneles comprobados en navegador; revisión responsive a 320 y 390 px. Generador de datos probado en salida temporal: 1.764 ferias, 16 regiones, 284 comunas. Dimensiones de los PNG verificadas. Vite conserva el aviso de bundle grande por MapLibre.
- **Bloqueos:** ninguno de implementación. OpenFreeMap/Nominatim siguen siendo servicios externos; no hay garantía de disponibilidad.
- **Ajuste solicitado:** centrar icono GitHub mediante flex en `.btn--icon`; el enlace heredaba un layout de bloque y quedaba desplazado 12 px en móvil. Verificado en escritorio y móvil: diferencia de centros horizontal/vertical = 0 px.
- **Próximos pasos:** revisar el diff y publicar cuando corresponda. GPS real y descarga completa offline no se verificaron; el modo offline conserva recursos visitados.
- **Commits:** base `fe734b8`; cambios locales sin commit/push.
