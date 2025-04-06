const { js2xml } = require('xml-js');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { exec } = require('child_process')

const { timeStampToDateComponents} = require('../utils/date')

module.exports = { makeCbz }

function countFiles(dir) {
    let count = 0;
    const files = fs.readdirSync(dir);

    files.forEach((file) => {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
            count += countFiles(filePath);
        } else if (stats.isFile() && !file.endsWith('xml')) {
            count++;
        }
    });

    return count;
}

function composeMetadataXml(folder, comicInfo, chapterInfo, volumeSplitMultiplier = 0) {
    const {chapterName, volumeName, volumeOrdinal, chapterOrdinal, updatedAt} = chapterInfo
    const {year, month, day} = timeStampToDateComponents(updatedAt)
    let fileCount = countFiles(folder)
    const authorString = comicInfo.authors.map(author => author.tagName).join(', ')
    const genreString = comicInfo.types.map(tag => tag.tagName).join(', ')
    const statusString = comicInfo.status.map(tag => tag.tagName).join(', ')

    if (fileCount === 0) {
        console.log (`No files found in ${folder}, skipping cbz flow`)
        throw new Error(`No files found in ${folder}, should skipping cbz flow`)
    }

    let comicInfoXmlObj = {
        _declaration: {
            _attributes: {
                version: "1.0",
                encoding: "utf-8"
            }
        },
        ComicInfo: {
            Title: { _text: `${volumeName} ${chapterName}` },
            Series: { _text: comicInfo.title },
            Number: { _text: chapterOrdinal + volumeSplitMultiplier * Math.max(volumeOrdinal - 1, 0) }, //We want chapters starts from 1 not volumeOrdinal * multiplier + 1
            // Volume: { _text: volumeName },
            Summary: { _text: comicInfo.description },
            Year: { _text: year ? year : 1970},
            Month: { _text: month ? month : 1},
            Day: { _text: day ? day : 1},
            Writer: { _text:  authorString},
            Tags: { _text: statusString },
            Genre: { _text: genreString },
            Manga: {_text: "Yes"},
            PageCount: {_text: fileCount},
        },
        
    }
    let xml = js2xml(comicInfoXmlObj, {compact: true, spaces: 4})
    fs.writeFileSync(path.join(folder, 'ComicInfo.xml'), xml)
}

function compressDirectory(inputDir, outputFilePath, level = 9) {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outputFilePath);
        const archive = archiver('zip', {
            zlib: { level: level } // Level 9 is maximum compression
        });

        output.on('close', () => resolve(true));
        output.on('error', (err) => reject(err));

        archive.pipe(output);
        archive.directory(inputDir, false);
        archive.finalize();
    });
}
function compressDirectoryAlt(inputDir, outputFilePath, level = 0) {
    return new Promise((resolve, reject) => {
        exec(`cd \"${inputDir}\" && zip -${level}r \"${outputFilePath}\" ./`, (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                reject(error);
                return;
            }
            resolve(true);
        });
    });
}

/**
 * 
 * @param {string} comicFolder Folder containing comic images and `info.json`
 * @param {string} cbzRoot Root folder of all abz files, which is the comic library.
 * @param {number} volumeSplitMultiplier We need to flatten the volume > chapter structure. This value controls how we tweak the ordinal of the chapter to push the chapters of other volumes to another section, for example chapter 1 of volume 2 will be 1001. Default is 0, which means no split.
 */
async function makeCbz(comicFolder, cbzRoot, volumeSplitMultiplier = 0, updatesOnly = false) {
    
    let localInfo = JSON.parse(fs.readFileSync(path.join(comicFolder, 'info.json')))
    let comicInfo = localInfo.comicInfo
    let updatedChapters = localInfo.archiveResult.chapters.map(c => c.id.toString())
    if (localInfo.archiveResult.chapters[0].isUpdated != null) {
        updatedChapters = localInfo.archiveResult.chapters.filter(c => c.isUpdated).map(c => c.id.toString())
    }
    console.log(`Archive updated only: ${updatesOnly}, computed updated chapters: ${updatedChapters}`)
    let cbzFolder = path.join(cbzRoot, comicInfo.title)
    if (!fs.existsSync(cbzFolder)) {
        fs.mkdirSync(cbzFolder, {recursive: true})
    }
    let volumeNum = 0
    for (const volume of comicInfo.chapters) {
        let volumeFolder = path.join(comicFolder, volume.title)
        // let volumeCbz = path.join(cbzFolder, `${volume.title}.cbz`)
        if (!fs.existsSync(volumeFolder)) {
            fs.mkdirSync(volumeFolder, {recursive: true})
        }
        volumeNum += 1
        let chapterNum = 0
        for (let chapter of volume.data.sort((a, b) => a.chapterOrder - b.chapterOrder)) {
            chapterNum += 1
            let chapterFolder = path.join(volumeFolder, chapter.chapterTitle)
            // let chapterCbz = path.join(cbzFolder, volume.title, `${chapter.chapterTitle}.cbz`)
            let chapterCbz = path.join(cbzFolder, `${volume.title} - ${chapter.chapterTitle}.cbz`)
            if (fs.existsSync(chapterCbz)) {
                // Will write anyway if target cbz is not present
                if (updatesOnly && !updatedChapters.includes(chapter.chapterId.toString())) continue;
            }
            console.log(`Zipping ${chapter.chapterTitle} to ${chapterCbz}`)
            if (!fs.existsSync(chapterFolder)) {
                fs.mkdirSync(chapterFolder, {recursive: true})
            }
            try {
                composeMetadataXml(chapterFolder, comicInfo, {
                    chapterName: chapter.chapterTitle, 
                    volumeName: volume.title,
                    volumeOrdinal: volumeNum,
                    chapterOrdinal: chapterNum,
                    updatedAt: chapter.updatetime,
                }, volumeSplitMultiplier)
            } catch(e) {
                continue;
            }
            if (chapterNum === 1) {
                const coverFile = fs.readdirSync(comicFolder).find(f => f.includes('cover'))
                if (coverFile) {
                    console.log(`Copying ${coverFile} to first chapter to help Komga to find it correctly`)
                    fs.copyFileSync(path.join(comicFolder, coverFile), path.join(chapterFolder, `0.${path.extname(coverFile)}`))
                }
            }
            await compressDirectoryAlt(chapterFolder, chapterCbz, 1).then(() => {
                console.log(`Successfully zipped ${chapterCbz}`)
            }).catch(e => {
                console.error(`Error zipping ${chapterCbz} with ${e}`)
            })
        }
        // console.log(`Zipping ${volume.title} to ${volumeCbz}`)
        // composeMetadataXml(volumeFolder, comicInfo, volume.title)
        // fs.copyFileSync(path.join(comicFolder, 'cover.jpg'), path.join(volumeFolder, 'cover.jpg'))
        // compressDirectoryAlt(volumeFolder, volumeCbz, 1).then(() => {
        //     console.log(`Successfully zipped ${volume.title}.cbz`)
        // }).catch(e => {
        //     console.error(`Error zipping ${volume.title}.cbz with ${e}`)
        // })
    }  
}


