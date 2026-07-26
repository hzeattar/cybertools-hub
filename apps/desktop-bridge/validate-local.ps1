[CmdletBinding()]
param(
  [switch]$InstallMissingTools
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogDirectory = Join-Path $ProjectRoot 'validation-logs'
$Timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$LogPath = Join-Path $LogDirectory "desktop-bridge-validation-$Timestamp.log"

function Write-Step {
  param([Parameter(Mandatory = $true)][string]$Message)
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Refresh-ProcessPath {
  $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = @($machinePath, $userPath) -join ';'
}

function Assert-LastExitCode {
  param([Parameter(Mandatory = $true)][string]$CommandName)
  if ($LASTEXITCODE -ne 0) {
    throw "$CommandName failed with exit code $LASTEXITCODE"
  }
}

function Install-WithWinget {
  param(
    [Parameter(Mandatory = $true)][string]$PackageId,
    [Parameter(Mandatory = $true)][string]$DisplayName
  )

  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw "$DisplayName is missing and WinGet is not available. Install it manually, then rerun this script."
  }

  Write-Step "Installing $DisplayName with WinGet"
  & winget install --id $PackageId --exact --source winget --accept-package-agreements --accept-source-agreements
  Assert-LastExitCode "winget install $PackageId"
  Refresh-ProcessPath
}

function Ensure-Node {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    if (-not $InstallMissingTools) {
      throw 'Node.js is missing. Rerun with -InstallMissingTools or install Node.js LTS.'
    }
    Install-WithWinget -PackageId 'OpenJS.NodeJS.LTS' -DisplayName 'Node.js LTS'
  }

  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw 'npm is missing even though Node.js was found. Reinstall Node.js LTS.'
  }

  $rawVersion = (& node --version).Trim().TrimStart('v')
  $majorVersion = [int]($rawVersion.Split('.')[0])
  if ($majorVersion -lt 22) {
    throw "Node.js 22 or newer is required. Detected: $rawVersion"
  }

  Write-Host "Node.js: $rawVersion"
  Write-Host "npm: $((& npm --version).Trim())"
}

function Ensure-Rust {
  if (-not (Get-Command rustup -ErrorAction SilentlyContinue)) {
    if (-not $InstallMissingTools) {
      throw 'Rustup is missing. Rerun with -InstallMissingTools or install Rustup.'
    }
    Install-WithWinget -PackageId 'Rustlang.Rustup' -DisplayName 'Rustup'
  }

  Write-Step 'Preparing the stable MSVC Rust toolchain'
  & rustup toolchain install stable-msvc --profile minimal --component rustfmt
  Assert-LastExitCode 'rustup toolchain install'
  & rustup default stable-msvc
  Assert-LastExitCode 'rustup default stable-msvc'

  Refresh-ProcessPath
  if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    $cargoBin = Join-Path $env:USERPROFILE '.cargo\bin'
    if (Test-Path $cargoBin) {
      $env:Path = "$cargoBin;$env:Path"
    }
  }

  if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    throw 'Cargo was installed but is not visible in this terminal. Close PowerShell, reopen it, and rerun the script.'
  }

  Write-Host "rustc: $((& rustc --version).Trim())"
  Write-Host "cargo: $((& cargo --version).Trim())"
}

function Assert-MsvcBuildTools {
  $programFilesX86 = [Environment]::GetFolderPath('ProgramFilesX86')
  $vsWhere = Join-Path $programFilesX86 'Microsoft Visual Studio\Installer\vswhere.exe'

  if (-not (Test-Path $vsWhere)) {
    throw @'
Microsoft C++ Build Tools were not detected.
Install the free "Build Tools for Visual Studio 2022" and select:
  Desktop development with C++
Then restart PowerShell and rerun this script.
'@
  }

  $installationPath = (& $vsWhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath | Select-Object -First 1)
  if ([string]::IsNullOrWhiteSpace($installationPath)) {
    $installationPath = (& $vsWhere -latest -products '*' -property installationPath | Select-Object -First 1)
  }
  if ([string]::IsNullOrWhiteSpace($installationPath)) {
    $fallbackPath = Join-Path $programFilesX86 'Microsoft Visual Studio\2022\BuildTools'
    if (Test-Path $fallbackPath) {
      $installationPath = $fallbackPath
    }
  }
  if ([string]::IsNullOrWhiteSpace($installationPath)) {
    throw @'
Visual Studio Build Tools exists, but no installation path could be resolved.
Open Visual Studio Installer, repair Build Tools 2022, and enable:
  Desktop development with C++
'@
  }

  Write-Host "MSVC Build Tools: $installationPath"
  Initialize-MsvcEnvironment -InstallationPath $installationPath
}

