let popupPort = null;
// const backendURL = 'http://localhost:3005';
const backendURL = 'https://api.oip.onl';

async function getJwtToken() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get('token', (data) => {
            // console.log('background got data:', data);
            const token = data.token;
            if (!token) {
                console.error('No token found.');
                return resolve({ token: null, userId: null });
            }

            // console.log('background got Token:', token);

            try {
                // Decode the token payload to retrieve the userId
                const tokenPayload = JSON.parse(atob(token.split('.')[1]));
                // console.log('background got tokenPayload:', tokenPayload);
                const userId = tokenPayload.userId;
                // console.log('background got userId:', userId);

                resolve({ token, userId });
            } catch (error) {
                console.error('Failed to decode token:', error);
                resolve({ token: null, userId: null });
            }
        });
    });
}

// function getJwtToken(callback) {
//     chrome.storage.local.get('token', function(data) {
//         console.log('background got data:', data);
//         token = data.token;
//         console.log('background got Token:', token);
//         if (!token) {
//             callback(null);
//             return;
//         }
//         // Decode the token to retrieve the userId
//         const tokenPayload = JSON.parse(atob(token.split('.')[1]));
//         console.log('background got tokenPayload:', tokenPayload);
//         const userId = tokenPayload.userId; // Ensure `userId` was encoded in the token
//         console.log('background got userId:', userId);
//         callback(token, userId);
//     });
// }

chrome.action.onClicked.addListener((tab) => {
    // Fetch data only when the icon is clicked
    chrome.storage.local.get('token', function (data) {
        const token = data.token;

        if (!token) {
            // If no token is present, save a flag to show the login screen in the popup
            chrome.storage.local.set({ popupState: 'login' }, () => {
                console.log("No token found. Opening popup for login.");
                // ALWAYS open popup when authentication is needed
                chrome.windows.create({
                    url: chrome.runtime.getURL('popup.html'),
                    type: 'popup',
                    width: 400,
                    height: 600
                });
            });
        } else {
            // If authenticated, initiate the fetch process
            console.log("Token found. Initiating background fetch.");
            initiateBackgroundFetch(tab);
        }
    });
});

// eventSource.addEventListener('message', (event) => {
//     console.log('Raw message received:', event.data);
//     try {
//         const parsedData = JSON.parse(event.data);
//         console.log('Parsed message:', parsedData);
//         processStreamChunk(event.data);
//     } catch (err) {
//         console.error('Failed to parse message:', event.data, err);
//     }
// });

async function initiateBackgroundFetch(tab) {
    const timeoutDuration = 60000; // 1-minute timeout
    const pageUrl = tab.url;

    const timeoutId = setTimeout(() => {
        console.warn("Page load taking too long. Starting fetch process anyway.");
        startFetchWithRetries(pageUrl, timeoutId);
    }, timeoutDuration);

    // const screenshots = null;
    // const screenshotBase64 = null;
    // const totalHeight = null;
    // const htmlContent = null;
    // startFetchWithRetries(pageUrl, timeoutId, htmlContent, screenshotBase64, screenshots, totalHeight);

    const { screenshots, totalHeight } = await captureFullPageScreenshot(tab.id);
    console.log('Full-page screenshot captured:', screenshots);

    // Capture a screenshot of the visible portion of the page
    chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, (screenshotBase64) => {
        if (chrome.runtime.lastError) {
            console.error('Error capturing screenshot:', chrome.runtime.lastError);
            clearTimeout(timeoutId); // Clear timeout on error
            return;
        }

        console.log('Screenshot captured.', screenshotBase64);

        // Inject script to retrieve HTML content
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                return new Promise((resolve) => {
                    const checkReadyState = () => {
                        if (document.readyState === 'complete') {
                            resolve(document.documentElement.outerHTML);
                        } else {
                            document.addEventListener('readystatechange', () => {
                                if (document.readyState === 'complete') {
                                    resolve(document.documentElement.outerHTML);
                                }
                            });
                        }
                    };
                    checkReadyState();
                });
            },
        }, (result) => {
            clearTimeout(timeoutId); // Clear timeout if HTML is retrieved on time

            const htmlContent = (result && result.length > 0) ? result[0].result : null;

            if (htmlContent) {
                // Pass the HTML content and screenshot to the backend
                startFetchWithRetries(pageUrl, timeoutId, htmlContent, screenshotBase64, screenshots, totalHeight);
            }
        });
    });
}

// async function initiateBackgroundFetch(tab) {
//     const timeoutDuration = 60000; // 1-minute timeout
//     const pageUrl = tab.url;

//     const timeoutId = setTimeout(() => {
//         console.warn("Page load taking too long. Starting fetch process anyway.");
//         startFetchWithRetries(pageUrl, timeoutId);
//     }, timeoutDuration);

//     const { screenshots, totalHeight } = await captureFullPageScreenshot(tab.id);
//     console.log('Full-page screenshot captured:', screenshots);

//     // Capture a screenshot of the visible portion of the page
//     chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, (screenshotBase64) => {
//         if (chrome.runtime.lastError) {
//             console.error('Error capturing screenshot:', chrome.runtime.lastError);
//             return;
//         }

//         console.log('Screenshot captured.', screenshotBase64);

//         // Inject script to retrieve HTML content
//         chrome.scripting.executeScript({
//             target: { tabId: tab.id },
//             func: () => {
//                 return new Promise((resolve) => {
//                     const checkReadyState = () => {
//                         if (document.readyState === 'complete') {
//                             resolve(document.documentElement.outerHTML);
//                         } else {
//                             document.addEventListener('readystatechange', () => {
//                                 if (document.readyState === 'complete') {
//                                     resolve(document.documentElement.outerHTML);
//                                 }
//                             });
//                         }
//                     };
//                     checkReadyState();
//                 });
//             },
//         }, (result) => {
//             clearTimeout(timeoutId); // Clear timeout if HTML is retrieved on time

//             const htmlContent = (result && result.length > 0) ? result[0].result : null;

//             if (htmlContent) {
//                 // Pass the HTML content and screenshot to the backend
//                 startFetchWithRetries(pageUrl, timeoutId, htmlContent, screenshotBase64, screenshots, totalHeight);
//             }
//         });
//     });


// }

function handleError() {
    console.error("Error occurred during data loading.");
    // resetIcon(); // Ensure the icon is reset on error
}

// Array of rotation frames for the loading icon
const loadingFrames = [
    "icons/icons8-loading-100-frame-1.png",
    "icons/icons8-loading-100-frame-2.png",
    "icons/icons8-loading-100-frame-3.png",
    "icons/icons8-loading-100-frame-4.png"
];

let rotationInterval = null;

// Function to start the rotating loading icon
function setLoadingIcon() {
    console.log("Setting loading icon...");
    let currentFrame = 0;

    // Clear any previous interval to avoid multiple instances
    if (rotationInterval) clearInterval(rotationInterval);

    rotationInterval = setInterval(() => {
        chrome.action.setIcon({ path: loadingFrames[currentFrame] }, () => {
            // if (chrome.runtime.lastError) {
            //     console.error("Error setting loading icon:", chrome.runtime.lastError);
            // }
        });
        currentFrame = (currentFrame + 1) % loadingFrames.length; // Cycle through frames
    }, 100); // Adjust the interval for smoother/faster rotation
}

// Function to reset the icon to the default state
function resetIcon() {
    console.log("Resetting icon to default state...");
    // Ensure the rotation interval is cleared properly
    if (rotationInterval) {
        clearInterval(rotationInterval);
        rotationInterval = null; // Set to null to indicate it's not running
    }
    try{
    // Reset the icon to its default state
        chrome.action.setIcon({
            path: {
                96: chrome.runtime.getURL("icons/default-icon-96.png"),
                150: chrome.runtime.getURL("icons/default-icon-150.png"),
            },
        }, () => {
            // if (chrome.runtime.lastError) {
            //     console.error("Error resetting icon:", chrome.runtime.lastError.message || chrome.runtime.lastError);
            // } else {
            //     console.log("Default icon set successfully.");
            // }
        });
    } catch (error) {
        console.error("Error resetting icon:", error);
    }
}

// async function startFetchWithRetries(pageUrl, timeoutId, htmlContent = null, screenshotBase64 = null, screenshots, totalHeight) {
//     const maxRetries = 5;
//     let retryCount = 0;

//     // Helper function to handle the fetch attempt
//     async function attemptFetch() {
//         try {
//             console.log(`Attempt ${retryCount + 1} of ${maxRetries}: Starting fetch...`);

//             // Update the icon to indicate loading
//             setLoadingIcon();

//             // Call startFetch directly
//             await startFetch(pageUrl, htmlContent, screenshotBase64, screenshots, totalHeight);

//             console.log(`Attempt ${retryCount + 1}: Fetch successful.`);
            
//             // Reset the icon after success
//             resetIcon();

