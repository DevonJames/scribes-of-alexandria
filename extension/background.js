let popupPort = null;
// const backendURL = 'http://localhost:3005';
const backendURL = 'https://api.oip.onl';

function getJwtToken(callback) {
    chrome.storage.local.get('token', function(data) {
        console.log('background got data:', data);
        token = data.token;
        console.log('background got Token:', token);
        if (!token) {
            callback(null);
            return;
        }
        // Decode the token to retrieve the userId
        const tokenPayload = JSON.parse(atob(token.split('.')[1]));
        console.log('background got tokenPayload:', tokenPayload);
        const userId = tokenPayload.userId; // Ensure `userId` was encoded in the token
        console.log('background got userId:', userId);
        callback(token, userId);
    });
}

chrome.runtime.onConnect.addListener((port) => {
    if (port.name === "popupConnection") {
        popupPort = port;  // Store the connection to use later
        console.log("Popup connected");
        port.onMessage.addListener(async (message) => {
            if (message.action === "startFetch") {
                console.log("Message from popup: startFetch", message);
                await startFetch(message.url, message.html);
            } else if (message.action === "fetchRelated") {
                console.log("Message from popup: fetchRelated", message);
                await startRelatedFetch(message.tags);
            } else if (message.action === "summarizeArticles") {
                console.log("Summarize articles:", message.articles);
                await summarizeArticles(message.articles);  // Call summarize function
            } else if (message.action === "podcastArticles") {
                console.log("Podcast articles:", message.articles);
                podcastArticles(message.articles);  // Call podcast function
            } else if (message.action === "addArticle") {
                try {
                    const result = await addArticle(message.data);
                    sendMessageToPopup({ action: 'addArticleResult', success: true, result });
                } catch (error) {
                    console.error('Error adding article:', error);
                    sendMessageToPopup({ action: 'addArticleResult', success: false, error: error.message });
                }
            } else if (message.action === "getAllArticles") {
                console.log("Getting all articles");
                try {
                    const articles = await getAllArticles();
                    sendMessageToPopup({ action: 'getAllArticlesResult', success: true, articles });
                } catch (error) {
                    console.error('Error fetching articles:', error);
                    sendMessageToPopup({ action: 'getAllArticlesResult', success: false, error: error.message });
                }
            } else if (message.action === "updateArticle") {
                try {
                    const { didTx, updates } = message.data;
                    const result = await updateArticle(didTx, updates);
                    sendMessageToPopup({ action: 'updateArticleResult', success: true, result });
                } catch (error) {
                    console.error('Error updating article:', error);
                    sendMessageToPopup({ action: 'updateArticleResult', success: false, error: error.message });
                }
            } else if (message.action === "deleteArticle") {
                try {
                    const { didTx } = message.data;
                    const result = await deleteArticle(didTx);
                    sendMessageToPopup({ action: 'deleteArticleResult', success: true, result });
                } catch (error) {
                    console.error('Error deleting article:', error);
                    sendMessageToPopup({ action: 'deleteArticleResult', success: false, error: error.message });
                }
            } else if (message.action === "addVideo") {
                try {
                    const result = await addVideo(message.data);
                    sendMessageToPopup({ action: 'addVideoResult', success: true, result });
                } catch (error) {
                    console.error('Error adding video:', error);
                    sendMessageToPopup({ action: 'addVideoResult', success: false, error: error.message });
                }
            } else if (message.action === "getAllVideos") {
                try {
                    const videos = await getAllVideos();
                    sendMessageToPopup({ action: 'getAllVideosResult', success: true, videos });
                } catch (error) {
                    console.error('Error fetching videos:', error);
                    sendMessageToPopup({ action: 'getAllVideosResult', success: false, error: error.message });
                }
            } else if (message.action === "updateVideo") {
                try {
                    const { didTx, updates } = message.data;
                    const result = await updateVideo(didTx, updates);
                    sendMessageToPopup({ action: 'updateVideoResult', success: true, result });
                } catch (error) {
                    console.error('Error updating video:', error);
                    sendMessageToPopup({ action: 'updateVideoResult', success: false, error: error.message });
                }
            } else if (message.action === "deleteVideo") {
                try {
                    const { didTx } = message.data;
                    const result = await deleteVideo(didTx);
                    sendMessageToPopup({ action: 'deleteVideoResult', success: true, result });
                } catch (error) {
                    console.error('Error deleting video:', error);
                    sendMessageToPopup({ action: 'deleteVideoResult', success: false, error: error.message });
                }
            } else if (message.action === "addImage") {
                try {
                    const result = await addImage(message.data);
                    sendMessageToPopup({ action: 'addImageResult', success: true, result });
                } catch (error) {
                    console.error('Error adding image:', error);
                    sendMessageToPopup({ action: 'addImageResult', success: false, error: error.message });
                }
            } else if (message.action === "getAllImages") {
                try {
                    const images = await getAllImages();
                    sendMessageToPopup({ action: 'getAllImagesResult', success: true, images });
                } catch (error) {
                    console.error('Error fetching images:', error);
                    sendMessageToPopup({ action: 'getAllImagesResult', success: false, error: error.message });
                }
            } else if (message.action === "updateImage") {
                try {
                    const { didTx, updates } = message.data;
                    const result = await updateImage(didTx, updates);
                    sendMessageToPopup({ action: 'updateImageResult', success: true, result });
                } catch (error) {
                    console.error('Error updating image:', error);
                    sendMessageToPopup({ action: 'updateImageResult', success: false, error: error.message });
                }
            } else if (message.action === "deleteImage") {
                try {
                    const { didTx } = message.data;
                    const result = await deleteImage(didTx);
                    sendMessageToPopup({ action: 'deleteImageResult', success: true, result });
                } catch (error) {
                    console.error('Error deleting image:', error);
                    sendMessageToPopup({ action: 'deleteImageResult', success: false, error: error.message });
                }
            }
        });
        port.onDisconnect.addListener(() => {
            console.log("Popup disconnected");
            popupPort = null; // Cleanup
        });
    }
});

