import { useEffect, useRef } from 'react';

interface NoticeModalProps {
  title?: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
}

export function NoticeModal({
  title = '이용 안내',
  message,
  confirmLabel = '확인',
  onConfirm,
}: NoticeModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onConfirm();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onConfirm]);

  return (
    <div className="modal-overlay">
      <div
        className="modal-card"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <p className="modal-title">{title}</p>
        <p className="modal-message">{message}</p>
        <button
          ref={confirmRef}
          type="button"
          className="btn btn-primary"
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