//             // Exit retry loop on success
//             return;
//         } catch (error) {
//             console.error(`Error during fetch attempt ${retryCount + 1}:`, error);

//             retryCount++;

//             if (retryCount < maxRetries) {
//                 console.log(`Retrying fetch... (${retryCount}/${maxRetries})`);
//                 setTimeout(attemptFetch, 3000); // Retry after a delay
//             } else {
//                 console.error("All fetch attempts failed.");

//                 // Update popup state in storage to show an error
//                 chrome.storage.local.set({ popupState: 'error' });

//                 // Display retry fetch button if defined
//                 if (typeof displayRetryFetchButton === 'function') {
//                     displayRetryFetchButton();
//                 } else {
//                     console.warn('displayRetryFetchButton is not defined. Skipping retry button display.');
//                 }

//                 resetIcon();
//             }
//         }
//     }

//     // Start the first fetch attempt
//     attemptFetch();
// }

// async function startFetchWithRetries(pageUrl, timeoutId, htmlContent = null, screenshotBase64 = null, screenshots, totalHeight) {
//     const maxRetries = 5;
//     let retryCount = 0;

//     // Helper function to handle the fetch attempt
//     async function attemptFetch() {
//         try {
//             console.log(`Attempt ${retryCount + 1} of ${maxRetries}: Starting fetch...`);

//             // Update the icon to indicate loading
//             setLoadingIcon();

//             // Call startFetch directly
//             await startFetch(pageUrl, htmlContent, screenshotBase64, screenshots, totalHeight);

//             console.log(`Attempt ${retryCount + 1}: Fetch successful.`);

//             // Reset the icon after success
//             resetIcon();

//             // Clear the timeout if fetch is successful
//             clearTimeout(timeoutId);

//             // Exit retry loop on success
//             return;
//         } catch (error) {
//             console.error(`Error during fetch attempt ${retryCount + 1}:`, error);

//             retryCount++;

//             if (retryCount < maxRetries) {
//                 console.log(`Retrying fetch... (${retryCount}/${maxRetries})`);
//                 setTimeout(attemptFetch, 3000); // Retry after a delay
//             } else {
//                 console.error("All fetch attempts failed.");

//                 // Update popup state in storage to show an error
//                 chrome.storage.local.set({ popupState: 'error' });

//                 // Display retry fetch button if defined
//                 if (typeof displayRetryFetchButton === 'function') {
//                     displayRetryFetchButton();
//                 } else {
//                     console.warn('displayRetryFetchButton is not defined. Skipping retry button display.');
//                 }

//                 resetIcon();
//             }
//         }
//     }

//     // Start the first fetch attempt
//     attemptFetch();
// }

async function startFetchWithRetries(pageUrl, timeoutId, htmlContent = null, screenshotBase64 = null, screenshots, totalHeight) {
    const maxRetries = 5;
    let retryCount = 0;

    // Helper function to handle the fetch attempt
    async function attemptFetch() {
        try {
            console.log(`Attempt ${retryCount + 1} of ${maxRetries}: Starting fetch...`);

            // Update the icon to indicate loading
            setLoadingIcon();

            // Call startFetch directly (only handles the POST request)
            const scrapeId = await startFetch(pageUrl, htmlContent, screenshotBase64, screenshots, totalHeight);

            console.log(`Attempt ${retryCount + 1}: Fetch successful. Connecting to SSE stream...`);
            
            // Connect to the EventSource stream
            connectToStream(scrapeId);

            // Reset the icon after success
            resetIcon();

            // Clear the timeout since fetch was successful
            clearTimeout(timeoutId);

            // Exit retry loop on success
            return;
        } catch (error) {
            console.error(`Error during fetch attempt ${retryCount + 1}:`, error);

            // Check if this is an authentication error
            if (error.message.includes("No JWT token") || error.message.includes("401") || error.message.includes("Unauthorized")) {
                console.log("Authentication error detected. Opening login popup.");
                
                // Clear the expired token and show login
                chrome.storage.local.remove('token', () => {
                    chrome.storage.local.set({ popupState: 'login' }, () => {
                        chrome.windows.create({
                            url: chrome.runtime.getURL('popup.html'),
                            type: 'popup',
                            width: 400,
                            height: 600
                        });
                    });
                });
                
                resetIcon();
                return; // Exit retry loop for auth errors
            }

            retryCount++;

            if (retryCount < maxRetries) {
                console.log(`Retrying fetch... (${retryCount}/${maxRetries})`);
                setTimeout(attemptFetch, 3000); // Retry after a delay
            } else {
                console.error("All fetch attempts failed.");

                // Update popup state in storage to show an error
                chrome.storage.local.set({ 
                    popupState: 'error',
                    popupData: {
                        error: 'Failed to process article after multiple attempts',
                        url: pageUrl
                    }
                }, () => {
                    // Always open popup for errors too
                    chrome.windows.create({
                        url: chrome.runtime.getURL('popup.html'),
                        type: 'popup',
                        width: 400,
                        height: 600
                    });
                });

                resetIcon();
            }
        }
    }

    // Start the first fetch attempt
    attemptFetch();
}

function connectToStream(scrapeId, pageUrl, htmlContent, screenshotBase64, screenshots, totalHeight) {
    const streamUrl = `${backendURL}/api/scrape/open-stream?id=${scrapeId}`;
    console.log('Connecting to SSE stream:', streamUrl);

    eventSource = new EventSource(streamUrl);

    eventSource.onopen = () => {
        console.log('EventSource connection established.');
    };

    // Log all events - this captures the raw event objects
    const originalAddEventListener = eventSource.addEventListener;
    eventSource.addEventListener = function(type, callback) {
        // First create a wrapper that logs all events
        const wrappedCallback = function(event) {
            console.log(`SSE EVENT RECEIVED [${type}]:`, event.data);
            // Still call the original callback
            return callback.apply(this, arguments);
        };
        
        // Call the original method with our wrapped callback
        return originalAddEventListener.call(this, type, wrappedCallback);
    };

    // Add a handler for unnamed messages
    eventSource.onmessage = function(event) {
        console.log('SSE UNNAMED EVENT RECEIVED:', event.type, event.data);
        try {
            // const parsedData = JSON.parse(event.data);
            // processStreamChunk(parsedData);
        } catch (err) {
            console.error('Failed to parse unnamed message:', event.data, err);
        }
    };

    eventSource.addEventListener('initialData', (event) => {
        console.log('initialData message received:', event.data);
        try {
            // const parsedData = JSON.parse(event.data);
            // console.log('Parsed message:', parsedData);
            // processStreamChunk(event.data);
            // sendMessageToPopup({ action: 'initialData', data: event.data });
            const payload = event.data;

            console.log(`Received ${event.type}:`, payload);
            console.log('triggering popup');
            // Save the data in local storage for the popup to access
            chrome.storage.local.set({ popupData: payload, popupState: 'main' }, () => {
                // Open the popup window
                chrome.windows.create({
                    url: chrome.runtime.getURL('popup.html'),
                    type: 'popup',
                    width: 400,
                    height: 600
                });
            });
        } catch (err) {
            console.error('Failed to parse message:', event.data, err);
        }
    });

    eventSource.addEventListener('finalData', (event) => {
        console.log('finalData message received:', event.data);
        try {
            // const parsedData = JSON.parse(event.data);
            // console.log('Parsed message:', parsedData);
            // processStreamChunk(event.data);
            const payload = event.data;

            console.log(`Received ${event.type}:`, payload);
            console.log('triggering popup');
            // Save the data in local storage for the popup to access
            chrome.storage.local.set({ popupData: payload, popupState: 'main' }, () => {
                // Open the popup window
                chrome.windows.create({
                    url: chrome.runtime.getURL('popup.html'),
                    type: 'popup',
                    width: 400,
                    height: 600
                });
            });
    
            // Clean up the listener to avoid duplicate invocations
            chrome.runtime.onMessage.removeListener(listener);


            // sendMessageToPopup({ action: 'finalData', data: event.data });
        } catch (err) {
            console.error('Failed to parse message:', event.data, err);
        }
    });

    eventSource.addEventListener('archived', (event) => {
        console.log('archived message received:', event.data);
        try {
            const parsedData = JSON.parse(event.data);
            console.log('Parsed message:', parsedData);
            processStreamChunk(parsedData);
        } catch (err) {
            console.error('Failed to parse message:', event.data, err);
        }
    });

    // Add a listener for the initial connection event
    eventSource.addEventListener('connected', (event) => {
        console.log('Stream connection established:', event.data, event.type);

        if (event.type === 'initialData' || event.type === 'finalData' || event.type === 'dataFromIndex') {
            const payload = event.data;
    
            console.log(`Received ${event.type}:`, payload);
            console.log('triggering popup');
            // Save the data in local storage for the popup to access
            chrome.storage.local.set({ popupData: payload, popupState: 'main' }, () => {
                // Open the popup window
                chrome.windows.create({
                    url: chrome.runtime.getURL('popup.html'),
                    type: 'popup',
                    width: 400,
                    height: 600
                });
            });
    
            // Clean up the listener to avoid duplicate invocations
            chrome.runtime.onMessage.removeListener(listener);
        }
    });

    eventSource.onerror = (error) => {
        console.error('Stream error:', error);
        eventSource.close();

        // Retry connection with a delay
        setTimeout(() => {
            console.log('Reconnecting to SSE stream...');
            connectToStream(scrapeId, pageUrl, htmlContent, screenshotBase64, screenshots, totalHeight);
        }, 5000);
    };

    // Close the stream after a timeout to prevent indefinite listening
    setTimeout(() => {
        console.log('Closing stream after timeout.');
        eventSource.close();
    }, 300000); // 5 minutes

    // Add these in the connectToStream function
    eventSource.addEventListener('message', (event) => {
        console.log('Generic message received:', event.data);
        try {
            const parsedData = JSON.parse(event.data);
            processStreamChunk(parsedData);
        } catch (err) {
            console.error('Failed to parse message:', event.data, err);
        }
    });

    eventSource.addEventListener('error', (event) => {
        console.error('Error event from server:', event.data);
    });
}