chrome.runtime.onInstalled.addListener(() => {
    console.log('Background script (service worker) is running');
});
  
// Function to podcast articles
function podcastArticles(articles) {
    getJwtToken((token) => {
        fetch(`${backendURL}/api/generate/summary`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ articles }),  // Send selected articles as JSON
        })
            .then(response => response.json())
            .then(message => {
                // Send the message result back to popup
                console.log('message generated:', message);
                sendMessageToPopup({ action: 'combinedSummaryAudio', payload: message });
                // console.log('message has been set:', message);
            })

        .catch(error => {
            console.error("Error generating summary:", error);
            sendMessageToPopup({ action: 'error', message: 'Failed to generate summary.' });
        });
    })
}


// Function to summarize articles
function summarizeArticles(articles) {
    // getJwtToken((token) => {

        fetch(`${backendURL}/api/generate/summary`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
                // 'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ articles }),  // Send selected articles as JSON
        })
            .then(response => response.json())
            .then(message => {
                // Send the message result back to popup
                console.log('message generated:', message);
                sendMessageToPopup({ action: 'combinedSummaryAudio', payload: message });
                // console.log('message has been set:', message);
            })
    
        .catch(error => {
            console.error("Error generating summary:", error);
            sendMessageToPopup({ action: 'error', message: 'Failed to generate summary.' });
        });
    // })
}
  // Function to send data back to popup
function sendMessageToPopup(data) {
    if (popupPort) {
        console.log("Sending data to popup:", data);
        popupPort.postMessage(data);
    } else {
        console.error("Popup is not connected, cannot send data");
    }
}
  // Fetch related articles based on tags
