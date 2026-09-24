; Herbatium — instalator Windows
; Instaleaza fisierele aplicatiei si comenzi rapide care pornesc/opresc
; aplicatia prin Docker Compose (Docker Desktop trebuie instalat separat de
; utilizator — instalatorul verifica asta la prima pornire, nu incearca sa-l
; instaleze el insusi).

!include "MUI2.nsh"

Name "Herbatium"
OutFile "..\dist\Herbatium-Setup.exe"
Unicode true
InstallDir "$LOCALAPPDATA\Herbatium"
InstallDirRegKey HKCU "Software\Herbatium" "InstallDir"
RequestExecutionLevel user

; ---- Metadate versiune (fara nicio referinta la terti) ----
VIProductVersion "1.0.0.0"
VIAddVersionKey "ProductName" "Herbatium"
VIAddVersionKey "CompanyName" "Herbatium"
VIAddVersionKey "FileDescription" "Instalator Herbatium"
VIAddVersionKey "FileVersion" "1.0.0.0"
VIAddVersionKey "LegalCopyright" ""

!define MUI_ICON "assets\herbatium.ico"
!define MUI_UNICON "assets\herbatium.ico"
!define MUI_ABORTWARNING

; ---- Pagini instalare ----
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES

!define MUI_FINISHPAGE_RUN "$INSTDIR\start-herbatium.bat"
!define MUI_FINISHPAGE_RUN_TEXT "Porneste Herbatium acum"
!define MUI_FINISHPAGE_RUN_FUNCTION "LaunchStart"
!insertmacro MUI_PAGE_FINISH

; ---- Pagini dezinstalare ----
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "Romanian"

Function LaunchStart
  ExecShell "open" "$INSTDIR\start-herbatium.bat"
FunctionEnd

; =========================== SECTIUNE INSTALARE ===========================
Section "Herbatium" SEC_MAIN
  SetOutPath "$INSTDIR"
  File /r "payload\*"
  File /r "payload\.env.example"
  File /r "payload\.dockerignore"

  ; Comenzi rapide — Meniu Start
  CreateDirectory "$SMPROGRAMS\Herbatium"
  CreateShortCut "$SMPROGRAMS\Herbatium\Herbatium (porneste).lnk" "$INSTDIR\start-herbatium.bat" "" "$INSTDIR\assets\herbatium.ico" 0
  CreateShortCut "$SMPROGRAMS\Herbatium\Herbatium (opreste).lnk" "$INSTDIR\stop-herbatium.bat" "" "$INSTDIR\assets\herbatium.ico" 0
  CreateShortCut "$SMPROGRAMS\Herbatium\Dezinstalare.lnk" "$INSTDIR\Uninstall.exe"

  ; Comanda rapida — Desktop
  CreateShortCut "$DESKTOP\Herbatium.lnk" "$INSTDIR\start-herbatium.bat" "" "$INSTDIR\assets\herbatium.ico" 0

  ; Inregistrare pentru Programe si Componente (Add/Remove Programs)
  WriteRegStr HKCU "Software\Herbatium" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Herbatium" "DisplayName" "Herbatium"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Herbatium" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Herbatium" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Herbatium" "DisplayIcon" "$INSTDIR\assets\herbatium.ico"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Herbatium" "DisplayVersion" "1.0.0"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Herbatium" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Herbatium" "NoRepair" 1

  WriteUninstaller "$INSTDIR\Uninstall.exe"
SectionEnd

; =========================== SECTIUNE DEZINSTALARE ===========================
Section "Uninstall"
  MessageBox MB_YESNO "Aplicatia (containerele Docker si baza de date) mai poate rula. Vrei sa le opresc acum, inainte de dezinstalare?" IDNO skip_stop
    ExecWait '"$SYSDIR\cmd.exe" /c "cd /d "$INSTDIR" && docker compose down"'
  skip_stop:

  Delete "$DESKTOP\Herbatium.lnk"
  Delete "$SMPROGRAMS\Herbatium\Herbatium (porneste).lnk"
  Delete "$SMPROGRAMS\Herbatium\Herbatium (opreste).lnk"
  Delete "$SMPROGRAMS\Herbatium\Dezinstalare.lnk"
  RMDir "$SMPROGRAMS\Herbatium"

  RMDir /r "$INSTDIR"

  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Herbatium"
  DeleteRegKey HKCU "Software\Herbatium"

  MessageBox MB_OK "Herbatium a fost dezinstalat. Datele salvate in Docker (volumele herbatium_pgdata si herbatium_uploads) NU au fost sterse — daca vrei sa le stergi definitiv, ruleaza manual:$\n$\ndocker volume rm herbatium_pgdata herbatium_uploads"
SectionEnd
