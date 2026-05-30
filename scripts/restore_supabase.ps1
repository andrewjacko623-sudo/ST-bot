# Restore a Supabase dashboard .backup file into a NEW project.
# Usage: .\scripts\restore_supabase.ps1
# You will be prompted for the NEW project's database password (Database Settings).

$ErrorActionPreference = "Stop"

$ProjectRef = "dgsmoqpkfrihdltjgdfz"
$PoolerHost = "aws-1-us-east-2.pooler.supabase.com"
$BackupFile = "C:\Users\Rydaw\OneDrive\Desktop\db_cluster-27-01-2026.backup"

$psqlCandidates = @(
    "C:\Program Files\PostgreSQL\18\bin\psql.exe",
    "C:\Program Files\PostgreSQL\17\bin\psql.exe",
    "C:\Program Files\PostgreSQL\16\bin\psql.exe"
)

$psql = $psqlCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $psql) {
    Write-Error "psql not found. Install PostgreSQL from https://www.postgresql.org/download/windows/"
}

if (-not (Test-Path $BackupFile)) {
    Write-Error "Backup not found: $BackupFile"
}

Write-Host "Backup: $BackupFile"
Write-Host "Target: $ProjectRef @ $PoolerHost"
Write-Host ""
Write-Host "Use the database password from Supabase Dashboard -> Project Settings -> Database -> Reset database password"
Write-Host "(Wait 1-2 minutes after reset before continuing.)"
Write-Host ""

$secure = Read-Host "Database password" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

$env:PGSSLMODE = "require"
$user = "postgres.$ProjectRef"

Write-Host "Connecting and restoring (this may take a few minutes)..."
& $psql -h $PoolerHost -p 5432 -U $user -d postgres -f $BackupFile

if ($LASTEXITCODE -ne 0) {
    Write-Error "Restore failed (exit $LASTEXITCODE). Check password and try direct host: db.$ProjectRef.supabase.com"
}

Write-Host ""
Write-Host "Restore finished. Verify in SQL Editor:"
Write-Host "  SELECT COUNT(*) FROM tasks;"
Write-Host "  SELECT COUNT(*) FROM inventory;"