// Listen for final data or index data from the fetch process
chrome.runtime.onMessage.addListener(function listener(message) {
    console.log("Received message in background.js:", message);

    if (message.type === 'finalData' || message.type === 'dataFromIndex') {
        const payload = message.data;

        console.log(`Received ${message.type}:`, payload);
        console.log('triggering popup');
        // Save the data in local storage for the popup to access
        chrome.storage.local.set({ popupData: payload, popupState: 'main' }, () => {
            // Open the popup window
            chrome.windows.create({
                url: chrome.runtime.getURL('popup.html'),
                type: 'popup',
                width: 400,
                height: 600
            });
        });

        // Clean up the listener to avoid duplicate invocations
        chrome.runtime.onMessage.removeListener(listener);
    }
});

// chrome.runtime.onMessage.addListener(function listener(message) {
//     console.log("Received message in background.js:", message);

//     // Consolidate handling for both 'finalData' and 'dataFromIndex'
//     if (message.type === 'finalData' || message.type === 'dataFromIndex') {
//         const payload = message.data;

//         console.log(`Received ${message.type}:`, payload);

//         // Save the data in local storage for the popup to access
//         chrome.storage.local.set({ popupData: payload, popupState: 'main' });

//         // Open the popup window
//         chrome.windows.create({
//             url: chrome.runtime.getURL('popup.html'),
//             type: 'popup',
//             width: 400,
//             height: 600
//         });

//         // Populate the fields in the popup
//         document.getElementById('headline').value = payload.title || '';
//         document.getElementById('byline').value = payload.byline || '';
//         document.getElementById('content').value = payload.content || payload.description || '';
//         document.getElementById('url').value = payload.url || '';
//         document.getElementById('domain').value = payload.domain || '';

//         // Handle the publish date
//         const unixTimestamp = payload.publishDate;
//         if (unixTimestamp) {
//             const date = new Date(unixTimestamp * 1000); // Convert Unix timestamp to milliseconds
//             const humanReadableDate = date.toLocaleDateString('en-US', {
//                 weekday: 'short',
//                 year: 'numeric',
//                 month: 'short',
//                 day: 'numeric'
//             });
//             document.getElementById('publish-date').value = humanReadableDate;
//         }

//         // Populate tags
//         document.getElementById('tags').value = (payload.tags || []).join(', ');

//         // Update links
//         const articleTxId = payload.txId || '';
//         const articleDidTx = payload.didTx || '';
//         const metadataUrl = `https://api.oip.onl/api/records?resolveDepth=2&didTx=${articleDidTx}`;
//         const blockchainUrl = payload.recordStatus === "pending confirmation in Arweave"
//             ? `https://arweave.net/${articleTxId}`
//             : `https://viewblock.io/arweave/tx/${articleTxId}`;

//         updateLink('read-article-link', payload.url, 'inactive-link');
//         updateLink('metadata-link', metadataUrl, 'inactive-link');
//         updateLink('blockchain-link', blockchainUrl, 'inactive-link');

//         // Handle audio summary (if present)
//         const audioPlayer = document.getElementById('audio-player');
//         const summaryTTS = payload.summaryTTS;
//         if (audioPlayer && summaryTTS) {
//             audioPlayer.src = summaryTTS;
//             audioPlayer.type = 'audio/mp3'; // Explicitly set the audio type
//             audioPlayer.load();
//             audioPlayer.style.display = 'block'; // Show the player
//             visualizeAudio(audioPlayer); // Optionally visualize the audio
//         }

//         // Enable buttons once data is ready
//         const briefBtn = document.getElementById('brief-btn');
//         const saveButton = document.getElementById('save-article-btn');
//         if (briefBtn && saveButton) {
//             briefBtn.style.display = 'block';
//             saveButton.style.display = 'block';
//             briefBtn.style.opacity = '1';
//             saveButton.style.opacity = '1';
//             briefBtn.style.pointerEvents = 'auto';
//             saveButton.style.pointerEvents = 'auto';
//         }

//         // Clean up the listener to avoid duplicate invocations
//         chrome.runtime.onMessage.removeListener(listener);
//     }
// });


// chrome.runtime.onMessage.addListener(function listener(message) {
//     if (message.action === 'updateData') {
//         console.log("Received message in background.js:", message);
//         const payload = message.data.payload;

//         // Consolidate handling for both 'finalData' and 'dataFromIndex'
//         if (message.data.type === 'finalData' || message.data.type === 'dataFromIndex') {
//             console.log(`Received ${message.data.type}:`, payload);
            
//             // Save the data in local storage for the popup to access
//             chrome.storage.local.set({ popupData: payload, popupState: 'main' });

//             // Populate the fields in the popup
//             chrome.windows.create({
//                 url: chrome.runtime.getURL('popup.html'),
//                 type: 'popup',
//                 width: 400,
//                 height: 600
//             });

//             // Populate common fields
//             document.getElementById('headline').value = payload.title || '';
//             document.getElementById('byline').value = payload.byline || '';
//             document.getElementById('content').value = payload.content || payload.description || '';
//             document.getElementById('url').value = payload.url || '';
//             document.getElementById('domain').value = payload.domain || '';

//             // Handle the publish date
//             const unixTimestamp = payload.publishDate;
//             if (unixTimestamp) {
//                 const date = new Date(unixTimestamp * 1000); // Convert Unix timestamp to milliseconds
//                 const humanReadableDate = date.toLocaleDateString('en-US', {
//                     weekday: 'short',
//                     year: 'numeric',
//                     month: 'short',
//                     day: 'numeric'
//                 });
//                 document.getElementById('publish-date').value = humanReadableDate;
//             }

//             // Populate tags
//             document.getElementById('tags').value = (payload.tags || []).join(', ');

//             // Update links
//             const articleTxId = payload.txId || '';
//             const articleDidTx = payload.didTx || '';
//             const metadataUrl = `https://api.oip.onl/api/records?resolveDepth=2&didTx=${articleDidTx}`;
//             const blockchainUrl = payload.recordStatus === "pending confirmation in Arweave"
//                 ? `https://arweave.net/${articleTxId}`
//                 : `https://viewblock.io/arweave/tx/${articleTxId}`;

//             updateLink('read-article-link', payload.url, 'inactive-link');
//             updateLink('metadata-link', metadataUrl, 'inactive-link');
//             updateLink('blockchain-link', blockchainUrl, 'inactive-link');

//             // Handle audio summary (if present)
//             const audioPlayer = document.getElementById('audio-player');
//             const summaryTTS = payload.summaryTTS;
//             if (audioPlayer && summaryTTS) {
//                 audioPlayer.src = summaryTTS;
//                 audioPlayer.type = 'audio/mp3'; // Explicitly set the audio type
//                 audioPlayer.load();
//                 audioPlayer.style.display = 'block'; // Show the player
//                 visualizeAudio(audioPlayer); // Optionally visualize the audio
//             }

//             // Enable buttons once data is ready
//             const briefBtn = document.getElementById('brief-btn');
//             const saveButton = document.getElementById('save-article-btn');
//             if (briefBtn && saveButton) {
//                 briefBtn.style.display = 'block';
//                 saveButton.style.display = 'block';
//                 briefBtn.style.opacity = '1';
//                 saveButton.style.opacity = '1';
//                 briefBtn.style.pointerEvents = 'auto';
//                 saveButton.style.pointerEvents = 'auto';
//             }

//             // Clean up the listener to avoid duplicate invocations
//             chrome.runtime.onMessage.removeListener(listener);
//         }
//     }
// });

