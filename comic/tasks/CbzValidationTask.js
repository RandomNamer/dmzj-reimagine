const fs = require('fs');
const path = require('path');
const { makeCbz } = require('../cbzMaker');

const COMIC_OUTPUT_DIR = "/Volumes/medialibrary/Books/Comic/dmzj/raw";
const CBZ_OUTPUT_DIR = "/Volumes/medialibrary/Books/Comic/dmzj/cbz";

async function triggerGenerateMissingCbz(folder) {
    if (ENABLE_IO) await makeCbz(folder, CBZ_OUTPUT_DIR, 1000, true)
}

async function validateComicCbz(comicFolder, cbzRoot) {
    const infoPath = path.join(comicFolder, 'info.json');
    if (!fs.existsSync(infoPath)) {
        console.log(`No info.json found in ${comicFolder}, skipping...`);
        return;
    }
    

    const localInfo = JSON.parse(fs.readFileSync(infoPath));
    const comicInfo = localInfo.comicInfo;
    // if (!localInfo || !comicInfo || !comicInfo.title) return null
    const cbzFolder = path.join(cbzRoot, comicInfo.title);
    const missingChapters = [];
    if (!comicInfo.chapters || comicInfo.chapters.length === 0) {
        console.log(`No chapters found in ${comicInfo.title}, skipping...`);
        return;
    }
    console.log(`Validating ${comicInfo.title} with id ${comicInfo.id}`)
    let requestArchiveResultUpdate = false;

    for (const volume of comicInfo.chapters) {
        const volumeFolder = path.join(comicFolder, volume.title);
        if (!fs.existsSync(volumeFolder)) continue;

        for (const chapter of volume.data.sort((a, b) => a.chapterOrder - b.chapterOrder)) {
            const chapterFolder = path.join(volumeFolder, chapter.chapterTitle);
            const chapterCbz = path.join(cbzFolder, `${volume.title} - ${chapter.chapterTitle}.cbz`);
            const linkedArchiveResult = localInfo.archiveResult.chapters.find(c => c.id == chapter.chapterId)
            

            // Check if chapter folder exists and has content
            if (!fs.existsSync(chapterFolder)) continue;
            const chapterFiles = fs.readdirSync(chapterFolder).filter(f => !f.endsWith('xml'));
            if (chapterFiles.length === 0) {
                console.log(`Empty folder: ${chapterFolder}`)
                continue;
            }

            // Check if CBZ exists and has correct size
            if (!fs.existsSync(chapterCbz)) {
                console.log(`Missing CBZ for chapter: ${volume.title} > ${chapter.chapterTitle} in ${comicInfo.title}`);
                missingChapters.push({
                    comicFolder,
                    chapterId: chapter.chapterId,
                    chapterTitle: chapter.chapterTitle
                });
                continue;
            }
            if (!linkedArchiveResult.cbzPath) {
                linkedArchiveResult.cbzPath = chapterCbz
                requestArchiveResultUpdate = true;
            }

            // // Compare sizes
            // const cbzStats = fs.statSync(chapterCbz);
            // const chapterStats = chapterFiles.reduce((total, file) => {
            //     return total + fs.statSync(path.join(chapterFolder, file)).size;
            // }, 0);

            // // [Disabled]If CBZ is significantly smaller than source files, mark for regeneration
            // if (cbzStats.size < chapterStats * 0.8) {
            //     console.log(`CBZ size mismatch for chapter: ${chapter.chapterTitle} in ${comicInfo.title}`);
            //     console.log(`CBZ size: ${cbzStats.size}, Chapter size: ${chapterStats}`);
            //     missingChapters.push({
            //         comicFolder,
            //         chapterId: chapter.chapterId,
            //         chapterTitle: chapter.chapterTitle
            //     });
            // }
        }
        
    }
    if (requestArchiveResultUpdate) {
        fs.writeFileSync(infoPath, JSON.stringify(localInfo, null, 2));
        console.log(`Updated archiveResult for ${comicInfo.title}`)
    }
    return missingChapters;
}

async function validateCbzFiles() {
    if (!fs.existsSync(COMIC_OUTPUT_DIR)) {
        console.error(`Comic output directory not found: ${COMIC_OUTPUT_DIR}`);
        return;
    }

    const comicFolders = fs.readdirSync(COMIC_OUTPUT_DIR)
        .filter(f => fs.statSync(path.join(COMIC_OUTPUT_DIR, f)).isDirectory());

    console.log(`Found ${comicFolders.length} comic folders to validate`);
    const allMissingChapters = [];

    for (const comicFolder of comicFolders) {
        const fullPath = path.join(COMIC_OUTPUT_DIR, comicFolder);
        const missingChapters = await validateComicCbz(fullPath, CBZ_OUTPUT_DIR);
        if (missingChapters && missingChapters.length > 0) {
            console.log(`Found ${missingChapters.length} chapters with missing or invalid CBZ files`);
            try {
                if (ENABLE_IO) await triggerGenerateMissingCbz(fullPath);
                console.log(`Generated CBZ for ${comicFolder}`);
            } catch (error) {
                console.error(`Error generating CBZ`, error);
            }
        }
    }

}

const ENABLE_IO = false
validateCbzFiles()

module.exports = { validateCbzFiles, validateComicCbz };