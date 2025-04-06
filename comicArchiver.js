const { DefaultAxiosProxy } = require('./utils/axios')

const { exit } = require("process");
const fs = require("fs")
const path = require("path")
const url = require("url")

const { getComicDetail, getChapterDetail, findComicFolderById, makeCbz } = require("./comic");
const { timestampToLocaleString } = require("./utils/date")


// const COMIC_ID = 54990; //no chapters
// const COMIC_ID = 40970; //May small chapters
// const COMIC_ID = 27430  ;  //May large chapters
// const COMIC_ID = 7020; //Yuru Yuri! Many chapters, many volumes, the holy grail of test case
// const COMIC_ID = 1218; //Possibly removed long ago
const COMIC_ID = 10121; //active

const COMIC_OUTPUT_DIR = "/Volumes/medialibrary/Books/Comic/dmzj/raw"
const CBZ_OUTPUT_DIR = "/Volumes/medialibrary/Books/Comic/dmzj/cbz"
const ENABLE_HIGH_QUALITY = true;
const PRINT_URL_THRESH_REDOWNLOAD = 10; //Batch downloading of many images may fail several, print URL when download failed less than this number
const VOLUME_SPLIT_MULTIPLIER = 1000; // Larger than possible chapter count in a volume of a comic
const SUPPRESS_UPSTREAM_ERROR = false; //TODO: implement this


module.exports = { COMIC_ID, COMIC_OUTPUT_DIR, archive, downloadChapterImages, downloadImage }

/**
 * 
 * @param {string} url 
 * @param {string} folder
 * @returns {Promise<Boolean>} 
 */
async function downloadImage(imageUrl, folder, maxRetries = 0, redownload = false, forceImageName=null, verbose = false) {
    let retries = maxRetries;
    redownload = false;
    const parsedUrl = decodeURIComponent(imageUrl);
    let imageName = path.basename(parsedUrl);
    if(forceImageName) {
        const ext = path.extname(imageName);
        imageName = `${forceImageName}${ext}`;
    }
    const imagePath = path.join(folder, imageName)
    if (!redownload && fs.existsSync(imagePath) && fs.statSync(imagePath).size > 0) return true;
    // if (verbose) console.log(`Downloading image ${imageName} from ${imageUrl} to ${folder}`)
    do {
        try {
            const response = await DefaultAxiosProxy.get(
                imageUrl, 
                {
                    responseType: 'stream',
                }
            );

            const writer = fs.createWriteStream(path.join(folder, imageName));

            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', () => resolve(true));
                writer.on('error', () =>{
                    if (verbose) console.error(`Error writing to file ${filePath}`);
                    reject(false);
                });
            });

            return true;
        } catch (error) {
            // if (verbose) console.error(`Failed to download image. Retries left: ${retries - 1}`, imageUrl, error);
            retries--;
        }
    } while (retries > 0);
    console.error(`Failed to download image after ${maxRetries} retries: ${imageUrl}`);
    return false;
}

/**
 * @param {boolean} redownload If enabled, all previously downloaded images will be fetched again.
 * @param {number} concurrency Maximum number of concurrent downloads
 * @returns {Promise<number>} successCount
 */
async function downloadChapterImages(imageList, folder, retries, redownload = false, verbose = false, concurrency = -1) {
    if (concurrency <= 1) {
        return downloadChapterImagesAtOnce(imageList, folder, retries, redownload, verbose);
    }
    const results = [];
    let successCount = 0;
    
    // Process in batches to limit concurrency
    for (let i = 0; i < imageList.length; i += concurrency) {
        const batch = imageList.slice(i, i + concurrency);
        const downloadPromises = batch.map((imageUrl) => {
            return downloadImage(imageUrl, folder, retries, redownload, false, verbose);
        });

        const batchResults = await Promise.all(downloadPromises);
        results.push(...batchResults);
        
        // Update success count for this batch
        const batchSuccessCount = batchResults.reduce((acc, cur) => cur ? acc + 1 : acc, 0);
        successCount += batchSuccessCount;
    }
    
    return successCount;
}

