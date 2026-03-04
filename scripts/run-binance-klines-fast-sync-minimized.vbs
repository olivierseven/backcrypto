' Executa binance-klines-fast-sync com janela minimizada (para uso no Agendador de Tarefas do Windows).
Option Explicit
Dim fso, sh, projectRoot, cmd
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
projectRoot = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
cmd = "cmd /c cd /d """ & projectRoot & """ && node scripts\binance-klines-fast-sync.js"
' 2 = minimizado, True = esperar terminar
sh.Run cmd, 2, True
