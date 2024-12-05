try {
  console.log('Content script is running');

  // Function to select and scrape text using multiple selectors
  function manualScrapeWithSelectors(selectors) {
      for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
              const text = elements[0].innerText.trim(); // Take the first matched element's text
              if (text) {
                  return text;
              }
          }
      }
      return null; // Return null if no elements found
  }

  // Function to clean up extracted text
  function cleanText(text) {
      return text
          .replace(/<[^>]+>/g, '') // Remove HTML tags
          .replace(/&#x2019;/g, "'") // Replace HTML entities
          .replace(/&#x201C;/g, '“')
          .replace(/&#x201D;/g, '”')
          .replace(/&#xA0;/g, ' ')
          .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
          .trim();
  }

  // Selectors for title, byline, publish date, and content
  const titleSelectors = ['h1', '.headline', '.article-title', '.entry-title'];
  const authorSelectors = [
    '.author', '.author-name', '.byline', '.by-author', '.byline__name', '.post-author', '.auth-name', '.ArticleFull_headerFooter__author',
    '.entry-author', '.post-author-name', '.post-meta-author', '.article__author', '.author-link', '.article__byline', '.content-author',
    '.meta-author', '.contributor', '.by', '.opinion-author', '.author-block', '.author-wrapper', '.news-author', '.header-byline',
    '.byline-name', '.post-byline', '.metadata__byline', '.author-box', '.bio-name', '.auth-link'
  ];
  const dateSelectors = [
    '.ArticleFull_headerFooter__date__UFCbS', 'time', '.publish-date', '.post-date', '.entry-date', '.article-date',
    '.published-date', '.t-txt', '.t-txt\\:sm', '.t-txt\\:u', '.t-display\\:inline-block'
  ];
  const contentSelectors = [
    '.article-content', '.entry-content', '.post-content', '.content', '.article-body', '.article-text', '.article-content',
    '.article-body', '.article-text', '.article-copy', '.article-content', '.article-main', '.article-contents', '.article-content-body'
  ];

  // Function to extract and clean data from the page
  function extractArticleData() {
      const title = manualScrapeWithSelectors(titleSelectors) || document.title || 'No title';
      const byline = manualScrapeWithSelectors(authorSelectors) || 'Unknown author';
      let publishDate = manualScrapeWithSelectors(dateSelectors) || 'Unknown date';
      let content = manualScrapeWithSelectors(contentSelectors) || 'No content found';

      // Clean content and date
      content = cleanText(content);
      publishDate = publishDate.replace(/\s+/g, ' ').trim().replace(/^PUBLISHED:\s*/, '');

      const domain = (new URL(window.location.href)).hostname.split('.').slice(-2, -1)[0];

      return {
          title,
          byline,
          publishDate,
          content,
          domain,
          url: window.location.href
      };
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (chrome.runtime.lastError) {
        console.error("Runtime error:", chrome.runtime.lastError);
    }
      if (request.action === 'extractData') {
          const articleData = extractArticleData();
          sendResponse({ data: articleData });
    //   } else if (request.action === 'extractFullPage') {
    //       const htmlContent = document.documentElement.outerHTML;
    //       const pageUrl = window.location.href;
    //       sendResponse({ htmlContent, url: pageUrl });
      }
      return true;  // Keeps sendResponse alive for async responses
  });

} catch (error) {
  console.error('Error in content script:', error);
}


// try {
//   console.log('Content script is running');

//   // Function to select and scrape text using multiple selectors, similar to manualScrapeWithSelectors from backend
//   async function manualScrapeWithSelectors(selectors) {
//       for (const selector of selectors) {
//           const elements = document.querySelectorAll(selector);
//           if (elements.length > 0) {
//               const text = elements[0].innerText.trim(); // Take the first matched element's text
//               if (text) {
//                   return text;
//               }
//           }
//       }
//       return null; // Return null if no elements found
//   }

//   // Function to clean up extracted text
//   function cleanText(text) {
//       return text
//           .replace(/<[^>]+>/g, '') // Remove HTML tags
//           .replace(/&#x2019;/g, "'") // Replace HTML entities
//           .replace(/&#x201C;/g, '“')
//           .replace(/&#x201D;/g, '”')
//           .replace(/&#xA0;/g, ' ')
//           .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
//           .trim();
//   }

//   // Fallback selectors for title, byline, publish date, and content
//   const titleSelectors = [
//       'h1', '.headline', '.article-title', '.entry-title', '.post-title', '.title', '.entry-title',
//   ];

//   const authorSelectors = [
//       '.ArticleFull_headerFooter__author__pC2tR', '.author', '.author-name', '.byline', '.by-author',
//       '.byline__name', '.post-author', '.auth-name', '.ArticleFull_headerFooter__author', '.entry-author',
//       '.post-author-name', '.post-meta-author', '.article__author', '.author-link', '.article__byline',
//       '.content-author', '.meta-author', '.contributor', '.by', '.opinion-author', '.author-block',
//       '.author-wrapper', '.news-author', '.header-byline', '.byline-name', '.post-byline',
//       '.metadata__byline', '.author-box', '.bio-name', '.auth-link'
//   ];

//   const dateSelectors = [
//       '.ArticleFull_headerFooter__date__UFCbS', 'time', '.publish-date', '.post-date',
//       '.entry-date', '.article-date', '.published-date', '.t-txt', '.t-txt\\:sm', '.t-txt\\:u',
//       '.t-display\\:inline-block'
//   ];

//   const contentSelectors = [
//       '.article-content', '.entry-content', '.post-content', '.content', '.article-body',
//       '.article-text', '.article-content', '.article-body', '.article-text', '.article-copy',
//       '.article-content', '.article-main', '.article-contents', '.article-content-body'
//   ];

//   // Function to extract and clean data from the page
//   async function extractArticleData() {
//       let title = await manualScrapeWithSelectors(titleSelectors);
//       let byline = await manualScrapeWithSelectors(authorSelectors);
//       let publishDate = await manualScrapeWithSelectors(dateSelectors);
//       let content = await manualScrapeWithSelectors(contentSelectors);

//       // Clean content similar to your backend logic
//       const cleanedContent = cleanText(content);

//       // Clean and format the publish date if necessary
//       if (publishDate) {
//           publishDate = publishDate.replace(/\s+/g, ' ').trim().replace(/^PUBLISHED:\s*/, '');
//       }

//       // Fallback for title, byline, and publishDate if not found
//       if (!title) title = document.title || null;
//       if (!byline) byline = "Unknown author";
//       if (!publishDate) publishDate = "Unknown date";

//       // Extract the domain
//       const domain = (new URL(window.location.href)).hostname.split('.').slice(-2, -1)[0];

//       return {
//           title: title || null,
//           byline: byline || null,
//           publishDate: publishDate || null,
//           content: cleanedContent || null,
//           domain: domain || null,
//           url: window.location.href
//       };
//   }

// //   chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
// //     if (request.action === 'extractData') {
// //       // Extracting the article's headline, description, and content from the page
// //       const headline = document.querySelector('h1') ? document.querySelector('h1').innerText : 'No title found';
// //       const description = document.querySelector('meta[name="description"]') ? document.querySelector('meta[name="description"]').getAttribute('content') : 'No description';
// //       const content = document.querySelector('article') ? document.querySelector('article').innerText : 'No content found';
      
// //       // Sending the extracted data back to the popup
// //       sendResponse({
// //           data: {
// //               title: headline,
// //               description: description,
// //               content: content,
// //               url: window.location.href
// //           }
// //       });
// //   }
// //   return true;
// // });

// chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
//   if (request.action === 'extractFullPage') {
//       const htmlContent = document.documentElement.outerHTML;
//       const pageUrl = window.location.href;
//       // sendResponse({ htmlContent, url: pageUrl });
//       return true
//   }
// });

// // chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
// //   if (request.action === 'extractFullPage') {
// //       // Get the full HTML content of the page
// //       const fullPageHTML = document.documentElement.outerHTML;
      
// //       // Send the full HTML content back
// //       sendResponse({
// //           htmlContent: fullPageHTML,
// //           url: window.location.href
// //       });
// //   }
// //   return true;  // This keeps the sendResponse alive for async responses
// // });

//   // // Listen for messages from popup.js or background.js
//   // chrome.runtime.onMessage.addListener(async function (request, sender, sendResponse) {
//   //     if (request.action === 'extractData') {
//   //         const articleData = await extractArticleData();
//   //         sendResponse({ data: articleData });
//   //     }
//   //     return true;
//   // });

// } catch (error) {
//   console.error('Error in content script:', error);
// }