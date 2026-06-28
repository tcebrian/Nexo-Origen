import { btnOutline, errorShell } from "./ui/nexo-styles";

type PageErrorStateProps = {
  title: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
};

export function PageErrorState({
  title,
  message,
  onRetry,
  retryLabel = "Reintentar",
}: PageErrorStateProps) {
  return (
    <div className={`flex min-h-[400px] flex-col items-center justify-center ${errorShell}`}>
      <p className="text-[13px] font-medium text-[var(--nexo-critical)]">{title}</p>
      {message ? (
        <p className="mt-2 max-w-md text-[12px] text-[var(--nexo-text-secondary)]">{message}</p>
      ) : null}
      {onRetry ? (
        <button type="button" onClick={onRetry} className={`mt-5 ${btnOutline}`}>
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