function startRelatedFetch(tags) {
    console.log('Starting related fetch for tags:', tags);
    getJwtToken((token) => {

        if (!tags) {
            console.error("No tags found, cannot fetch related articles.");
            return;
        }

        // API endpoint with tags
        const apiEndpoint = `${backendURL}/api/records?resolveDepth=2&tags=${encodeURIComponent(tags)}`;

        // Show loading indicator on the popup side (send message to popup to show spinner)
        // sendMessageToPopup({ action: 'showLoadingIndicator', show: true });

        fetch(apiEndpoint, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ tags })
        })
            .then(response => response.json())
            .then(data => {
                // Hide loading indicator after receiving data
                // sendMessageToPopup({ action: 'showLoadingIndicator', show: false });
                // Log the received data for debugging
                console.log("Related articles fetched:", data.qtyReturned);
                // Check if any articles were returned
                if (data.qtyReturned > 0) {
                    sendMessageToPopup({ action: 'updateRelatedArticles', data: data.records });
                } else {
                    sendMessageToPopup({ action: 'updateRelatedArticles', data: [] });
                }
            })
    })
    .catch(error => {
        console.error("Error fetching related articles:", error);
        sendMessageToPopup({ action: 'error', message: 'Failed to fetch related articles.' });
        sendMessageToPopup({ action: 'showLoadingIndicator', show: false });
    });
}


