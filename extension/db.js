// // Open (or create) the database
// function openDatabase() {
//     return new Promise((resolve, reject) => {
//         const request = indexedDB.open('ContentArchiveDB', 2);

//         // Handle database upgrades (define the schema)
//         request.onupgradeneeded = (event) => {
//             const db = event.target.result;
            
//             // Create object stores if they don't exist
//             if (!db.objectStoreNames.contains('articles')) {
//                 const articleStore = db.createObjectStore('articles', { keyPath: 'didTx' });
//                 articleStore.createIndex('byline', 'byline', { multiEntry: true });
//                 articleStore.createIndex('tags', 'tags', { multiEntry: true });
//             }
//             if (!db.objectStoreNames.contains('videos')) {
//                 const videoStore = db.createObjectStore('videos', { keyPath: 'didTx' });
//                 videoStore.createIndex('tags', 'tags', { multiEntry: true });
//             }
//             if (!db.objectStoreNames.contains('images')) {
//                 const imageStore = db.createObjectStore('images', { keyPath: 'didTx' });
//                 imageStore.createIndex('tags', 'tags', { multiEntry: true });
//             }
//         };

//         request.onsuccess = () => resolve(request.result);
//         request.onerror = (event) => reject(event.target.error);
//     });
// }

// // CRUD functions for the 'articles' store
// async function addArticle(article) {
//     const db = await openDatabase();
//     const transaction = db.transaction('articles', 'readwrite');
//     const store = transaction.objectStore('articles');
//     return new Promise((resolve, reject) => {
//         const request = store.add(article);
//         request.onsuccess = () => resolve(request.result);
//         request.onerror = (event) => reject(event.target.error);
//     });
// }

// async function getAllArticles() {
//     const db = await openDatabase();
//     const transaction = db.transaction('articles', 'readonly');
//     const store = transaction.objectStore('articles');
//     return new Promise((resolve, reject) => {
//         const request = store.getAll();
//         request.onsuccess = (event) => resolve(event.target.result);
//         request.onerror = (event) => reject(event.target.error);
//     });
// }

// async function updateArticle(didTx, updates) {
//     const db = await openDatabase();
//     const transaction = db.transaction('articles', 'readwrite');
//     const store = transaction.objectStore('articles');
//     const article = await store.get(didTx);
//     Object.assign(article, updates);
//     return new Promise((resolve, reject) => {
//         const request = store.put(article);
//         request.onsuccess = () => resolve(request.result);
//         request.onerror = (event) => reject(event.target.error);
//     });
// }

// async function deleteArticle(didTx) {
//     const db = await openDatabase();
//     const transaction = db.transaction('articles', 'readwrite');
//     const store = transaction.objectStore('articles');
//     return new Promise((resolve, reject) => {
//         const request = store.delete(didTx);
//         request.onsuccess = () => resolve(request.result);
//         request.onerror = (event) => reject(event.target.error);
//     });
// }

// // Similarly, implement functions for `videos` and `images` with addVideo, getAllVideos, updateVideo, deleteVideo, etc.

// async function addVideo(video) {
//     const db = await openDatabase();
//     const transaction = db.transaction('videos', 'readwrite');
//     const store = transaction.objectStore('videos');
//     return new Promise((resolve, reject) => {
//         const request = store.add(video);
//         request.onsuccess = () => resolve(request.result);
//         request.onerror = (event) => reject(event.target.error);
//     });
// }

// async function getAllVideos() {
//     const db = await openDatabase();
//     const transaction = db.transaction('videos', 'readonly');
//     const store = transaction.objectStore('videos');
//     return new Promise((resolve, reject) => {
//         const request = store.getAll();
//         request.onsuccess = (event) => resolve(event.target.result);
//         request.onerror = (event) => reject(event.target.error);
//     });
// }

// async function updateVideo(didTx, updates) {
//     const db = await openDatabase();
//     const transaction = db.transaction('videos', 'readwrite');
//     const store = transaction.objectStore('videos');
//     const video = await store.get(didTx);
//     Object.assign(video, updates);
//     return new Promise((resolve, reject) => {
//         const request = store.put(video);
//         request.onsuccess = () => resolve(request.result);
//         request.onerror = (event) => reject(event.target.error);
//     });
// }

// async function deleteVideo(didTx) {
//     const db = await openDatabase();
//     const transaction = db.transaction('videos', 'readwrite');
//     const store = transaction.objectStore('videos');
//     return new Promise((resolve, reject) => {
//         const request = store.delete(didTx);
//         request.onsuccess = () => resolve(request.result);
//         request.onerror = (event) => reject(event.target.error);
//     });
// }

// async function addImage(image) {
//     const db = await openDatabase();
//     const transaction = db.transaction('images', 'readwrite');
//     const store = transaction.objectStore('images');
//     return new Promise((resolve, reject) => {
//         const request = store.add(image);
//         request.onsuccess = () => resolve(request.result);
//         request.onerror = (event) => reject(event.target.error);
//     });
// }

// async function getAllImages() {
//     const db = await openDatabase();
//     const transaction = db.transaction('images', 'readonly');
//     const store = transaction.objectStore('images');
//     return new Promise((resolve, reject) => {
//         const request = store.getAll();
//         request.onsuccess = (event) => resolve(event.target.result);
//         request.onerror = (event) => reject(event.target.error);
//     });
// }

// async function updateImage(didTx, updates) {
//     const db = await openDatabase();
//     const transaction = db.transaction('images', 'readwrite');
//     const store = transaction.objectStore('images');
//     const image = await store.get(didTx);
//     Object.assign(image, updates);
//     return new Promise((resolve, reject) => {
//         const request = store.put(image);
//         request.onsuccess = () => resolve(request.result);
//         request.onerror = (event) => reject(event.target.error);
//     });
// }

// async function deleteImage(didTx) {
//     const db = await openDatabase();
//     const transaction = db.transaction('images', 'readwrite');
//     const store = transaction.objectStore('images');
//     return new Promise((resolve, reject) => {
//         const request = store.delete(didTx);
//         request.onsuccess = () => resolve(request.result);
//         request.onerror = (event) => reject(event.target.error);
//     });
// }

// export { addArticle, getAllArticles, updateArticle, deleteArticle, addVideo, getAllVideos, updateVideo, deleteVideo, addImage, getAllImages, updateImage, deleteImage };