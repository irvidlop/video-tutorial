# Qué instalar

Solo lo necesita quien hace el video. Para verlo basta cualquier reproductor.

La skill funciona en Claude Code y en la pestaña Code de la app de escritorio de Claude, porque ahí Claude puede correr programas en tu computadora. En el chat normal de Claude no.

## Lo que necesita la computadora

| Qué | Para qué | Cómo saber si ya está |
|---|---|---|
| Node.js 22 o más nuevo | Corre los pasos (`hacer.mjs`) y la CLI de HyperFrames | `node --version` |
| Python 3 con edge-tts | Genera la voz | `python -c "import edge_tts"` (en Mac, `python3`) |
| FFmpeg, con ffprobe | Mide, recorta y une el audio y el video | `ffmpeg -version` y `ffprobe -version` |
| Google Chrome | Graba la herramienta | Que esté instalado |
| La CLI de HyperFrames | Arma y renderiza el video | `npx hyperframes doctor` |
| Espacio en disco | Renderizar | Unos 5 GB libres |

- **La CLI de HyperFrames y `playwright-core` no se instalan en la computadora**: van dentro de cada proyecto de video y se instalan con `npm install` en su carpeta. La CLI es el programa de línea de comandos que convierte la composición en video; `playwright-core` es la pieza que maneja Chrome para grabar. Fuera de un proyecto, `npx hyperframes` descarga la CLI sola la primera vez (esa vez pide internet).
- **Las skills de HyperFrames** son recomendadas. Le enseñan a Claude las reglas de HyperFrames y ayudan cuando un render falla o hay que cambiar el montaje. Se instalan una vez con `npx hyperframes skills`.
- **Internet**: para generar la voz (sale del servicio de voz de Microsoft, el mismo con el que Edge lee en voz alta), la primera vez que corre `npx hyperframes` y para instalar lo de cada proyecto. Grabar una copia local y renderizar no lo necesitan.
- **Espacio**: unos 5 GB libres para renderizar un cuerpo de 4 minutos, más hasta unos 170 MB por cada video terminado. El paso `render` lo revisa antes de empezar.
- **Chrome en otro lugar**: si Chrome no está donde se instala siempre, la grabación lo encuentra con la variable `CHROME` apuntando a su ejecutable (en Windows, `set CHROME=<ruta>\chrome.exe`).
- **Opcional, para revisar la voz sin oírla**: `python -m pip install faster-whisper`. Lo usa `voz/comprobar.py`, que transcribe cada frase y la compara con el guion. La primera vez baja un modelo de unos 500 MB.

## Instalar la skill

### Con el plugin de Claude Code (Windows y Mac)

En Claude Code, o en la pestaña Code de la app de escritorio de Claude:

```
/plugin marketplace add https://github.com/irvidlop/video-tutorial.git
/plugin install video-tutorial@videos-tutoriales
```

Usa la dirección completa con `https`: la forma corta intenta entrar por SSH y falla si no tienes llave de GitHub. Para recibir mejoras: `/plugin marketplace update videos-tutoriales`.

El plugin trae la skill, pero no instala Python, la voz, Node, FFmpeg ni Chrome. Eso va abajo.

### Con el instalador (Windows)

`INSTALAR.bat`, en la raíz del repositorio, copia la skill a `%USERPROFILE%\.claude\skills\video-tutorial`, instala la voz (edge-tts) y revisa Node, FFmpeg y Chrome. Cada paso dice `[OK]` o `[X]`. Si sale una `[X]`, instala lo que dice y vuelve a abrirlo.

### A mano (Mac)

Copia la carpeta `plugins/video-tutorial/skills/video-tutorial` del repositorio a `~/.claude/skills/video-tutorial`.

## Windows, paso por paso

1. **Python 3**: de python.org. Al instalar, marca la casilla «Add python.exe to PATH». Luego, en una terminal:
   ```
   python -m pip install edge-tts
   ```
2. **Node.js 22 o más nuevo**: de nodejs.org, la versión LTS. Comprueba con `node --version`.
3. **FFmpeg**: en una terminal,
   ```
   winget install ffmpeg
   ```
   Cierra la terminal y abre otra para que Windows lo encuentre. Si winget dice que hay varios paquetes con ese nombre, `winget search ffmpeg` los lista: instala el que se llama FFmpeg con `winget install --id <el id que sale> -e`.
4. **Google Chrome**: de google.com/chrome.
5. **Recomendado**: `npx hyperframes skills`.

### Si hay varios Python

Pasa seguido en Windows: la voz quedó instalada en un Python y la skill usa otro. `py -0p` lista todos. Prueba cada uno con `"<ruta>\python.exe" -c "import edge_tts"` e instala la voz en el que no la tenga: `"<ruta>\python.exe" -m pip install edge-tts`.

## Mac, paso por paso

```
brew install node ffmpeg
python3 -m pip install edge-tts
```

- Chrome, en `/Applications`.
- En Mac se escribe `python3` en lugar de `python`.
- Si pip responde «externally-managed-environment», usa `python3 -m pip install --user --break-system-packages edge-tts`. El nombre asusta, pero con `--user` la voz se instala solo para tu usuario y no toca lo del sistema.
- Recomendado: `npx hyperframes skills`.

## Revisar que todo esté

- Dentro de un proyecto de video: `node hacer.mjs entorno`.
- Sin proyecto: `node <skill>/scripts/revisar-entorno.mjs`, donde `<skill>` es la carpeta de la skill.

Los dos dicen qué falta y cómo instalarlo.

HyperFrames tiene su propia revisión: `npx hyperframes doctor` (Node, FFmpeg, el Chrome del render, memoria y disco). Si dice que falta el Chrome del render, `npx hyperframes browser ensure` lo descarga.

## Si algo no está donde siempre

Los pasos buscan cada programa solo. Si no lo encuentran, se les dice dónde con una variable de entorno (en Windows, `set NOMBRE=valor` en la misma terminal; en Mac, `export NOMBRE=valor`):

| Variable | Para qué |
|---|---|
| `PYTHON` | El Python que tiene edge-tts, si no es el de `python`, `python3` o `py -3`. |
| `CHROME` | El ejecutable de Chrome, si no está donde se instala siempre. Lo usan la grabación y las revisiones. |
| `FFMPEG`, `FFPROBE` | FFmpeg y ffprobe, si no están en el PATH. |
| `VIDEO_TUTORIAL_TMP` | Una carpeta con ruta sin acentos para el render (en Windows, por omisión `C:\vt-tmp`, que se borra al terminar). |
| `VIDEO_TUTORIAL_WORKERS` | Cuántos procesos usa el render (3 por omisión; más pueden agotar la memoria en un video largo). |
| `VIDEO_TUTORIAL_SKILL` | La carpeta de la skill, si `node hacer.mjs entorno` no encuentra `revisar-entorno.mjs`. |
