' Executa binance-klines-fast-sync com janela minimizada (para uso no Agendador de Tarefas do Windows).
' Requer: CRON_SECRET no .env do projeto. Node e npm no PATH do usuário que executa a tarefa.
' Saída e erros vão para logs\binance-klines-fast-sync-vbs.log (criar pasta logs se não existir).
Option Explicit
Dim fso, sh, projectRoot, scriptDir, cmd, logPath
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")

' Diretório do script (scripts\) e raiz do projeto (pai de scripts)
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectRoot = fso.GetParentFolderName(scriptDir)
projectRoot = fso.GetAbsolutePathName(projectRoot)

' Pasta e arquivo de log
logPath = fso.BuildPath(projectRoot, "logs")
If Not fso.FolderExists(logPath) Then
  fso.CreateFolder(logPath)
End If
logPath = fso.BuildPath(logPath, "binance-klines-fast-sync-vbs.log")

' npm run garante contexto do projeto e PATH; saída vai para o log
cmd = "cmd /c cd /d """ & projectRoot & """ && echo [VBS] " & Now() & " >> """ & logPath & """ && npm run binance-klines-fast-sync >> """ & logPath & """ 2>&1"
' 2 = janela minimizada, True = esperar terminar
sh.Run cmd, 2, True
