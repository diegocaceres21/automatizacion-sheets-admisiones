<#
  Admisiones UCB - instalador y actualizador de la extension de Chrome (sin Web Store).

  Instalar (una vez), en Windows + R:
    powershell -ExecutionPolicy Bypass -Command "irm https://diegocaceres21.github.io/automatizacion-sheets-admisiones/install/instalar.ps1 | iex"

  Que hace:
    1. Descarga la ultima version (releases/version.json + ZIP) y verifica su SHA-256.
    2. La instala en %LOCALAPPDATA%\AdmisionesUCB\extension (carpeta fija para "Cargar sin empaquetar").
    3. Se copia como %LOCALAPPDATA%\AdmisionesUCB\actualizar.ps1 y crea la tarea programada
       "Admisiones UCB - Actualizar" (solo para este usuario, sin permisos de administrador)
       que repite los pasos 1-2 al iniciar sesion y dos veces al dia.
    4. La extension detecta los archivos nuevos y se recarga sola (cuando el panel esta cerrado).

  Parametros (para el actualizador y pruebas):
    -Silencioso   sin mensajes ni abrir Chrome (lo usa la tarea programada)
    -Forzar       reinstala aunque la version sea la misma
    -Desinstalar  borra la tarea y la carpeta (la extension se quita en chrome://extensions)
    -BaseUrl      carpeta de releases (por defecto GitHub Pages)
    -Carpeta      carpeta de instalacion (por defecto %LOCALAPPDATA%\AdmisionesUCB)
    -SinTarea     no crea la tarea programada (pruebas)

  Solo caracteres ASCII: Windows PowerShell 5.1 puede leer mal las tildes segun como se descargue el script.
#>
param(
  [switch]$Silencioso,
  [switch]$Forzar,
  [switch]$Desinstalar,
  [switch]$SinTarea,
  [string]$BaseUrl = 'https://diegocaceres21.github.io/automatizacion-sheets-admisiones/releases',
  [string]$Carpeta = (Join-Path $env:LOCALAPPDATA 'AdmisionesUCB')
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # Invoke-WebRequest es muy lento con la barra de progreso en PS 5.1
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$InstallerUrl = 'https://diegocaceres21.github.io/automatizacion-sheets-admisiones/install/instalar.ps1'
$TaskName = 'Admisiones UCB - Actualizar'
$ExtDir = Join-Path $Carpeta 'extension'
$LogFile = Join-Path $Carpeta 'actualizador.log'
$UpdaterPath = Join-Path $Carpeta 'actualizar.ps1'

function Write-Log([string]$Text) {
  $line = '{0:yyyy-MM-dd HH:mm:ss}  {1}' -f (Get-Date), $Text
  if (Test-Path $Carpeta) {
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
    # Mantener el log corto
    $lines = Get-Content $LogFile -Encoding UTF8
    if ($lines.Count -gt 300) { $lines | Select-Object -Last 200 | Set-Content $LogFile -Encoding UTF8 }
  }
  if (-not $Silencioso) { Write-Host $Text }
}

function Get-InstalledVersion {
  $manifest = Join-Path $ExtDir 'manifest.json'
  if (-not (Test-Path $manifest)) { return $null }
  try { return (Get-Content $manifest -Raw -Encoding UTF8 | ConvertFrom-Json).version } catch { return $null }
}

function Compare-Version([string]$A, [string]$B) {
  # -1, 0 o 1 comparando "a.b.c"
  $pa = $A.Split('.'); $pb = $B.Split('.')
  for ($i = 0; $i -lt [Math]::Max($pa.Count, $pb.Count); $i++) {
    $x = 0; $y = 0
    if ($i -lt $pa.Count) { $x = [int]$pa[$i] }
    if ($i -lt $pb.Count) { $y = [int]$pb[$i] }
    if ($x -ne $y) { return [Math]::Sign($x - $y) }
  }
  return 0
}

function Find-Chrome {
  $keys = @(
    'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe',
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe',
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe'
  )
  foreach ($k in $keys) {
    try {
      $p = (Get-ItemProperty -Path $k -ErrorAction Stop).'(default)'
      if ($p -and (Test-Path $p)) { return $p }
    } catch { }
  }
  return $null
}

function Install-Release {
  $info = Invoke-RestMethod -Uri "$BaseUrl/version.json" -UseBasicParsing -Headers @{ 'Cache-Control' = 'no-cache' }
  $installed = Get-InstalledVersion
  if ($installed -and -not $Forzar -and (Compare-Version $info.version $installed) -le 0) {
    Write-Log "Sin cambios: version $installed instalada (ultima publicada: $($info.version))."
    return $false
  }

  $zipName = [IO.Path]::GetFileName(([Uri]$info.url).AbsolutePath)
  $tmp = Join-Path ([IO.Path]::GetTempPath()) ('admisiones-' + [Guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $tmp | Out-Null
  try {
    $zip = Join-Path $tmp $zipName
    Invoke-WebRequest -Uri "$BaseUrl/$zipName" -OutFile $zip -UseBasicParsing

    if ($info.sha256) {
      $hash = (Get-FileHash -Path $zip -Algorithm SHA256).Hash.ToLower()
      if ($hash -ne $info.sha256.ToLower()) { throw "El ZIP descargado no coincide con version.json (SHA-256). No se instalo nada." }
    }

    Expand-Archive -Path $zip -DestinationPath $tmp -Force
    $src = Join-Path $tmp 'admisiones-ucb'
    if (-not (Test-Path (Join-Path $src 'manifest.json'))) { throw 'El ZIP no contiene admisiones-ucb/manifest.json.' }

    New-Item -ItemType Directory -Path $ExtDir -Force | Out-Null
    # /MIR deja la carpeta identica a la version nueva (borra archivos que ya no existen)
    & robocopy.exe $src $ExtDir /MIR /NFL /NDL /NJH /NJS /NP /R:2 /W:1 | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "No se pudieron copiar los archivos (robocopy $LASTEXITCODE). Cierre Chrome e intente de nuevo." }

    # Marca para la extension: esta instalacion se actualiza sola
    $marca = @{ instalador = $true; carpeta = $ExtDir; actualizado = (Get-Date).ToString('s') } | ConvertTo-Json
    [IO.File]::WriteAllText((Join-Path $ExtDir 'instalador.json'), $marca, (New-Object Text.UTF8Encoding($false)))

    Write-Log "Instalada la version $($info.version) (antes: $(if ($installed) { $installed } else { 'ninguna' }))."
    return $true
  } finally {
    Remove-Item -Path $tmp -Recurse -Force -ErrorAction SilentlyContinue
  }
}

function Save-Updater {
  # Copia local de este script para la tarea programada (no depende de internet para arrancar)
  try {
    $text = (Invoke-WebRequest -Uri $InstallerUrl -UseBasicParsing).Content
    if ($text -is [byte[]]) { $text = [Text.Encoding]::UTF8.GetString($text) }
    if ($text -notmatch 'Admisiones UCB') { throw 'contenido inesperado' }
    [IO.File]::WriteAllText($UpdaterPath, $text, (New-Object Text.UTF8Encoding($true)))
  } catch {
    if ($PSCommandPath -and (Test-Path $PSCommandPath)) {
      Copy-Item -Path $PSCommandPath -Destination $UpdaterPath -Force
    } else {
      throw "No se pudo guardar el actualizador: $($_.Exception.Message)"
    }
  }
}

function Register-UpdateTask {
  $taskArgs = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$UpdaterPath`" -Silencioso"
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $taskArgs
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -MultipleInstances IgnoreNew
  $daily = @(
    (New-ScheduledTaskTrigger -Daily -At '08:30'),
    (New-ScheduledTaskTrigger -Daily -At '13:30')
  )
  $user = "$env:USERDOMAIN\$env:USERNAME"
  $principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
  try {
    $logon = New-ScheduledTaskTrigger -AtLogOn -User $user
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger (@($logon) + $daily) -Settings $settings `
      -Principal $principal -Force | Out-Null
    Write-Log 'Tarea programada creada: al iniciar sesion y a las 08:30 y 13:30.'
  } catch {
    # Algunos equipos no permiten el disparador "al iniciar sesion" sin administrador: usar solo los diarios
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $daily -Settings $settings `
      -Principal $principal -Force | Out-Null
    Write-Log 'Tarea programada creada: a las 08:30 y 13:30 (si el equipo estaba apagado, corre al encenderlo).'
  }
}

# ---------------- Desinstalar ----------------
if ($Desinstalar) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Remove-Item -Path $Carpeta -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host 'Listo. Ahora quite "Admisiones UCB" en chrome://extensions (boton Quitar).'
  return
}

# ---------------- Instalar / actualizar ----------------
try {
  New-Item -ItemType Directory -Path $Carpeta -Force | Out-Null
  $firstInstall = -not (Get-InstalledVersion)
  Install-Release | Out-Null

  if (-not $Silencioso) {
    Save-Updater
    if (-not $SinTarea) { Register-UpdateTask }
  }
} catch {
  Write-Log "ERROR: $($_.Exception.Message)"
  if (-not $Silencioso) {
    Write-Host ''
    Write-Host 'No se pudo completar la instalacion. Envie esta pantalla al administrador.' -ForegroundColor Red
    Read-Host 'Presione Enter para cerrar'
  }
  exit 1
}

if (-not $Silencioso) {
  try { Set-Clipboard -Value $ExtDir } catch { }
  Write-Host ''
  Write-Host '==================== Admisiones UCB ====================' -ForegroundColor Cyan
  Write-Host "Version instalada: $(Get-InstalledVersion)"
  Write-Host "Carpeta: $ExtDir"
  Write-Host 'Las actualizaciones se instalan solas.'
  Write-Host ''
  if ($firstInstall) {
    Write-Host 'ULTIMO PASO (solo esta vez), en la pestana de Chrome que se abre:' -ForegroundColor Yellow
    Write-Host '  1. Active "Modo de desarrollador" (arriba a la derecha).'
    Write-Host '  2. Clic en "Cargar extension sin empaquetar".'
    Write-Host '  3. En la ventana, pegue la carpeta con Ctrl+V (ya esta copiada) y presione "Seleccionar carpeta".'
    Write-Host '  4. Fije el icono: pieza de rompecabezas > alfiler junto a "Admisiones UCB".'
  } else {
    Write-Host 'La extension ya estaba instalada: se recargara sola con la version nueva.'
  }
  Write-Host '========================================================' -ForegroundColor Cyan
  if ($firstInstall) {
    $chrome = Find-Chrome
    if ($chrome) { Start-Process -FilePath $chrome -ArgumentList 'chrome://extensions' }
    else { Write-Host 'No se encontro Chrome. Abra chrome://extensions manualmente.' -ForegroundColor Yellow }
  }
  Read-Host 'Presione Enter para cerrar'
}
