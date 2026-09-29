param(
    [switch]$WhatIf
)

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot ".." )).Path
$knownOldPaths = @(
    (Join-Path $projectRoot "release-v11"),
    (Join-Path $projectRoot "tmp\aether-app-inspect-20260929"),
    (Join-Path $projectRoot "tmp\ain-runtime-test-20260929"),
    (Join-Path $projectRoot "tmp\ain-runtime-test-20260929-v2"),
    (Join-Path $projectRoot "tmp\release-app-patch-20260929"),
    (Join-Path $projectRoot "tmp\release-app-patch-20260929-v2"),
    (Join-Path $projectRoot "tmp\release-app-patch-20260929-v3"),
    (Join-Path $projectRoot "tmp\release-app-patch-20260929-v4"),
    (Join-Path $projectRoot "tmp\release-app-patch-20260929-v5"),
    (Join-Path $projectRoot "tmp\release-app-patch-20260929-v6"),
    (Join-Path $projectRoot "tmp\app-mic-v4.asar"),
    (Join-Path $projectRoot "tmp\app-mic-v5.asar"),
    (Join-Path $projectRoot "tmp\app-mic-v6.asar"),
    (Join-Path $projectRoot "tmp\app-before-mic-v4.asar")
)

foreach ($target in $knownOldPaths) {
    if (-not (Test-Path -LiteralPath $target)) {
        continue
    }

    $resolved = (Resolve-Path -LiteralPath $target).Path
    $relative = [IO.Path]::GetRelativePath($projectRoot, $resolved)
    if ($relative.StartsWith("..") -or [IO.Path]::IsPathRooted($relative)) {
        throw "Refusing to remove a path outside the project: $resolved"
    }

    if ($WhatIf) {
        Write-Host "Would remove: $relative"
    } else {
        Remove-Item -LiteralPath $resolved -Recurse -Force
        Write-Host "Removed: $relative"
    }
}

Write-Host "Current portable build remains at: release-skills\win-unpacked"
Write-Host "FunASR probe directory remains untouched: tmp\funasr-onnx-probe"
