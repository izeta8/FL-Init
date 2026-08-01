# TODO

Inventario de trabajo pendiente. Ordenado por prioridad, no por esfuerzo.

---

## 🔴 Bloqueante / Fiabilidad del entorno

Un `npm run dist` interrumpido deja la app inutilizable. Ya ha pasado una vez.

- [ ] **`setup-portable-python.js`: instalación no atómica.** Borra `dist/python` entero (líneas 73-76) *antes* de reinstalar, y solo escribe `.requirements_hash` al final (línea 136). Si la instalación falla o se cancela a mitad, te quedas sin entorno y sin ninguna señal de que está roto — el fallo aparece después, como un `ModuleNotFoundError` crudo dentro de una descarga.
  - Arreglo: instalar en un directorio temporal y renombrar al final (atómico), o escribir un marcador `.install_in_progress` que se borre al terminar y se compruebe al arrancar.
- [ ] **La app no valida el entorno Python al arrancar.** `preWarmPython()` ([python-runner.ts:171](src/main/python-runner.ts:171)) ya importa todos los módulos pesados, pero si falla solo hace `console.error`. Debería reportar a la UI: "entorno incompleto, reinstala" en vez de dejar que el usuario lo descubra a mitad de un proyecto.
- [ ] **Sin validación de dependencias contra `requirements.txt`.** No hay forma de saber si `dist/python` está completo salvo intentar importar.

## 🟠 Flujo de desarrollo (acordado: Opción A)

- [ ] **`npm run dev` está roto de raíz.** `webpack serve` compila en memoria en `:3000`, pero [window-manager.ts:43](src/main/window-manager.ts:43) hace `loadFile()` desde disco. Los dos lados nunca se tocan; el dev server no sirve para nada hoy.
- [ ] **`npm start` no reconstruye el renderer** (solo `build:main`), así que muestra el bundle antiguo sin avisar.
- [ ] Implementar: `isDev ? loadURL('http://localhost:3000') : loadFile(...)` + `wait-on` para evitar la race condition de pantalla en blanco + `start` pasa a significar "verificar el build de producción".

## 🟡 Deuda de la feature de SoundCloud

La feature funciona, pero la nomenclatura quedó anclada a YouTube.

- [ ] **Renombrar el dominio `youtube*` → `song*`/`track*`.** Afecta a `HistoryEntry.youtubeUrl` y `videoName` ([types.ts:49-50](src/shared/types.ts:49)), `updateHistoryEntryVideoName` ([history-manager.ts:70](src/main/history-manager.ts:70)), los estados `youtubeUrl`/`youtubeWarning`/`handleYoutubeUrlChange` de `App.tsx`, y el `id="youtube-url"` del formulario.
  - ⚠️ `youtubeUrl` está **persistido en `history.json`**: hace falta migración o lectura tolerante a ambas claves, o se pierde el historial existente.
- [ ] **El historial no distingue la plataforma.** Guardar el `source` ('youtube'/'soundcloud') para poder mostrar un icono y filtrar.
- [ ] **Soporte de playlists/sets de SoundCloud.** Hoy se rechazan con un mensaje claro; podrían descargarse como N proyectos.
- [ ] **Unificar el progreso de descarga.** La barra "Download" se alimenta del output `chunk:` de moviepy (la *conversión*), no de la descarga real. En SoundCloud tenemos el % real de yt-dlp pero se emite solo como texto. Se podrían separar en dos fases: descarga y conversión.

## 🟡 Segfault de librosa (workaround aplicado)

- [ ] **`librosa.piptrack` provoca un access violation (0xC0000005) y mata el proceso.** Con `librosa 0.11.0` + `numpy 2.1.3` (ambos pinneados), cualquier llamada a `piptrack` tumba el intérprete. Afectaba a `detect_key()` a través de `chroma_cqt(tuning=None)` → `estimate_tuning()` → `piptrack()`, así que la app descargaba el audio pero **nunca creaba el `.flp` ni el `Original Song Info.txt`**.
  - Workaround aplicado: `estimate_tuning()` propia en `script_python.py`, con `librosa.yin` + `pitch_tuning` sobre los primeros 30s. Mismo resultado y mismo coste (~1s) en las pruebas.
  - Pendiente: confirmar la causa raíz (sospecha: numba sin bounds checking sobre un índice fuera de rango, expuesto por numpy 2.x). `librosa 0.11.0` es la última versión publicada, así que no hay fix vía actualización. Revisar si bajar a `numpy<2` lo resuelve — implica revalidar torch 2.6 y numba 0.61.
  - `beat_track`, `onset_strength`, `yin`, `cqt` y `stft` no están afectados; el BPM siempre funcionó.

## 🟡 Versión de Python

- [ ] **Subir el Python embebido de 3.10.11 a 3.11+** (`PYTHON_VERSION`, [setup-portable-python.js:7](scripts/setup-portable-python.js:7)).
  - yt-dlp ya emite "Support for Python version 3.10 has been deprecated" en cada instancia. Está silenciado en `build_ydl()`, pero es un parche.
  - El riesgo real: los extractores de SoundCloud se rompen periódicamente y hay que actualizar yt-dlp. Si una versión futura dropea 3.10, quedamos clavados en una versión que ya no funciona.
  - Requiere revalidar `torch`, `demucs`, `librosa`, `numba`/`llvmlite` (este último es el más sensible a la versión de Python).
  - Actualizar también el README, que promete "Python 3.10.x".

## 🟢 Robustez y calidad

- [ ] **Cero tests en el repo.** No hay directorio de tests ni script `npm test`. Candidatos baratos y de alto valor: `detect_source()`, `sanitize_title()`, `validateSongURL()`/`validateSoundcloudURL()` y el parser `parsePhaseFromMessage`. Hoy todo eso se verifica a mano.
- [ ] **Número mágico frágil en el parseo de stems.** [App.tsx:269](src/renderer/App.tsx:269) usa `/(\d+)%\s*\|.*\/132\.0/`; ese `132.0` viene del modelo `mdx_extra`. Si se cambia de modelo (ver la tarea de 2 stems, abajo), la barra de progreso deja de moverse en silencio.
- [ ] **`run-python-script` no valida sus inputs IPC** ([ipc-handlers.ts:105](src/main/ipc-handlers.ts:105)), aunque `AGENTS.md` lo exige explícitamente. Riesgo bajo (se usa `spawn` con `shell: false` y array de args, así que no hay inyección de shell), pero el renderer puede mandar cualquier ruta o flag.
- [ ] **Detección de errores por substring.** `python-runner.ts` clasifica la salida buscando `'error'` en el texto en minúsculas; cualquier canción cuyo título contenga "error" se pintará en rojo. Sería más robusto un prefijo estructurado desde Python (p. ej. `[ERROR] ...`).
- [ ] **`moviepy` clavado en 1.0.3** (de 2020). Ya dio problemas con los lazy imports (commits `70f00f6`, `d597dd4`). Migrar a 2.x es un cambio de API (`moviepy.editor` desaparece); evaluar si compensa.

## 🔵 Features

- [ ] Permitir elegir entre dos modos de separación:
  - **4 Stems** (con Demucs: Vocal, Bass, Drums, Other).
  - **Acapella / Instrumental** (script nuevo con un modelo de 2 stems tipo BS-Roformer o MDX-Net).