chrome.runtime.onConnect.addListener((port) => {
    if (port.name === "popupConnection") {
        popupPort = port;  // Store the connection to use later
        console.log("Popup connected");
        resetIcon();
        port.onMessage.addListener(async (message) => {
            if (message.action === "startFetch") {
                console.log("Message from popup: startFetch", message);
                await   (message.url, message.html);
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
    // resetIcon();

});
  
// Function to podcast articles

function podcastArticles(articles) {
    chrome.storage.local.get('personalitySettings', (data) => {
        const { host1, host2 } = data.personalitySettings || { host1: 'hypatia', host2: 'socrates' };
        const apiUrl = `${backendURL}/api/generate/podcast`;

        // Step 1: POST request to initiate podcast generation
        fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                articles,
                selectedHosts: [host1, host2],
            }),
        })
        .then((response) => {
            if (!response.ok) {
                throw new Error(`Failed to start podcast generation: ${response.statusText}`);
            }
            return response.json();
        })
        .then(({ taskId }) => {
            console.log('Podcast generation started with Task ID:', taskId);

            // Step 2: Connect to the SSE stream using the taskId
            const eventSource = new EventSource(`${backendURL}/api/open-stream?taskId=${taskId}`);

            eventSource.onmessage = (event) => {
                processStreamChunk(event.data); // Process each streamed chunk
            };

            eventSource.onerror = (error) => {
                console.error('Stream error:', error);
                eventSource.close();
                sendMessageToPopup({ action: 'error', message: 'Stream connection error.' });
            };
        })
        .catch((error) => {
            console.error('Failed to start podcast generation:', error);
            sendMessageToPopup({ action: 'error', message: error.message });
        });
    });
}

// function podcastArticles(articles) {
//     chrome.storage.local.get('personalitySettings', (data) => {
//         const { host1, host2 } = data.personalitySettings || { host1: 'hypatia', host2: 'socrates' };
//         const apiUrl = `${backendURL}/api/generate/podcast`;
//         fetch(apiUrl, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({
//                 articles,
//                 selectedHosts: [host1, host2],
//             }),
//         })
//         .then(response => {
//             if (!response.ok) {
//                 throw new Error(`Failed to start podcast generation: ${response.statusText}`);
//                             }


//         const eventSource = new EventSource(apiUrl);

//         eventSource.addEventListener('progress', (e) => {
//             const data = JSON.parse(e.data);
//             console.log('Progress:', data);
//             sendMessageToPopup({ action: 'progress', message: data });
//         });

//         eventSource.addEventListener('podcastComplete', (e) => {
//             const data = JSON.parse(e.data);
//             console.log('Podcast complete:', data);
//             sendMessageToPopup({ action: 'podcastComplete', message: data });
//             eventSource.close();
//         });

//         eventSource.addEventListener('error', (e) => {
//             if (e.data && isValidJson(e.data)) {
//                 const data = JSON.parse(e.data);
//                 console.error('Error:', data);
//                 sendMessageToPopup({ action: 'error', message: data.message });
//             } else {
//                 console.error('Error: Invalid or undefined data received', e);
//                 sendMessageToPopup({ action: 'error', message: `An unknown error occurred.` });
//             }
//             eventSource.close();
//         });

//         function isValidJson(str) {
//             try {
//                 JSON.parse(str);
//             } catch (e) {
//                 return false;
//             }
//             return true;
//         }
//     })
//     .catch((error) => {
//         console.error('Failed to start podcast generation:', error);
//         sendMessageToPopup({ action: 'error', message: error.message });
//     });
// });
// }

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
  function sendMessageToPopup(message) {
    if (popupPort) {
        console.log("[Popup Connected] Sending data to popup:", message);
        popupPort.postMessage(message);
    } else {
        if (message.action !== 'ping') {
            console.warn("Popup is not connected, waiting to send data...");
            const retryInterval = setInterval(() => {
                if (popupPort) {
                    clearInterval(retryInterval); // Stop checking once the popup connects
                    console.log("[Retry] Sending data to popup:", message);
                    popupPort.postMessage(message);
                }
            }, 1000); // Retry every 1000ms
        }
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

function extractArticleData(htmlContent, pageUrl, screenshotBase64) {
    // Create a DOM parser to extract article data
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    
    // Extract title - try multiple selectors
    let title = null;
    const titleSelectors = [
        'h1',
        'h1.entry-title',
        'h1.post-title', 
        'h1.article-title',
        '[data-testid="headline"]',
        '.headline',
        'title'
    ];
    
    for (const selector of titleSelectors) {
        const element = doc.querySelector(selector);
        if (element && element.textContent.trim()) {
            title = element.textContent.trim();
            break;
        }
    }
    
    // Extract author/byline
    let author = null;
    const authorSelectors = [
        '[rel="author"]',
        '.byline',
        '.author',
        '.post-author',
        '[data-testid="byline"]',
        '.article-author'
    ];
    
    for (const selector of authorSelectors) {
        const element = doc.querySelector(selector);
        if (element && element.textContent.trim()) {
            author = element.textContent.trim();
            break;
        }
    }
    
    // Extract main content
    let content = null;
    const contentSelectors = [
        'article',
        '.post-content',
        '.entry-content', 
        '.article-content',
        '.content',
        'main',
        '[data-testid="story-body"]'
    ];
    
    for (const selector of contentSelectors) {
        const element = doc.querySelector(selector);
        if (element && element.textContent.trim().length > 100) {
            content = element.textContent.trim();
            break;
        }
    }
    
    // If no content found, use body text but clean it up
    if (!content) {
        content = doc.body.textContent.trim();
        // Remove common noise
        content = content.replace(/\s+/g, ' ').substring(0, 5000);
    }
    
    // Extract meta description
    let description = null;
    const metaDesc = doc.querySelector('meta[name="description"]');
    if (metaDesc) {
        description = metaDesc.getAttribute('content');
    }
    
    // Extract or generate tags
    let tags = [];
    
    // Try to get keywords from meta tags
    const metaKeywords = doc.querySelector('meta[name="keywords"]');
    if (metaKeywords) {
        tags = metaKeywords.getAttribute('content').split(',').map(tag => tag.trim());
    }
    
    // Add domain as a tag
    try {
        const domain = new URL(pageUrl).hostname.replace('www.', '');
        tags.push(domain);
    } catch (e) {
        // ignore URL parsing errors
    }
    
    // Add some default tags
    tags.push('archived', 'news');
    
    // Clean and limit tags
    tags = tags.filter(tag => tag && tag.length > 0).slice(0, 10);
    
    return {
        title,
        author,
        content,
        description,
        tags
    };
}

function captureFullPageScreenshot(tabId) {
    return new Promise((resolve, reject) => {
        chrome.scripting.executeScript(
            {
                target: { tabId },
                func: () => {
                    // Get the total height and current viewport dimensions
                    const totalHeight = document.documentElement.scrollHeight;
                    const viewportHeight = window.innerHeight;
                    const scrollPositions = [];

                    for (let y = 0; y < totalHeight; y += viewportHeight) {
                        scrollPositions.push(y);
                    }

                    return { scrollPositions, totalHeight, viewportHeight };
                },
            },
            async (results) => {
                if (!results || !results[0]) {
                    return reject(new Error("Failed to calculate scroll positions"));
                }

                const { scrollPositions, totalHeight, viewportHeight } = results[0].result;
                console.log("Scroll positions:", scrollPositions, "Total height:", totalHeight, "Viewport height:", viewportHeight);
                const screenshots = [];
                const delay = 825; // Delay in milliseconds between scrolls and captures

                for (let i = 0; i < scrollPositions.length; i++) {
                    const scrollY = scrollPositions[i];

                    // Scroll to the desired position
                    await new Promise((resolve) =>
                        chrome.scripting.executeScript(
                            {
                                target: { tabId },
                                func: (y) => window.scrollTo(0, y),
                                args: [scrollY],
                            },
                            resolve
                        )
                    );

                    // Wait briefly for the page to settle
                    await new Promise((resolve) => setTimeout(resolve, delay));

                    // Capture the visible area
                    const screenshot = await new Promise((resolve, reject) =>
                        chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
                            if (chrome.runtime.lastError) {
                                return reject(chrome.runtime.lastError);
                            }
                            resolve(dataUrl);
                        })
                    );

                    screenshots.push({ y: scrollY, screenshot });
                }

                // Reset scroll position to the top
                await new Promise((resolve) =>
                    chrome.scripting.executeScript(
                        {
                            target: { tabId },
                            func: () => window.scrollTo(0, 0),
                        },
                        resolve
                    )
                );

                // Send the screenshots to the backend for stitching
                resolve({ screenshots, totalHeight });
            }
        );
    });
}

// to recipes (temp till its replaced)
// async function startFetch(pageUrl) {
//     console.log('Starting fetch for URL:', pageUrl);

//     const { token, userId } = await getJwtToken();
//     if (!token || !userId) {
//         throw new Error("No JWT token or userId found. Cannot start fetch operation.");
//     }

//     try {
//         // Step 1: Send POST request to start scraping
//         const response = await fetch(`${backendURL}/api/scrape/recipe`, {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json',
//                 'Authorization': `Bearer ${token}`,
//             },
//             body: JSON.stringify({
//                 url: pageUrl,
//                 userId,
//             }),
//         });