function Initialize-MsvcEnvironment {
  param([Parameter(Mandatory = $true)][string]$InstallationPath)

  $vsDevCmd = Join-Path $InstallationPath 'Common7\Tools\VsDevCmd.bat'
  if (-not (Test-Path $vsDevCmd)) {
    throw "VsDevCmd.bat was not found at $vsDevCmd"
  }

  Write-Step 'Loading the MSVC build environment'
  $environmentLines = & cmd.exe /s /c "`"$vsDevCmd`" -arch=x64 -host_arch=x64 >nul && set"
  Assert-LastExitCode 'VsDevCmd.bat'

  foreach ($line in $environmentLines) {
    if ($line -match '^(.*?)=(.*)$') {
      Set-Item -Path "Env:$($matches[1])" -Value $matches[2]
    }
  }

  if (-not (Get-Command link.exe -ErrorAction SilentlyContinue)) {
    throw 'MSVC linker link.exe is not visible after loading the build environment.'
  }

  Add-WindowsSdkLibraryPaths
}

function Add-WindowsSdkLibraryPaths {
  $programFilesX86 = [Environment]::GetFolderPath('ProgramFilesX86')
  $sdkRoot = Join-Path $programFilesX86 'Windows Kits\10'
  $libRoot = Join-Path $sdkRoot 'Lib'
  if (-not (Test-Path $libRoot)) {
    throw 'Windows SDK libraries were not found. Install a Windows 10/11 SDK component.'
  }

  $sdkVersion = Get-ChildItem -LiteralPath $libRoot -Directory |
    Sort-Object Name -Descending |
    Select-Object -First 1
  if (-not $sdkVersion) {
    throw 'No Windows SDK library version was found.'
  }

  $libraryPaths = @(
    (Join-Path $sdkVersion.FullName 'um\x64'),
    (Join-Path $sdkVersion.FullName 'ucrt\x64'),
    (Join-Path $sdkRoot 'Debuggers\lib\x64')
  ) | Where-Object { Test-Path $_ }

  foreach ($libraryPath in $libraryPaths) {
    if (-not ($env:LIB -split ';' | Where-Object { $_ -eq $libraryPath })) {
      $env:LIB = "$libraryPath;$env:LIB"
    }
  }

  $includeVersion = Join-Path $sdkRoot "Include\$($sdkVersion.Name)"
  $includePaths = @(
    (Join-Path $includeVersion 'um'),
    (Join-Path $includeVersion 'shared'),
    (Join-Path $includeVersion 'ucrt'),
    (Join-Path $includeVersion 'winrt'),
    (Join-Path $includeVersion 'cppwinrt')
  ) | Where-Object { Test-Path $_ }

  foreach ($includePath in $includePaths) {
    if (-not ($env:INCLUDE -split ';' | Where-Object { $_ -eq $includePath })) {
      $env:INCLUDE = "$includePath;$env:INCLUDE"
    }
  }

  if (-not (Test-Path (Join-Path $sdkVersion.FullName 'um\x64\kernel32.lib'))) {
    throw "kernel32.lib was not found in $($sdkVersion.FullName)"
  }
  if (-not (Test-Path (Join-Path $includeVersion 'um\windows.h'))) {
    throw "windows.h was not found in $includeVersion"
  }
  if (-not (Test-Path (Join-Path $sdkRoot 'Debuggers\lib\x64\dbghelp.lib'))) {
    throw 'dbghelp.lib was not found. Install Windows SDK Debugging Tools.'
  }
}

New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null
Start-Transcript -Path $LogPath -Force | Out-Null
$OriginalLocation = Get-Location

try {
  Write-Host 'CyberTools Desktop Bridge - Free Local Validation' -ForegroundColor Green
  Write-Host "Project: $ProjectRoot"
  Write-Host "Log: $LogPath"

  Write-Step 'Checking prerequisites'
  Ensure-Node
  Ensure-Rust
  Assert-MsvcBuildTools

  Set-Location $ProjectRoot

  Write-Step 'Installing frontend dependencies'
  & npm install --no-audit --no-fund
  Assert-LastExitCode 'npm install'

  Write-Step 'Building the TypeScript/Vite frontend'
  & npm run build
  Assert-LastExitCode 'npm run build'

  Write-Step 'Checking Rust formatting'
  Push-Location (Join-Path $ProjectRoot 'src-tauri')
  try {
    & cargo fmt --check
    Assert-LastExitCode 'cargo fmt --check'

    Write-Step 'Compiling and validating the Rust application'
    & cargo check
    Assert-LastExitCode 'cargo check'
  }
  finally {
    Pop-Location
  }

  Write-Host "`nSUCCESS: Desktop Bridge validation completed without errors." -ForegroundColor Green
  Write-Host "Validation log: $LogPath"
  exit 0
}
catch {
  Write-Host "`nFAILED: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Validation log: $LogPath"
  exit 1
}
finally {
  Set-Location $OriginalLocation
  try { Stop-Transcript | Out-Null } catch { }
}
