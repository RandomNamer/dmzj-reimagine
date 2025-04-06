const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { getComicDetail, findComicFolderById } = require('./comic');
const { timestampToLocaleString } = require('./utils/date');

// Configuration
const COMIC_OUTPUT_DIR = "/Volumes/medialibrary/Books/Comic/dmzj/raw";
const SUBSCRIPTION_HTML_PATH = "/Users/zzy/Documents/GitHub/dmzjReader/ApiExplore/Frontend/pages/comicsub.html"

/**
 * Parse the subscription HTML to extract comic IDs
 * @param {string} htmlContent - The HTML content of the subscription page
 * @returns {Array<{id: number, title: string}>} - Array of comic IDs and titles
 */
function parseSubscriptionHtml(htmlContent) {
    const dom = new JSDOM(htmlContent);
    const document = dom.window.document;
    
    // Find all subscription items
    const subscriptionItems = document.querySelectorAll('.dy_content_li');
    const comics = [];
    
    subscriptionItems.forEach(item => {
        // Extract comic ID from the cancel subscription button
        const cancelButton = item.querySelector('.qx');
        if (!cancelButton) return;
        
        const comicId = cancelButton.getAttribute('value');
        if (!comicId) return;
        
        // Extract comic title
        const titleElement = item.querySelector('h3 a');
        const title = titleElement ? titleElement.textContent.trim() : '';
        
        comics.push({
            id: parseInt(comicId),
            title: title
        });
    });
    
    return comics;
}

/**
 * Get local comics that have already been archived
 * @returns {Set<number>} - Set of comic IDs that are already archived locally
 */
function getLocalComics() {
    if (!fs.existsSync(COMIC_OUTPUT_DIR)) {
        fs.mkdirSync(COMIC_OUTPUT_DIR, { recursive: true });
        return new Set();
    }
    
    const localComics = new Set();
    const files = fs.readdirSync(COMIC_OUTPUT_DIR);
    
    files.forEach(file => {
        const match = file.match(/^(\d+)_/);
        if (match) {
            localComics.add(parseInt(match[1]));
        }
    });
    
    return localComics;
}

/**
 * Create a local folder for a comic and save its basic information
 * @param {number} comicId - The comic ID
 * @returns {Promise<void>}
 */
async function createComicFolder(comicId) {
    try {
        const comicInfo = await getComicDetail(comicId);
        if (!comicInfo || !comicInfo.id) {
            console.error(`Error getting comic detail for ID ${comicId}`);
            return;
        }
        
        console.log(`Processing comic: ${comicInfo.title} (ID: ${comicId})`);
        
        const workingDir = path.join(COMIC_OUTPUT_DIR, `${comicInfo.id}_${comicInfo.title}`);
        if (!fs.existsSync(workingDir)) {
            fs.mkdirSync(workingDir, { recursive: true });
        }
        
        // Save basic comic information without archiveResult
        // We don't create archiveResult here so the massUpdater can start fresh
        fs.writeFileSync(path.join(workingDir, "info.json"), JSON.stringify({
            contentUpdatedAt: timestampToLocaleString(comicInfo.lastUpdatetime),
            comicInfo: comicInfo
            // No archiveResult - will be created by massUpdater
        }, null, 2));
        
        // Create empty image_urls.json file
        fs.writeFileSync(path.join(workingDir, "image_urls.json"), JSON.stringify([]));
        
        console.log(`Created folder for ${comicInfo.title}`);
    } catch (error) {
        console.error(`Error creating folder for comic ID ${comicId}:`, error);
    }
}

/**
 * Import subscriptions from HTML file
 * @param {string} htmlFilePath - Path to the HTML file
 * @returns {Promise<Array<number>>} - Array of newly imported comic IDs
 */
async function importSubscriptions(htmlFilePath) {
    if (!fs.existsSync(htmlFilePath)) {
        console.error(`HTML file not found: ${htmlFilePath}`);
        return [];
    }
    
    const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
    const subscribedComics = parseSubscriptionHtml(htmlContent);
    const localComics = getLocalComics();
    const newComics = [];
    
    console.log(`Found ${subscribedComics.length} subscribed comics`);
    console.log(`Found ${localComics.size} local comics`);
    
    for (const comic of subscribedComics) {
        if (!localComics.has(comic.id)) {
            console.log(`New comic found: ${comic.title} (ID: ${comic.id})`);
            await createComicFolder(comic.id);
            newComics.push(comic.id);
        } else {
            console.log(`Comic already exists locally: ${comic.title} (ID: ${comic.id})`);
        }
    }
    
    console.log(`Imported ${newComics.length} new comics`);
    return newComics;
}

/**
 * Main function
 */
async function main() {
    if (!SUBSCRIPTION_HTML_PATH) {
        console.error('Please provide the path to the subscription HTML file as an argument');
        console.log('Usage: node subscriptionImporter.js path/to/comicsub.html');
        process.exit(1);
    }
    
    console.log('Starting subscription import...');
    const newComics = await importSubscriptions(SUBSCRIPTION_HTML_PATH);
    
    console.log('Subscription import completed.');
    console.log(`${newComics.length} new comics were imported.`);
    
    if (newComics.length > 0) {
        console.log('You can now run the massUpdater.js to download all comics.');
    }
}

// Run the main function if this script is executed directly
if (require.main === module) {
    main().catch(error => {
        console.error('Error in main function:', error);
        process.exit(1);
    });
}

module.exports = { importSubscriptions, parseSubscriptionHtml, getLocalComics };