//         if (!response.ok) {
//             throw new Error(`Failed to start scraping. Server responded with status: ${response.status}`);
//         }

//         // Parse the response to get the scrapeId
//         const { scrapeId } = await response.json();
//         console.log('Scrape started with ID:', scrapeId);

//         // Return scrapeId for SSE connection
//         return scrapeId;
//     } catch (error) {
//         console.error('Error during fetch operation:', error);
//         throw error;
//     }
// }

async function startFetch(pageUrl, htmlContent, screenshotBase64, screenshots, totalHeight) {
    console.log('Starting fetch for URL:', pageUrl);

    const { token, userId } = await getJwtToken();
    if (!token || !userId) {
        throw new Error("No JWT token or userId found. Cannot start fetch operation.");
    }

    try {
        // Step 1: Send POST request to start scraping
        const response = await fetch(`${backendURL}/api/scrape/article`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                url: pageUrl,
                html: htmlContent,
                userId,
                screenshotBase64,
                screenshots,
                totalHeight,
            }),
        });

        if (!response.ok) {
            // Handle authentication errors specifically
            if (response.status === 401 || response.status === 403) {
                throw new Error(`Authentication failed: ${response.status} Unauthorized`);
            }
            throw new Error(`Failed to start scraping. Server responded with status: ${response.status}`);
        }

        // Parse the response to get the scrapeId
        const { scrapeId } = await response.json();
        console.log('Scrape started with ID:', scrapeId);

        // Return scrapeId for SSE connection
        return scrapeId;
    } catch (error) {
        console.error('Error during fetch operation:', error);
        throw error;
    }
}

// async function startFetch(pageUrl, htmlContent, screenshotBase64, screenshots, totalHeight) {
//     console.log('Starting fetch for URL:', pageUrl);

//     const { token, userId } = await getJwtToken();
//     if (!token || !userId) {
//         console.error("No JWT token or userId found. Cannot start fetch operation.");
//         return;
//     }

//     try {
//         // Step 1: Send POST request to start scraping
//         const response = await fetch(`${backendURL}/api/scrape/article`, {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json',
//                 'Authorization': `Bearer ${token}`,
//             },
//             body: JSON.stringify({
//                 url: pageUrl,
//                 html: htmlContent,
//                 userId,
//                 screenshotBase64,
//                 screenshots,
//                 totalHeight,
//             }),
//         });

//         if (!response.ok) {
//             throw new Error(`Failed to start scraping. Server responded with status: ${response.status}`);
//         }

//         // Parse the response to get the scrapeId
//         const { scrapeId } = await response.json();
//         // console.log('Scrape started with ID:', scrapeId);

//         // Step 2: Connect to SSE stream using the scrapeId
//         const streamUrl = `${backendURL}/api/open-stream?scrapeId=${scrapeId}`;
//         console.log('Connecting to SSE stream:', streamUrl);

//         // Store EventSource globally to prevent garbage collection
//         if (eventSource) {
//             console.log('Closing existing EventSource to prevent conflicts.');
//             eventSource.close(); // Close any existing connections
//         }

//         eventSource = new EventSource(streamUrl);



//         // Set up listeners
//         eventSource.onopen = () => {
//             console.log('EventSource connection established.');
//         };

//         eventSource.addEventListener('message', (event) => {
//             console.log('Raw message received:', event.data);
//             try {
//                 const parsedData = JSON.parse(event.data);
//                 console.log('Parsed message:', parsedData);
//                 processStreamChunk(event.data);
//             } catch (err) {
//                 console.error('Failed to parse message:', event.data, err);
//             }
//         });

//         // eventSource.onmessage = (event) => {
//         //     console.log('Message received from stream:', event.data);
//         //     processStreamChunk(event.data); // Pass to processing logic
//         // };

//         eventSource.onerror = (error) => {
//             console.error('EventSource error:', error);
//             console.warn('Reconnecting SSE stream in 5 seconds...');
//             eventSource.close();

//             // Retry logic
//             setTimeout(() => {
//                 startFetch(pageUrl, htmlContent, screenshotBase64, screenshots, totalHeight);
//             }, 5000);
//         };

//         // Optional: Automatically close the EventSource after a timeout
//         setTimeout(() => {
//             console.log('Closing EventSource connection after 5 minutes.');
//             eventSource.close();
//         }, 300000); // 5 minutes

//     } catch (error) {
//         console.error('Error during fetch operation:', error);
//     }
// }

// async function startFetch(pageUrl, htmlContent, screenshotBase64, screenshots, totalHeight) {
//     console.log('Starting fetch for URL:', pageUrl);

//     const { token, userId } = await getJwtToken();
//     if (!token || !userId) {
//         console.error("No JWT token or userId found. Cannot start fetch operation.");
//         return;
//     }

//     try {
//         // Step 1: Send POST request to start scraping
//         const response = await fetch(`${backendURL}/api/scrape/article`, {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json',
//                 'Authorization': `Bearer ${token}`,
//             },
//             body: JSON.stringify({
//                 url: pageUrl,
//                 html: htmlContent,
//                 userId,
//                 screenshotBase64,
//                 screenshots,
//                 totalHeight,
//             }),
//         });

//         if (!response.ok) {
//             throw new Error(`Failed to start scraping. Server responded with status: ${response.status}`);
//         }

//         // Parse the response to get the scrapeId
//         const { scrapeId } = await response.json();
//         console.log('Scrape started with ID:', scrapeId);


//         connectToStream(scrapeId, pageUrl, htmlContent, screenshotBase64, screenshots, totalHeight);



//         // Step 2: Connect to SSE stream using the scrapeId
//         // const streamUrl = `${backendURL}/api/open-stream?scrapeId=${scrapeId}`;
//         // const eventSource = new EventSource(streamUrl);

//         // eventSource.onmessage = (event) => {
//         //     console.log('Event received:', event.data);
//         //     processStreamChunk(event.data);
//         // };

//         // eventSource.onerror = (error) => {
//         //     console.error('Stream error:', error);
//         //     eventSource.close();

//         //     // Retry connection with a delay
//         //     setTimeout(() => {
//         //         console.log('Reconnecting to SSE stream...');
//         //         startFetch(pageUrl, htmlContent, screenshotBase64, screenshots, totalHeight);
//         //     }, 5000);
//         // };

//         // // Close the stream after a timeout to prevent indefinite listening
//         // setTimeout(() => {
//         //     console.log('Closing stream after timeout.');
//         //     eventSource.close();
//         // }, 300000); // 5 minutes

//     } catch (error) {
//         console.error('Error during fetch operation:', error);
//     }
// }

// async function startFetch(pageUrl, htmlContent, screenshotBase64, screenshots, totalHeight) {
//     console.log('Starting fetch for URL:', pageUrl);

//     const { token, userId } = await getJwtToken();
//     if (!token || !userId) {
//         console.error("No JWT token or userId found. Cannot start fetch operation.");
//         return;
//     }

//     // console.log('Using token', token, 'and starting fetch for URL:', pageUrl);
//     console.log('starting fetch for URL:', pageUrl);

//     // try {
//         // Step 1: Send POST request to start scraping
//         const response = await fetch(`${backendURL}/api/scrape/article`, {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json',
//                 'Authorization': `Bearer ${token}`,
//             },
//             body: JSON.stringify({
//                 url: pageUrl,
//                 html: htmlContent,
//                 userId,
//                 screenshotBase64,
//                 screenshots,
//                 totalHeight,
//             }),
//         });

//         if (!response.ok) {
//             throw new Error(`Failed to start scraping. Server responded with status: ${response.status}`);
//         }
//         const { scrapeId } = await response.json();
//         console.log('Scrape started with ID:', scrapeId);

//         // Step 2: Connect to SSE stream using the scrapeId
//         const eventSource = new EventSource(`${backendURL}/api/open-stream?scrapeId=${scrapeId}`);

//         eventSource.onmessage = (event) => {
//             console.log('Event received:');
//             console.log('Event received:', event);
//             console.log('Event received:', event.data);
//             processStreamChunk(event.data);
//         };

//         eventSource.onerror = (error) => {
//             console.error('Stream error:', error);
//             eventSource.close();

//             // Optionally retry connection with a delay
//             setTimeout(() => {
//                 console.log('Reconnecting to SSE stream...');
//                 startFetch(pageUrl, htmlContent, screenshotBase64, screenshots, totalHeight);
//             }, 5000);
//         };

//         // Close stream after timeout to prevent indefinite listening
//         setTimeout(() => {
//             console.log('Closing stream after timeout.');
//             eventSource.close();
//         }, 300000); // 5 minutes