async function downloadChapterImagesAtOnce(imageList, folder, retries, redownload = false, verbose = false) {
    const downloadPromises = imageList.map((imageUrl, index) => {
        return downloadImage(imageUrl, folder, retries, redownload, false, verbose);
    });

    //If some images failed, consider this chapter is failed and won't be recorded as downloaded.
    const results = await Promise.all(downloadPromises);
    const successCount = results.reduce((acc, cur) => cur ? acc + 1 : acc, 0)
    return successCount;
}

// async function archiveAll(id, rootDir, preferHighQuality = true) {
//     let comicInfo = await getComicDetail(id);
//     if (!comicInfo || !comicInfo.id) {
//         console.error("Error getting comic detail");
//         return;
//     }
//     console.log("Got comic info of", comicInfo.title);
//     console.log(`Updated at ${new Date(comicInfo.lastUpdatetime * 1000).toLocaleString()}, lateste chapter: ${comicInfo.lastUpdateChapterName}, chapterCount: ${comicInfo.chapters.map(v => v.data.length)}`);
//     const workingDir = path.join(rootDir, `${comicInfo.id}_${comicInfo.title}`);
//     if (!fs.existsSync(workingDir)) {
//         fs.mkdirSync(workingDir);
//     }
//     let archiveResult = {
//         id: comicInfo.id,
//         title: comicInfo.title,
//         time: Math.floor(new Date().getTime()),
//         chapters: new Map()
//     }
//     let chapterDetailsCache = new Map()
//     for (volume of comicInfo.chapters) {
//         const volumeDir = path.join(workingDir, volume.title);
//         if (!fs.existsSync(volumeDir)) {
//             fs.mkdirSync(volumeDir);
//         }
//         //Sort chapters increasing order, for incremental we do it reversely
//         for (chapter of volume.data.sort((a, b) => a.chapterOrder - b.chapterOrder)) {
//             const chapterDir = path.join(volumeDir, chapter.chapterTitle);
//             if (!fs.existsSync(chapterDir)) {
//                 fs.mkdirSync(chapterDir);
//             }
//             let chapterDetail = await getChapterDetail(comicInfo.id, chapter.chapterId);
            
//             if (!chapterDetail) {
//                 console.error(`Error getting chapter detail for ${chapter.chapterTitle}`);
//                 continue;
//             }
//             chapterDetail.fetchTime = Math.floor(new Date().getTime());
//             chapterDetailsCache.set(chapterDetail.chapterId, chapterDetail);

//             const imageList = (preferHighQuality && chapterDetail.pageUrlHd) ? chapterDetail.pageUrlHd : chapterDetail.pageUrl;
            
//             const successCount = await downloadChapterImages(imageList, chapterDir, 2, false);
            
//             const imageCount = chapterDetail.picnum ? chapterDetail.picnum : imageList.length;

//             console.log(`Downloaded ${successCount} of ${imageCount} images of ${volume.title} > ${chapter.chapterTitle}`) 
//             archiveResult.chapters.set(
//                 chapter.chapterId, 
//                 {
//                     id: chapter.chapterId,
//                     title: chapter.chapterTitle,
//                     volume: volume.title,
//                     time: Math.floor(new Date().getTime()),
//                     downloaded: successCount == chapterDetail.picnum,
//                     successCount: successCount
//                 }
//             )
//         }
//     }
//     archiveResult.chapters = Array.from(archiveResult.chapters.values());
//     console.log("Finished archiving all chapters:", archiveResult.chapters.map(c => {return JSON.stringify({ title: c.title, total: c.picnum, success: c.successCount}) }) );
//     const infoPath = path.join(workingDir, "info.json");
//     const imageUrlsPath = path.join(workingDir, "image_urls.json");
//     fs.writeFileSync(infoPath, JSON.stringify({
//         comicInfo: comicInfo,
//         archiveResult: archiveResult
//     }));
//     fs.writeFileSync(imageUrlsPath, JSON.stringify(Array.from(chapterDetailsCache.entries())));
//     console.log("Done")
// }

