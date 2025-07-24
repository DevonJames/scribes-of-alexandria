// const backendURL = 'http://localhost:3005';
const backendURL = 'https://api.oip.onl';

function reconnectPort() {
    console.log("Reconnecting port...");
    return chrome.runtime.connect({ name: "popupConnection" });
}
let port = chrome.runtime.connect({ name: "popupConnection" });
// port.onDisconnect.addListener(() => {
//     console.warn("Port disconnected.");
//     port = reconnectPort(); // Automatically reopen the port
// });
const summarizeSelectedBtn = document.getElementById('summarize-selected-btn');
const briefBtn = document.getElementById('brief-btn');
const saveButton = document.getElementById('save-article-btn');
const audioPlayer = document.getElementById('audio-player');
let articleSummaryAudioUrl = null; // For article summary audio
let relatedSummaryAudioUrl = null; // For related articles summary audio
let savedSummaryAudioUrl = null; // For saved articles summary audio
let podcastUrl = null; // For podcast URL
let isAudioPlaying = false;  // Track playback state
let isRelatedTabActive = false;
let isSavedTabActive = false;
let articleDidTx = null;

briefBtn.style.pointerEvents = 'none';  // Disable pointer events to prevent clicks

saveButton.style.pointerEvents = 'none';  // Disable pointer events to prevent clicks

let isArticleDataComplete = false;

const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let audioSourceNode = null; // Declare this outside to manage properly
let isPlaying = false;  // Track playback state

// Toggle expand/collapse for the footer ticker
const logContainer = document.getElementById('log-container');
const expandBtn = document.getElementById('expand-btn');

expandBtn.addEventListener('click', () => {
    if (logContainer.classList.contains('ticker-mode')) {
        logContainer.classList.remove('ticker-mode');
        logContainer.classList.add('expanded');
        expandBtn.textContent = '⇔'; // Change icon to indicate "collapse"
    } else {
        logContainer.classList.remove('expanded');
        logContainer.classList.add('ticker-mode');
        expandBtn.textContent = '⇔'; // Change icon to indicate "expand"
    }
});

// const briefBtn = document.getElementById('brief-btn');
const spinner = document.getElementById('spinner');
const buttonText = document.getElementById('button-text');

document.addEventListener('DOMContentLoaded', () => {
    // Retrieve the preloaded data
    chrome.storage.local.get(['popupData', 'popupState'], function (result) {
        const data = result.popupData;
        const state = result.popupState;

        console.log("Popup state:", state, "Data:", data);

        if (state === 'error' && data) {
            // Handle error state
            displayError(data.error || 'An error occurred', data.url);
            return;
        }

        if (state === 'main' && data) {
            // Populate fields with the retrieved data
            console.log("Populating popup with data:", data);

            // Handle screenshot
            const screenshotEl = document.getElementById('screenshot');
            if (screenshotEl && data.screenshotURL) {
                screenshotEl.src = data.screenshotURL;
                screenshotEl.alt = 'Screenshot';
            }

            // Populate basic fields
            const headlineEl = document.getElementById('headline');
            if (headlineEl) headlineEl.value = data.title || '';

            const bylineEl = document.getElementById('byline');
            if (bylineEl) bylineEl.value = data.author || data.byline || '';

            const contentEl = document.getElementById('content');
            if (contentEl) contentEl.value = data.content || '';

            const urlEl = document.getElementById('url');
            if (urlEl) urlEl.value = data.url || '';

            // Extract domain from URL
            const domainEl = document.getElementById('domain');
            if (domainEl && data.url) {
                try {
                    const domain = new URL(data.url).hostname.replace('www.', '');
                    domainEl.value = domain;
                } catch (e) {
                    domainEl.value = '';
                }
            }

            // Convert and display the publish date
            const publishDateEl = document.getElementById('publish-date');
            if (publishDateEl && data.publishDate) {
                const unixTimestamp = data.publishDate;
                const date = new Date(unixTimestamp * 1000);
                const humanReadableDate = date.toLocaleDateString('en-US', {
                    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
                });
                publishDateEl.value = humanReadableDate;
            }

            // Populate tags
            const tagsEl = document.getElementById('tags');
            if (tagsEl && data.tags) {
                tagsEl.value = data.tags.join(', ');
            }

            // Update blockchain links
            if (data.transactionId) {
                const arweaveUrl = `https://arweave.net/${data.transactionId}`;
                updateLink('blockchain-link', arweaveUrl);
            }

            if (data.didTx) {
                const metadataUrl = `${backendURL}/api/records?resolveDepth=2&didTx=${data.didTx}`;
                updateLink('metadata-link', metadataUrl);
            }

            if (data.url) {
                updateLink('read-article-link', data.url);
            }

            // Show success message
            if (data.message) {
                displaySuccess(data.message, data.transactionId);
            }

            console.log("Popup populated successfully.");
        } else if (state === 'login') {
            // Show login interface (though not needed with new API)
            displayLogin();
        } else {
            console.error("No data available or invalid popup state:", state);
        }
    });
});

// document.addEventListener('DOMContentLoaded', () => {
//     // Retrieve the preloaded data
//     chrome.storage.local.get(['popupData', 'popupState'], function (result) {
//         const data = result.popupData;
//         const state = result.popupState;

//         if (state === 'main' && data) {
//             // Populate fields with the retrieved data
//             console.log("Populating popup with data:", data);

//             document.getElementById('headline').value = data.title || '';
//             document.getElementById('byline').value = data.byline || '';
//             document.getElementById('content').value = data.content || '';
//             document.getElementById('url').value = data.url || '';
//             document.getElementById('domain').value = data.domain || '';

//             const unixTimestamp = data.publishDate;
//             const date = new Date(unixTimestamp * 1000); // Convert Unix timestamp to milliseconds
//             const humanReadableDate = date.toLocaleDateString('en-US', {
//                 weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
//             });
//             document.getElementById('publish-date').value = humanReadableDate;

//             document.getElementById('tags').value = (data.tags || []).join(', ');

//             // Handle additional UI logic, e.g., updating links, enabling buttons, etc.
//         } else {
//             console.error("No data available or invalid popup state.");
//         }
//     });
// });

function setGeneratingState(isGenerating) {
    if (isGenerating) {
        // buttonText.textContent = "Working…";
        // spinner.classList.remove("hidden"); // Show spinner
        briefBtn.style.pointerEvents = "none"; // Disable button to prevent multiple clicks
    } else {
        // buttonText.textContent = "Brief Me";
        // spinner.classList.add("hidden"); // Hide spinner
        briefBtn.style.pointerEvents = "auto"; // Enable button
    }
}

function getJwtToken(callback) {
    chrome.storage.local.get('token', function(data) {
        const token = data.token;
        console.log('popup got Token:', token);
        if (!token) {
            callback(null);
            return;
        }
        // Decode the token to retrieve the userId
        const tokenPayload = JSON.parse(atob(token.split('.')[1]));
        const userId = tokenPayload.userId; // Ensure `userId` was encoded in the token
        console.log('popup got userId:', userId);
        callback(token, userId);
    });
}

function playPauseAudio(url, button) {
    const audioPlayer = document.getElementById("audio-player");

    if (!audioPlayer) {
        console.error("Audio player element not found.");
        return;
    }

    // Set the audio source if it’s not already playing the requested file
    if (audioPlayer.src !== url) {
        audioPlayer.src = url;
        isPlaying = false; // Reset playing state
    }

    if (isPlaying) {
        audioPlayer.pause();
        isPlaying = false;
        button.innerHTML = `<img src="svgs/noun-play-6302389.svg" alt="Play" style="width: 16px; height: 16px;">`;
    } else {
        audioPlayer.play()
            .then(() => {
                isPlaying = true;
                button.innerHTML = `<img src="svgs/noun-consistency-7196147.svg" alt="Pause" style="width: 16px; height: 16px;">`;
                visualizeAudio(audioPlayer);
            })
            .catch((error) => {
                console.error("Error playing audio:", error);
                // alert("Unable to play audio. Please try again.");
            });
    }
}

// // might turn this back on
// function playPauseAudio(url) {
//     const audioPlayer = document.getElementById('audio-player');

//     // Check if the audio player exists
//     if (!audioPlayer) {
//         console.error("Audio player element not found.");
//         return;
//     }

//     // Set the audio source if it's not already set to the desired URL
//     if (audioPlayer.src !== url) {
//         audioPlayer.src = url; // Assign the new audio URL
//         isPlaying = false;     // Reset the playing state since the source changed
//     }

//     // Toggle play/pause based on the current state
//     if (isPlaying) {
//         audioPlayer.pause();
//         isPlaying = false;
//     } else {
//         audioPlayer.play()
//             .then(() => {
//                 isPlaying = true;
//                 console.log("Audio playback started.");
//                 visualizeAudio(audioPlayer); // Call your existing visualizeAudio function
//             })
//             .catch(error => {
//                 console.error("Error playing audio:", error);
//                 alert("Unable to play audio. Please try again.");
//             });
//     }
// }

function visualizeAudio(audioElement) {
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    if (!audioSourceNode) {
        audioSourceNode = audioContext.createMediaElementSource(audioElement);
        const analyser = audioContext.createAnalyser();

        audioSourceNode.connect(analyser);
        analyser.connect(audioContext.destination);

        analyser.fftSize = 64;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const canvas = document.getElementById('audio-visualizer');
        const canvasCtx = canvas.getContext('2d');

        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;

        function draw() {
            requestAnimationFrame(draw);

            if (!audioElement.paused) {
                analyser.getByteFrequencyData(dataArray);

                canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

                // Draw the audio bars
                const barWidth = (canvas.width / bufferLength) * 1.5;
                let x = 0;

                for (let i = 0; i < bufferLength; i++) {
                    const barHeight = (dataArray[i] / 255) * canvas.height / 2;
                    canvasCtx.fillStyle = `rgba(0, 150, 255, 0.8)`;
                    canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                    x += barWidth + 1;
                }

                // Draw the playhead as a ball
                const currentTime = audioElement.currentTime;
                const duration = audioElement.duration;

                if (!isNaN(duration)) {
                    const playheadX = (currentTime / duration) * canvas.width;
                    const ballRadius = 4;

                    canvasCtx.beginPath();
                    canvasCtx.arc(
                        playheadX, 
                        34, // Position the ball near the bottom
                        ballRadius, 
                        0, 
                        Math.PI * 2
                    );
                    canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.8)'; // Subtle blue color
                    canvasCtx.shadowColor = 'rgba(255, 255, 255, 0.2)';
                    canvasCtx.shadowBlur = 14;
                    canvasCtx.fill();
                }
            }
        }

        draw();
    }
}

// // THIS ONE WORKS GREAT BUT NO PLAYHEAD - THIS IS BACKUP IF PLAYHEAD ONE FUCKS UP
// function visualizeAudio(audioElement) {
//     if (audioContext.state === 'suspended') {
//         audioContext.resume();
//     }

//     if (!audioSourceNode) {
//         audioSourceNode = audioContext.createMediaElementSource(audioElement);
//         const analyser = audioContext.createAnalyser();

//         audioSourceNode.connect(analyser);
//         analyser.connect(audioContext.destination);

//         analyser.fftSize = 64;
//         const bufferLength = analyser.frequencyBinCount;
//         const dataArray = new Uint8Array(bufferLength);

//         const canvas = document.getElementById('audio-visualizer');
//         const canvasCtx = canvas.getContext('2d');

//         canvas.width = canvas.offsetWidth;
//         canvas.height = canvas.offsetHeight;