//     // } catch (error) {
//     //     console.error('Error during startFetch:', error);
//     //     chrome.storage.local.set({ popupState: 'error' });
//     //     // displayRetryFetchButton();
//     //     // Display retry fetch button if defined
//     //     if (typeof displayRetryFetchButton === 'function') {
//     //         displayRetryFetchButton();
//     //     } else {
//     //         console.warn('displayRetryFetchButton is not defined. Skipping retry button display.');
//     //     }
//     //     resetIcon();
//     // }
// }



// async function startFetch(pageUrl, htmlContent, screenshotBase64, screenshots, totalHeight) {
//     console.log('Starting fetch for URL:', pageUrl);

//     const { token, userId } = await getJwtToken();
//     if (!token || !userId) {
//         console.error("No JWT token or userId found. Cannot start fetch operation.");
//         return;
//     }

//     console.log('Using token', token, 'and starting fetch for URL:', pageUrl);

//     // try {
//         // Step 1: Send POST request to start scraping
//         const response = await fetch(`${backendURL}/api/scrape/article`, {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json',
//                 'Authorization': `Bearer ${token}`,
//             },
//             body: JSON.stringify({
//                 url: pageUrl,
//                 html: htmlContent,
//                 userId,
//                 screenshotBase64,
//                 screenshots,
//                 totalHeight,
//             }),
//         });

//         if (!response.ok) {
//             throw new Error(`Failed to start scraping. Server responded with status: ${response.status}`);
//         }

//         const { scrapeId } = await response.json();
//         console.log('Scrape started with ID:', scrapeId);

//         // Step 2: Connect to SSE stream using the scrapeId
//         const eventSource = new EventSource(`${backendURL}/api/article/stream?scrapeId=${scrapeId}`);
//         console.log('Event source connected:')
//         eventSource.onmessage = (event) => {

//             console.log('Event received:', event);
//             processStreamChunk(event.data);
//         };

//         eventSource.onerror = (error) => {
//             console.error('Stream error:', error);
//             eventSource.close();

//             // Optionally retry connection with a delay
//             setTimeout(() => {
//                 console.log('Reconnecting to SSE stream...');
//                 startFetch(pageUrl, htmlContent, screenshotBase64, screenshots, totalHeight);
//             }, 5000);
//         };

//         // Close stream after timeout to prevent indefinite listening
//         setTimeout(() => {
//             console.log('Closing stream after timeout.');
//             eventSource.close();
//         }, 300000); // 5 minutes

//     // } catch (error) {
//     //     console.error('Error during startFetch:', error);
//     //     chrome.storage.local.set({ popupState: 'error' });
//     //     // displayRetryFetchButton();
//     //     // Display retry fetch button if defined
//     //     if (typeof displayRetryFetchButton === 'function') {
//     //         displayRetryFetchButton();
//     //     } else {
//     //         console.warn('displayRetryFetchButton is not defined. Skipping retry button display.');
//     //     }
//     //     resetIcon();
//     // }
// }

// function processStreamChunk(data) {
//     // console log the type of data
//     console.log('Data type:', typeof data);
//     const events = [data]; // data is already an object
//     events.forEach(eventStr => {
//         if (!eventStr.trim()) return; // Skip empty lines

//         let eventType = null;
//         let eventData = null;

//         const lines = eventStr.split('\n');
//         if (lines[0].startsWith('event:') && lines[1].startsWith('data:')) {
//             eventType = lines[0].replace('event: ', '').trim();
//             eventData = lines[1].replace('data: ', '').trim();
//         } else {
//             // Attempt to parse the entire eventStr as JSON
//             try {
//                 const jsonData = JSON.parse(eventStr);
//                 if (jsonData.type && jsonData.data) {
//                     eventType = jsonData.type;
//                     eventData = JSON.stringify(jsonData.data);
//                 }
//             } catch {
//                 console.warn('Failed to parse event string as JSON:', eventStr);
//             }
//         }

//         if (!eventType || !eventData) {
//             console.warn('Malformed event received:', eventStr);
//             return;
//         }

//         let parsedData;
//         try {
//             parsedData = JSON.parse(eventData);
//         } catch {
//             console.warn('Failed to parse event data as JSON:', eventData);
//             return;
//         }

//         const { type, data } = parsedData;

//         if (type === 'finalData') {
//             console.log(`Received ${type}:`, data);
//             chrome.storage.local.set({ popupData: data, popupState: 'main' }, () => {
//                 chrome.windows.getAll({ populate: true }, windows => {
//                     const popupExists = windows.some(w => w.type === 'popup' && w.tabs.some(tab => tab.url?.includes('popup.html')));
//                     if (!popupExists) {
//                         chrome.windows.create({
//                             url: chrome.runtime.getURL('popup.html'),
//                             type: 'popup',
//                             width: 400,
//                             height: 600
//                         });
//                     }
//                 });
//             });
//             sendMessageToPopup({ action: 'updateData', data: { type, payload: data } });
//         } else if (type === 'synthesizedSpeech') {
//             sendMessageToPopup({ action: 'synthesizedSpeech', payload: data });
//         } else if (type === 'combinedSummaryAudio') {
//             sendMessageToPopup({ action: 'combinedSummaryAudio', payload: data });
//         } else if (type === 'STREAM_END') {
//             console.log('Stream end event received.');
//         } else {
//             console.log(`Unhandled event type: ${type}, Data:`, data);
//             sendMessageToPopup({ action: 'updateData', data: { type, payload: data } });
//         }
//     });
// }

// function processStreamChunk(data) {
//     console.log('Data type:', typeof data);
//     console.log('data:', data);

//     // If data is not an array of strings, ensure it's handled appropriately
//     const events = Array.isArray(data) ? data : [data]; // Normalize to an array

//     events.forEach(event => {
//         // Ensure the event is a string
//         if (typeof event !== 'string') {
//             console.warn('Non-string event encountered:', event);
//             return;
//         }

//         if (!event.trim()) return; // Skip empty lines

//         let eventType = null;
//         let eventData = null;

//         const lines = event.split('\n');
//         if (lines[0].startsWith('event:') && lines[1].startsWith('data:')) {
//             eventType = lines[0].replace('event: ', '').trim();
//             eventData = lines[1].replace('data: ', '').trim();
//         } else {
//             // Attempt to parse the entire event as JSON
//             try {
//                 const jsonData = JSON.parse(event);
//                 if (jsonData.type && jsonData.data) {
//                     eventType = jsonData.type;
//                     eventData = jsonData.data; // No need for `JSON.stringify`
//                 }
//             } catch (err) {
//                 console.warn('Failed to parse event as JSON:', event, err);
//             }
//         }

//         if (!eventType || !eventData) {
//             console.warn('Malformed event received:', event);
//             return;
//         }

//         // No need to parse `eventData` again since it's already an object
//         const { type, data } = eventData;

//         if (type === 'finalData') {
//             console.log(`Received ${type}:`, data);
//             chrome.storage.local.set({ popupData: data, popupState: 'main' }, () => {
//                 chrome.windows.getAll({ populate: true }, windows => {
//                     const popupExists = windows.some(
//                         w => w.type === 'popup' && w.tabs.some(tab => tab.url?.includes('popup.html'))
//                     );
//                     if (!popupExists) {
//                         chrome.windows.create({
//                             url: chrome.runtime.getURL('popup.html'),
//                             type: 'popup',
//                             width: 400,
//                             height: 600
//                         });
//                     }
//                 });
//             });
//             sendMessageToPopup({ action: 'updateData', data: { type, payload: data } });
//         } else if (type === 'synthesizedSpeech') {
//             sendMessageToPopup({ action: 'synthesizedSpeech', payload: data });
//         } else if (type === 'combinedSummaryAudio') {
//             sendMessageToPopup({ action: 'combinedSummaryAudio', payload: data });
//         } else if (type === 'STREAM_END') {
//             console.log('Stream end event received.');
//         } else {
//             console.log(`Unhandled event type: ${type}, Data:`, data);
//             sendMessageToPopup({ action: 'updateData', data: { type, payload: data } });
//         }
//     });
// }

function processStreamChunk(data) {
    console.log('Data type:', typeof data);
    console.log('Data:', data);

    // Handle case where data is already an object
    if (typeof data === 'object' && data !== null) {
        if (data.type && data.data) {
            processEvent(data.type, data.data);
        } else {
            console.warn('Malformed object received:', data);
        }
        return;
    }

    // If data is not an object, treat it as a string and process normally
    const events = Array.isArray(data) ? data : [data];
    events.forEach(event => {
        if (typeof event !== 'string') {
            console.warn('Non-string event encountered:', event);
            return;
        }

        if (!event.trim()) return; // Skip empty lines

        let eventType = null;
        let eventData = null;

        const lines = event.split('\n');
        if (lines[0].startsWith('event:') && lines[1].startsWith('data:')) {
            eventType = lines[0].replace('event: ', '').trim();
            eventData = lines[1].replace('data: ', '').trim();
        } else {
            try {
                const jsonData = JSON.parse(event);
                if (jsonData.type && jsonData.data) {
                    eventType = jsonData.type;
                    eventData = jsonData.data;
                }
            } catch (err) {
                console.warn('Failed to parse event as JSON:', event, err);
            }
        }

        if (!eventType || !eventData) {
            console.warn('Malformed event received:', event);
            return;
        }

        processEvent(eventType, eventData);
    });
}

