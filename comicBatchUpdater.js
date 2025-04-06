const fs = require('fs');
const path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { getComicDetail, findComicFolderById, makeCbz } = require('./comic');
const { archive } = require('./comicArchiver');
const { timeStampToDashedString } = require('./utils/date');
const { time } = require('console');

// Configuration
const COMIC_OUTPUT_DIR = "/Volumes/medialibrary/Books/Comic/dmzj/raw";
const CBZ_OUTPUT_DIR = "/Volumes/medialibrary/Books/Comic/dmzj/cbz";
const ENABLE_HIGH_QUALITY = true;
const MAX_CONCURRENT_COMICS = 5; // Number of comics to process concurrently
const IMAGE_CONCURRENCY = 10; // Max concurrent image downloads per comic
const VOLUME_SPLIT_MULTIPLIER = 1000; // Same as in comicArchiver.js
const PRINT_URL_THRESH_REDOWNLOAD = 10; // Same as in comicArchiver.js
const SUPPRESS_UPSTREAM_ERROR = false; // Same as in comicArchiver.js

/**
 * If this is the main thread, it will coordinate the workers
 * If this is a worker thread, it will process a single comic
 */
if (isMainThread) {
    // Main thread code
    /**
     * Get all comic folders in the output directory
     * @returns {Array<{id: number, path: string}>} - Array of comic IDs and their folder paths
     */
    function getAllComicFolders() {
        if (!fs.existsSync(COMIC_OUTPUT_DIR)) {
            fs.mkdirSync(COMIC_OUTPUT_DIR, { recursive: true });
            return [];
        }
        
        const folders = [];
        const files = fs.readdirSync(COMIC_OUTPUT_DIR);
        
        files.forEach(file => {
            const fullPath = path.join(COMIC_OUTPUT_DIR, file);
            if (fs.statSync(fullPath).isDirectory()) {
                const match = file.match(/^(\d+)_/);
                if (match) {
                    folders.push({
                        id: parseInt(match[1]),
                        path: fullPath
                    });
                }
            }
        });
        
        return folders;
    }

    /**
     * Process comics in batches with limited concurrency
     * @param {Array<{id: number, path: string}>} comics - Array of comics to process
     * @param {boolean} makeCbz - Whether to create CBZ files after updating
     */
    async function processComicsInBatches(comics, makeCbz = true) {
        const total = comics.length;
        let processed = 0;
        let activeWorkers = 0;
        let comicIndex = 0;
        const results = [];
        const statsCollection = [];
        
        console.log(`Starting to process ${total} comics with max ${MAX_CONCURRENT_COMICS} concurrent workers`);
        
        return new Promise((resolve) => {
            const startNextWorker = () => {
                if (comicIndex >= comics.length) {
                    // No more comics to process
                    if (activeWorkers === 0) {
                        resolve({ results, statsCollection });
                    }
                    return;
                }
                
                const comic = comics[comicIndex++];
                activeWorkers++;

                console.log(`[${processed + 1}/${total}] Starting worker for comic ID ${comic.id}`);
                
                const worker = new Worker(__filename, {
                    workerData: {
                        comicId: comic.id,
                        comicPath: comic.path,
                        enableHighQuality: ENABLE_HIGH_QUALITY,
                        makeCbz: makeCbz
                    }
                });

                const logPrefix = `[Comic ${comic.path.split('/').pop()}]`

                worker.on('message', (message) => {
                    if (message.type === 'log') {
                        console.log(`${logPrefix}`, message.data);
                    } else if (message.type === 'error') {
                        console.error(`${logPrefix} Unhandled error: `, message.data);
                    } else if (message.type === 'result') {
                        // Store the result
                        results.push({
                            id: comic.id,
                            success: message.success,
                            message: message.data
                        });
                        
                        // Collect statistics if available
                        if (message.stats) {
                            statsCollection.push(message.stats);
                        }
                    }
                });
                
                worker.on('error', (err) => {
                    console.error(`Worker error for comic ${comic.id}:`, err);
                    results.push({
                        id: comic.id,
                        success: false,
                        message: `Worker error: ${err.message}`
                    });
                    activeWorkers--;
                    processed++;
                    startNextWorker();
                });
                
                worker.on('exit', (code) => {
                    activeWorkers--;
                    processed++;
                    console.log(`[${processed}/${total}] Worker for comic ID ${comic.id} exited with code ${code}`);
                    startNextWorker();
                });
            };
            
            // Start initial batch of workers
            for (let i = 0; i < Math.min(MAX_CONCURRENT_COMICS, comics.length); i++) {
                startNextWorker();
            }
        });
    }


    /**
     * Main function for the main thread
     */
    async function main() {
        const comicFolders = getAllComicFolders();
        
        if (comicFolders.length === 0) {
            console.log('No comics found in the output directory.');
            console.log('Please run subscriptionImporter.js first to import comics.');
            return;
        }
        
        console.log(`Found ${comicFolders.length} comics in the output directory.`);
        
        // Process specific comics if IDs are provided as arguments
        const specificIds = process.argv.slice(2).map(arg => parseInt(arg)).filter(id => !isNaN(id));
        
        let comicsToProcess;
        if (specificIds.length > 0) {
            comicsToProcess = comicFolders.filter(comic => specificIds.includes(comic.id));
            console.log(`Will process ${comicsToProcess.length} specified comics.`);
        } else {
            comicsToProcess = comicFolders;
            console.log(`Will process all ${comicsToProcess.length} comics.`);
        }

        const globalStartTime = Date.now()
        const { results, statsCollection } = await processComicsInBatches(comicsToProcess);
        
        const globalProcessingTime = (Date.now() - globalStartTime) / 1000;
        // Print summary
        console.log('\n===== Summary =====');
        const successful = results.filter(r => r.success).length;
        console.log(`Total: ${results.length}, Successful: ${successful}, Failed: ${results.length - successful}, total time: ${globalProcessingTime.toFixed(2)}s`);
        
        if (results.length - successful > 0) {
            console.log('\nFailed comics:');
            results.filter(r => !r.success).forEach(r => {
                console.log(`- Comic ID ${r.id}: ${r.message}`);
            });
        }
        
        // Write statistics to last-updates.json
        if (statsCollection.length > 0) {
            const statsData = {
                updateTime: new Date().toISOString(),
                processingTimeSec: globalProcessingTime, // Add processing time t
                totalComics: comicsToProcess.length,
                successfulUpdates: successful,
                failedUpdates: results.length - successful,
                comics: statsCollection
            };
            
            try {
                const updateHistoryFolder = path.join(COMIC_OUTPUT_DIR, 'history');
                if (!fs.existsSync(updateHistoryFolder)) {
                    fs.mkdirSync(updateHistoryFolder, { recursive: true });
                }
                let statsFilePath = path.join(updateHistoryFolder, `update_${timeStampToDashedString(Date.now())}.json`);
                let existingVersions = 0;
                while (true) {
                    if (!fs.existsSync(statsFilePath)) {
                        break;
                    }
                    existingVersions++;
                    statsFilePath = path.join(updateHistoryFolder, `update_${new Date().toDateString()}-${existingVersions}.json`);
                }
                fs.writeFileSync(path.join(COMIC_OUTPUT_DIR, 'last-updates.json'), JSON.stringify(statsData, null, 2));
                fs.writeFileSync(statsFilePath, JSON.stringify(statsData, null, 2));
                console.log(`\nStatistics written to ${statsFilePath}`);
            } catch (error) {
                console.error(`Error writing statistics file: `, error);
            }

            // Print some aggregate statistics
            const totalChapters = statsCollection.reduce((sum, s) => sum + (s.totalChapters || 0), 0);
            const updatedChapters = statsCollection.reduce((sum, s) => sum + (s.updatedChapters || 0), 0);
            const totalImages = statsCollection.reduce((sum, s) => sum + (s.totalImages || 0), 0);

            console.log('\n===== Statistics =====');
            console.log(`Total chapters: ${totalChapters}`);
            console.log(`Updated chapters: ${updatedChapters}`);
            console.log(`Total images: ${totalImages}`);

            // Print detailed statistics for each comic
            console.log('\n===== Per-Comic Statistics =====');
            console.log('Title | Updated | Completed/Total | Remaining Images | Processing Time (s)');
            console.log('-----|---------|----------------|-----------------|----------------');

            statsCollection.forEach(comic => {
                const title = comic.title ? comic.title : comic.id;
                const updated = comic.updatedChapters || 0;
                const completed = comic.completed || 0;
                const total = comic.totalChapters || 0;
                const remaining = comic.remainingImages || 0;
                const taskTime = comic.processingTime || 0;

                console.log(`${title} | ${updated} | ${completed}/${total} | ${remaining} | ${taskTime}`);
            });

            // Print comics with remaining images
            const incompleteComics = statsCollection.filter(comic => (comic.remainingImages || 0) > 0);
            if (incompleteComics.length > 0) {
                console.log('\n===== Incomplete Comics =====');
                incompleteComics.forEach(comic => {
                    console.log(`${comic.title}: ${comic.remainingImages} images remaining`);
                });
            }
            
        }
    }

    // Run the main function if this script is executed directly
    if (require.main === module) {
        main().catch(error => {
            console.error('Error in main function:', error);
            process.exit(1);
        });
    }

} else {
    // Worker thread code - handles a single comic
    /**
     * Worker thread main function
     * Handles the archiving process for a single comic
     * 1. Checks if info.json exists and if archiveResult is valid
     * 2. Downloads the comic with appropriate incremental setting
     * 3. Creates CBZ files after successful download
     */
    async function workerMain() {
        const { comicId, comicPath, enableHighQuality, makeCbz: shouldMakeCbz } = workerData;
        const workerStartTime = Date.now();

        if (!fs.existsSync(comicPath)) {
            console.error(`Comic folder ${comicPath} does not exist, might got deleted on the fly`);
            parentPort.postMessage({ type: 'result', success: false, data: "Comic folder does not exist" });
            return;
        }
        
        try {
            // Check if info.json exists and if archiveResult is valid
            let useIncremental = true;
            const infoPath = path.join(comicPath, "info.json");
            const logPrefix = `[Comic ${comicPath.split('/').pop()}]`
            
            if (fs.existsSync(infoPath)) {
                try {
                    const infoData = JSON.parse(fs.readFileSync(infoPath));
                    // If archiveResult doesn't exist or is empty, start fresh
                    if (!infoData.archiveResult || 
                        Object.keys(infoData.archiveResult).length === 0 ||
                        !infoData.archiveResult.chapters) {
                        console.log("No valid archive result found, starting fresh download");
                        useIncremental = false;
                    } else {
                        console.log(logPrefix, "Found existing archive data, using incremental update");
                    }
                } catch (error) {
                    console.error(logPrefix, `Error parsing info.json: ${error.message}, starting fresh download`);
                    useIncremental = false;
                }
            } else {
                parentPort.postMessage({ type: 'log', data: "No info.json found, starting fresh download" });
                useIncremental = false;
            }
            
            // Use the archive function from comicArchiver.js with worker thread messaging
            console.log(logPrefix, `Starting archive process with incremental=${useIncremental}`);
            const success = await archive(comicId, path.dirname(comicPath), enableHighQuality, useIncremental, {
                isWorker: true,
                parentPort: parentPort,
                concurrency: IMAGE_CONCURRENCY
            });
            
            // Always create CBZ if download was successful
            if (success) {
                console.log(logPrefix, "Download completed successfully, creating CBZ files");
                try {
                    await makeCbz(comicPath, CBZ_OUTPUT_DIR, VOLUME_SPLIT_MULTIPLIER, true);
                    console.log(logPrefix, "CBZ creation completed successfully");
                } catch (error) {
                    console.error(logPrefix, `Error making CBZ: ${error.message}, probably due to no images`);
                }
            } else {
                console.error(logPrefix, "Download failed, skipping CBZ creation");
            }
            
            // Collect statistics from the info.json file
            let stats = {};
            if (fs.existsSync(infoPath)) {
                try {
                    const infoData = JSON.parse(fs.readFileSync(infoPath));
                    if (infoData.archiveResult) {
                        const archiveResult = infoData.archiveResult;
                        
                        // Calculate total chapters and images
                        const totalChapters = archiveResult.chapters.length;
                        const downloadedChapters = archiveResult.chapters.filter(c => c.downloaded).length;
                        const totalImages = archiveResult.chapters.reduce((sum, c) => sum + (c.successCount || 0), 0);
                        const totalExpectedImages = archiveResult.chapters.reduce((sum, c) => sum + (c.pageCount || 0), 0);
                        const remainingImages = totalExpectedImages - totalImages;
                        const updatedChapters = archiveResult.chapters.filter(c => c.isUpdated === true).length;
                        
                        // Calculate processing time from worker start to now
                        const processingTime = Math.round((Date.now() - workerStartTime) / 1000); // in seconds
                        
                        stats = {
                            id: comicId,
                            title: archiveResult.title,
                            updateTime: new Date().toISOString(),
                            totalChapters,
                            completed: downloadedChapters,
                            updatedChapters,
                            totalImages,
                            remainingImages,
                            processingTime,
                            success
                        };
                    }
                } catch (error) {
                    console.error(`Error collecting stats: `, error);
                }
            }
            
            parentPort.postMessage({ 
                type: 'result', 
                success: success,
                stats: stats,
                data: success ? "Comic downloaded and CBZ created successfully" : comicPath
            });
        } catch (error) {
            console.error(`Unhandled error in worker ${comicId}: `, error);
        }
    }

    // Start the worker
    workerMain().catch(error => {
        parentPort.postMessage({ type: 'error', data: error });
        parentPort.postMessage({ type: 'result', success: false, data: `Unhandled error: ${error.message}` });
    });
}