//         function draw() {
//             requestAnimationFrame(draw);

//             if (!isPlaying) return;

//             analyser.getByteFrequencyData(dataArray);

//             canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

//             const barWidth = (canvas.width / bufferLength) * 1.5;
//             let x = 0;

//             for (let i = 0; i < bufferLength; i++) {
//                 const barHeight = (dataArray[i] / 255) * canvas.height / 2;
//                 canvasCtx.fillStyle = `rgba(0, 150, 255, 0.8)`;
//                 canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
//                 x += barWidth + 1;
//             }
//         }

//         draw();
//     }
// }

// function visualizeAudio(audioElement) {
//     // Resume AudioContext if needed
//     if (audioContext.state === 'suspended') {
//         audioContext.resume();
//     }

//     // Only create the MediaElementSourceNode once
//     if (!audioSourceNode) {
//         audioSourceNode = audioContext.createMediaElementSource(audioElement);
//         const analyser = audioContext.createAnalyser();

//         audioSourceNode.connect(analyser);
//         analyser.connect(audioContext.destination);

//         analyser.fftSize = 64;
//         const bufferLength = analyser.frequencyBinCount;
//         const dataArray = new Uint8Array(bufferLength);
//         const canvas = document.getElementById('audio-visualizer');
//         const canvasCtx = canvas.getContext('2d');

//         // Ensure canvas size matches button
//         canvas.width = canvas.offsetWidth * .8;
//         canvas.height = canvas.offsetHeight;

//         function draw() {
//             requestAnimationFrame(draw);

//             // Only draw the bars if audio is playing
//             if (!isPlaying) return;

//             analyser.getByteFrequencyData(dataArray);

//             canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

//             const barWidth = (canvas.width / bufferLength) * 1.5;
//             let x = 0;

//             for (let i = 0; i < bufferLength; i++) {
//                 let barHeight = (dataArray[i] / 255) * (canvas.height / 2);  // Scale bar height relative to canvas height
                
//                 canvasCtx.fillStyle = `rgba(255, 255, 255, 1)`;
//                 canvasCtx.fillRect(x, canvas.height / 2 - barHeight / 2, barWidth, barHeight / 2);
//                 canvasCtx.fillRect(x, canvas.height / 2, barWidth, barHeight / 2);

//                 x += barWidth + 1;
//             }
//         }
//         draw();
//     }
// }

function updateLink(elementId, url, classToRemove = null) {
    const linkElement = document.getElementById(elementId);
    if (linkElement) {
        linkElement.href = url;
        linkElement.classList.remove('inactive-link');
        const img = linkElement.querySelector('img');
        if (img) {
            img.style.opacity = url ? 1 : 0.5; // Dim the icon if the link is inactive
        }
    } else {
        console.warn(`Element with ID '${elementId}' not found.`);
    }
}

// Function to check if all data has been received
function checkIfDataComplete() {
    const headline = document.getElementById('headline').value;
    const byline = document.getElementById('byline').value;
    const content = document.getElementById('content').value;
    const tags = document.getElementById('tags').value;
    const url = document.getElementById('url').value;
    const summaryTTS = document.getElementById('audio-player').src;

    // Ensure all fields have values before showing the save button
    if (headline && byline && content && tags && url && summaryTTS) {
        isArticleDataComplete = true;
        saveButton.style.display = 'block';  // Show the button once all data is ready
        saveButton.style.opacity = '1';  // Make the button fully opaque
        saveButton.style.pointerEvents = 'auto';  // Enable pointer events to allow clicks
    } else {
        isArticleDataComplete = false;
        saveButton.style.display = 'none';  // Hide the button if data is incomplete
    }
}

// Function to fetch related articles based on tags
function fetchRelatedArticles() {
    // getJwtToken((token) => {

        const tags = document.getElementById('tags').value.split(',').map(tag => tag.trim());
        logOutput("matching by tags...");
        if (!tags) {
            logOutput("No tags!");
            return;
        }

        // API endpoint with tags
        const apiEndpoint = `${backendURL}/api/records?resolveDepth=4&hasAudio=true&tags=${encodeURIComponent(tags)}`;

        // Fetch related articles from the API
        fetch(apiEndpoint, {
            headers: {
                // 'Authorization': `Bearer ${token}`
            }
        })
            .then(response => response.json())
            .then(data => {
                const relatedContainer = document.getElementById('related-articles-container');
                relatedContainer.innerHTML = ""; // Clear previous content

                // Log the received data for debugging
                // console.log("Related articles fetched:", data);

                // Check if any articles were returned
                if (data.searchResults > 0) {
                    logOutput(`found ${data.searchResults} related articles`);

                    data.records.forEach((record, index) => {
                        console.log("related article:", record);
                        const article = record;
                        // const articleAlt = record.data[1];
                        const relatedScore = record.score;
                        // const tags = article.basic.tags.join(', ') || articleAlt.basic.tags.join(', ') || null;
                        function findTagItems(obj) {
                            let tagItems = [];

                            function searchForTags(node) {
                                if (Array.isArray(node)) {
                                    node.forEach(item => searchForTags(item));
                                } else if (node && typeof node === 'object') {
                                    if (node.tagItems) {
                                        tagItems = tagItems.concat(node.tagItems);
                                    }
                                    Object.values(node).forEach(value => searchForTags(value));
                                }
                            }

                            searchForTags(obj);
                            return tagItems;
                        }

                        const tags = findTagItems(record);
                        // console.log("Found tags:", tags);
                        articleDidTx = record.oip.didTx;
                        // console.log("related article:", article);
                        const articleTxId = articleDidTx.replace('did:arweave:', '');
                        let summaryTTS
                        // try{
                        summaryTTS = (record !== undefined && article.data.post !== undefined && article.data.post.audioItems !== undefined) 
                            ? article.data.post.audioItems[0].data.audio.webUrl 
                            : null;

                        // if (summaryTTS === null) {
                        //     summaryTTS = (article !== undefined && article.audioItems !== undefined) 
                        //         ? article.audioItems.data.audio.webUrl 
                        //         : null;
                        // }

                        // if (summaryTTS === null) {
                        //     summaryTTS = (articleAlt !== undefined && articleAlt.post !== undefined && articleAlt.post.audioItems !== undefined && articleAlt.post.audioItems[0].data[0].associatedURLOnWeb !== undefined) 
                        //         ? articleAlt.post.audioItems[0].data[0].associatedURLOnWeb.url 
                        //         : null;
                        // }

                        // if (summaryTTS === null) {
                        //     summaryTTS = (articleAlt !== undefined && articleAlt.post !== undefined && articleAlt.post.audioItems !== undefined && articleAlt.post.audioItems[0].data[0].audio !== undefined) 
                        //         ? articleAlt.post.audioItems[0].data[0].audio.webUrl 
                        //         : null;
                        // }

                        // if (summaryTTS === null) {
                        //     summaryTTS = (articleAlt !== undefined && articleAlt.audioItems !== undefined) 
                        //         ? articleAlt.audioItems[0].data[0].audio.webUrl 
                        //         : null;
                        // }

                        // if (summaryTTS === null) {
                        //     summaryTTS = (articleAlt !== undefined && articleAlt.audioItems !== undefined && articleAlt.audioItems[0].data[0].associatedURLOnWeb !== undefined) 
                        //         ? articleAlt.audioItems[0].data[0].associatedURLOnWeb.url 
                        //         : null;
                        // }

                        if (summaryTTS === null) {
                            console.error("No TTS URL found for related article.");
                            return;
                        }
                        // } catch (error) {
                        //     console.error("Error fetching related articles:", error);
                        //     // alert("Failed to fetch related articles.");
                        // }
                        const metadataUrl = `https://api.oip.onl/api/records?resolveDepth=2&didTx=${articleDidTx}`;
                        const blockchainUrl = `https://viewblock.io/arweave/tx/${articleTxId}`;
                        // const articleUrl = article.urlItems[0].data[0].associatedUrlOnWeb.url || article.urlItems[0].data[0].associatedURLOnWeb.url
                        const articleElement = document.createElement('div');
                        // const articleDidTx = record.oip.didTx;
                        const articleUrl = article.data.post.webUrl || null; // Default to null if no URL exists
                        articleElement.classList.add('related-article');

                        articleElement.innerHTML = `
                            <input type="checkbox" class="related-checkbox" id="article-${index}" data-url="${articleUrl}">
                            <div class="related-content">
                                <label for="article-${index}">
                                    <h4>${article.data.basic.name}</h4>
                                    <p>${article.data.basic.description}</p>
                                        <div>
                                            <small>Published on: ${new Date(article.data.basic.date * 1000).toDateString()}</small>
                                                <div class="links">
                                                    ${summaryTTS ? `
                                                    <button class="play-audio-btn" data-audio="${summaryTTS}" title="Play Audio">
                                                    <img src="svgs/noun-play-6302389.svg" alt="Play" style="width: 16px; height: 16px;">
                                                    </button>
                                                    ` : ""}
                                                    <a id="read-article-${index}" href="${articleUrl}" target="_blank">
                                                    <img src="svgs/noun-read-7196061.svg" alt="Read Article" style="width: 16px; height: 16px;" title="Read Article">
                                                    </a>
                                                    <a id="view-record-${index}" href="${metadataUrl}" target="_blank">
                                                    <img src="svgs/noun-bookmark-7196067.svg" alt="View Record" style="width: 16px; height: 16px;" title="View Record">
                                                    </a>
                                                    <a id="permaweb-data-${index}" href="${blockchainUrl}" target="_blank">
                                                    <img src="svgs/noun-verified-badge-7196252.svg" alt="Permaweb Data" style="width: 16px; height: 16px;" title="Permaweb Data">
                                                    </a>
                                                </div>
                                                <div class="tags-container" style="display: none;">
                                                    <span class="tags">${tags}</span>
                                                    <div class="relatedScore">${relatedScore}</div>
                                                </div>
                                        </div>
                                        <input type="text" id="didTx-${index}" class="didTx" value="${articleDidTx}">
                                </label>
                            </div>
                        `;
                        relatedContainer.appendChild(articleElement);

                        // Use updateLink to set hrefs
                        updateLink(`read-article-${index}`, articleUrl);
                        updateLink(`view-record-${index}`, metadataUrl);
                        updateLink(`permaweb-data-${index}`, blockchainUrl);
                    });
                } else {
                    logOutput("Found 0 related articles.");
                    relatedContainer.innerHTML = "<p>No related articles found.</p>";
                }
            })
            .catch(error => {
                logOutput("Error fetching related articles.");
                console.error("Error fetching related articles:", error);
                // alert("Failed to fetch related articles.");
            });
    // });
}

document.addEventListener("click", (event) => {
    if (event.target.closest(".play-audio-btn")) {
        const playButton = event.target.closest(".play-audio-btn");
        const audioUrl = playButton.getAttribute("data-audio");
        playPauseAudio(audioUrl, playButton);
    }
});
// Show or hide the loading indicator and backdrop
function showLoadingIndicator(show) {
    show = false
    const loadingIndicator = document.getElementById('loading-indicator');
    const loadingBackdrop = document.getElementById('loading-backdrop');

    if (show) {
        loadingIndicator.classList.remove('hidden');
        loadingBackdrop.classList.remove('hidden');
    } else {
        loadingIndicator.classList.add('hidden');
        loadingBackdrop.classList.add('hidden');
    }
}

