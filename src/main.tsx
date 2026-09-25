import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { MotionProvider } from '@/components/ui/motion';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { bindCrashHandlers } from '@/lib/crashlog';
import './index.css';

bindCrashHandlers();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <MotionProvider>
          <App />
        </MotionProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');

      // Новый воркер активируется только по согласию пользователя: иначе ассеты
      // подменяются под открытым приложением посреди работы.
      // Перезагружаемся только по кнопке. controllerchange приходит и на самом
      // первом визите — activate зовёт clients.claim(), у страницы появляется
      // контроллер, — и без этого флага каждый новый пользователь получал
      // внезапную перезагрузку через секунду после открытия, посреди мастера.
      let updateRequested = false;
      const offerUpdate = (worker: ServiceWorker) => {
        import('@/lib/toast').then(({ toast }) =>
          toast.action('Доступно обновление', {
            label: 'Обновить',
            onClick: () => { updateRequested = true; worker.postMessage({ type: 'SKIP_WAITING' }); },
          }, { description: 'Новая версия загружена и готова к установке.', duration: 0 }),
        );
      };

      if (reg.waiting) offerUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const next = reg.installing;
        if (!next) return;
        next.addEventListener('statechange', () => {
          // controller есть — значит это обновление, а не первая установка.
          if (next.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(next);
        });
      });

      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!updateRequested || reloading) return;
        reloading = true;
        window.location.reload();
      });
    } catch {
      // Без service worker приложение работает, только без офлайна.
    }
  });
}
