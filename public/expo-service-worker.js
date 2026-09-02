// public/expo-service-worker.js
self.addEventListener('push', function (event) {
  if (!event.data) return;

  const payload = event.data.json();

  const title = payload.notification?.title || payload.title || 'Nova notificação';
  const options = {
    body: payload.notification?.body || payload.body || '',
    icon: '/assets/icon-app.png',
    data: payload.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/') // ajuste para a rota que quiser abrir ao clicar
  );
});