function summarizeSelectedSavedArticles() {
    const selectedArticles = [];
    document.querySelectorAll('.saved-checkbox:checked').forEach(checkbox => {
        const articleContent = checkbox.nextElementSibling;
        selectedArticles.push({
            url: checkbox.getAttribute('data-url'),
            title: articleContent.querySelector('h4').innerText,
            description: articleContent.querySelector('p').innerText // Adjust to capture summary content
        });
    });

    if (selectedArticles.length === 0) {
        alert('Please select at least one article to summarize.');
        return;
    }

    // Send the selected articles for summarization
    // Send message to background to create summary for selected articles
    try {
        console.log('sending articles to podcast');
        port.postMessage({ action: 'podcastArticles', articles: selectedArticles });
    } catch (error) {
        reconnectPort();
        // console.error("Port disconnected. Reconnecting...");
        // port = reconnectPort(); // Reopen the port
        // port.postMessage({ action: 'podcastArticles', articles: selectedArticles });
    }
    // port.postMessage({ action: 'summarizeArticles', articles: selectedArticles });
}

function saveSelectedArticles() {
    const selectedArticles = [];
    document.querySelectorAll('.saved-checkbox:checked').forEach(checkbox => {
        const articleContent = checkbox.nextElementSibling; // Gets associated content
        selectedArticles.push({
            url: checkbox.getAttribute('data-url'),
            title: articleContent.querySelector('h4').innerText,
            content: articleContent.querySelector('p').innerText,
            publishedOnUtcEpoch: new Date(articleContent.querySelector('small').innerText.replace('Published on: ', '')).getTime() / 1000
        });
    });

    if (selectedArticles.length === 0) {
        alert('Please select at least one article to save.');
        return;
    }

    // Loop through selected articles and send them to the background script to be saved
    selectedArticles.forEach(article => {
        port.postMessage({ action: 'addArticle', data: article });
    });

}

// Function to fetch and display saved articles
function displaySavedArticles() {
    const savedList = document.getElementById('saved-list');
    savedList.innerHTML = '';  // Clear previous content

    // Send a message to the background script to get all articles
    port.postMessage({ action: 'getAllArticles' });

    // Listen for the response from the background script
    port.onMessage.addListener((message) => {
        if (message.action === 'getAllArticlesResult') {
            if (message.success) {
                const savedArticles = message.articles;

                if (savedArticles.length === 0) {
                    savedList.innerHTML = '<p>No saved articles found.</p>';
                    return;
                }

                savedArticles.forEach((article, index) => {
                    const articleElement = document.createElement('div');
                    articleElement.classList.add('saved-article');
                    const articleTxId = article.didTx.replace('did:arweave:', ''); // Remove the "did:arweave:" prefix
                    const metadataUrl = `https://api.oip.onl/api/records?resolveDepth=2&didTx=${article.didTx}`;
                    const blockchainUrl = `https://viewblock.io/arweave/tx/${articleTxId}`;
                    // Populate article details with checkboxes for selection
                    articleElement.innerHTML = `
                        <input type="checkbox" class="saved-checkbox" id="saved-article-${index}" data-url="${article.canonicalUrl}">
                        <div class="related-content">
                            <label for="saved-article-${index}">
                                <h4>${article.title || 'Untitled'}</h4>
                                <p>${article.content || 'No content available'}</p>
                                <small>Published on: ${new Date(article.publishDate * 1000).toDateString()}</small>
                            </label>
                            <div class="links">
                                <a href="${article.canonicalUrl}" target="_blank">Read Article</a> |
                                <a href="${metadataUrl}" target="_blank">View Record</a>
                                <a href="${blockchainUrl}" target="_blank">Permaweb Data</a>
                            </div>
                        </div>
                    `;
                    savedList.appendChild(articleElement);
                    // Use updateLink to set hrefs
                    updateLink(`saved-read-article-${index}`, article.canonicalUrl);
                    updateLink(`saved-view-record-${index}`, metadataUrl);
                    updateLink(`saved-permaweb-data-${index}`, blockchainUrl);
                });

            } else {
                console.error('Error fetching saved articles:', message.error);
                savedList.innerHTML = '<p>Error loading saved articles.</p>';
            }
        }
    });
}

function openTab(event, tabName) {
    const tabcontent = document.getElementsByClassName('tabcontent');
    const tablinks = document.getElementsByClassName('tablinks');

    // Hide all tab contents
    for (let i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = 'none';
    }

    // Remove 'active' class from all tablinks
    for (let i = 0; i < tablinks.length; i++) {
        tablinks[i].classList.remove('active');
    }

    // Show the current tab and add 'active' class to the button
    document.getElementById(tabName).style.display = 'block';
    // document.querySelector(`[data-tab="${tabName}"]`).style.display = 'block';
    event.currentTarget.classList.add('active');

    
    const currentTab = document.getElementById(tabName);
    if (currentTab) {
        currentTab.style.display = 'block';
        event.currentTarget.classList.add('active');
    } else {
        console.error(`Tab "${tabName}" not found.`);
    }


    // Check which tab is active and adjust button visibility
    if (tabName === "Article") {
        summarizeSelectedBtn.style.display = 'none';  // Hide summarize button
        // saveButton.style.opacity = '1';  // Save button enabled
        // saveButton.style.pointerEvents = 'auto';
    } else if (tabName === "Saved") {
        summarizeSelectedBtn.style.display = 'block';  // Show summarize button
        saveButton.style.opacity = '0.5';  // Disable save button on Saved tab
        saveButton.style.pointerEvents = 'none';
    } else if (tabName === "Related") {
        summarizeSelectedBtn.style.display = 'block';  // Show summarize button
        saveButton.style.opacity = '1';  // Enable save button in Related tab
        saveButton.style.pointerEvents = 'auto';
    }
}

function logOutput(message) {

    // Create or find the message line
    let messageLine = document.getElementById('message-line');
    if (!messageLine) {
        messageLine = document.createElement('div');
        messageLine.id = 'message-line';
        messageLine.classList.add('log-output');  // Add class for styling
        messageLine.style.width = 'auto';  // Set the width of the text inside
                document.body.appendChild(logContainer);
    }

    // Append the new message to the log container
    messageLine.innerHTML += message + '<br>';

    // Scroll to the bottom to show the latest message
    messageLine.scrollTop = messageLine.scrollHeight;
}

function summarizeSelectedArticles() {

    briefBtn.style.opacity = '0.5';  // Make the button look inactive initially
    briefBtn.style.pointerEvents = 'none';  // Disable pointer events to prevent clicks
    // briefBtn.style.display = 'none';
    
    const saveButton = document.getElementById('save-article-btn');
    saveButton.style.opacity = '0.5';  // Make the button look inactive initially
    saveButton.style.pointerEvents = 'none';  // Disable pointer events to prevent clicks

    // disableButtons();
    const selectedArticles = [];

    const activeTab = document.querySelector('.tablinks.active').dataset.tab;

    // Determine which checkboxes to select based on active tab
    const checkboxClass = activeTab === 'Related' ? '.related-checkbox' : '.saved-checkbox';

    // Collect selected articles from either Related or Saved tab
    document.querySelectorAll(`${checkboxClass}:checked`).forEach(checkbox => {
        const articleContent = checkbox.nextElementSibling;
        selectedArticles.push({
            url: checkbox.getAttribute('data-url'),
            date: articleContent.querySelector('small').innerText.replace('Published on: ', ''),
            title: articleContent.querySelector('h4').innerText,
            description: articleContent.querySelector('p').innerText
        });
    });

    console.log('Selected articles:', JSON.stringify(selectedArticles));
    if (selectedArticles.length === 0) {
        alert('Please select at least one article to summarize.');
        enableButtons(); // Ensure buttons are re-enabled if no selection
        return;
    }



    // document.querySelectorAll('.related-checkbox:checked').forEach(checkbox => {
    //     const articleContent = checkbox.nextElementSibling; // Gets associated content
    //     selectedArticles.push({
    //         url: checkbox.getAttribute('data-url'),
    //         title: articleContent.querySelector('h4').innerText,
    //         description: articleContent.querySelector('p').innerText // need to fix this to content once thats working
    //     });
    // });

    //     console.log('Selected articles:', JSON.stringify(selectedArticles));
    //     if (selectedArticles.length === 0) {
    //         alert('Please select at least one article to summarize.');
    //         enableButtons();
    //         return;
    //     }

        port.postMessage({ action: 'summarizeArticles', articles: selectedArticles });
    }

