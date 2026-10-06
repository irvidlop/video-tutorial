@echo off
chcp 65001 >nul
setlocal
rem Instalador de la skill de videos tutoriales, para Windows.
rem Doble clic. Copia la skill a los skills de Claude, deja lista la voz y revisa lo demas.
rem Para probar sin tocar nada real: set VT_DESTINO=otra\carpeta  y  set VT_SIN_PIP=1

set "ORIGEN=%~dp0plugins\video-tutorial\skills\video-tutorial"
if defined VT_DESTINO (set "DEST=%VT_DESTINO%") else (set "DEST=%USERPROFILE%\.claude\skills\video-tutorial")

echo.
echo  Videos tutoriales - instalador
echo  ------------------------------
echo.
echo  1/5  Copiando la skill a:
echo       %DEST%
if not exist "%ORIGEN%\SKILL.md" (
  echo       [X] No encontre la skill junto a este instalador.
  echo           Extrae el zip completo y abre INSTALAR.bat desde esa carpeta.
  goto fin
)
rem sin dependencias, videos ni el proyecto de prueba del ejemplo (ejemplo\video), si alguien lo creo aqui
robocopy "%ORIGEN%" "%DEST%" /E /NFL /NDL /NJH /NJS /NP /XD node_modules out tmp video >nul
if errorlevel 8 (
  echo       [X] No se pudo copiar. Cierra Claude e intenta de nuevo.
  goto fin
)
echo       [OK]

echo.
echo  2/5  Buscando Python...
set "PY="
where python >nul 2>nul && python -c "import sys" >nul 2>nul && set "PY=python"
if not defined PY (where py >nul 2>nul && set "PY=py -3")
if not defined PY (
  echo       [X] No hay Python. Instalalo de https://www.python.org/downloads/
  echo           y marca la casilla "Add python.exe to PATH". Luego vuelve a abrir este instalador.
  goto node
)
echo       [OK] %PY%

echo.
echo  3/5  Instalando la voz (edge-tts)...
if defined VT_SIN_PIP (
  echo       [--] omitido por VT_SIN_PIP
) else (
  %PY% -m pip install --user --quiet --disable-pip-version-check edge-tts
)
%PY% -c "import edge_tts" >nul 2>nul
if errorlevel 1 (
  echo       [X] La voz no quedo instalada. Prueba a mano:  %PY% -m pip install edge-tts
) else (
  echo       [OK] voz lista
)

:node
echo.
echo  4/5  Revisando Node...
where node >nul 2>nul
if errorlevel 1 (
  echo       [X] Falta Node.js 22 o mas nuevo: https://nodejs.org  version LTS
) else (
  for /f "tokens=1 delims=." %%v in ('node -p "process.versions.node"') do (
    if %%v LSS 22 (echo       [X] Tu Node es version %%v; hace falta 22 o mas nuevo: https://nodejs.org) else (echo       [OK] Node %%v)
  )
)

echo.
echo  5/5  Revisando FFmpeg y Chrome...
where ffmpeg >nul 2>nul
if errorlevel 1 (
  echo       [X] Falta FFmpeg. Instalalo con:  winget install ffmpeg
  echo           y vuelve a abrir este instalador en una ventana nueva.
) else (
  where ffprobe >nul 2>nul
  if errorlevel 1 (echo       [X] Hay FFmpeg pero falta ffprobe. Reinstala:  winget install ffmpeg) else (echo       [OK] FFmpeg)
)
set "NAV="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "NAV=1"
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "NAV=1"
if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "NAV=1"
if defined NAV (echo       [OK] Chrome) else (echo       [X] No encontre Chrome: https://www.google.com/chrome/)

echo.
echo  Listo. Abre una sesion NUEVA de Claude Code (o la pestana Code de Claude)
echo  y pidele:  "hazme un video tutorial de ..."
echo  Si arriba salio alguna [X], resuelvela y vuelve a abrir este instalador.
echo  Antes del primer video, Claude revisa tambien el espacio en disco.

:fin
echo.
if not defined VT_DESTINO pause
endlocal