// async function increamentalArchive(id, workingDir, preferHighQuality = true) {
//     let comicInfo = await getComicDetail(id);
//     if (!comicInfo) {
//         console.error("Error getting comic detail");
//         return;
//     }
//     let archiveResult = JSON.parse(fs.readFileSync(path.join(workingDir, "info.json"))).archiveResult;
//     let imageListCache = JSON.parse(fs.readFileSync(path.join(workingDir, "image_urls.json")));
//     //If something not downloaded last time and the comic doesn't have new chapters, we can reuse the cache.
//     const useImageUrlCache = (imageListCache && archiveResult.time >= comicInfo.lastUpdatetime);
//     let chapterDetailsCache = imageListCache ? new Map(imageListCache) : new Map();
//     if (archiveResult && archiveResult.id == comicInfo.id) {
//         archiveResult.chapters = new Map(archiveResult.chapters.map(chap => [chap.id, chap]));
//         console.log("Starting incremental archive");
//         for (volume of comicInfo.chapters) {
//             const volumeDir = path.join(workingDir, volume.title);
//             if (!fs.existsSync(volumeDir)) {
//                 fs.mkdirSync(volumeDir);
//             }
//             for (chapter of volume.data.sort((a, b) => b.chapterOrder - a.chapterOrder)) {
//                 const chapterDir = path.join(volumeDir, chapter.chapterTitle);
//                 if (!fs.existsSync(chapterDir)) {
//                     fs.mkdirSync(chapterDir);
//                 }

//                 //Use imageList cache if available
//                 //process of long chapterId:
//                 chapter.chapterId = chapter.chapterId.toNumber();
//                 const cachedDetail = chapterDetailsCache.get(chapter.chapterId);
//                 let chapterDetail;
//                 if (useImageUrlCache && cachedDetail) {
//                     chapterDetail = cachedDetail;
//                 } else {
//                     chapterDetail = await getChapterDetail(comicInfo.id, chapter.chapterId);
//                     chapterDetail.fetchTime = Math.floor(new Date().getTime());
//                     chapterDetailsCache.set(chapterDetail.chapterId, chapterDetail);
//                 }

//                 if (!chapterDetail) {
//                     console.error(`Error getting chapter detail for ${chapter.chapterTitle}`);
//                     continue;
//                 }

//                 const imageList = (preferHighQuality && chapterDetail.pageUrlHd) ? chapterDetail.pageUrlHd : chapterDetail.pageUrl;
                
//                 const imageCount = chapterDetail.picnum ? chapterDetail.picnum : imageList.length; //Sometimes picnum is not available

//                //Update chapter detail first to keep urls list to be the latest
//                 const prevChapterResult = archiveResult.chapters.get(chapter.chapterId);
//                 if (prevChapterResult && prevChapterResult.downloaded &&
//                      prevChapterResult.successCount == imageCount //just fail safe
//                 ) {
//                     console.log(`Chapter ${chapter.chapterTitle} already downloaded, skipping`);
//                     continue;
//                 }

//                 const successCount = await downloadChapterImages(imageList, chapterDir, 2, false);
//                 console.log(`Downloaded ${successCount} of ${chapterDetail.picnum} images of ${chapter.chapterTitle}`) 
//                 archiveResult.chapters.set(
//                     chapter.chapterId, 
//                     {
//                         id: chapter.chapterId,
//                         title: chapter.chapterTitle,
//                         volume: volume.title,
//                         time: Math.floor(new Date().getTime()),
//                         downloaded: successCount == chapterDetail.picnum,
//                         successCount: successCount
//                     }
//                 )
//             }
        
//         }
//         archiveResult.chapters = Array.from(archiveResult.chapters.values());
//         console.log("Finished archiving all chapters:", archiveResult.chapters.map(c => {return JSON.stringify({ title: c.title, total: c.picnum, success: c.successCount}) }) );

