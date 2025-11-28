// Load import map synchronously before any module scripts
// This must complete before DOMContentLoaded
const xhr = new XMLHttpRequest();
xhr.open('GET', chrome.runtime.getURL('src/importmap.json'), false); // synchronous
xhr.send();

if (xhr.status === 200) {
  const importMap = JSON.parse(xhr.responseText);
  const script = document.createElement('script');
  script.type = 'importmap';
  script.textContent = JSON.stringify(importMap);

  // Insert as first element in head to ensure it loads before any imports
  if (document.head.firstChild) {
    document.head.insertBefore(script, document.head.firstChild);
  } else {
    document.head.appendChild(script);
  }

  console.log('✅ Import map loaded successfully');
} else {
  console.error('❌ Failed to load import map:', xhr.status);
}