// LISTENERS
// Event listener for messages from the background script
port.onMessage.addListener((message) => {
    console.log('Received message:', message.action, message.data);
    if (message.data && message.data.type === 'error') {
        console.log("error: ", JSON.stringify(message.data.payload));
        setGeneratingState(false);
    } else if (message.data && message.data.type === 'ping') {
        // console.log("ping: ", JSON.stringify(message.data.payload));
    } else {
        if (message.action === 'updateData') {
            // console.log('Received data for:', message.data.type, JSON.stringify(message.data.payload));
            // Handle the message and update UI
            if (message.data.type === 'initialData') {
                if (message.data.payload.screenshotURL) {
                    console.log('1 setting screenshot URL')
                    document.getElementById('screenshot').src = message.data.payload.screenshotURL;
                }
                if (message.data.payload.title) {
                    document.getElementById('headline').value = message.data.payload.title;
                    logOutput("found headline");
                }
                if (message.data.payload.byline) {
                    document.getElementById('byline').value = message.data.payload.byline;
                    logOutput("found byline");
                }
                if (message.data.payload.description) {
                    logOutput("found description");
                }
                if (message.data.payload.content) {
                    document.getElementById('content').value = message.data.payload.content;
                    logOutput("found content");
                }
                if (message.data.payload.url) {
                    document.getElementById('url').value = message.data.payload.url;
                    let readArticleUrl = message.data.payload.url;
                    document.getElementById('read-article-link').href = readArticleUrl;
                    logOutput("found url");
                }
                if (message.data.payload.domain) {
                    document.getElementById('domain').value = message.data.payload.domain;
                    logOutput("found domain");
                }
                if (message.data.payload.publishDate) {
                    const unixTimestamp = message.data.payload.publishDate;
                    const date = new Date(unixTimestamp * 1000);
                    const humanReadableDate = date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
                    document.getElementById('publish-date').value = humanReadableDate;
                    logOutput("found publish date");
                }
                if (message.data.payload.tags) {
                    document.getElementById('tags').value = message.data.payload.tags.join(', ');
                    logOutput("found tags");
                }
            }
            if (message.data.type === 'byline') {
                document.getElementById('byline').value = message.data.payload.byline;
                logOutput("found byline");
            }
            if (message.data.type === 'publishDate') {
                const unixTimestamp = message.data.payload.publishDate;
                const date = new Date(unixTimestamp * 1000); // Convert Unix timestamp to milliseconds
                const humanReadableDate = date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
                document.getElementById('publish-date').value = humanReadableDate;
                logOutput("found publish date");

            }
            if (message.data.type === 'content') {
                logOutput("found content");
            }

            if (message.data.type === 'tags') {
                document.getElementById('tags').value = message.data.payload.tags.join(', ');
                logOutput("inferred tags");
            }
            if (message.data.type === 'summary') {
                logOutput("generated summary");
            }
            if (message.data.type === 'archived') {
                logOutput('archived article 4ever');
                console.log('article archived message', message.data);
                let articleDidTx = message.data.payload.archived;
                console.log('received message that article was archived', articleDidTx);
                let articleTxId = articleDidTx.replace('did:arweave:', ''); // Remove the "did:arweave:" prefix
                document.getElementById('didTx').value = articleTxId;
                // Update the metadata link
                const metadataUrl = `https://api.oip.onl/api/records?resolveDepth=2&didTx=${articleDidTx}`;
                updateLink('metadata-link', metadataUrl);

                // Update the blockchain link
                const blockchainUrl = `https://arweave.net/${articleTxId}`;
                updateLink('blockchain-link', blockchainUrl);
            }
            if (message.data.type === 'finalData') {
                console.log('finalData has been received:', message.data.payload);
                logOutput("got metadata");
                document.getElementById('byline').value = message.data.payload.byline;
                document.getElementById('headline').value = message.data.payload.title;
                document.getElementById('description').value = message.data.payload.description;
                document.getElementById('url').value = message.data.payload.url;
                let readArticleUrl = message.data.payload.url;
                document.getElementById('domain').value = message.data.payload.domain;
                const unixTimestamp = message.data.payload.publishDate;
                const date = new Date(unixTimestamp * 1000); // Convert Unix timestamp to milliseconds
                const humanReadableDate = date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
                logOutput("making date readable");
                document.getElementById('publish-date').value = humanReadableDate;
                document.getElementById('tags').value = message.data.payload.tags.join(', ');
                updateLink('read-article-link', message.data.payload.url, 'inactive-link');
                setGeneratingState(false);

                const audioPlayer = document.getElementById('audio-player');
                articleSummaryAudioUrl = `${backendURL}${message.data.payload.summaryTTS}`;

                if (audioPlayer) {
                    audioPlayer.src = articleSummaryAudioUrl;  // Set the URL of the audio file
                    audioPlayer.type = 'audio/mp3'; // Explicitly set the Content-Type for mp3 audio
                    audioPlayer.load(); // Ensure the audio is loaded

                    audioPlayer.style.display = 'block';  // Show the audio player if it's hidden
                    visualizeAudio(audioPlayer);
                }

                briefBtn.style.display = 'block';  // Show the button once all data is ready
                saveButton.style.display = 'block';  // Show the button once all data is ready
                briefBtn.style.opacity = '1';  // Make the button fully opaque
                saveButton.style.opacity = '1';  // Make the button fully opaque
                briefBtn.style.pointerEvents = 'auto';  // Enable pointer events to allow clicks
                saveButton.style.pointerEvents = 'auto';  // Enable pointer events to allow clicks
            }
            if (message.data.type === 'dataFromIndex') {
                logOutput("found in archive");
                document.getElementById('headline').value = message.data.payload.title;
                document.getElementById('byline').value = message.data.payload.byline;
                const unixTimestamp = message.data.payload.publishDate;
                const date = new Date(unixTimestamp * 1000); // Convert Unix timestamp to milliseconds
                const humanReadableDate = date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
                document.getElementById('publish-date').value = humanReadableDate;
                document.getElementById('description').value = message.data.payload.description;
                document.getElementById('tags').value = message.data.payload.tags.join(', ');
                document.getElementById('url').value = message.data.payload.url;
                let readArticleUrl = message.data.payload.url;
                document.getElementById('domain').value = message.data.payload.domain;
                const recordStatus = message.data.payload.recordStatus;
                const summaryTTS = message.data.payload.summaryTTS; // The URL of the audio file
                console.log('111 summaryTTS:', summaryTTS);
                articleTxId = message.data.payload.txId;
                articleDidTx = message.data.payload.didTx;
                screenshotUrl = message.data.payload.screenshotURL;
                console.log('2 setting screenshotUrl:', screenshotUrl);
                document.getElementById('screenshot').src = message.data.payload.screenshotURL;
                const metadataUrl = `https://api.oip.onl/api/records?resolveDepth=2&didTx=${articleDidTx}`;
                const blockchainLink = document.createElement('a');
                if (recordStatus === "pending confirmation in Arweave") {
                    blockchainLink.href = `https://arweave.net/${articleTxId}`;
                } else {
                    blockchainLink.href = `https://viewblock.io/arweave/tx/${articleTxId}`;
                }

                updateLink('read-article-link', readArticleUrl, 'inactive-link');
                updateLink('metadata-link', metadataUrl, 'inactive-link');
                updateLink('blockchain-link', blockchainLink.href, 'inactive-link');
                articleSummaryAudioUrl = summaryTTS;
                console.log('receiving speech ', summaryTTS)
                briefBtn.style.opacity = '1';
                briefBtn.style.pointerEvents = 'auto';  // Enable pointer events to allow clicks
                const audioPlayer = document.getElementById('audio-player');

                if (audioPlayer) {
                    audioPlayer.src = summaryTTS;  // Set the URL of the audio file
                    audioPlayer.type = 'audio/mp3'; // Explicitly set the Content-Type for mp3 audio
                    audioPlayer.load(); // Ensure the audio is loaded

                    audioPlayer.style.display = 'block';  // Show the audio player if it's hidden
                    visualizeAudio(audioPlayer);
                }

                setGeneratingState(false);
                briefBtn.style.display = 'block';  // Show the button once all data is ready
                saveButton.style.display = 'block';  // Show the button once all data is ready

                briefBtn.style.opacity = '1';  // Make the button fully opaque
                saveButton.style.opacity = '1';  // Make the button fully opaque

                briefBtn.style.pointerEvents = 'auto';  // Enable pointer events to allow clicks
                saveButton.style.pointerEvents = 'auto';  // Enable pointer events to allow clicks
            }
            if (message.data.type === 'podcastProductionUpdate') {
                console.log('Podcast production update:', message.data.payload);
                logOutput(message.data.payload);
            }
            if (message.data.type === 'podcastComplete') {
                console.log('Received podcastComplete audio URL:', message.data.payload.podcastFile);
                setGeneratingState(false);
                console.log('Podcast complete:', parsedData);
                if (!popupPort) {
                    chrome.windows.create({
                    url: chrome.runtime.getURL('popup.html'),
                    type: 'popup',
                    width: 400,
                    height: 600
                    });
                }
                if (isRelatedTabActive === true) {
                    relatedSummaryAudioUrl = `${backendURL}/api/media?id=${message.data.payload.podcastFile}`;
                    console.log('Received combined summary audio URL:', relatedSummaryAudioUrl);
                } else if (isSavedTabActive === true) {
                    savedSummaryAudioUrl = `${backendURL}/api/media?id=${message.data.payload.podcastFile}`;
                    console.log('Received combined summary audio URL:', savedSummaryAudioUrl);
                } else {
                    articleSummaryAudioUrl = `${backendURL}${message.payload.url}`;
                }
    
                logOutput("Podcast generated!");
    
                briefBtn.disabled = false;
                briefBtn.style.opacity = '1';
                briefBtn.style.pointerEvents = 'auto';  // Enable pointer events to allow clicks
                // isAudioPlaying = false; // Reset audio playback state
            }
            
        }
        
        // if (message.action === 'podcastGeneration') {
        //     const host = message.data.payload
        //     console.log('podcastGeneration:', host);
        //     logOutput("generating intro for" + host);
        // }
        if (message.action === 'synthesizedSpeech') {
            const audioUrl = message.payload; // The URL of the audio file
            const apiEndpoint = `${backendURL}${audioUrl}`;
            console.log('receiving speech ', apiEndpoint)
            logOutput('summary synthesized');
            articleSummaryAudioUrl = apiEndpoint;
            briefBtn.style.opacity = '1';
            briefBtn.style.pointerEvents = 'auto';  // Enable pointer events to allow clicks
            if (audioPlayer) {
                audioPlayer.src = apiEndpoint;  // Set the URL of the audio file
                audioPlayer.style.display = 'block';  // Show the audio player if it's hidden
                visualizeAudio(audioPlayer);
            }
        }
        if (message.action === 'updateSummary') {
            console.log("Summary received:", message.summary, ". Not doing anything with it currently");
        }
        // if (message.action === 'combinedSummaryAudio') {

        if (message.action === 'addArticleResult') {
            if (message.success) {
                logOutput('Saved article locally');
            } else if (message.error === 'Key already exists') {
                logOutput('Article already saved.');
                alert(`Article "${message.data.title}" is already saved.`);
            } else {
                logOutput('Error saving article');
                console.error('Error saving article:', message.error);
                alert('Failed to save the article.');
            }
        }
    }
});


document.addEventListener('DOMContentLoaded', () => {
    console.log("Popup loaded. Resetting icon to default...");

    // Reset the browser action icon to the default state
    // resetIcon();
    // Retrieve the preloaded data
    chrome.storage.local.get(['popupData'], function (result) {
        const data = result.popupData;

        if (data) {
            // Populate fields with the retrieved data
            console.log("Populating popup with data:", data);
            document.getElementById('byline').value = data.byline;
            document.getElementById('headline').value = data.title;
            document.getElementById('content').value = data.content;
            document.getElementById('url').value = data.url;
            document.getElementById('domain').value = data.domain;

            const unixTimestamp = data.publishDate;
            const date = new Date(unixTimestamp * 1000); // Convert Unix timestamp to milliseconds
            const humanReadableDate = date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
            document.getElementById('publish-date').value = humanReadableDate;

            document.getElementById('tags').value = data.tags.join(', ');

            // Update links using the helper function
            updateLink('read-article-link', data.url, 'inactive-link');
            // Optionally update other links if needed
            // updateLink('permaweb-link', data.permawebData, 'inactive-link');

            // Enable UI elements once data is ready
            setGeneratingState(false);
            const briefBtn = document.getElementById('brief-btn');
            const saveButton = document.getElementById('save-btn');
            if (briefBtn && saveButton) {
                briefBtn.style.display = 'block';
                saveButton.style.display = 'block';
                briefBtn.style.opacity = '1';
                saveButton.style.opacity = '1';
                briefBtn.style.pointerEvents = 'auto';
                saveButton.style.pointerEvents = 'auto';
            }
        } else {
            console.error("No data available to populate the popup.");
        }
    });
});

window.addEventListener('load', function() {
    // Check for the JWT token in Chrome's local storage
    chrome.storage.local.get('token', function(data) {
        const token = data.token;

        if (!token) {
            // No JWT found, show the login/register screen
            document.getElementById('auth-container').classList.remove('hidden');
            document.getElementById('main-content').classList.add('hidden');
        } else {
            // JWT found, show the main content
            document.getElementById('auth-container').classList.add('hidden');
            document.getElementById('main-content').classList.remove('hidden');
            document.getElementById('logout-btn').classList.remove('hidden'); // Show logout button

            // Now, set up the tabs and fetch data
            setupTabs();
             // Track the number of retry attempts
            setGeneratingState(true)
            initiateBackgroundFetch(); // Only starts if token is found
        }
    });
});

// Function to set up tab event listeners
function setupTabs() {
    const tabLinks = document.querySelectorAll('.tablinks');
    tabLinks.forEach(tab => {
        tab.addEventListener('click', function(event) {
            const tabName = event.target.innerText;
            openTab(event, tabName);
        });
    });

    // Set default tab open
    document.querySelector('.tablinks').click();
    document.querySelector('.tablinks:nth-child(1)').click(); // Open Article tab by default

    document.querySelector('.tablinks:nth-child(1)').addEventListener('click', (event) => {
        openTab(event, 'Article');
        isRelatedTabActive = false;
        isSavedTabActive = false;
    });
    document.querySelector('.tablinks:nth-child(2)').addEventListener('click', (event) => {
        openTab(event, 'Related');
        isRelatedTabActive = true;
        isSavedTabActive = false;
    });
    document.querySelector('.tablinks:nth-child(3)').addEventListener('click', (event) => {
        openTab(event, 'Saved');
        displaySavedArticles();
        saveButton.style.opacity = '0.5'; // Disable save button
        saveButton.style.pointerEvents = 'none';
        isRelatedTabActive = false;
        isSavedTabActive = true;
    });
}

