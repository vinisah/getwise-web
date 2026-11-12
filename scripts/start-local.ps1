param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $project
$url = 'http://127.0.0.1:3001/admin/lessons/turmas'

# Codex instalado pela Microsoft Store pode virtualizar LOCALAPPDATA.
$runtimeCandidates = @(
    (Join-Path $env:LOCALAPPDATA 'GetWise'),
    (Join-Path $env:USERPROFILE 'AppData\Local\Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Local\GetWise')
)
$runtime = $runtimeCandidates | Where-Object {
    (Test-Path -LiteralPath (Join-Path $_ 'pgsql\bin\pg_ctl.exe')) -and
    (Test-Path -LiteralPath (Join-Path $_ 'data\PG_VERSION'))
} | Select-Object -First 1
if (-not $runtime) { throw 'Banco local nao encontrado. Nenhum banco foi criado ou substituido.' }

$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
$node = if ($nodeCommand) { $nodeCommand.Source } else {
    Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
}
if (-not (Test-Path -LiteralPath $node)) { throw 'Node.js nao encontrado nesta maquina.' }
if (-not (Test-Path -LiteralPath '.env')) { throw 'Configuracao local .env ausente.' }
if (-not (Test-Path -LiteralPath 'node_modules\next\dist\bin\next')) { throw 'Dependencias ausentes. Instale-as antes de iniciar.' }

# Bloqueia um .env apontado por engano para producao; nao imprime credenciais.
& $node -e "require('dotenv').config({quiet:true});const u=new URL(process.env.DATABASE_URL);if(u.hostname!=='127.0.0.1'||u.port!=='55432'||u.pathname!=='/getwise_feature')throw Error('Use o banco local getwise_feature na porta 55432');"
if ($LASTEXITCODE -ne 0) { throw 'Configuracao do banco local invalida.' }

$pgCtl = Join-Path $runtime 'pgsql\bin\pg_ctl.exe'
$data = Join-Path $runtime 'data'
& $pgCtl status -D $data *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host 'Iniciando banco local...'
    & $pgCtl start -D $data -l (Join-Path $runtime 'postgres.log') -w
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao iniciar o PostgreSQL. Confira postgres.log na pasta GetWise.' }
}

function Test-LocalApp {
    try {
        $csrf = Invoke-RestMethod 'http://127.0.0.1:3001/api/auth/csrf' -TimeoutSec 3
        return [bool]$csrf.csrfToken
    } catch { return $false }
}

if (-not (Test-LocalApp)) {
    $probe = New-Object System.Net.Sockets.TcpClient
    try { $probe.Connect('127.0.0.1', 3001); $occupied = $true } catch { $occupied = $false } finally { $probe.Dispose() }
    if ($occupied) { throw 'Porta 3001 ocupada por um servidor que nao respondeu. Nenhum processo foi encerrado.' }

    $build = Get-Item '.next\BUILD_ID' -ErrorAction SilentlyContinue
    $inputs = @(Get-ChildItem src,public,prisma -File -Recurse)
    $inputs += @(Get-Item package.json,package-lock.json,next.config.ts,tsconfig.json,.env)
    $changed = -not $build -or @($inputs | Where-Object { $_.LastWriteTimeUtc -gt $build.LastWriteTimeUtc }).Count -gt 0
    if ($changed) {
        Write-Host 'Preparando versao local atualizada. Isso pode levar alguns minutos...'
        & $node node_modules/prisma/build/index.js generate
        if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar Prisma Client.' }
        & $node scripts/migrate-scheduling.mjs
        if ($LASTEXITCODE -ne 0) { throw 'Falha ao preparar agenda no banco local.' }
        & $node node_modules/next/dist/bin/next build --webpack
        if ($LASTEXITCODE -ne 0) { throw 'Falha na compilacao local.' }
    }
    $server = Start-Process -FilePath $node -ArgumentList 'node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3001' -WorkingDirectory $project -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime 'feature-production.log') -RedirectStandardError (Join-Path $runtime 'feature-production-error.log')
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        if (Test-LocalApp) { $ready = $true; break }
        if ($server.HasExited) { break }
        Start-Sleep -Seconds 1
    }
    if (-not $ready) { throw "Servidor nao respondeu. Confira os logs em $runtime" }
} else { Write-Host 'Get Wise ja esta em execucao. Reutilizando servidor.' }

Write-Host "Get Wise disponivel em $url"
if (-not $NoBrowser) {
    $chromePaths = @(
        (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
        (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
    )
    $chrome = $chromePaths | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if (-not $chrome) { throw "Google Chrome nao encontrado. Abra manualmente: $url" }
    Start-Process -FilePath $chrome -ArgumentList $url
}
