#Requires AutoHotkey v2.0
#SingleInstance Off

if A_Args.Length < 2 {
  ExitApp 2
}

targetHwnd := Integer(A_Args[1])
keys := A_Args[2]

if targetHwnd > 0 {
  try {
    WinActivate("ahk_id " targetHwnd)
    WinWaitActive("ahk_id " targetHwnd, , 1)
  }
}

Send(keys)
ExitApp 0
