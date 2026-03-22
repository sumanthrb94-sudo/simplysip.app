$file = 'src\components\AdminDashboard.tsx'
$lines = Get-Content $file
$total = $lines.Length

# New section ends at line 917 (0-indexed: 916), old analytics block is 917-974 (0-indexed)
# New orders section ends at 1244 (0-indexed), old orders block is 1245-end-of-old
# Keep: lines[0..916] + lines[975..1519] but we need to find exact old orders end
# The old orders section (duplicate) starts right after new orders `)}\n` at index 1245
# and ends before the line with `{/* Slide-over Drawer */}`
# Find the index of the drawer marker in the old section

$drawerStart = -1
for ($i = 1245; $i -lt $total; $i++) {
    if ($lines[$i] -match 'Slide-over Drawer for Order Details') {
        $drawerStart = $i
        break
    }
}

Write-Host "Total lines: $total"
Write-Host "Old analytics starts at (0-indexed): 917  ends at: 974"
Write-Host "Drawer marker found at (0-indexed): $drawerStart"

if ($drawerStart -gt 0) {
    $clean = @($lines[0..916]) + @($lines[975..($drawerStart-1)]) + @($lines[$drawerStart..($total-1)])
    $clean | Set-Content $file -Encoding UTF8
    Write-Host "File cleaned. New count: $($clean.Length)"
} else {
    Write-Host "ERROR: Could not find drawer marker"
}