let retryCount = 0; 
const maxRetries = 5;

// Function to start fetch operation in the background script
function displayError(errorMessage, url) {
    // Hide all other content and show error message
    document.body.innerHTML = `
        <div style="padding: 20px; text-align: center;">
            <h2 style="color: #dc3545;">Error</h2>
            <p>${errorMessage}</p>
            ${url ? `<p><strong>URL:</strong> ${url}</p>` : ''}
            <button onclick="window.close()" style="margin-top: 10px; padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Close
            </button>
        </div>
    `;
}

function displaySuccess(message, transactionId) {
    // Add success message to the top of the popup
    const successDiv = document.createElement('div');
    successDiv.style.cssText = 'background: #d4edda; color: #155724; padding: 10px; margin-bottom: 10px; border-radius: 4px; border: 1px solid #c3e6cb;';
    successDiv.innerHTML = `
        <strong>✅ ${message}</strong><br>
        ${transactionId ? `<small>Transaction ID: ${transactionId}</small>` : ''}
    `;
    document.body.insertBefore(successDiv, document.body.firstChild);
}

function displayLogin() {
    // Show login form
    document.body.innerHTML = `
        <div style="padding: 20px;">
            <h2 style="text-align: center; margin-bottom: 20px;">Scribes of Alexandria</h2>
            <h3 style="text-align: center; margin-bottom: 20px;">Login Required</h3>
            
            <div id="login-form">
                <div style="margin-bottom: 15px;">
                    <label for="email" style="display: block; margin-bottom: 5px;">Email:</label>
                    <input type="email" id="email" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" required>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label for="password" style="display: block; margin-bottom: 5px;">Password:</label>
                    <input type="password" id="password" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" required>
                </div>
                
                <button id="login-btn" style="width: 100%; padding: 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; margin-bottom: 10px;">
                    Login
                </button>
                
                <button id="register-btn" style="width: 100%; padding: 10px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Register New Account
                </button>
                
                <div id="login-message" style="margin-top: 10px; text-align: center; color: #dc3545;"></div>
            </div>
        </div>
    `;
    
    // Add event listeners
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('register-btn').addEventListener('click', handleRegister);
    
    // Handle Enter key
    document.getElementById('password').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleLogin();
        }
    });
}

async function handleLogin() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const messageEl = document.getElementById('login-message');
    
    if (!email || !password) {
        messageEl.textContent = 'Please enter both email and password';
        return;
    }
    
    try {
        const response = await fetch(`${backendURL}/api/user/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const result = await response.json();
        
        if (result.success && result.token) {
            // Save token and close popup
            chrome.storage.local.set({ token: result.token }, () => {
                messageEl.style.color = '#28a745';
                messageEl.textContent = 'Login successful! You can now click the extension icon to archive articles.';
                setTimeout(() => window.close(), 2000);
            });
        } else {
            messageEl.textContent = result.error || 'Login failed';
        }
    } catch (error) {
        console.error('Login error:', error);
        messageEl.textContent = 'Login failed. Please check your connection and try again.';
    }
}

async function handleRegister() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const messageEl = document.getElementById('login-message');
    
    if (!email || !password) {
        messageEl.textContent = 'Please enter both email and password';
        return;
    }
    
    try {
        const response = await fetch(`${backendURL}/api/user/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                email, 
                password, 
                name: email.split('@')[0] // Use email prefix as name
            })
        });
        
        const result = await response.json();
        
        if (result.success && result.token) {
            // Save token and close popup
            chrome.storage.local.set({ token: result.token }, () => {
                messageEl.style.color = '#28a745';
                messageEl.textContent = 'Registration successful! You can now click the extension icon to archive articles.';
                setTimeout(() => window.close(), 2000);
            });
        } else {
            messageEl.textContent = result.error || 'Registration failed';
        }
    } catch (error) {
        console.error('Registration error:', error);
        messageEl.textContent = 'Registration failed. Please check your connection and try again.';
    }
}

function initiateBackgroundFetch() {
    const timeoutDuration = 60000; // Start fetch after 1 minute if not yet started

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const activeTab = tabs[0];
        const pageUrl = activeTab.url;

        const timeoutId = setTimeout(() => {
            console.warn("Page load taking too long. Starting fetch process anyway.");
            startFetchWithRetries(pageUrl, activeTab, timeoutId);
        }, timeoutDuration);

        // Attempt to retrieve HTML content, but start fetch after 1 minute regardless
        chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
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
            clearTimeout(timeoutId);  // Clear the timeout if we get HTML content in time

            const htmlContent = (result && result.length > 0) ? result[0].result : null;

            // If HTML content was successfully retrieved, start the fetch immediately
            if (htmlContent) {
                startFetchWithRetries(pageUrl, activeTab, timeoutId, htmlContent);
            }
        });
    });
}



// Registration process
document.getElementById('register-btn').addEventListener('click', function() {
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;

    if (password !== confirmPassword) {
        document.getElementById('register-error').innerText = "Passwords do not match";
        return;
    }

    // Send registration data to your backend
    fetch(`${backendURL}/api/user/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Registration successful!');
            // Store JWT token locally
            chrome.storage.local.set({ token: data.token });
            // Hide auth container, show main content
            document.getElementById('auth-container').classList.add('hidden');
            document.getElementById('main-content').classList.remove('hidden');
            document.getElementById('logout-btn').classList.remove('hidden');
        } else {
            document.getElementById('register-error').innerText = data.message;
        }
    })
    .catch(error => {
        console.error('Error during registration:', error);
    });
});

// Login process
document.getElementById('login-btn').addEventListener('click', function() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    // Send login data to your backend
    fetch(`${backendURL}/api/user/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Login successful!');
            // Store JWT token locally
            chrome.storage.local.set({ token: data.token });
            // Hide auth container, show main content
            document.getElementById('auth-container').classList.add('hidden');
            document.getElementById('main-content').classList.remove('hidden');
            document.getElementById('logout-btn').classList.remove('hidden');
        } else {
            document.getElementById('login-error').innerText = data.message;
        }
    })
    .catch(error => {
        console.error('Error during login:', error);
    });
});

// Toggle between login and registration forms
document.getElementById('toggle-auth').addEventListener('click', function(event) {
    event.preventDefault();
    const registrationForm = document.getElementById('registration-form');
    const loginForm = document.getElementById('login-form');
    
    if (registrationForm.classList.contains('hidden')) {
        registrationForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
        document.getElementById('toggle-auth').innerText = "Already have an account? Log in here.";
    } else {
        registrationForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        document.getElementById('toggle-auth').innerText = "Don't have an account? Register here.";
    }
});

// Toggle settings visibility using the gear button
document.getElementById('settings-btn').addEventListener('click', function() {
    const settingsTab = document.getElementById('Settings');
    const stickyButtonRow = document.querySelector('.sticky-button-row');

    if (settingsTab.classList.contains('hidden')) {
        settingsTab.classList.remove('hidden');
        // Hide other tabs/content when settings is open
        document.querySelector('.tab').classList.add('hidden');
        document.getElementById('main-content').classList.add('hidden');
        // Hide the sticky button row
        stickyButtonRow.style.display = 'none';
    } else {
        settingsTab.classList.add('hidden');
        // Show other tabs/content when settings is hidden
        document.querySelector('.tab').classList.remove('hidden');
        document.getElementById('main-content').classList.remove('hidden');
        // Show the sticky button row
        stickyButtonRow.style.display = 'flex'; // Adjust to your original display style (e.g., 'flex')
    }
});

// Save settings and hide the settings tab when the save button is clicked
document.getElementById('save-settings-btn').addEventListener('click', function() {
    const host1 = document.getElementById('host1').value;
    const host2 = document.getElementById('host2').value;
    // const order = 'host1'

    // Validate the host selection
    if (!host1 || !host2 || host1 === host2) {
        const errorMsg = "Hosts must be different and selected.";
        document.getElementById('host-error').textContent = errorMsg;
        return;
    }

    // Save the settings to local storage
    chrome.storage.local.set({ personalitySettings: { host1, host2 } }, () => {
        alert("Settings saved successfully!");
    });

    // Hide the settings tab
    const settingsTab = document.getElementById('Settings');
    settingsTab.classList.add('hidden');
    // Show the main content and other tabs
    document.querySelector('.tab').classList.remove('hidden');
    document.getElementById('main-content').classList.remove('hidden');
    document.querySelector('.sticky-button-row').style.display = 'flex';
});

// Load saved settings when the popup is opened
document.addEventListener('DOMContentLoaded', function() {
    chrome.storage.local.get('personalitySettings', function(data) {
        if (data.personalitySettings) {
            const { host1, host2 } = data.personalitySettings;

            document.getElementById('host1').value = host1;
            document.getElementById('host2').value = host2;

            // if (order === 'host1') {
            //     document.getElementById('order1').checked = true;
            // } else if (order === 'host2') {
            //     document.getElementById('order2').checked = true;
            // }
        }
    });
});


// Toggle settings visibility using the gear button
// document.getElementById('settings-btn').addEventListener('click', function() {
//     const settingsTab = document.getElementById('Settings');
//     const stickyButtonRow = document.querySelector('.sticky-button-row');

//     if (settingsTab.classList.contains('hidden')) {
//         settingsTab.classList.remove('hidden');
//         // Hide other tabs/content when settings is open
//         document.querySelector('.tab').classList.add('hidden');
//         document.getElementById('main-content').classList.add('hidden');
//         // Hide the sticky button row
//         stickyButtonRow.style.display = 'none';
//     } else {
//         settingsTab.classList.add('hidden');
//         // Show other tabs/content when settings is hidden
//         document.querySelector('.tab').classList.remove('hidden');
//         document.getElementById('main-content').classList.remove('hidden');
//         // Show the sticky button row
//         stickyButtonRow.style.display = 'flex'; // Adjust to your original display style (e.g., 'flex')
//     }
// });





// Logout process
document.getElementById('logout-btn').addEventListener('click', function() {
    // Clear the token
    chrome.storage.local.remove('token', function() {
        // Show the auth screen, hide main content
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('main-content').classList.add('hidden');
        document.getElementById('logout-btn').classList.add('hidden');  // Hide logout button
    });
});

