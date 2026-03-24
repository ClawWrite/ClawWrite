<p align="center">
  <img src="resources/banner.png" alt="ClawWrite Banner" width="100%">
</p>

# ClawWrite
> **The high-performance, system-wide AI writing companion for Windows.**


## Project Overview
ClawWrite is an ultra-fast, system-wide AI writing companion designed exclusively for Windows that fundamentally changes how you write, edit, and perfect text. Rather than breaking your focus by context-switching into a separate browser tab or dedicated chat interface, ClawWrite brings the power of Google's Gemini AI directly to your cursor. Whether you're drafting an email in Outlook, chatting in Slack, or coding in an IDE, simply select your text and press a global hotkey. ClawWrite will instantly ingest the text, pop up a beautiful frameless window, and allow you to quickly apply powerful preset commands (like "Make Formal" or "Shorten") or custom prompts. Once satisfied with the AI's output, a single click seamlessly replaces your original highlighted text.

## Key Features
- **Global Hotkey Activation**: Trigger ClawWrite instantly from anywhere in Windows using `Ctrl+Shift+Space`.
- **Intelligent In-Place Replacement**: Automatically pastes the polished output directly back into your original application with one click.
- **True Capture Engine**: A robust "Clear-and-Detect" strategy ensures that even text matches from previous clipboard states are correctly captured.
- **Enterprise-Grade Architecture**: Designed to bypass strict corporate AppLocker execution policies and Antivirus temporal file restrictions utilizing isolated memory and inline base64 `-EncodedCommand` PowerShell executions.
- **One-Click Recapture**: Effortlessly switch to another app, select new text, and reload the assistant with a single click—no need to re-trigger the hotkey.
- **Resilient UI Lifecycle**: Features a near-instant window lifecycle. If no text was selected, the UI gracefully falls back to an editable input box allowing seamless manual entry or pasting.
- **Robust Preset System**: Ships with 8 built-in core actions (Improve, Formal, Casual, Shorten, Expand, Grammar, Bullets, Summarise) with full support for user-defined custom AI presets.
- **Clipboard Monitoring (Opt-in)**: A background service you can enable that automatically shows the AI assistant whenever new text is copied to your clipboard.
- **Recent Chat & History Logging**: Never lose track of your work with localized built-in history storage up to 20 entries.
- **Premium Design System**: A crisp, accessible "#Bold Light" theme featuring glassmorphism elements, intuitive animations, and taskbar visibility.


## Tech Stack
- **Framework Core**: Electron 29
- **Frontend Architecture**: React 19, TypeScript 5.4, Vanilla CSS
- **Build Tooling**: electron-vite (Vite 5), electron-builder (NSIS Installer) 
- **AI Engine**: Google Gemini API SDK (`gemini-3-flash-preview` by default)
- **OS Automation**: Win32 P/Invoke via PowerShell 5+ (`user32.dll`)
- **State Management**: React Hooks & Electron-store (JSON disk persistence)

## Getting Started

### Prerequisites
Before running ClawWrite locally, ensure you have the following installed and configured:
- **Node.js** (v18 or higher recommended)
- **npm** or **yarn**
- A free **Google Gemini API Key** (from [Google AI Studio](https://aistudio.google.com/))
- **Windows OS**: Windows 10 or 11 (requires access to `user32.dll` and PowerShell 5+)

### Installation
1. **Clone the repository:**
   ```bash
   git clone https://github.com/ClawWrite/ClawWrite.git
   cd ClawWrite
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure your API Key:**
   Create a `.env` file at the root of the project:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
   *(Alternatively, you can set the key directly from the Application Settings UI once it boots)*

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. **Build for Production (Windows Installer):**
   ```bash
   npm run dist
   ```

## Usage
### The Core Workflow
1. Select any text (at least a word) in whatever application you're currently using (e.g., Notepad, Chrome, Slack).
2. Press the global hotkey: `Ctrl+Shift+Space`
3. The ClawWrite floating window will instantly materialize next to your cursor, pre-populated with your selected text.
4. Click a built-in preset like **✨ Improve** or type entirely free-form instructions into the **Custom instruction...** field and hit **Enter**.
5. **(Optional)** If you select different text while the window is open, click **↻ Recapture** to update the assistant without closing it.
6. Once the AI answers, either modify the returned text in the text area, click **Copy** to save it to your clipboard, or click **⚡ Replace** to forcefully inject it back into the original active window.


### Utilizing Empty States
If you run the hotkey without anything highlighted, the application still functions robustly—morphing into a blank canvas where you can securely paste text or request a scratch prompt from Gemini. 

## Roadmap
- [ ] **Cross-Platform Support**: Implement native accessibility/AppleScript hooks for macOS users.
- [ ] **Multiple LLM Providers**: Integrate drop-in support for OpenAI API (GPT-4) and Anthropic (Claude 3.5 Sonnet).
- [ ] **Shortcut Customizability**: Introduce a visual hotkey-binding UI within the Settings panel.
- [ ] **Context Awareness**: Optional mode to ingest surrounding active-window text bounds for deeper contextual AI completions.

## Contributing
Contributions are absolutely welcome! We follow a standard "fork-and-pull" workflow. 

1. **Fork** the repository on GitHub.
2. **Clone** the project to your own machine.
3. **Commit** changes to your own branch (`git checkout -b feature/AmazingFeature`).
4. **Push** your work back up to your fork (`git push origin feature/AmazingFeature`).
5. Submit a **Pull Request** so that we can review your changes.

*Please ensure your code passes linting (`npm run lint` if configured) and strictly conforms to existing React 19 `useEffect` structures preventing memory leaks.* 

## License
Distributed under the **MIT License**. See `LICENSE` for more information.

## Contact/Acknowledgments
- **Maintainer**: [Sagar Kalra](https://github.com/sagarkalra-tech/) (ClawWrite Organization)
- **Documentation & UI Logic Engine**: Powered by automated expert implementations to bypass Windows environmental restrictions rapidly. 

---
*Created with ❤️ by **Sagar Kalra** for uninterrupted flow-state writing on Windows.*
