# Handoff

## 2026-10-12 — README visual

- **Objetivo:** dar al README una presentación cuidada con imágenes reales del proyecto.
- **Completado:** portada con logo, acceso al visor y cobertura; capturas de mapas claro/oscuro, estadísticas y ficha móvil; galería con textos alternativos y enlaces para ampliar.
- **Decisiones:** usar el SVG existente y capturas JPEG en `assets/readme/`; la portada usa `picture` para acompañar el tema del sistema. Los recursos de documentación no se incluyen en el build del sitio.
- **Verificación:** revisión visual de las capturas y comprobación de rutas locales. No se modifica código de la aplicación.
- **Bloqueos:** ninguno.
- **Próximos pasos:** mantener las capturas al cambiar la interfaz.
- **Commit de esta sesión:** `docs: add visual README with maps, stats and mobile screenshots`; base `c3691d2`.

## 2026-10-12 — Commit y publicación solicitados

- **Objetivo:** guardar los cambios y subirlos a `origin/master` para actualizar GitHub Pages.
- **Completado:** commit `4b60db4` y push a `origin/master`; 4 regresiones pasan. GitHub Actions ejecutó pruebas, build y despliegue con éxito (run `38199324760`). El sitio público responde HTTP 200 y sirve el JS con OpenFreeMap, el favicon SVG nuevo y el service worker `ferias-v7`.
- **Decisiones:** publicar directamente en `master`, según autorización del usuario; el workflow ejecuta pruebas y build antes de desplegar.
- **Bloqueos:** ninguno.
- **Próximos pasos:** ninguno para la publicación solicitada. GPS real y offline completo siguen fuera de lo verificado.
- **Commit de implementación:** `4b60db4` — `fix: restore basemap and polish viewer, icons and docs`; base `fe734b8`. La verificación posterior se registra en el commit de documentación que contiene esta entrada.

## 2026-10-12 — Recuperar basemap, validar el sitio y mejorar documentación/iconos

- **Objetivo:** reemplazar CARTO caído por un mapa similar, validar el visor y corregir problemas relevantes; crear favicon y README adecuados.
- **Completado:** clon del repositorio; OpenFreeMap Dark/Positron preservando overlays GeoJSON; corrección de sprite; buscador móvil y controles táctiles; paneles accesibles con Escape/foco; slider de puestos y ARIA; búsqueda local inmediata y descarte de respuestas antiguas; error de carga con Reintentar; SW solo en producción y actualización de caché; Ñuble en gráficos/centroides; salida del generador a `web/public/data`; favicon SVG/PNG e iconos PWA; README reescrito y 4 regresiones automatizadas.
- **Decisiones:** reutilizar MapLibre y helpers existentes; no añadir dependencias de producción. Iconos servidos desde `public/`. Mantener los datos publicados sin volver a descargarlos. Fichas limitadas al viewport y desplazables en móviles pequeños; pruebas antes de publicar en GitHub Actions.
- **Verificación:** 4 pruebas de regresión pasan; build de producción correcto; filtros combinados, búsqueda, ambos temas, Ñuble y paneles comprobados en navegador; revisión responsive a 320 y 390 px. Generador de datos probado en salida temporal: 1.764 ferias, 16 regiones, 284 comunas. Dimensiones de los PNG verificadas. Vite conserva el aviso de bundle grande por MapLibre.
- **Bloqueos:** ninguno de implementación. OpenFreeMap/Nominatim siguen siendo servicios externos; no hay garantía de disponibilidad.
- **Ajuste solicitado:** centrar icono GitHub mediante flex en `.btn--icon`; el enlace heredaba un layout de bloque y quedaba desplazado 12 px en móvil. Verificado en escritorio y móvil: diferencia de centros horizontal/vertical = 0 px.
- **Próximos pasos:** revisar el diff y publicar cuando corresponda. GPS real y descarga completa offline no se verificaron; el modo offline conserva recursos visitados.
- **Commits:** base `fe734b8`; cambios locales sin commit/push.