// Event Listener for Summarize Selected Articles button
summarizeSelectedBtn.addEventListener('click', function () {

    // Disable buttons while processing
    setGeneratingState(true)
    briefBtn.disabled = true;
    briefBtn.style.opacity = '1';  // Make the button look inactive initially
    briefBtn.style.pointerEvents = 'none'; 
    
    document.getElementById('save-article-btn').disabled = true;
    const selectedArticles = [];
    if (isRelatedTabActive) {
        document.querySelectorAll('.related-checkbox:checked').forEach(checkbox => {
            const articleContent = checkbox.nextElementSibling;
            console.log('1488 articleContent:', articleContent);
            selectedArticles.push({
                didTx: articleContent.querySelector('.didTx').value,
                title: articleContent.querySelector('h4').innerText,
                content: articleContent.querySelector('p').innerText,
                date: articleContent.querySelector('small').innerText,
                tags: articleContent.querySelector('.tags')?.innerText || 'No tags',
                relatedScore: articleContent.querySelector('.relatedScore').innerText,
                url: articleContent.querySelector('a').href,
            });
            console.log('1496 selectedArticles:', selectedArticles);
        });
    } else if (isSavedTabActive) {
        document.querySelectorAll('.saved-checkbox:checked').forEach(checkbox => {
            const articleContent = checkbox.nextElementSibling;
            console.log('1501 articleContent:', articleContent);
            selectedArticles.push({
                didTx: articleContent.querySelector('.didTx').value,
                title: articleContent.querySelector('h4').innerText,
                content: articleContent.querySelector('p').innerText,
                date: articleContent.querySelector('small').innerText,
                tags: articleContent.querySelector('.tags')?.innerText || 'No tags',
                url: checkbox.getAttribute('data-url'),
            });
            console.log('1510 selectedArticles:', selectedArticles);
        });
    } 

    if (selectedArticles.length === 0) {
        alert('Please select at least one article to summarize.');
        return;
    }


    // Send message to background to create summary for selected articles
    // port.postMessage({ action: 'summarizeArticles', articles: selectedArticles });
    if (!port) {
        port = reconnectPort(); // Automatically reopen the port if it's closed
    }
    port.postMessage({ action: 'podcastArticles', articles: selectedArticles });
});

// Save the article to  when the button is clicked
saveButton.addEventListener('click', async function () {
    chrome.storage.local.get('userId', async function (data) {
        const userId = data.userId || 'anon';  // Default if not found

        const article = {
            didTx: articleDidTx,
            title: document.getElementById('headline').value,
            byline: document.getElementById('byline').value,
            description: document.getElementById('description').value,
            content: document.getElementById('content').value,
            canonicalUrl: document.getElementById('url').value,
            domain: document.getElementById('domain').value,
            publishDate: Math.floor(new Date(document.getElementById('publish-date').value).getTime() / 1000), // Convert to Unix time
            tags: document.getElementById('tags').value.split(',').map(tag => tag.trim()),
            nsfw: false,  // Set based on your criteria
            descriptionTTS: document.getElementById('audio-player').src,
            archivedTimestamp: Math.floor(Date.now() / 1000),
            archivedBy: userId, 
            // canonicalLocationTorrent: message.data.payload.canonicalLocationTorrent,
            // canonicalLocationIPFS: message.data.payload.canonicalLocationIPFS,
            // canonicalLocationArweave: message.data.payload.canonicalLocationArweave,
            // embeddedVideos: message.data.payload.embeddedVideos || [],
            // embeddedArticles: message.data.payload.embeddedArticles || [],
            // interactionMetadata: {
            //     views: 0,
            //     likes: 0,
            //     comments: 0
            // }
        };
        console.log('article:', article);

        try {
            port.postMessage({ action: 'addArticle', data: article });
        } catch (error) {
            console.error('Error saving article:', error);
            alert('Failed to save the article.');
        }
    });
});

// Attach event listener to the "Related" tab
document.querySelector(".tablinks:nth-child(2)").addEventListener("click", fetchRelatedArticles);

document.getElementById('toggle-content-btn').addEventListener('click', function() {
    const contentTextarea = document.getElementById('content');
    const toggleBtn = document.getElementById('toggle-content-btn');

    if (contentTextarea.rows === 2) {
        contentTextarea.rows = 10;  // Expand the textarea
        toggleBtn.innerText = 'Collapse';  // Change button text
    } else {
        contentTextarea.rows = 2;  // Collapse the textarea back to 2 lines
        toggleBtn.innerText = 'Expand';  // Change button text back
    }
});

document.querySelectorAll('.sticky-button-row button, .links a').forEach(button => {
    button.addEventListener('click', () => {
        button.classList.add('active');
        setTimeout(() => button.classList.remove('active'), 150); // Remove active effect after 150ms
    });
});

document.getElementById('brief-btn').addEventListener('click', function () {
    // isRelatedTabActive = localStorage.getItem(isRelatedTabActive)
    console.log('isRelatedTabActive: ', isRelatedTabActive);
    let audioUrl;
    if (isSavedTabActive) {
     audioUrl = savedSummaryAudioUrl
    } else if (isRelatedTabActive) {
     audioUrl = relatedSummaryAudioUrl
    } else {
     audioUrl = articleSummaryAudioUrl
    }
    console.log('audioUrl: ', audioUrl);
    logOutput('playing audio');
    if (audioUrl) {
        playPauseAudio(audioUrl, 'brief-btn');
    } else {
        alert(isRelatedTabActive 
            ? "Please generate a related articles summary first."
            : "No article summary available.");
    }
});

document.getElementById('account-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('account.html') });
});



// // Retry mechanism: Attempt the fetch up to `maxRetries` times
// function startFetchWithRetries(pageUrl, activeTab, timeoutId, htmlContent = null) {
//     if (retryCount < maxRetries) {
//         // Send message to the background script to start the fetch operation
//         port.postMessage({
//             action: "startFetch",
//             url: pageUrl,
//             html: htmlContent
//         });

//         // Increment the retry count
//         retryCount++;
//     } else {
//         // After 5 retries, show failure message and disable buttons
//         console.error("Failed to fetch content after 5 attempts.");

//         // Disable Save and Brief Me buttons
//         saveButton.style.opacity = '0.5';
//         saveButton.style.pointerEvents = 'none';
//         briefBtn.style.opacity = '0.5';
//         briefBtn.style.pointerEvents = 'none';

//         // Show an alert message
//         alert("Failed to fetch the article after multiple attempts.");

//         // Create and display a Retry Fetch button
//         displayRetryFetchButton();
//     }
// }

// // Add a "Retry Fetch" button if all retries fail
// function displayRetryFetchButton() {
//     let retryButton = document.getElementById("retry-fetch-btn");
//     if (!retryButton) {
//         retryButton = document.createElement("button");
//         retryButton.id = "retry-fetch-btn";
//         retryButton.textContent = "Retry Fetch";
//         retryButton.style.display = "block";

//         document.querySelector(".sticky-button-row").appendChild(retryButton);

//         retryButton.addEventListener("click", () => {
//             retryCount = 0;  // Reset retry count
//             initiateBackgroundFetch();  // Restart fetch
//             chrome.tabs.reload();  // Reload the active tab if supported by the extension
//         });
//     }
// }

// // Event listener for the initial load process
// // window.addEventListener('load', function() {
// //     chrome.storage.local.get('token', function(data) {
// //         const token = data.token;

// //         if (!token) {
// //             // No JWT found, show the login/register screen
// //             document.getElementById('auth-container').classList.remove('hidden');
// //             document.getElementById('main-content').classList.add('hidden');

// //             // Simulate a JWT for development purposes
// //             // const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImFkbWluQGVtYWlsLmNvbSIsImlhdCI6MTYxNjIzOTAyMn0.7';
// //             // chrome.storage.local.set({ token: fakeToken }, function() {
// //             //     console.log('Fake JWT token set for development');
// //             //     logOutput('Fake JWT token set for development');
// //             // });

// //             // Simulate as if the user is logged in
// //             // document.getElementById('auth-container').classList.add('hidden');
// //             // document.getElementById('main-content').classList.remove('hidden');
// //             // document.getElementById('logout-btn').classList.remove('hidden');
// //         } else {
// //             // JWT found, show the main content
// //             document.getElementById('auth-container').classList.add('hidden');
// //             document.getElementById('main-content').classList.remove('hidden');
// //             document.getElementById('logout-btn').classList.remove('hidden');  // Show logout button
// //         }
// //     });
// // });

// // // Wait for the entire page to load and then send a message to the backend scrape endpoint and to the content script
// // window.addEventListener('load', function () {
// //     const tabLinks = document.querySelectorAll('.tablinks');
// //     tabLinks.forEach(tab => {
// //         tab.addEventListener('click', function (event) {
// //             const tabName = event.target.innerText;
// //             openTab(event, tabName);
// //         });
// //     });

// //     // Set default tab open
// //     // document.getElementById('defaultOpen').click();
// //     document.querySelector('.tablinks').click();
// //     document.querySelector('.tablinks:nth-child(1)').click();  // Article tab by default

// //     // Set up event listeners for tabs (as per CSP requirements)
// //       document.querySelector('.tablinks:nth-child(1)').addEventListener('click', (event) => {
// //         openTab(event, 'Article')
// //         isRelatedTabActive = false ;
// //         isSavedTabActive = false ;
// //         // localStorage.setItem(isRelatedTabActive, false)
// //     });
// //       document.querySelector('.tablinks:nth-child(2)').addEventListener('click', (event) => {
// //         openTab(event, 'Related');
// //         isRelatedTabActive = true ;
// //         isSavedTabActive = false ;
// //         // localStorage.setItem(isRelatedTabActive, true)
// //     });
// //       document.querySelector('.tablinks:nth-child(3)').addEventListener('click', (event) => {
// //         logOutput('Saved tab clicked');
// //         openTab(event, 'Saved');
// //         displaySavedArticles();
// //         saveButton.style.opacity = '0.5';  // Disable save button
// //         saveButton.style.pointerEvents = 'none';
// //       isRelatedTabActive = false ;
// //         isSavedTabActive = true ;
// //     });
// //     //   document.querySelector('.tablinks:nth-child(4)').addEventListener('click', (event) => openTab(event, 'Settings'));
  
// //     // Get the active tab's URL and start fetching data
// //     chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
// //         const activeTab = tabs[0];
// //         const pageUrl = activeTab.url;
// //         chrome.scripting.executeScript({
// //         target: { tabId: activeTab.id },
// //         func: () => {
// //             return new Promise((resolve) => {
// //                 const checkReadyState = () => {
// //                     if (document.readyState === 'complete') {
// //                         resolve(document.documentElement.outerHTML);
// //                     } else {
// //                         document.addEventListener('readystatechange', () => {
// //                             if (document.readyState === 'complete') {
// //                                 resolve(document.documentElement.outerHTML);
// //                             }
// //                         });
// //                     }
// //                 };
// //                 checkReadyState();
// //             });
// //         },
// //     }, (result) => {
// //         const htmlContent = (result && result.length > 0) ? result[0].result : result;
        
// //         // Show loading indicator
        
// //         // TURN THIS BACK ON AFTER FIXING LOADING INDICATOR
// //         // showLoadingIndicator(true);

// //         port.postMessage({ action: "startFetch", url: pageUrl, html: htmlContent });
// //         // });      

        

// //         // Send message to content script to extract data
// //         chrome.tabs.sendMessage(activeTab.id, { action: 'extractData', additionalParam: htmlContent }, function(response) {
// //             if (response && response.data) {
// //             logOutput('found metadata:' + JSON.stringify(response.data));
// //             }
// //             const articleData = (response) ? response.data : null;
// //             if (articleData) {
// //                 document.getElementById('byline').value = articleData.byline || "Unknown author";
// //                 document.getElementById('headline').value = articleData.title || "No title found";
// //                 document.getElementById('description').value = articleData.description || "No description found";
// //                 document.getElementById('content').value = articleData.content || "No content found";
// //                 document.getElementById('url').value = articleData.url;
// //             }
// //         });  
// //         });
// //     });
// // });



    // save and reuse this function to submit any changes to the article
// function submitArticleToAPI() {
//     showLoadingIndicator(show=true);  // Show the loading indicator

