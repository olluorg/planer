/* Логотип Google (в lucide брендовых иконок нет) */
export const GoogleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.16 3.57-8.81Z" fill="#4285F4" />
    <path d="M12 24c3.24 0 5.96-1.07 7.93-2.91l-3.87-3.01c-1.07.72-2.44 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.29v3.11A11.99 11.99 0 0 0 12 24Z" fill="#34A853" />
    <path d="M5.29 14.28a7.2 7.2 0 0 1 0-4.56V6.61H1.29a12.03 12.03 0 0 0 0 10.78l4-3.11Z" fill="#FBBC05" />
    <path d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0A11.99 11.99 0 0 0 1.29 6.61l4 3.11C6.23 6.88 8.88 4.77 12 4.77Z" fill="#EA4335" />
  </svg>
);

/** Открыть запрос во внешнем поиске Google. Только encodeURIComponent + noopener. */
export function openGoogleSearch(query: string) {
  const query2 = query.trim();
  if (!query2) return;
  window.open(`https://www.google.com/search?q=${encodeURIComponent(query2)}`, '_blank', 'noopener,noreferrer');
}