//         const infoPath = path.join(workingDir, "info.json");
//         const imageUrlsPath = path.join(workingDir, "image_urls.json");
//         fs.writeFileSync(infoPath, JSON.stringify({
//             comicInfo: comicInfo,
//             archiveResult: archiveResult
//         }));
//         fs.writeFileSync(imageUrlsPath, JSON.stringify(Array.from(chapterDetailsCache.entries())));
//         downloadImage(comicInfo.cover, workingDir, 2, false, "cover", true);
//         console.log("Done")
//     } else {
//         console.log("Archive result not found or id mismatch, starting fresh");
//         archiveAll(id, path.dirname(workingDir), preferHighQuality);
//     }
// }

/**
 * Archive a comic with its chapters
 * @param {number} id Comic ID
 * @param {string} rootDir Root directory for comics
 * @param {boolean} preferHighQuality Whether to prefer high quality images
 * @param {boolean} incremental Whether to do an incremental update
 * @param {Object} options Additional options
 * @param {boolean} options.isWorker Whether this is running in a worker thread
 * @param {Object} options.parentPort Worker thread parent port for messaging
 * @param {number} options.concurrency Maximum number of concurrent downloads per chapter
 * @returns {Promise<boolean>} Whether the operation was successful
 */
async function archive(id, rootDir, preferHighQuality = true, incremental = false, options = {}) {
    const { isWorker = false, parentPort = null, concurrency = -1 } = options;
    let comicInfo = await getComicDetail(id);
    if (!comicInfo || !comicInfo.id) {
        const errorMsg = `Error getting comic detail for ID ${id}`;
        if (isWorker && parentPort) {
            parentPort.postMessage({ type: 'error', data: errorMsg });
        } else {
            console.error(errorMsg);
        }
        return false;
    }

    const logPrefix = `[Comic ${id}_${comicInfo.title}] `;

    console.log(`${logPrefix}Got comic info of ${comicInfo.title}`);
    
    console.log(`${logPrefix}Updated at ${timestampToLocaleString(comicInfo.lastUpdatetime)}, latest chapter: ${comicInfo.lastUpdateChapterName}, chapterCount: ${comicInfo.chapters.map(v => v.data.length)}`);

    const workingDir = path.join(rootDir, `${comicInfo.id}_${comicInfo.title}`);
    if (!fs.existsSync(workingDir)) {
        fs.mkdirSync(workingDir, { recursive: true });
    }

    let archiveResult = {
        id: comicInfo.id,
        title: comicInfo.title,
        time: Math.floor(Date.now() / 1000),
        chapters: new Map()
    }

    let chapterDetailsCache = new Map();
    let useImageUrlCache = false;
    if (incremental) {
        try {
            const infoPath = path.join(workingDir, "info.json");
            if (fs.existsSync(infoPath)) {
                archiveResult = JSON.parse(fs.readFileSync(infoPath)).archiveResult;
                if (archiveResult && archiveResult.id == comicInfo.id) {
                    console.log(`${logPrefix}Starting incremental archive for ${comicInfo.title}`);
                } else {
                    console.log(`${logPrefix}Archive result not found or ID mismatch, starting fresh`);
                    return await archive(id, rootDir, preferHighQuality, false, options);
                }
                
                const imageUrlsPath = path.join(workingDir, "image_urls.json");
                if (fs.existsSync(imageUrlsPath)) {
                    let imageListCache = JSON.parse(fs.readFileSync(imageUrlsPath));
                    useImageUrlCache = (imageListCache && archiveResult.time >= comicInfo.lastUpdatetime);
                    chapterDetailsCache = imageListCache ? new Map(imageListCache) : new Map();
                }
                
                archiveResult.chapters = new Map(archiveResult.chapters.map(chap => {
                    Object.assign(chap, {isUpdated: false});
                    return [chap.id, chap];
                }));
                
            } else {
                console.log(`${logPrefix}No info.json found, starting fresh`);
                return await archive(id, rootDir, preferHighQuality, false, options);
            }
        } catch (error) {
            console.error(`${logPrefix}Error reading archive info: ${error.message}`);
            return await archive(id, rootDir, preferHighQuality, false, options);
        }
    }

    for (const volume of comicInfo.chapters) {
        const volumeDir = path.join(workingDir, volume.title);
        if (!fs.existsSync(volumeDir)) {
            fs.mkdirSync(volumeDir, { recursive: true });
        }

        for (const chapter of volume.data.sort((a, b) => a.chapterOrder - b.chapterOrder)) {
            const chapterDir = path.join(volumeDir, chapter.chapterTitle);
            if (!fs.existsSync(chapterDir)) {
                fs.mkdirSync(chapterDir, { recursive: true });
            }

            let chapterDetail;
            chapter.chapterId = chapter.chapterId.toNumber();
            const cachedDetail = chapterDetailsCache.get(chapter.chapterId);
            if (incremental && useImageUrlCache && cachedDetail) {
                chapterDetail = cachedDetail;
            } else {
                chapterDetail = await getChapterDetail(comicInfo.id, chapter.chapterId);
                if (chapterDetail == null) {
                    if (!SUPPRESS_UPSTREAM_ERROR) {
                        console.error(`${logPrefix}Error getting chapter detail, skipping ${volume.title} > ${chapter.chapterTitle}`);
                    }
                    continue;
                }
                chapterDetail.fetchTime = Math.floor(Date.now() / 1000);
                chapterDetailsCache.set(chapterDetail.chapterId, chapterDetail);
            }

            if (!chapterDetail) {
                if (!SUPPRESS_UPSTREAM_ERROR) {
                    console.error(`${logPrefix}Error getting chapter detail for ${chapter.chapterTitle}`);
                }
                continue;
            }
            
            let doSelectHighQuality = preferHighQuality === true && chapterDetail.pageUrlHd != null;
            const imageList = 
                (doSelectHighQuality ? chapterDetail.pageUrlHd : chapterDetail.pageUrl) 
                    ?? chapterDetail.pageUrlHd 
                    ?? chapterDetail.pageUrl 
                    ?? [];
            // const imageCount = chapterDetail.picnum ? chapterDetail.picnum : imageList.length;
            let imageCount = imageList.length;    //Sometimes picnum is not available or not accurate if worse

            //Update chapter detail first to keep urls list to be the latest
            const prevChapterResult = archiveResult.chapters.get(chapter.chapterId);
            let logImageUrlWhenDownload = false;
            if (prevChapterResult) {
                // if (prevChapterResult.isHighQuality === false && doSelectHighQuality == true) {
                //     console.log(`${logPrefix}Will upgrade quality for ${volume.title} > ${chapter.chapterTitle}, removing prev download`);
                //     prevChapterResult.downloaded = false;
                //     fs.rmSync(chapterDir, {recursive: true});
                //     fs.mkdirSync(chapterDir, { recursive: true });
                // }
                if (prevChapterResult.title != chapter.chapterTitle || prevChapterResult.volume!= volume.title) {
                    console.log(`prev result inconsistency hit, will ignore result`)
                    prevChapterResult.downloaded = false;
                }
                if (prevChapterResult.downloaded && 
                    prevChapterResult.successCount == imageCount
                ) {
                    if (!isWorker) console.log(`${logPrefix}Skipping ${volume.title} > ${chapter.chapterTitle} as it's already downloaded`);
                    continue;    
                }
                if ( imageCount - prevChapterResult.successCount < PRINT_URL_THRESH_REDOWNLOAD) {
                    logImageUrlWhenDownload = true;
                }
            }

            const downloadVerboseLogging = logImageUrlWhenDownload && true;

            let successCount = await downloadChapterImages(imageList, chapterDir, 2, false, downloadVerboseLogging, concurrency);

            console.log(`${logPrefix}Downloaded ${successCount} of ${imageCount} images of ${volume.title} > ${chapter.chapterTitle}`);
            
            if (successCount < 1) {
                console.log(`${logPrefix}Failed to download any images, trying another quality`);
                const alternativeImageList = doSelectHighQuality ? chapterDetail.pageUrl : chapterDetail.pageUrlHd;
                if (!alternativeImageList) {
                    console.log(`${logPrefix}No alternative quality found, skipping ${volume.title} > ${chapter.chapterTitle}`);
                    continue;
                }
                imageCount = alternativeImageList.length;
                successCount = await downloadChapterImages(alternativeImageList, chapterDir, 2, false, downloadVerboseLogging, concurrency);
                console.log(`${logPrefix}Downloaded ${successCount} of ${imageCount} images of ${volume.title} > ${chapter.chapterTitle} with alternative quality`);
                doSelectHighQuality = !doSelectHighQuality;
            }

            archiveResult.chapters.set(
                chapter.chapterId,
                {
                    id: chapter.chapterId,
                    title: chapter.chapterTitle,
                    volume: volume.title,
                    time: Math.floor(Date.now() / 1000),
                    downloaded: successCount >= imageCount,
                    pageCount: imageCount,
                    successCount: successCount,
                    isHighQuality: doSelectHighQuality,
                    isUpdated: true
                }
            )
        }
    }

    archiveResult.chapters = Array.from(archiveResult.chapters.values());
    archiveResult.time = Math.floor(Date.now() / 1000);
    console.log(`${logPrefix}Finished archiving all chapters`);

    fs.writeFileSync(path.join(workingDir, "info.json"), JSON.stringify({
        contentUpdatedAt: timestampToLocaleString(comicInfo.lastUpdatetime),
        comicInfo: comicInfo,
        archiveResult: archiveResult
    }, null, 2));
    fs.writeFileSync(path.join(workingDir, "image_urls.json"), JSON.stringify(Array.from(chapterDetailsCache.entries())));
    
    await downloadImage(comicInfo.cover, workingDir, 2, false, "cover", true);
    console.log(`${logPrefix}Comic archive completed successfully`);
    return true
}



