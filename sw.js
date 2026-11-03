const CACHE_NAME = 'sk-worship-v4';
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './js/data.js',
  './js/drive.js',
  './js/ai.js',
  './js/app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './성광교회로고.jpg',
  'https://unpkg.com/@phosphor-icons/web@2.1.1/src/bold/style.css',
  'https://unpkg.com/@phosphor-icons/web@2.1.1/src/fill/style.css'
];

// 설치 시 정적 자원 캐싱
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Cache addAll non-fatal error:', err);
      });
    })
  );
  self.skipWaiting();
});

// 활성화 시 이전 버전 캐시 정리
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 네트워크 우선 (Network First) 전략: 실시간 시트/드라이브 통신 보장
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 구글 시트 및 드라이브 API 통신은 캐시 우회하여 항상 최신 실시간 통신
  if (url.origin.includes('google') || url.origin.includes('googleusercontent')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 앱 내부 자원은 네트워크 우선, 실패 시 캐시 폴백 (빠른 반응과 오프라인 동시 만족)
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
