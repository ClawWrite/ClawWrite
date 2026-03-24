import { useState, useEffect, useRef } from 'react';
import type { AnyPreset } from '../main/gemini.js';
import type { HistoryEntry } from '../main/settings.js';

type Phase = 'idle' | 'loading' | 'result' | 'settings' | 'history';

export default function App() {
  const [sourceText, setSourceText] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [result, setResult] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [presets, setPresets] = useState<AnyPreset[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [copied, setCopied] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [activeInstruction, setActiveInstruction] = useState('');
  const [newPresetLabel, setNewPresetLabel] = useState('');
  const [newPresetPrompt, setNewPresetPrompt] = useState('');
  const customInputRef = useRef<HTMLInputElement>(null);

  // One-time setup: fetch presets/history and listen for init-text
  useEffect(() => {
    window.clawwrite.getPresets().then(setPresets);
    window.clawwrite.getHistory().then(setHistory);

    const unsubInitText = window.clawwrite.onInitText((text: string) => {
      setSourceText(text);
      setPhase('idle');
      setResult('');
      setError('');
      setActivePresetId(null);
    });

    return () => { unsubInitText(); };
  }, []);

  // Escape key handler — depends on phase so needs its own effect
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (phase === 'result' || phase === 'settings' || phase === 'history') {
          setPhase('idle');
        } else {
          window.clawwrite.closePopup();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase]);

  const runRewrite = async (instruction: string, presetId: string | null) => {
    if (!sourceText.trim()) return;
    setPhase('loading');
    setError('');
    setActivePresetId(presetId);
    setActiveInstruction(instruction);

    const res = await window.clawwrite.rewrite(sourceText, instruction, presetId);

    if (res.success && res.result) {
      setResult(res.result);
      setPhase('result');
    } else {
      setError(res.error ?? 'Gemini returned no result. Try again.');
      setPhase('idle');
    }
  };

  const handleCopy = async () => {
    await window.clawwrite.copyResult(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleReplace = () => {
    window.clawwrite.replaceText(result);
    // Popup will be destroyed by main process after paste
  };

  const handleRetry = () => {
    if (activeInstruction) runRewrite(activeInstruction, activePresetId);
  };

  const handleBack = () => {
    setPhase('idle');
    setResult('');
    setCopied(false);
    setError('');
  };

  const handleAddPreset = async () => {
    if (!newPresetLabel.trim() || !newPresetPrompt.trim()) return;
    const updated = await window.clawwrite.addCustomPreset({
      label: newPresetLabel,
      prompt: newPresetPrompt,
    });
    setPresets(updated);
    setNewPresetLabel('');
    setNewPresetPrompt('');
  };

  const handleDeletePreset = async (id: string) => {
    const updated = await window.clawwrite.deleteCustomPreset(id);
    setPresets(updated);
  };

  const truncate = (text: string, max: number) =>
    text.length > max ? text.slice(0, max) + '…' : text;

  return (
    <div className="app">
      {/* ── Header ─────────────────────────── */}
      <div className="header drag-region">
        <span className="logo">✦ ClawWrite</span>
        <div className="header-actions no-drag">
          <button
            className={`header-btn ${phase === 'history' ? 'active' : ''}`}
            onClick={() => setPhase(phase === 'history' ? 'idle' : 'history')}
            title="Recent rewrites"
          >⟳</button>
          <button
            className={`header-btn ${phase === 'settings' ? 'active' : ''}`}
            onClick={() => setPhase(phase === 'settings' ? 'idle' : 'settings')}
            title="Settings"
          >⚙</button>
          <button className="close-btn" onClick={() => window.clawwrite.closePopup()}>✕</button>
        </div>
      </div>

      {/* ── Source preview (always visible unless in settings/history) ── */}
      {phase !== 'settings' && phase !== 'history' && (
        <div className="source-preview">
          <div className="source-header">
            <span className="source-label">Selected text</span>
            <button
              className="recapture-btn"
              onClick={() => window.clawwrite.recaptureText()}
              title="Select new text and recapture"
            >↻ Recapture</button>
          </div>
          <textarea
            className="source-textarea"
            placeholder="Capturing selection or type your text here..."
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            spellCheck={false}
            rows={2}
          />
        </div>
      )}

      {/* ── Phase: idle ─────────────────────── */}
      {phase === 'idle' && (
        <div className="actions-section">
          <div className="preset-grid">
            {presets.map((p) => (
              <button
                key={p.id}
                className="preset-btn"
                onClick={() => runRewrite(p.prompt, p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="custom-row">
            <input
              ref={customInputRef}
              className="custom-input"
              placeholder="Custom instruction…"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customPrompt.trim()) {
                  runRewrite(customPrompt, null);
                }
              }}
            />
            <button
              className="custom-send-btn"
              onClick={() => customPrompt.trim() && runRewrite(customPrompt, null)}
              disabled={!customPrompt.trim()}
            >→</button>
          </div>
          {error && (
            <div className="error-banner">
              <span>{error}</span>
              <button onClick={() => setError('')}>✕</button>
            </div>
          )}
        </div>
      )}

      {/* ── Phase: loading ──────────────────── */}
      {phase === 'loading' && (
        <div className="loading-section">
          <div className="loading-dots">
            <span /><span /><span />
          </div>
          <p className="loading-label">Rewriting…</p>
        </div>
      )}

      {/* ── Phase: result ───────────────────── */}
      {phase === 'result' && (
        <div className="result-section">
          <div className="result-box">
            <textarea
              className="result-textarea"
              value={result}
              onChange={(e) => setResult(e.target.value)}
              spellCheck={false}
            />
          </div>
          <div className="result-actions">
            <button className="btn-back" onClick={handleBack} title="Try a different action">← Back</button>
            <button className="btn-retry" onClick={handleRetry} title="Run the same action again">↺ Retry</button>
            <button className="btn-copy" onClick={handleCopy}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
            <button className="btn-replace" onClick={handleReplace}>
              ⚡ Replace
            </button>
          </div>
          <p className="replace-hint">Replace pastes directly back into your app</p>
        </div>
      )}

      {/* ── Phase: settings ─────────────────── */}
      {phase === 'settings' && (
        <div className="settings-section">
          <h3 className="settings-title">Settings</h3>

          <div className="settings-group">
            <label className="settings-label">Gemini API Key</label>
            <div className="api-key-row">
              <input
                className="settings-input"
                type="password"
                placeholder="AIza…"
                onBlur={(e) => {
                  if (e.target.value) window.clawwrite.setApiKey(e.target.value);
                }}
              />
            </div>
          </div>

          <div className="settings-group">
            <label className="settings-label">Custom Presets</label>
            <div className="custom-presets-list">
              {presets.filter(p => !p.isBuiltIn).map(p => (
                <div key={p.id} className="custom-preset-item">
                  <span className="custom-preset-label">{p.label}</span>
                  <button
                    className="custom-preset-delete"
                    onClick={() => handleDeletePreset(p.id)}
                  >✕</button>
                </div>
              ))}
              {presets.filter(p => !p.isBuiltIn).length === 0 && (
                <p className="empty-state">No custom presets yet</p>
              )}
            </div>
            <div className="add-preset-form">
              <input
                className="settings-input"
                placeholder="Button label (e.g. MSP Ticket)"
                value={newPresetLabel}
                onChange={(e) => setNewPresetLabel(e.target.value)}
                maxLength={30}
              />
              <textarea
                className="settings-textarea"
                placeholder="Instruction sent to AI…"
                value={newPresetPrompt}
                onChange={(e) => setNewPresetPrompt(e.target.value)}
                rows={2}
                maxLength={500}
              />
              <button
                className="btn-add-preset"
                onClick={handleAddPreset}
                disabled={!newPresetLabel.trim() || !newPresetPrompt.trim()}
              >+ Add Preset</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Phase: history ──────────────────── */}
      {phase === 'history' && (
        <div className="history-section">
          <h3 className="settings-title">Recent Rewrites</h3>
          {history.length === 0 ? (
            <p className="empty-state">No history yet</p>
          ) : (
            <div className="history-list">
              {history.map(entry => (
                <div key={entry.id} className="history-item">
                  <div className="history-item-header">
                    <span className="history-instruction">{truncate(entry.instruction, 40)}</span>
                    <button
                      className="history-delete-btn"
                      onClick={async () => {
                        await window.clawwrite.deleteHistoryEntry(entry.id);
                        setHistory(h => h.filter(e => e.id !== entry.id));
                      }}
                    >✕</button>
                  </div>
                  <p className="history-result">{truncate(entry.result, 100)}</p>
                  <button
                    className="history-use-btn"
                    onClick={() => {
                      setResult(entry.result);
                      setPhase('result');
                    }}
                  >Use this</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
