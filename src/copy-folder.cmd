if exist %2 rmdir %2 /s /q
(robocopy %1 %2 /e) ^& IF %ERRORLEVEL% LEQ 1 exit 0