//     const headline = document.getElementById('headline').value;
//     const byline = document.getElementById('byline').value;
//     const description = document.getElementById('description').value;
//     const tags = document.getElementById('tags').value.split(',').map(tag => tag.trim());
//     const url = document.getElementById('url').value;
//     const descriptionTTS = document.getElementById('audio-player').src;
//     const publishDateInput = document.getElementById('publish-date').value;  // Fetching the publish date
//     let publishDate;
//     if (publishDateInput) {
//         publishDate = new Date(publishDateInput).getTime() / 1000;  // Converting to Unix timestamp
//     } else {
//         publishDate = Math.floor(Date.now() / 1000);  // Current timestamp
//     }

//     const articleData = {
//         "basic": {
//             "name": headline,
//             "language": "en",
//             "date": publishDate,  // Current timestamp or use scraped date if applicable
//             "description": description,
//             "urlItems": [
//                 {
//                     "associatedUrlOnWeb": {
//                         "url": url
//                     },
//                     "descriptionTTS": descriptionTTS
//                 }
//             ],
//             "nsfw": false,
//             "tagItems": tags
//         },
//         "post": {
//             "bylineWriter": byline,
//             "articleText": {
//                 "text": "Placeholder for full article text",
//                 "contentType": "text/markdown"
//             },
//             "featuredImage": {
//                 "basic": {
//                     "name": headline,
//                     "date": Math.floor(Date.now() / 1000),
//                     "language": "en",
//                     "nsfw": false
//                 },
//                 "image": {
//                     "height": 400,
//                     "width": 720,
//                     "size": 50000,
//                     "contentType": "image/jpeg"
//                 },
//                 "associatedUrlOnWeb": {
//                     "url": "Placeholder for main image"
//                 }
//             }
//         }
//     };

//     const apiEndpoint = `${backendURL}/api/records/newRecord?recordType=post`;  // Update your API URL here

//     fetch(apiEndpoint, {
//         method: "POST",
//         headers: {
//             "Content-Type": "application/json"
//         },
//         body: JSON.stringify(articleData)
//     })
//     .then(response => response.json())
//     .then(data => {
//         const article = {
//             didTx: data.didTx,
//             title: headline,
//             byline: byline,
//             description: description,
//             tags: tags,
//             publishedOnUtcEpoch: publishDate,
//             canonicalUrl: url,
//             archivedTimestamp: Math.floor(Date.now() / 1000),
//             descriptionTTS: "Placeholder for TTS audio URL",
//             // archivedBy: "User",  // Update with user's name or ID
//             interactionMetadata: {
//                 views: 0,
//                 likes: 0,
//                 comments: 0
//             }
//         }
//         // for (const video)
    

        
//         console.log("Article submitted:", data);
//         logOutput('Article submitted:' + headline);
//         alert("Article archived successfully!");
//     })
//     .catch(error => {
//         console.error("Error submitting article:", error);
//         alert("Failed to archive the article.");
//     })
//     .finally(() => {
//         showLoadingIndicator(show=false);  // Hide loading indicator when done
//     });
// }


// turn off for now?
// function startSpeedReader(text, wpm) {
//     const words = text.split(' ');  // Split the text into words
//     const readingElement = document.getElementById('text-content');  // Where the words will be displayed
//     let currentIndex = 0;
//     const interval = 60000 / wpm;  // Calculate interval based on WPM

//     let readerInterval;

//     // Function to display the next word
//     function displayNextWord() {
//         if (currentIndex < words.length) {
//             readingElement.textContent = words[currentIndex];
//             currentIndex++;
//         } else {
//             clearInterval(readerInterval);  // Stop when text is finished
//         }
//     }

//     // Start the reader
//     readerInterval = setInterval(displayNextWord, interval);    

//     // Controls to pause/resume
//     // document.getElementById('pause-btn').addEventListener('click', function() {
//     //     clearInterval(readerInterval);
//     // });

//     // document.getElementById('resume-btn').addEventListener('click', function() {
//     //     readerInterval = setInterval(displayNextWord, interval);
//     // });

//     // document.getElementById('speed-slider').addEventListener('input', function(e) {
//     //     const newWpm = parseInt(e.target.value);
//     //     clearInterval(readerInterval);
//     //     startSpeedReader(text, newWpm);  // Restart reader with new speed
//     // });
// }

// async function displaySavedArticles() {
//     const historyList = document.getElementById('history-list');
//     historyList.innerHTML = '';  // Clear previous content

//     const savedArticles = await getAllArticles();  // Fetch articles from Dexie DB

//     if (savedArticles.length === 0) {
//         historyList.innerHTML = '<p>No saved articles found.</p>';
//         return;
//     }

//     savedArticles.forEach(article => {
//         const articleElement = document.createElement('div');
//         articleElement.classList.add('related-article');

//         // Populate the article details
//         articleElement.innerHTML = `
//             <h4>${article.title || 'Untitled'}</h4>
//             <p>${article.content || 'No content available'}</p>
//             <small>Published on: ${new Date(article.publishedOnUtcEpoch * 1000).toDateString()}</small>
//             <a href="${article.canonicalUrl}" target="_blank">Read it</a>
//         `;

//         historyList.appendChild(articleElement);
//     });
// }







// Save the article to Dexie when the button is clicked - works well enough, trying a more thorough approach
// saveButton.addEventListener('click', async function () {
//     // if (isArticleDataComplete) {
//         const article = {
//             didTx: 'transaction-id-here',  // You'll replace this with the actual didTx
//             title: document.getElementById('headline').value,
//             byline: document.getElementById('byline').value,
//             // description: document.getElementById('description').value,
//             content: document.getElementById('description').value,
//             canonicalUrl: document.getElementById('url').value,
//             publishedOnUtcEpoch: Math.floor(Date.now() / 1000),
//             tags: document.getElementById('tags').value.split(',').map(tag => tag.trim()),
//             nsfw: false,  // Set to true if the content is NSFW
//             descriptionTTS: document.getElementById('audio-player').src,
//             archivedTimestamp: Math.floor(Date.now() / 1000),
//             archivedBy: 'User',  // Optionally, provide the current user or other info
//             interactionMetadata: {
//                 views: 0,
//                 likes: 0,
//                 comments: 0
//             }
//         };

//         try {
//             await db.addArticle(article);  // Add the article to Dexie
//             alert('Article saved successfully!');
//         } catch (error) {
//             console.error('Error saving article:', error);
//             alert('Failed to save the article.');
//         }
//     // }
// });

// // Event listener for brief-btn WORKS FOR MAIN ONE NOT THE SUMMARY ONE< TRYING A NEW APPROACH
// document.getElementById('brief-btn').addEventListener('click', function () {
//     const relatedTab = document.getElementById('Related');
//     if (relatedTab && relatedTab.style.display === 'block') {
//         // If Related tab is active, call summarizeSelectedArticles
//         // summarizeSelectedArticles();
//     }
//     else {
//         const audioPlayer = document.getElementById('audio-player'); // Assuming you have an audio player
//         if (!audioPlayer.src) {
//             audioPlayer.src = localStorage.getItem('audioUrl'); // Load audio from stored URL
//         }
//         if (isPlaying) {
//             audioPlayer.pause();  // Pause audio
//             isPlaying = false;    // Update playback state
//         } else {
//             audioPlayer.play()    // Start or resume audio
//                 .then(() => {
//                     console.log("Audio playback started");
//                     isPlaying = true;  // Update playback state
//                     visualizeAudio(audioPlayer); // Ensure visualizer is active
//                 })
//                 .catch(error => console.error("Error playing audio:", error));
//         }
//     }
//     // const visualizerCanvas = document.getElementById('audio-visualizer');
    
//     // // Toggle visualizer display
//     // if (visualizerCanvas.style.display === 'none') {
//     //     // Display the visualizer
//     //     visualizerCanvas.style.display = 'block';
//     //     audioPlayer.src = localStorage.getItem('audioUrl');  
        
//     //     // Start audio and visualization
//     //     audioPlayer.play()
//     //         .then(() => visualizeAudio(audioPlayer))
//     //         .catch(error => console.error("Error playing audio:", error));
//     // } else {
//     //     // Hide visualizer and stop audio if it's playing
//     //     visualizerCanvas.style.display = 'none';
//     //     audioPlayer.pause();
//     //     audioPlayer.currentTime = 0;
//     // }

//     // if (isVoiceSelected) {
//         // Play the synthesized speech
//         // if (audioPlayer) {
//         //     audioPlayer.src = localStorage.getItem('audioUrl');  
//         //     // audioPlayer.play();
//         //     // use local storage to get the audio
//         //     const context = new (window.AudioContext || window.webkitAudioContext)();
//         //     if (context.state === 'suspended') {
//         //         context.resume();
//         //     }
            
//         //     visualizeAudio(audioPlayer);
//         //     // audioPlayer.src = apiEndpoint;  // Set the URL of the audio file
//         //             // console.log('receiving speech')

//         //     audioPlayer.play()
//         //         .then(() => console.log("Audio playback started"))
//         //         .catch(error => console.error("Error playing audio:", error));

//         // }
//     // } else if (isScreenSelected) {
//     //     // Start speed reader
//     //     let progress = 0;
//     //     const totalWords = descriptionText.split(' ').length;
//     //     const intervalTime = (60000 / 370);  // Adjust this based on your default WPM
        
//     //     // Update progress bar
//     //     let progressInterval = setInterval(function () {
//     //         if (progress >= 100) {
//     //             clearInterval(progressInterval);
//     //         } else {
//     //             progress += (100 / totalWords);  // Update progress based on word count
//     //             progressBar.style.width = progress + '%';
//     //         }
//     //     }, intervalTime);

//     //     // Start the speed reader
//     //     startSpeedReader(descriptionText, 370);

//     //     // Add pause and resume functionality
//     //     pauseBtn.addEventListener('click', function () {
//     //         clearInterval(progressInterval);
//     //         pauseBtn.style.display = 'none';
//     //         resumeBtn.style.display = 'block';
//     //     });

//     //     resumeBtn.addEventListener('click', function () {
//     //         progressInterval = setInterval(function () {
//     //             if (progress >= 100) {
//     //                 clearInterval(progressInterval);
//     //             } else {
//     //                 progress += (100 / totalWords);
//     //                 progressBar.style.width = progress + '%';
//     //             }
//     //         }, intervalTime);
//     //         pauseBtn.style.display = 'block';
//     //         resumeBtn.style.display = 'none';
//         // });
//     // } 
//     // else {
//     //     alert("Please select either 'Voice' or 'Screen' to proceed.");
//     // }
// });









// MIGHT USE IN FUTURE

// full panel visualizeAudio function
// function visualizeAudio(audioElement) {
//     const context = new (window.AudioContext || window.webkitAudioContext)();
//     const analyser = context.createAnalyser();
//     const source = context.createMediaElementSource(audioElement);
//     source.connect(analyser);
//     analyser.connect(context.destination);

//     // Adjust fftSize to reduce the number of bars
//     analyser.fftSize = 128;
//     const bufferLength = analyser.frequencyBinCount;
//     const dataArray = new Uint8Array(bufferLength);
//     const canvas = document.getElementById('audio-visualizer');
//     const canvasCtx = canvas.getContext('2d');

//     // Set rounded edges for the bars
//     canvasCtx.lineCap = "round";
    
//     // Make sure the visualizer canvas is visible
//     canvas.style.display = 'block';

//     function draw() {
//         requestAnimationFrame(draw);
//         analyser.getByteFrequencyData(dataArray);
//         canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

//         // Increase bar width and adjust spacing
//         const barWidth = (canvas.width / bufferLength) * 3.5;
//         let barHeight;
//         let x = 0;

//         for (let i = 0; i < bufferLength; i++) {
//             barHeight = dataArray[i];

