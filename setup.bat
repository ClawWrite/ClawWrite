@echo off
setlocal

echo ===================================================
echo             ClawWrite - Local Setup
echo ===================================================
echo.

:: 1. Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please download and install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: 2. Install dependencies
echo [1/4] Installing dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install npm dependencies.
    pause
    exit /b 1
)

:: 3. Create .env if missing
echo [2/4] Checking .env configuration...
if not exist ".env" (
    echo Creating default .env file...
    echo GEMINI_API_KEY=> .env
    echo SMTP_HOST=mail.smtp2go.com>> .env
    echo SMTP_PORT=587>> .env
    echo SMTP_USER=>> .env
    echo SMTP_PASS=>> .env
    echo SMTP_FROM=notifications@mspgenie.online>> .env
    echo MOM_RECIPIENT=>> .env
    echo [INFO] A default .env file has been created. Please configure it later.
) else (
    echo [INFO] .env file already exists.
)

:: 4. Build the application main and renderer processes
echo [3/4] Building the application...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to build the application.
    pause
    exit /b 1
)

:: 5. Create Desktop Shortcut for easy silent launch
echo [4/4] Creating Desktop Shortcut...
set "SCRIPT_DIR=%~dp0"
set "SHORTCUT_PATH=%USERPROFILE%\Desktop\ClawWrite.lnk"
set "VBS_PATH=%SCRIPT_DIR%start.vbs"

:: Create the silent start VBS script inside the folder
echo Set WshShell = CreateObject^("WScript.Shell"^) > "%VBS_PATH%"
echo WshShell.CurrentDirectory = "%SCRIPT_DIR%" >> "%VBS_PATH%"
echo WshShell.Run "cmd.exe /c npm run start", 0, False >> "%VBS_PATH%"

:: Delete existing shortcut script if any
if exist CreateShortcut.vbs del CreateShortcut.vbs

:: Use VBScript to create the actual Windows Shortcut link on the Desktop
echo Set oWS = WScript.CreateObject^("WScript.Shell"^) > CreateShortcut.vbs
echo sLinkFile = "%SHORTCUT_PATH%" >> CreateShortcut.vbs
echo Set oLink = oWS.CreateShortcut^(sLinkFile^) >> CreateShortcut.vbs
echo oLink.TargetPath = "wscript.exe" >> CreateShortcut.vbs
echo oLink.Arguments = """" ^& "%SCRIPT_DIR%start.vbs" ^& """" >> CreateShortcut.vbs
echo oLink.WorkingDirectory = "%SCRIPT_DIR%" >> CreateShortcut.vbs
echo oLink.Description = "ClawWrite AI Assistant" >> CreateShortcut.vbs
echo oLink.IconLocation = "%SCRIPT_DIR%resources\icon.ico" >> CreateShortcut.vbs
echo oLink.Save >> CreateShortcut.vbs
cscript //nologo CreateShortcut.vbs
del CreateShortcut.vbs

echo.
echo ===================================================
echo SETUP COMPLETE!
echo.
echo A shortcut "ClawWrite" has been created on your Desktop.
echo You can use it to launch ClawWrite silently in the system tray.
echo.
echo Note: Remember to set your Gemini API Key in the ClawWrite 
echo Settings menu or by editing the .env file directly.
echo ===================================================
pause