async function main() {
    const workingDir = findComicFolderById(COMIC_OUTPUT_DIR, COMIC_ID);
    if (workingDir) {
        const infoPath = path.join(workingDir, "info.json");
        try {
            // Existing data check
            const info = JSON.parse(fs.readFileSync(infoPath));
            if (!info.archiveResult) {
                throw new Error("No archive result found");
            }
        } catch (error) {
            console.error("Error reading download history", error);
            console.log("No download history found, starting fresh");
            // archiveAll(COMIC_ID, COMIC_OUTPUT_DIR, ENABLE_HIGH_QUALITY);
            return await archive(COMIC_ID, COMIC_OUTPUT_DIR, ENABLE_HIGH_QUALITY, false);
        }

        //Ensured exit here
        // increamentalArchive(COMIC_ID, workingDir, ENABLE_HIGH_QUALITY);
        return await archive(COMIC_ID, COMIC_OUTPUT_DIR, ENABLE_HIGH_QUALITY, true);
    } else {
        // archiveAll(COMIC_ID, COMIC_OUTPUT_DIR, ENABLE_HIGH_QUALITY);
        return await archive(COMIC_ID, COMIC_OUTPUT_DIR, ENABLE_HIGH_QUALITY, false);
    }
}

// Only run the main function if this script is executed directly (not imported)
if (require.main === module) {
    main().then((result) => {
        console.log(`Update done ${result}, making cbz...`);
        if (result) {
            makeCbz(findComicFolderById(COMIC_OUTPUT_DIR, COMIC_ID), CBZ_OUTPUT_DIR, VOLUME_SPLIT_MULTIPLIER, true).then(() => {    
                console.log("CBZ done");
                exit(0);
            }).catch(e => {
                console.error("Error making cbz", e);
                exit(1);
            });
        }
       
    }).catch(e => {
        console.error("Error syncing comic with local:", e);
        exit(1);
    });
}

// makeCbz(findComicFolderById(COMIC_OUTPUT_DIR, COMIC_ID), CBZ_OUTPUT_DIR)