//             // Create a gradient from light blue to white
//             const gradient = canvasCtx.createLinearGradient(0, canvas.height / 2, 0, canvas.height / 2 - barHeight);
//             gradient.addColorStop(0, '#87CEEB');  // Sky blue
//             gradient.addColorStop(1, `rgb(${barHeight + 180}, ${barHeight + 220}, 255)`); // Lighter blue/white transition

//             canvasCtx.fillStyle = gradient;

//             // Draw upper bars with rounded edges
//             canvasCtx.fillRect(x, canvas.height / 2 - barHeight / 2, barWidth, barHeight / 2);

//             // Draw mirrored bars with rounded edges
//             canvasCtx.fillRect(x, canvas.height / 2, barWidth, barHeight / 2);

//             x += barWidth + 2;  // Adjust spacing between bars
//         }
//     }
//     draw();
// }

// // THIS WORKS JUST FINE< IT JUST NEEDS A CLOSE BUTTON
// function visualizeAudio(audioElement) {
//     const context = new (window.AudioContext || window.webkitAudioContext)();
//     const analyser = context.createAnalyser();
//     const source = context.createMediaElementSource(audioElement);
//     source.connect(analyser);
//     analyser.connect(context.destination);

//     // Adjust fftSize to reduce the number of bars
//     analyser.fftSize = 128;
//     const bufferLength = analyser.frequencyBinCount;
//     const dataArray = new Uint8Array(bufferLength);
//     const canvas = document.getElementById('audio-visualizer');
//     const canvasCtx = canvas.getContext('2d');
    
//     // Set rounded edges for the bars
//     canvasCtx.lineCap = "round";

//     function draw() {
//         requestAnimationFrame(draw);
//         analyser.getByteFrequencyData(dataArray);
//         canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

//         // Increase bar width and adjust spacing
//         const barWidth = (canvas.width / bufferLength) * 3.5;
//         let barHeight;
//         let x = 0;

//         for (let i = 0; i < bufferLength; i++) {
//             barHeight = dataArray[i];

//             // Create a gradient from light blue to white
//             const gradient = canvasCtx.createLinearGradient(0, canvas.height / 2, 0, canvas.height / 2 - barHeight);
//             gradient.addColorStop(0, '#87CEEB');  // Sky blue
//             gradient.addColorStop(1, `rgb(${barHeight + 180}, ${barHeight + 220}, 255)`); // Lighter blue/white transition

//             canvasCtx.fillStyle = gradient;

//             // Draw upper bars with rounded edges
//             canvasCtx.fillRect(x, canvas.height / 2 - barHeight / 2, barWidth, barHeight / 2);

//             // Draw mirrored bars with rounded edges
//             canvasCtx.fillRect(x, canvas.height / 2, barWidth, barHeight / 2);

//             x += barWidth + 2;  // Adjust spacing between bars
//         }
//     }
//     draw();
// }

// // Add a close button to the visualizer
// const closeButton = document.createElement('button');
// closeButton.innerText = 'Close';
// closeButton.style.position = 'absolute';
// closeButton.style.top = '10px';
// closeButton.style.right = '10px';
// closeButton.style.zIndex = '1000';
// closeButton.addEventListener('click', () => {
//     const visualizerContainer = document.getElementById('visualizer-container');
//     if (visualizerContainer) {
//         visualizerContainer.style.display = 'none';
//     }
// });

// document.body.appendChild(closeButton);

// // function to save the generated audio to the dexie database
// function saveAudio(audioElement) {
//     const audioUrl = audioElement.src;
//     const audioTitle = document.getElementById('headline').value;
//     const audioDescription = document.getElementById('description').value;
//     const audioTags = document.getElementById('tags').value.split(',').map(tag => tag.trim());
//     const audioPublishedOn = document.getElementById('publish-date').value;
//     const audioDomain = document.getElementById('domain').value;


// Audio visualizer function (simplified from the three.js example)
// function visualizeAudio(audioElement) {
//     console.log('Visualizing audio:', audioElement.src);
//     const context = new (window.AudioContext || window.webkitAudioContext)();
//     const analyser = context.createAnalyser();

//     // Only create a new MediaElementSourceNode if it doesn't already exist
//     if (!sourceNode) {
//         sourceNode = context.createMediaElementSource(audioElement);
//         sourceNode.connect(analyser);
//         analyser.connect(context.destination);
//     }

//     analyser.fftSize = 256;
//     const bufferLength = analyser.frequencyBinCount;
//     const dataArray = new Uint8Array(bufferLength);

//     const canvas = document.getElementById('audio-visualizer');  // Reference the canvas by ID
//     const canvasCtx = canvas.getContext('2d');
//     console.log(canvas, canvasCtx);  // Check if they are correctly initialized

//     function draw() {
//         console.log('Drawing visualization frame');
//         requestAnimationFrame(draw);
//         analyser.getByteFrequencyData(dataArray);
    
//         canvasCtx.fillStyle = 'rgb(0, 0, 0)';
//         canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
    
//         const barWidth = (canvas.width / bufferLength) * 2.5;
//         let barHeight;
//         let x = 0;
//         const centerY = canvas.height / 2;
    
//         for (let i = 0; i < bufferLength; i++) {
//             barHeight = dataArray[i];
//             canvasCtx.fillStyle = `rgb(173, 216, 230)`;
//             canvasCtx.fillRect(x, centerY - barHeight / 2, barWidth, barHeight / 2);
//             canvasCtx.fillRect(x, centerY, barWidth, barHeight / 2);
//             x += barWidth + 1;
//         }
//     }
//     // function draw() {
//     //     requestAnimationFrame(draw);

//     //     analyser.getByteFrequencyData(dataArray);

//     //     canvasCtx.fillStyle = 'rgb(0, 0, 0)';
//     //     canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

//     //     const barWidth = (canvas.width / bufferLength) * 2.5;
//     //     let barHeight;
//     //     let x = 0;

//     //     for (let i = 0; i < bufferLength; i++) {
//     //         barHeight = dataArray[i];

//     //         canvasCtx.fillStyle = `rgb(173, 216, 230)`;  // Light blue color
//     //         canvasCtx.fillRect(x, canvas.height - barHeight / 2, barWidth, barHeight / 2);

//     //         x += barWidth + 1;
//     //     }
//     // }

//     draw();
// }
// let sourceNode = null; 


// // Event Listener for Summarize Selected Articles button
// summarizeSelectedBtn.addEventListener('click', function () {

//     // Disable buttons while processing
//     briefBtn.disabled = true;
//     briefBtn.style.opacity = '0.5';  // Make the button look inactive initially
//     briefBtn.style.pointerEvents = 'none'; 
    
//     document.getElementById('save-article-btn').disabled = true;
//     const selectedArticles = [];
//     document.querySelectorAll('.related-checkbox:checked').forEach(checkbox => {
//         const articleContent = checkbox.nextElementSibling;
//         selectedArticles.push({
//             url: checkbox.getAttribute('data-url'),
//             title: articleContent.querySelector('h4').innerText,
//             description: articleContent.querySelector('p').innerText
//         });
//     });

//     if (selectedArticles.length === 0) {
//         alert('Please select at least one article to summarize.');
//         return;
//     }


//     // Send message to background to create summary for selected articles
//     port.postMessage({ action: 'summarizeArticles', articles: selectedArticles });
// });


// document.getElementById('close-visualizer-btn').addEventListener('click', function() {
//     const visualizer = document.getElementById('audio-visualizer');
//     if (visualizer) {
//         visualizer.style.display = 'none';  // Hide the visualizer
//     }
//     // set the dim background to none
//     document.getElementById('dim-background').style.display = 'none';
// });



// document.addEventListener('DOMContentLoaded', function () {
//     const headlineInput = document.getElementById('headline');
//     const descriptionTextarea = document.getElementById('description');
//     const contentTextarea = document.getElementById('content');
//     const urlInput = document.getElementById('url');
    
//     // Get the active tab to send a message to the content script
//     chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
//         const activeTab = tabs[0];
//         // Send message to content script to extract full page HTML
//         chrome.tabs.sendMessage(activeTab.id, { action: 'extractFullPage' }, function (response) {
//             if (chrome.runtime.lastError) {
//                 console.error('Error in message communication:', chrome.runtime.lastError);
//                 return;
//             }

//             if (response && response.htmlContent) {
//                 const fullPageHTML = response.htmlContent;
//                 const pageUrl = response.url;

//                 // Display the page URL in the UI
//                 urlInput.value = pageUrl;

//                 // Send the HTML content to your server for scraping
//                 fetch(`http://localhost:3005/api/scrape/artcle/stream`, {
//                     method: 'POST',
//                     headers: {
//                         'Content-Type': 'application/json',
//                     },
//                     body: JSON.stringify({ html: fullPageHTML, url: pageUrl }),
//                 })
//                 .then(response => response.json())
//                 .then(data => {
//                     // Handle the scraped data here and update the popup fields
//                     headlineInput.value = data.title || '';
//                     descriptionTextarea.value = data.description || '';
//                     contentTextarea.value = data.content || '';
//                 })
//                 .catch(error => {
//                     console.error('Error sending HTML to server:', error);
//                 });
//             } else {
//                 console.error('No response data received from the content script.');
//             }
//         });
//         // // Send message to content script to extract data
//         // chrome.tabs.sendMessage(activeTab.id, { action: 'extractData' }, function (response) {
//         //     if (chrome.runtime.lastError) {
//         //         console.error('Error in message communication:', chrome.runtime.lastError);
//         //         return;
//         //     }

//         //     if (response && response.data) {
//         //         const articleData = response.data;

//         //         // Set the extracted data to the popup fields
//         //         headlineInput.value = articleData.title || '';
//         //         descriptionTextarea.value = articleData.description || '';
//         //         contentTextarea.value = articleData.content || '';
//         //         urlInput.value = articleData.url || '';
//         //     } else {
//         //         console.error('No response data received or content script is not injected.');
//         //     }
//         // });
//     });
// });


        // // Send message to content script to extract data
        // chrome.tabs.sendMessage(activeTab.id, { action: 'extractData' }, function(response) {
        //     if (chrome.runtime.lastError) {
        //         // Handle errors that occur when sending the message
        //         console.error('Error in message communication:', chrome.runtime.lastError);
        //     } else if (response && response.data) {
        //         // Successfully received response
        //         console.log('Response from content script:', response.data);
        //         const articleData = response.data;
        //         document.getElementById('url').value = articleData.url;
        //         showLoadingIndicator(false);  // Hide loading indicator
        //     } else {
        //         // Handle case where no data is received
        //         console.error('No response data received.');
        //     }
        // });


        // chrome.tabs.sendMessage(activeTab.id, { action: 'extractData' }, function(response) {
        //     // logOutput('Response from content script:' + response.data);
        //     const articleData = response.data;
        //     if (articleData) {
        //         document.getElementById('byline').value = articleData.byline || "Unknown author";
        //         document.getElementById('headline').value = articleData.title || "No title found";
        //         document.getElementById('description').value = articleData.description || "No description found";
        //         document.getElementById('content').value = articleData.content || "No content found";
        //         document.getElementById('url').value = articleData.url;
        //         document.getElementById('domain').value = (new URL(articleData.url)).hostname.split('.').slice(-2, -1)[0] || "No domain found";
        //         showLoadingIndicator(false);  // Hide loading indicator
        //     }
        //     // add this to localstorage as initialData
        //     // chrome.storage.local.set({ 'initialData': articleData }, function() {
        //     //     logOutput('Initial data stored in chrome.storage.local');
        //     // });
        // });
