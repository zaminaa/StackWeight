Output demo/stackweight.gif
Set FontSize 16
Set Width 1200
Set Height 720
Set Theme "GitHub Dark"
Hide
Type "export STACKWEIGHT_SCAN_HOME=$(npx tsx scripts/demo-home.ts) && clear" Enter
Sleep 2s
Show
Type "npx stackweight" Sleep 300ms Enter
Sleep 5s
Type "npx stackweight prune --yes" Sleep 300ms Enter
Sleep 3s
Type "npx stackweight" Sleep 300ms Enter
Sleep 4s
