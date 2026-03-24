import { exec } from 'child_process';
import { clipboard } from 'electron';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';
import { app } from 'electron';

const execAsync = promisify(exec);

let previousWindowHandle: string | null = null;

/** Run a PowerShell script by encoding it as Base64 to bypass execution policies and temp file restrictions */
async function runPowerShell(script: string): Promise<string> {
  // PowerShell -EncodedCommand expects UTF-16LE Base64
  const buffer = Buffer.from(script, 'utf16le');
  const b64 = buffer.toString('base64');

  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand ${b64}`,
      { timeout: 10000 }
    );
    return stdout;
  } catch (err: any) {
    if (err.stdout) return err.stdout;
    throw err;
  }
}

/**
 * Captures both the previous window handle and the selected text
 * in a single PowerShell operation to minimize latency.
 */
export async function captureContext(): Promise<{ text: string }> {
  const before = clipboard.readText();

  const script = `
$w = Add-Type -Name W -Namespace N -MemberDefinition @'
[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
[DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
[DllImport("user32.dll")] public static extern short GetAsyncKeyState(int vKey);
'@ -PassThru

$hwnd = [N.W]::GetForegroundWindow().ToInt64()
Write-Output "H:$hwnd"

# Wait until modifier keys (Shift=0x10, Ctrl=0x11, Space=0x20) are released
$timeout = 0
while (($timeout -lt 1500) -and (
  ([N.W]::GetAsyncKeyState(0x10) -band 0x8000) -or
  ([N.W]::GetAsyncKeyState(0x11) -band 0x8000) -or
  ([N.W]::GetAsyncKeyState(0x20) -band 0x8000)
)) { Start-Sleep -Milliseconds 15; $timeout += 15 }
Start-Sleep -Milliseconds 10

# Send Ctrl+C via keybd_event (avoids SendKeys modifier conflicts)
[N.W]::keybd_event(0x11, 0, 0, [UIntPtr]::Zero)   # Ctrl down
[N.W]::keybd_event(0x43, 0, 0, [UIntPtr]::Zero)   # C down
[N.W]::keybd_event(0x43, 0, 2, [UIntPtr]::Zero)   # C up
[N.W]::keybd_event(0x11, 0, 2, [UIntPtr]::Zero)   # Ctrl up
`;

  try {
    const stdout = await runPowerShell(script);

    const match = stdout.match(/H:(\d+)/);
    if (match) previousWindowHandle = match[1];

    // Wait for clipboard update — shaves off time but stays reliable
    await new Promise(r => setTimeout(r, 200));

    const after = clipboard.readText().trim();
    return { text: after !== before.trim() ? after : '' };
  } catch (err) {
    console.error('[Capture] PowerShell error:', err);
    return { text: '' };
  }
}

/**
 * Auto-paste flow:
 * Focuses the previous window and sends Ctrl+V.
 */
export async function autoReplace(newText: string): Promise<void> {
  clipboard.writeText(newText);

  const focusPart = previousWindowHandle
    ? `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class Focus {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
'@
[Focus]::SetForegroundWindow([IntPtr]${previousWindowHandle})
`
    : '';

  const script = `${focusPart}
Start-Sleep -Milliseconds 250
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait("^v")
`;

  try {
    await runPowerShell(script);
  } catch (err) {
    console.error('[AutoReplace] PowerShell error:', err);
  }
}

/**
 * Recapture: focuses the previously-recorded window, sends Ctrl+C,
 * and returns whatever lands on the clipboard.
 */
export async function recaptureFromWindow(): Promise<{ text: string }> {
  if (!previousWindowHandle) {
    return { text: '' };
  }

  // Clear clipboard so we can detect the fresh copy
  clipboard.writeText('');

  const script = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class R {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
}
'@

# Focus the original app window
[R]::SetForegroundWindow([IntPtr]${previousWindowHandle})
Start-Sleep -Milliseconds 200

# Send Ctrl+C
[R]::keybd_event(0x11, 0, 0, [UIntPtr]::Zero)
[R]::keybd_event(0x43, 0, 0, [UIntPtr]::Zero)
[R]::keybd_event(0x43, 0, 2, [UIntPtr]::Zero)
[R]::keybd_event(0x11, 0, 2, [UIntPtr]::Zero)
`;

  try {
    await runPowerShell(script);
    await new Promise(r => setTimeout(r, 250));
    const text = clipboard.readText().trim();
    return { text };
  } catch (err) {
    console.error('[Recapture] PowerShell error:', err);
    return { text: '' };
  }
}

// Deprecated old functions — kept for interface compatibility if needed, but unused now
export async function recordPreviousWindow(): Promise<void> { await captureContext(); }
export async function captureSelectedText(): Promise<string> { return (await captureContext()).text; }
