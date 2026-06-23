import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style the confirm button as a destructive action. */
  danger?: boolean;
}

interface DialogState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

// Promise-based in-app replacement for window.confirm(): themed, keyboard-
// accessible (Escape cancels, Enter confirms), and screen-reader friendly.
export function useConfirm() {
  const [state, setState] = useState<DialogState | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setState({ ...options, resolve })),
    [],
  );

  const handleClose = useCallback(
    (value: boolean) => {
      setState((s) => {
        s?.resolve(value);
        return null;
      });
    },
    [],
  );

  const dialog = state ? <ConfirmDialog state={state} onClose={handleClose} /> : null;

  return { confirm, dialog };
}

function ConfirmDialog({ state, onClose }: { state: DialogState; onClose: (v: boolean) => void }) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<Element | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement;
    confirmRef.current?.focus();
    return () => {
      if (previouslyFocused.current instanceof HTMLElement) previouslyFocused.current.focus();
    };
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose(false);
    } else if (e.key === 'Enter') {
      e.stopPropagation();
      onClose(true);
    }
  }

  return (
    <div
      onClick={() => onClose(false)}
      onKeyDown={onKeyDown}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={state.title ? 'confirm-title' : undefined}
        aria-describedby="confirm-message"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--background)',
          color: 'var(--foreground)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          padding: '20px',
          maxWidth: '440px',
          width: '100%',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
        }}
      >
        {state.title && (
          <h3 id="confirm-title" style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: 600 }}>
            {state.title}
          </h3>
        )}
        <p id="confirm-message" style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
          {state.message}
        </p>
        <div style={{ marginTop: '20px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={() => onClose(false)}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--foreground)',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            {state.cancelLabel ?? 'Cancel'}
          </button>
          <button
            ref={confirmRef}
            onClick={() => onClose(true)}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              border: 'none',
              background: state.danger ? 'hsl(0 84% 60%)' : 'var(--primary)',
              color: state.danger ? 'white' : 'var(--primary-foreground)',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            {state.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