function processEvent(type, data) {
    if (type === 'finalData' || type === 'dataFromIndex') {
        console.log(`Received ${type}:`, data);
        chrome.storage.local.set({ popupData: data, popupState: 'main' }, () => {
            chrome.windows.getAll({ populate: true }, windows => {
                const popupExists = windows.some(
                    w => w.type === 'popup' && w.tabs.some(tab => tab.url?.includes('popup.html'))
                );
                if (!popupExists) {
                    chrome.windows.create({
                        url: chrome.runtime.getURL('popup.html'),
                        type: 'popup',
                        width: 400,
                        height: 600
                    });
                }
            });
        });
        sendMessageToPopup({ action: 'updateData', data: { type, payload: data } });
    } else if (type === 'synthesizedSpeech') {
        sendMessageToPopup({ action: 'synthesizedSpeech', payload: data });
    } else if (type === 'combinedSummaryAudio') {
        sendMessageToPopup({ action: 'combinedSummaryAudio', payload: data });
    } else if (type === 'STREAM_END') {
        console.log('Stream end event received.');
    } else {
        console.log(`Unhandled event type: ${type}, Data:`, data);
        sendMessageToPopup({ action: 'updateData', data: { type, payload: data } });
    }
}

// function processStreamChunk(chunk) {
//     // Split chunk into separate events by double newline
//     const events = chunk.split('\n\n'); // Each event is separated by two newlines
//     events.forEach(eventStr => {
//         if (eventStr.trim() === '') return; // Skip empty events

//         // Split the event string into lines and extract event details
//         const lines = eventStr.split('\n');
//         const eventTypeLine = lines.find(line => line.startsWith('event:'));
//         const dataLine = lines.find(line => line.startsWith('data:'));

//         const eventType = eventTypeLine ? eventTypeLine.replace('event:', '').trim() : null;
//         const eventData = dataLine ? dataLine.replace('data:', '').trim() : null;

//         // Skip processing if no valid event type or data is found
//         if (!eventType || !eventData) {
//             console.warn('Malformed event:', eventStr);
//             return;
//         }

//         // Safely parse JSON if possible
//         let parsedData;
//         try {
//             parsedData = JSON.parse(eventData);
//         } catch (parseError) {
//             console.warn('Failed to parse event data as JSON:', eventData, parseError);
//             parsedData = eventData; // Fallback to raw text
//         }

//         // Handle specific events
//         switch (eventType) {
//             case 'finalData':
//                 console.log('Final data received, triggering popup...');
//                 chrome.storage.local.set({ popupData: parsedData, popupState: 'main' });
//                 chrome.windows.create({
//                     url: chrome.runtime.getURL('popup.html'),
//                     type: 'popup',
//                     width: 400,
//                     height: 600
//                 });
//                 break;
//             case 'dataFromIndex':
//                 console.log('Data from index received, triggering popup...', parsedData);
//                 chrome.storage.local.set({ popupData: parsedData, popupState: 'main' });
//                 chrome.windows.create({
//                     url: chrome.runtime.getURL('popup.html'),
//                     type: 'popup',
//                     width: 400,
//                     height: 600
//                 });
//                 break;
//             case 'combinedSummaryAudio':
//                 const audioUrl = parsedData.audioUrl || parsedData;
//                 sendMessageToPopup({ action: 'combinedSummaryAudio', payload: audioUrl });
//                 break;
//             case 'error':
//                 console.error('Error event received:', parsedData);
//                 sendMessageToPopup({
//                     action: 'error',
//                     message: parsedData.message || 'An unknown error occurred.'
//                 });
//                 break;
//             default:
//                 console.warn(`Unhandled event type: ${eventType}`);
//                 break;
//         }

//         // Always send updates to the popup
//         sendMessageToPopup({
//             action: 'updateData',
//             data: { type: eventType, payload: parsedData }
//         });
//     });
// }


// old reliable one
// function processStreamChunk(chunk) {
//     const events = chunk.split('\n\n'); // Each event is separated by two newlines
//     events.forEach(eventStr => {
//         if (eventStr.trim() === '') return; // Skip empty lines

//         const lines = eventStr.split('\n');
//         const eventType = lines[0] ? lines[0].replace('event: ', '').trim() : null;
        
//         // Handle specific event types
//         if (eventType === 'synthesizedSpeech') {
//             const urlData = lines[1].replace('data: ', '').trim();
//             sendMessageToPopup({ action: 'synthesizedSpeech', payload: urlData });
//         } else if (eventType === 'combinedSummaryAudio') {
//             const audioUrl = lines[1].replace('data: ', '').trim();
//             sendMessageToPopup({ action: 'combinedSummaryAudio', payload: audioUrl });
//         } else if (eventType === 'STREAM_END') {
//             console.log('Stream end event received');
//         } else if (lines[1]) {
//             console.log('other event received')
//             const eventData = lines[1].replace('data: ', '').trim();
//             function isValidJson(str) {
//                 try {
//                     JSON.parse(str);  // Try parsing the string
//                 } catch (e) {
//                     return false;  // If it throws an error, it's not valid JSON
//                 }
//                 return true;  // If it doesn't throw an error, it's valid
//             }
            
//             console.log(`Event: ${eventType}`, `Data: ${eventData}`);
            
//             // Parse the data as JSON if necessary
//             let parsedData;
//             if (isValidJson(eventData)) {
//                 try {
//                     parsedData = JSON.parse(eventData);
//                 } catch (e) {
//                     console.error('Failed to parse event data:', e);
//                     return;  // Exit the function gracefully if parsing fails
//                 }
//             } else {
//                 console.warn('Received event data is not valid JSON:', eventData);
//                 // Optionally, handle the case where the eventData is not JSON
//                 return;
//             }
        
//             sendMessageToPopup({ action: 'updateData', data: { type: eventType, payload: parsedData } });
//         }
//     });
// }

// function processStreamChunk(chunk) {
//     // Split chunk into separate events by double newline
//     const events = chunk.split('\n\n');

//     events.forEach((eventStr) => {
//         if (!eventStr.trim()) return; // Skip empty events

//         const lines = eventStr.split('\n');
//         let eventType = 'message'; // Default event type
//         let eventData = '';

//         lines.forEach(line => {
//             if (line.startsWith('event: ')) {
//                 eventType = line.replace('event: ', '').trim();
//             } else if (line.startsWith('data: ')) {
//                 eventData += line.replace('data: ', '').trim() + '\n';
//             }
//         });

//         // Remove the trailing newline from eventData
//         eventData = eventData.trim();

//         console.log(`Event type: ${eventType}`, `Data: ${eventData}`);

//         // Attempt to parse eventData as JSON
//         let parsedData;
//         try {
//             parsedData = JSON.parse(eventData);
//         } catch {
//             parsedData = eventData; // If parsing fails, treat as raw text
//         }

//         // Handle specific events
//         switch (eventType) {
//             case 'initialData':
//                 console.log('Initial data received:', parsedData);
//                 sendMessageToPopup({ action: 'initialData', payload: parsedData });
//                 break;
//             case 'finalData':
//                 console.log('Final data received, triggering popup...', parsedData);
//                 chrome.storage.local.set({ popupData: parsedData, popupState: 'main' });
//                 chrome.windows.create({
//                     url: chrome.runtime.getURL('popup.html'),
//                     type: 'popup',
//                     width: 400,
//                     height: 600
//                 });
//                 break;
//             case 'error':
//                 console.error('Error event received:', parsedData);
//                 sendMessageToPopup({ action: 'error', message: parsedData.message || 'An unknown error occurred.' });
//                 break;
//             default:
//                 console.warn(`Unhandled event type: ${eventType}`);
//                 break;
//         }

//         // Always send updates to the popup
//         sendMessageToPopup({ action: 'updateData', data: { type: eventType, payload: parsedData } });
//     });
// }
// function processStreamChunk(chunk) {
//     // Split chunk into separate SSE events by double newline
//     const events = chunk.split('\n\n');

//     events.forEach((eventStr) => {
//         if (!eventStr.trim()) return; // Skip empty events

//         // Extract the event type and event data
//         const lines = eventStr.split('\n');
//         let eventType = 'message'; // Default event type
//         let eventData = '';

//         lines.forEach(line => {
//             if (line.startsWith('event: ')) {
//                 eventType = line.replace('event: ', '').trim();
//             } else if (line.startsWith('data: ')) {
//                 eventData += line.replace('data: ', '').trim() + '\n';
//             }
//         });

//         // Remove the trailing newline from eventData
//         eventData = eventData.trim();

//         console.log(`Event type: ${eventType}`, `Data: ${eventData}`);

