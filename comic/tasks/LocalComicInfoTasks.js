const COMIC_OUTPUT_DIR = "/Volumes/medialibrary/Books/Comic/dmzj/raw";
const exp = require('constants');
const fs = require('fs');
const path = require('path');

const ENABLE_IO = false

const getComicFolders = () => { return fs.readdirSync(COMIC_OUTPUT_DIR)
    .map(file => path.join(COMIC_OUTPUT_DIR, file))
    .filter(fullPath => fs.statSync(fullPath).isDirectory() && /^\d+_/.test(path.basename(fullPath)));
}

async function calibrateImageCounts(checkImageCounts = false) {
    const comicFolders = getComicFolders();

    let totalUpdated = 0;
    let totalChaptersCalibrated = 0;
    
    for (const comicFolder of comicFolders) {
        const infoPath = path.join(comicFolder, 'info.json');
        const imageUrlsPath = path.join(comicFolder, 'image_urls.json');
        
        if (!fs.existsSync(infoPath) || !fs.existsSync(imageUrlsPath)) {
            continue;
        }
        
        try {
            const infoData = JSON.parse(fs.readFileSync(infoPath));
            const imageUrlsData = JSON.parse(fs.readFileSync(imageUrlsPath));
            
            if (!infoData.archiveResult || !infoData.archiveResult.chapters) {
                continue;
            }
            
            const imageUrlsMap = new Map(imageUrlsData);
            let chapterUpdates = 0;
            
            infoData.archiveResult.chapters = infoData.archiveResult.chapters.map(chapter => {
                const chapterDetail = imageUrlsMap.get(chapter.id);
                if (!chapterDetail) return chapter;

                let updated = false;

                if (checkImageCounts || !chapter.successCount) {
                    if (!chapter.successCount) {
                        chapter.successCount = 0;
                    }
                    const imageFolder = path.join(comicFolder, chapter.volume, chapter.title);
                    if (!fs.existsSync(imageFolder)) {
                        fs.mkdirSync(imageFolder, { recursive: true });
                    }
                    const files = fs.readdirSync(imageFolder);
                    const imageCount = files.filter(file => /\.(jpg|jpeg|png)$/i.test(file)).length;
                    if (Math.abs(imageCount - chapter.successCount) > 1) {
                        console.log(`ImageCount inconsistent: ${imageFolder} > ${chapter.title}: successCount=${chapter.successCount}, actualImageCount=${imageCount}`);
                        chapter.successCount = imageCount;
                        updated = true;
                    }
                }
                
                const hdListSize = chapterDetail.pageUrlHd ? chapterDetail.pageUrlHd.length : 0;
                const sdListSize = chapterDetail.pageUrl ? chapterDetail.pageUrl.length : 0;
                
                // Set or correct pageCount based on the available image lists
                const expectedSize = chapter.isHighQuality ? hdListSize : sdListSize;

                if (chapter.pageCount == null || chapter.pageCount !== expectedSize) {
                    chapter.pageCount = expectedSize;
                    updated = true;
                }
                
                if (chapter.successCount - expectedSize > 2) {
                    console.log(`Anomaly detected in ${path.basename(comicFolder)} > ${chapter.title}:`);
                    console.log(` successCount=${chapter.successCount}, isHighQuality=${chapter.isHighQuality}, HD list=${hdListSize}, SD list=${sdListSize}`);
                    const altSize = Math.max(hdListSize, sdListSize);
                    const isHd = hdListSize > sdListSize
                    console.log(` successCount=${chapter.successCount}  altSize=${altSize} HQ=${isHd}`);
                    if (altSize >= chapter.successCount) {
                        console.log(`Using alternative size ${altSize} instead`);
                        chapter.isHighQuality = isHd
                        chapter.pageCount = altSize;
                        updated = true;
                    } else if ((chapter.successCount - altSize) > 2) {
                        const imageFolder = path.join(comicFolder, chapter.volume, chapter.title);
                        console.error(`${imageFolder} possible duplicate, do removal of downloaded`)
                        if(ENABLE_IO) fs.rmSync(imageFolder, { recursive: true, force: true });
                        chapter.successCount = 0;
                        chapter.downloaded = false;
                        updated = true;
                    }
                }

                const completed = (chapter.successCount >= chapter.pageCount);
                if (chapter.downloaded != completed) {
                    console.log(`update complete status from ${chapter.downloaded} to ${completed} for ${chapter.title}`);
                    chapter.downloaded = completed;
                    updated = true;
                }
                if (updated) {
                    chapterUpdates++;
                }
                return chapter;
            });
            
            if (chapterUpdates > 0) {
                if(ENABLE_IO) fs.writeFileSync(infoPath, JSON.stringify(infoData, null, 2));
                totalUpdated ++;
                totalChaptersCalibrated += chapterUpdates;
                console.log(`Updated ${chapterUpdates} chapters in ${path.basename(comicFolder)}`);
            }
            
        } catch (error) {
            console.error(`Error processing ${path.basename(comicFolder)}:`, error);
        }
    }
    
    console.log(`Updated ${totalUpdated} out of ${comicFolders.length}, calibrated ${totalChaptersCalibrated} chapters`);
}

function trimInt64FromChapterIds() {
    const comicFolders = getComicFolders();
    let totalUpdated = 0;
    let totalChaptersCalibrated = 0;

    for (const comicFolder of comicFolders) {
        const infoPath = path.join(comicFolder, 'info.json');
        if (!fs.existsSync(infoPath)) {
            continue;
        }
        try {
            const infoData = JSON.parse(fs.readFileSync(infoPath));
            if (!infoData.archiveResult ||!infoData.archiveResult.chapters) {
                continue;
            }
            let chapterUpdates = 0;
            infoData.archiveResult.chapters = infoData.archiveResult.chapters.map(chapter => {
                if (chapter.id && chapter.id.low != null) {
                    chapter.id = chapter.id.low;
                    chapterUpdates++;
                }
                return chapter;
            });
            if (chapterUpdates > 0) {
                if(ENABLE_IO) fs.writeFileSync(infoPath, JSON.stringify(infoData, null, 2));
                totalUpdated ++;
                totalChaptersCalibrated += chapterUpdates;
                console.log(`Updated ${chapterUpdates} chapters in ${path.basename(comicFolder)}`);
            }
        } catch (error) {
            console.error(`Error processing ${path.basename(comicFolder)}:`, error);
        }   
    }
    console.log(`Updated ${totalUpdated} out of ${comicFolders.length}, calibrated ${totalChaptersCalibrated} chapters`);
}


// trimInt64FromChapterIds();
calibrateImageCounts(true);

module.exports = {
    trimInt64FromChapterIds,
    calibrateImageCounts
};