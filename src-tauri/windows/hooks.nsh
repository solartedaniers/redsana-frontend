; Al desinstalar borra la entrada de inicio con Windows y la marca que deja el Administrador de tareas, para que no
; quede apuntando a un programa que ya no existe. En una actualización (/UPDATE) se conserva: el usuario la encendió.
!macro NSIS_HOOK_POSTUNINSTALL
  ${If} $UpdateMode <> 1
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCTNAME}"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "${PRODUCTNAME}"
  ${EndIf}
!macroend