//         // Safely parse JSON if possible
//         let parsedData;
//         try {
//             parsedData = JSON.parse(eventData);
//         } catch {
//             parsedData = eventData; // If parsing fails, treat as raw text
//         }

//         // Handle specific events
//         switch (eventType) {
//             case 'initialData':
//                 console.log('Initial data received:', parsedData);
//                 sendMessageToPopup({ action: 'initialData', payload: parsedData });
//                 break;
//             case 'finalData':
//                 console.log('Final data received, triggering popup...', parsedData);
//                 chrome.storage.local.set({ popupData: parsedData, popupState: 'main' });
//                 chrome.windows.create({
//                     url: chrome.runtime.getURL('popup.html'),
//                     type: 'popup',
//                     width: 400,
//                     height: 600
//                 });
//                 break;
//             case 'combinedSummaryAudio':
//                 const audioUrl = parsedData.audioUrl || parsedData;
//                 sendMessageToPopup({ action: 'combinedSummaryAudio', payload: audioUrl });
//                 break;
//             case 'error':
//                 console.error('Error event received:', parsedData);
//                 sendMessageToPopup({ action: 'error', message: parsedData.message || 'An unknown error occurred.' });
//                 break;
//             default:
//                 console.warn(`Unhandled event type: ${eventType}`);
//                 break;
//         }

//         // Always send updates to the popup
//         sendMessageToPopup({ action: 'updateData', data: { type: eventType, payload: parsedData } });
//     });
// }

// function processStreamChunk(chunk) {
//     const events = chunk.split('\n\n'); // Each event is separated by two newlines
//     events.forEach(eventStr => {
//         if (eventStr.trim() === '') return; // Skip empty lines

//         const lines = eventStr.split('\n');
//         const eventType = lines[0] ? lines[0].replace('event: ', '').trim() : null;
//         console.log('Event type:', eventType);

//         if (lines[1]) {
//             const eventData = lines[1].replace('data: ', '').trim();

//             // Helper function to validate JSON
//             function isValidJson(str) {
//                 try {
//                     JSON.parse(str); // Try parsing the string
//                 } catch (e) {
//                     return false; // If it throws an error, it's not valid JSON
//                 }
//                 return true; // If it doesn't throw an error, it's valid
//             }

//             // Parse the data as JSON if necessary
//             let parsedData;
//             if (isValidJson(eventData)) {
//                 try {
//                     parsedData = JSON.parse(eventData);
//                 } catch (e) {
//                     console.error('Failed to parse event data:', e);
//                     return; // Exit the function gracefully if parsing fails
//                 }
//             } else {
//                 console.warn('Received event data is not valid JSON:', eventData);
//                 return; // Skip invalid JSON
//             }

//             console.log(`Event: ${eventType}`, `Data:`, parsedData);

//             // Handle specific event types
//             if (eventType === 'combinedSummaryAudio') {
//                 const audioUrl = parsedData.audioUrl || eventData; // Use parsed data or raw data
//                 sendMessageToPopup({ action: 'combinedSummaryAudio', payload: audioUrl });
//             } else if (eventType === 'STREAM_END') {
//                 console.log('Stream end event received');
//             // } else if (eventType === 'generatingPodcast') {
//             //     console.log('Podcast generation started');
//             //     sendMessageToPopup({ action: 'generatingPodcast', message: 'Podcast generation in progress...' });
//             // } else if (eventType === 'podcastComplete') {
//             //     const playableUrl = backendURL + '/api/media?id=' + parsedData.podcastFile;
//             //     console.log('Podcast generation complete:', playableUrl);
//             //     sendMessageToPopup({ action: 'podcastComplete', message: playableUrl });
//             } else if (eventType === 'error') {
//                 console.error('Error event received:', parsedData);
//                 sendMessageToPopup({ action: 'error', message: parsedData.message || 'An unknown error occurred.' });
//             } else if (eventType === 'finalData' || eventType === 'dataFromIndex') {
//                 console.log(`${eventType} received, triggering popup...`, parsedData);

//                 // Save the data for the popup
//                 chrome.storage.local.set({ popupData: parsedData, popupState: 'main' });

//                 // Open the popup
//                 chrome.windows.create({
//                     url: chrome.runtime.getURL('popup.html'),
//                     type: 'popup',
//                     width: 400,
//                     height: 600
//                 });
//             }

//             // Send the parsed data to the popup for other events
//             sendMessageToPopup({ action: 'updateData', data: { type: eventType, payload: parsedData } });
//         }
//     });
// }

// function processStreamChunk(chunk) {
//     const events = chunk.split('\n\n'); // Each event is separated by two newlines
//     events.forEach(eventStr => {
//         if (eventStr.trim() === '') return; // Skip empty lines

//         const lines = eventStr.split('\n');
//         const eventType = lines[0] ? lines[0].replace('event: ', '').trim() : null;
//         console.log('Event type:', eventType);
//         // Handle specific event types
//         // if (eventType === 'synthesizedSpeech') {
//         //     const urlData = lines[1].replace('data: ', '').trim();
//         //     sendMessageToPopup({ action: 'synthesizedSpeech', payload: urlData });
//         // } else 
//         if (eventType === 'combinedSummaryAudio') {
//             const audioUrl = lines[1].replace('data: ', '').trim();
//             sendMessageToPopup({ action: 'combinedSummaryAudio', payload: audioUrl });
//         } else if (eventType === 'STREAM_END') {
//             console.log('Stream end event received');
//         } else if (lines[1]) {
//             const eventData = lines[1].replace('data: ', '').trim();
//             function isValidJson(str) {
//                 try {
//                     JSON.parse(str);  // Try parsing the string
//                 } catch (e) {
//                     return false;  // If it throws an error, it's not valid JSON
//                 }
//                 return true;  // If it doesn't throw an error, it's valid
//             }

            
//             // Parse the data as JSON if necessary
//             let parsedData;
//             if (isValidJson(eventData)) {
//                 try {
//                     parsedData = JSON.parse(eventData);
//                 } catch (e) {
//                     console.error('Failed to parse event data:', e);
//                     return;  // Exit the function gracefully if parsing fails
//                 }
//             } else {
//                 console.warn('Received event data is not valid JSON:', eventData);
//                 return; // Skip invalid JSON
//             }
//             console.log(`Event: ${eventType}`, `Data: ${eventData}`);

//             // Trigger the popup and fill fields when final data or data from index is received
//             if (eventType === 'finalData' || eventType === 'dataFromIndex') {
//                 console.log(`${eventType} received, triggering popup...`, parsedData);

//                 // Save the data for the popup
//                 chrome.storage.local.set({ popupData: parsedData, popupState: 'main' });

//                 // Open the popup
//                 chrome.windows.create({
//                     url: chrome.runtime.getURL('popup.html'),
//                     type: 'popup',
//                     width: 400,
//                     height: 600
//                 });

//             }
//             // Send the parsed data to the popup
//             sendMessageToPopup({ action: 'updateData', data: { type: eventType, payload: parsedData } });

//         }
//     });
// }
// function processStreamChunk(chunk) {
//     const events = chunk.split('\n\n'); // Each event is separated by two newlines
//     events.forEach(eventStr => {
//         if (eventStr.trim() === '') return; // Skip empty lines

//         const lines = eventStr.split('\n');
//         const eventType = lines[0] ? lines[0].replace('event: ', '').trim() : null;
        
//         // Handle specific event types
//         if (eventType === 'synthesizedSpeech') {
//             const urlData = lines[1].replace('data: ', '').trim();
//             sendMessageToPopup({ action: 'synthesizedSpeech', payload: urlData });
//         } else if (eventType === 'combinedSummaryAudio') {
//             const audioUrl = lines[1].replace('data: ', '').trim();
//             sendMessageToPopup({ action: 'combinedSummaryAudio', payload: audioUrl });
//         } else if (eventType === 'STREAM_END') {
//             console.log('Stream end event received');
//         } else if (lines[1]) {
//             console.log('other event received')
//             const eventData = lines[1].replace('data: ', '').trim();
//             function isValidJson(str) {
//                 try {
//                     JSON.parse(str);  // Try parsing the string
//                 } catch (e) {
//                     return false;  // If it throws an error, it's not valid JSON
//                 }
//                 return true;  // If it doesn't throw an error, it's valid
//             }
            
//             console.log(`Event: ${eventType}`, `Data: ${eventData}`);
            
//             // Parse the data as JSON if necessary
//             let parsedData;
//             if (isValidJson(eventData)) {
//                 try {
//                     parsedData = JSON.parse(eventData);
//                 } catch (e) {
//                     console.error('Failed to parse event data:', e);
//                     return;  // Exit the function gracefully if parsing fails
//                 }
//             } else {
//                 console.warn('Received event data is not valid JSON:', eventData);
//                 // Optionally, handle the case where the eventData is not JSON
//                 return;
//             }
        
//             sendMessageToPopup({ action: 'updateData', data: { type: eventType, payload: parsedData } });
//         }
//     });
// }

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