function startFetch(pageUrl, htmlContent) {
    getJwtToken((token, userId ) => {
    if (!token || !userId) {
        console.error("No JWT token or userId found. Cannot start fetch operation.");
        return; // Exit early if no token is available
    }
    console.log('Using token', token, 'and starting fetch for URL:', pageUrl);
    return new Promise((resolve, reject) => {
        // Your fetch logic here
        fetch(`${backendURL}/api/scrape/article/stream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ url: pageUrl, html: htmlContent, userId }), // Include userId here
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            return reader.read().then(function processText({ done, value }) {
              if (done) {
                console.log("Stream complete");
                return;
              }
              
              const chunk = decoder.decode(value, { stream: true });
            //   console.log("Chunk received:", chunk);
              processStreamChunk(chunk);  // Process the chunk (this should be the event data)
              
              return reader.read().then(processText);
            });
        })
        .catch(error => {
            console.error('There was a problem with the fetch operation:', error);
            reject(error);  // Reject the promise in case of error
        });
    });
})
}

function processStreamChunk(chunk) {
    const events = chunk.split('\n\n'); // Each event is separated by two newlines
    events.forEach(eventStr => {
        if (eventStr.trim() === '') return; // Skip empty lines

        const lines = eventStr.split('\n');
        const eventType = lines[0] ? lines[0].replace('event: ', '').trim() : null;
        
        // Handle specific event types
        if (eventType === 'synthesizedSpeech') {
            const urlData = lines[1].replace('data: ', '').trim();
            sendMessageToPopup({ action: 'synthesizedSpeech', payload: urlData });
        } else if (eventType === 'combinedSummaryAudio') {
            const audioUrl = lines[1].replace('data: ', '').trim();
            sendMessageToPopup({ action: 'combinedSummaryAudio', payload: audioUrl });
        } else if (eventType === 'STREAM_END') {
            console.log('Stream end event received');
        } else if (lines[1]) {
            console.log('other event received')
            const eventData = lines[1].replace('data: ', '').trim();
            function isValidJson(str) {
                try {
                    JSON.parse(str);  // Try parsing the string
                } catch (e) {
                    return false;  // If it throws an error, it's not valid JSON
                }
                return true;  // If it doesn't throw an error, it's valid
            }
            
            console.log(`Event: ${eventType}`, `Data: ${eventData}`);
            
            // Parse the data as JSON if necessary
            let parsedData;
            if (isValidJson(eventData)) {
                try {
                    parsedData = JSON.parse(eventData);
                } catch (e) {
                    console.error('Failed to parse event data:', e);
                    return;  // Exit the function gracefully if parsing fails
                }
            } else {
                console.warn('Received event data is not valid JSON:', eventData);
                // Optionally, handle the case where the eventData is not JSON
                return;
            }
        
            sendMessageToPopup({ action: 'updateData', data: { type: eventType, payload: parsedData } });
        }
    });
}

// Open (or create) the database
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('ContentArchiveDB', 2);

        // Handle database upgrades (define the schema)
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Create object stores if they don't exist
            if (!db.objectStoreNames.contains('articles')) {
                const articleStore = db.createObjectStore('articles', { keyPath: 'didTx' });
                articleStore.createIndex('byline', 'byline', { multiEntry: true });
                articleStore.createIndex('tags', 'tags', { multiEntry: true });
            }
            if (!db.objectStoreNames.contains('videos')) {
                const videoStore = db.createObjectStore('videos', { keyPath: 'didTx' });
                videoStore.createIndex('tags', 'tags', { multiEntry: true });
            }
            if (!db.objectStoreNames.contains('images')) {
                const imageStore = db.createObjectStore('images', { keyPath: 'didTx' });
                imageStore.createIndex('tags', 'tags', { multiEntry: true });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

// CRUD function to add an article to the 'articles' store with duplicate key handling
async function addArticle(article) {
    const db = await openDatabase();
    const transaction = db.transaction('articles', 'readwrite');
    const store = transaction.objectStore('articles');

    return new Promise((resolve, reject) => {
        const request = store.add(article);
        request.onsuccess = () => {
            // If successfully added, resolve with success message
            chrome.runtime.sendMessage({ action: 'addArticleResult', success: true });
            resolve(request.result);
        };
        
        request.onerror = (event) => {
            const error = event.target.error;

            if (error.name === 'ConstraintError') {
                // Send a message indicating the article already exists
                chrome.runtime.sendMessage({
                    action: 'addArticleResult',
                    success: false,
                    error: 'Key already exists',
                    data: article  // Send back article details for reference
                });
                resolve(null); // Resolve without rejection to handle gracefully
            } else {
                // For other errors, send a generic error response
                chrome.runtime.sendMessage({
                    action: 'addArticleResult',
                    success: false,
                    error: error.message || 'Failed to save the article'
                });
                reject(error); // Reject for non-duplicate errors
            }
        };
    });
}

async function getAllArticles() {
    const db = await openDatabase();
    const transaction = db.transaction('articles', 'readonly');
    const store = transaction.objectStore('articles');
    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function updateArticle(didTx, updates) {
    const db = await openDatabase();
    const transaction = db.transaction('articles', 'readwrite');
    const store = transaction.objectStore('articles');
    const article = await store.get(didTx);
    Object.assign(article, updates);
    return new Promise((resolve, reject) => {
        const request = store.put(article);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function deleteArticle(didTx) {
    const db = await openDatabase();
    const transaction = db.transaction('articles', 'readwrite');
    const store = transaction.objectStore('articles');
    return new Promise((resolve, reject) => {
        const request = store.delete(didTx);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function addVideo(video) {
    const db = await openDatabase();
    const transaction = db.transaction('videos', 'readwrite');
    const store = transaction.objectStore('videos');
    return new Promise((resolve, reject) => {
        const request = store.add(video);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function getAllVideos() {
    const db = await openDatabase();
    const transaction = db.transaction('videos', 'readonly');
    const store = transaction.objectStore('videos');
    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function updateVideo(didTx, updates) {
    const db = await openDatabase();
    const transaction = db.transaction('videos', 'readwrite');
    const store = transaction.objectStore('videos');
    const video = await store.get(didTx);
    Object.assign(video, updates);
    return new Promise((resolve, reject) => {
        const request = store.put(video);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function deleteVideo(didTx) {
    const db = await openDatabase();
    const transaction = db.transaction('videos', 'readwrite');
    const store = transaction.objectStore('videos');
    return new Promise((resolve, reject) => {
        const request = store.delete(didTx);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function addImage(image) {
    const db = await openDatabase();
    const transaction = db.transaction('images', 'readwrite');
    const store = transaction.objectStore('images');
    return new Promise((resolve, reject) => {
        const request = store.add(image);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function getAllImages() {
    const db = await openDatabase();
    const transaction = db.transaction('images', 'readonly');
    const store = transaction.objectStore('images');
    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function updateImage(didTx, updates) {
    const db = await openDatabase();
    const transaction = db.transaction('images', 'readwrite');
    const store = transaction.objectStore('images');
    const image = await store.get(didTx);
    Object.assign(image, updates);
    return new Promise((resolve, reject) => {
        const request = store.put(image);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function deleteImage(didTx) {
    const db = await openDatabase();
    const transaction = db.transaction('images', 'readwrite');
    const store = transaction.objectStore('images');
    return new Promise((resolve, reject) => {
        const request = store.delete(didTx);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

let eventSource;