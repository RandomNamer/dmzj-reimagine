const { DefaultAxiosProxy } = require('./utils/axios')

const { exit } = require("process");
const fs = require("fs")
const path = require("path")
const url = require("url")

const { getComicDetail, getChapterDetail, COMIC_DEFAULT_UA, findComicFolderById, makeCbz } = require("./comic");
const { arch } = require("os");
const { info } = require('console');

const COMIC_ID = 47971;
const COMIC_OUTPUT_DIR = "/Volumes/medialibrary/Books/Comic/dmzj/raw"
const CBZ_OUTPUT_DIR = "/Volumes/medialibrary/Books/Comic/dmzj/cbz"
const ENABLE_HIGH_QUALITY = true



module.exports = { findComicFolderById , COMIC_ID, COMIC_OUTPUT_DIR }

/**
 * 
 * @param {string} url 
 * @param {string} folder
 * @returns {Promise<>} 
 */
async function downloadImage(imageUrl, folder, retries = 0, redownload = false, forceImageName=null, verbose = false) {
    const parsedUrl = decodeURIComponent(imageUrl);
    let imageName = path.basename(parsedUrl);
    if(forceImageName) {
        const ext = path.extname(imageName);
        imageName = `${forceImageName}${ext}`;
    }
    const imagePath = path.join(folder, imageName)
    if (!redownload && fs.existsSync(imagePath) && fs.statSync(imagePath).size > 0) return true;
    if (verbose) console.log(`Downloading image ${imageName} from ${imageUrl}`)
    do {
        try {
            const response = await DefaultAxiosProxy.get(
                imageUrl, 
                {
                    responseType: 'stream',
                    headers: {
                        'User-Agent': COMIC_DEFAULT_UA
                    }
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
            console.error(`Failed to download image. Retries left: ${retries - 1}`, imageUrl, error);
            retries--;
        }
    } while (retries > 0);
    return false;
}

/**
 * @param {boolean} redownload If enabled, all previously downloaded images will be fetched again.
 * @returns {Promise<number>} successCount
 */
async function downloadChapterImages(imageList, folder, retries, redownload = false, verbose = false) {
    const downloadPromises = imageList.map((imageUrl, index) => {
        return downloadImage(imageUrl, folder, retries, redownload, verbose=verbose);
    });

    //If some images failed, consider this chapter is failed and won't be recorded as downloaded.
    const results = await Promise.all(downloadPromises);
    const successCount = results.reduce((acc, cur) => cur ? acc + 1 : acc, 0)
    return successCount;
}

async function archiveAll(id, rootDir, preferHighQuality = true) {
    let comicInfo = await getComicDetail(id);
    if (!comicInfo) {
        console.error("Error getting comic detail");
        return;
    }
    console.log("Got comic info of", comicInfo.title);
    const workingDir = path.join(rootDir, `${comicInfo.id}_${comicInfo.title}`);
    if (!fs.existsSync(workingDir)) {
        fs.mkdirSync(workingDir);
    }
    let archiveResult = {
        id: comicInfo.id,
        title: comicInfo.title,
        time: Math.floor(new Date().getTime()),
        chapters: new Map()
    }
    let chapterDetailsCache = new Map()
    for (volume of comicInfo.chapters) {
        const volumeDir = path.join(workingDir, volume.title);
        if (!fs.existsSync(volumeDir)) {
            fs.mkdirSync(volumeDir);
        }
        //Sort chapters increasing order, for incremental we do it reversely
        for (chapter of volume.data.sort((a, b) => a.chapterOrder - b.chapterOrder)) {
            const chapterDir = path.join(volumeDir, chapter.chapterTitle);
            if (!fs.existsSync(chapterDir)) {
                fs.mkdirSync(chapterDir);
            }
            let chapterDetail = await getChapterDetail(comicInfo.id, chapter.chapterId);
            
            if (!chapterDetail) {
                console.error(`Error getting chapter detail for ${chapter.chapterTitle}`);
                continue;
            }
            chapterDetail.fetchTime = Math.floor(new Date().getTime());
            chapterDetailsCache.set(chapterDetail.chapterId, chapterDetail);

            const imageList = (preferHighQuality && chapterDetail.pageUrlHd) ? chapterDetail.pageUrlHd : chapterDetail.pageUrl;
            
            const successCount = await downloadChapterImages(imageList, chapterDir, 2, false);

            console.log(`Downloaded ${successCount} of ${chapterDetail.picnum} images of ${volume.title} > ${chapter.chapterTitle}`) 
            archiveResult.chapters.set(
                chapter.chapterId, 
                {
                    id: chapter.chapterId,
                    title: chapter.chapterTitle,
                    volume: volume.title,
                    time: Math.floor(new Date().getTime()),
                    downloaded: successCount == chapterDetail.picnum,
                    successCount: successCount
                }
            )
        }
    }
    archiveResult.chapters = Array.from(archiveResult.chapters.values());
    console.log("Finished archiving all chapters:", archiveResult.chapters.map(c => {return JSON.stringify({ title: c.title, total: c.picnum, success: c.successCount}) }) );
    const infoPath = path.join(workingDir, "info.json");
    const imageUrlsPath = path.join(workingDir, "image_urls.json");
    fs.writeFileSync(infoPath, JSON.stringify({
        comicInfo: comicInfo,
        archiveResult: archiveResult
    }));
    fs.writeFileSync(imageUrlsPath, JSON.stringify(Array.from(chapterDetailsCache.entries())));
    console.log("Done")
}

async function increamentalArchive(id, workingDir, preferHighQuality = true) {
    let comicInfo = await getComicDetail(id);
    if (!comicInfo) {
        console.error("Error getting comic detail");
        return;
    }
    let archiveResult = JSON.parse(fs.readFileSync(path.join(workingDir, "info.json"))).archiveResult;
    let imageListCache = JSON.parse(fs.readFileSync(path.join(workingDir, "image_urls.json")));
    //If something not downloaded last time and the comic doesn't have new chapters, we can reuse the cache.
    const useImageUrlCache = (imageListCache && archiveResult.time >= comicInfo.lastUpdatetime);
    let chapterDetailsCache = imageListCache ? new Map(imageListCache) : new Map();
    if (archiveResult && archiveResult.id == comicInfo.id) {
        archiveResult.chapters = new Map(archiveResult.chapters.map(chap => [chap.id, chap]));
        console.log("Starting incremental archive");
        for (volume of comicInfo.chapters) {
            const volumeDir = path.join(workingDir, volume.title);
            if (!fs.existsSync(volumeDir)) {
                fs.mkdirSync(volumeDir);
            }
            for (chapter of volume.data.sort((a, b) => b.chapterOrder - a.chapterOrder)) {
                const chapterDir = path.join(volumeDir, chapter.chapterTitle);
                if (!fs.existsSync(chapterDir)) {
                    fs.mkdirSync(chapterDir);
                }

                //Use imageList cache if available
                //process of long chapterId:
                chapter.chapterId = chapter.chapterId.toNumber();
                const cachedDetail = chapterDetailsCache.get(chapter.chapterId);
                let chapterDetail;
                if (useImageUrlCache && cachedDetail) {
                    chapterDetail = cachedDetail;
                } else {
                    chapterDetail = await getChapterDetail(comicInfo.id, chapter.chapterId);
                    chapterDetail.fetchTime = Math.floor(new Date().getTime());
                    chapterDetailsCache.set(chapterDetail.chapterId, chapterDetail);
                }

                if (!chapterDetail) {
                    console.error(`Error getting chapter detail for ${chapter.chapterTitle}`);
                    continue;
                }

               //Update chapter detail first to keep urls list to be the latest
                const prevChapterResult = archiveResult.chapters.get(chapter.chapterId);
                if (prevChapterResult && prevChapterResult.downloaded &&
                     prevChapterResult.successCount == chapterDetail.picnum //just fail safe
                ) {
                    console.log(`Chapter ${chapter.chapterTitle} already downloaded, skipping`);
                    continue;
                }

                const imageList = (preferHighQuality && chapterDetail.pageUrlHd) ? chapterDetail.pageUrlHd : chapterDetail.pageUrl;
                
                const successCount = await downloadChapterImages(imageList, chapterDir, 2, false);
                console.log(`Downloaded ${successCount} of ${chapterDetail.picnum} images of ${chapter.chapterTitle}`) 
                archiveResult.chapters.set(
                    chapter.chapterId, 
                    {
                        id: chapter.chapterId,
                        title: chapter.chapterTitle,
                        volume: volume.title,
                        time: Math.floor(new Date().getTime()),
                        downloaded: successCount == chapterDetail.picnum,
                        successCount: successCount
                    }
                )
            }
        
        }
        archiveResult.chapters = Array.from(archiveResult.chapters.values());
        console.log("Finished archiving all chapters:", archiveResult.chapters.map(c => {return JSON.stringify({ title: c.title, total: c.picnum, success: c.successCount}) }) );

        const infoPath = path.join(workingDir, "info.json");
        const imageUrlsPath = path.join(workingDir, "image_urls.json");
        fs.writeFileSync(infoPath, JSON.stringify({
            comicInfo: comicInfo,
            archiveResult: archiveResult
        }));
        fs.writeFileSync(imageUrlsPath, JSON.stringify(Array.from(chapterDetailsCache.entries())));
        downloadImage(comicInfo.cover, workingDir, 2, false, "cover", true);
        console.log("Done")
    } else {
        console.log("Archive result not found or id mismatch, starting fresh");
        archiveAll(id, path.dirname(workingDir), preferHighQuality);
    }
}


async function main() {
    const workingDir = findComicFolderById(COMIC_OUTPUT_DIR, COMIC_ID);
    if (workingDir) {
        const infoPath = path.join(workingDir, "info.json");
        try {
            const info = JSON.parse(fs.readFileSync(infoPath));
            if (!info.archiveResult) {
                console.log("No downloaded chapters found, starting fresh");
                return;
            }
            //Ensured exit here
            increamentalArchive(COMIC_ID, workingDir, ENABLE_HIGH_QUALITY);
            return;
        } catch (error) {
            console.error("Error reading download history", error);
            console.log("No download history found, starting fresh");
        }
    } 
    archiveAll(COMIC_ID, COMIC_OUTPUT_DIR, ENABLE_HIGH_QUALITY);
    return;
}

// main()
makeCbz(findComicFolderById(COMIC_OUTPUT_DIR, COMIC_ID), CBZ_OUTPUT_DIR)