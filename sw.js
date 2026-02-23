// Service Worker for Habitat Hub
// Currently basic install/activate only

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activated');
});

self.addEventListener('fetch', (event) => {
  // Pass through fetch requests
  // In future, caching logic can be added here
});