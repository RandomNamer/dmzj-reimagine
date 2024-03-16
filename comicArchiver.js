const { Axios } = require("axios");
const { exit } = require("process");
const { timestampToLocaleString, timeStampToDashedString } = require("./utils/date")
const fs = require("fs")
const path = require("path")

const { getComicDetail, getChapterDetail } = require("./comic");
const { arch } = require("os");

const id = 47971;
const outputDir = "/Users/zzy/Downloads/dmzj_comic/"
const ENABLE_HIGH_QUALITY = true

function findFolderById(directory, id) {
    const filesAndFolders = fs.readdirSync(directory);
    const folder = filesAndFolders.find(name => name.startsWith(id.toString()));
    return folder ? path.join(directory, folder) : null;
}

/**
 * TODO: 
 * 1. multi-threaded downloading
 * 2. Auto retry 2 times
 * 3. Maybe QPS?
 * 4. Quit condition: downloaded chapter, but file count does not meet
 * 5. Folder structure for compatible readers.
 */

async function archiveAll(id, rootDir, preferHighQuality = true) {
    exit(1);
}

async function increamentalArchive(id, workingDir, downloaded, preferHighQuality = true) {
    exit(1);
}


async function main(id) {
    const workingDir = findFolderById(outputDir, id);
    if (workingDir) {
        const infoPath = path.join(workingDir, "info.json");
        try {
            const downloadHistory = JSON.parse(fs.readFileSync(path.join(workingDir, "download_history.json")));
            if (!downloadHistory.downloaded || !downloadHistory.downloaded.length) {
                console.log("No downloaded chapters found, starting fresh");
                return;
            }
            //Ensured exit here
            increamentalArchive(id, workingDir, downloadHistory.downloaded, ENABLE_HIGH_QUALITY);
        } catch (error) {
            console.error("Error reading download history", error);
            console.log("No download history found, starting fresh");
        }
        archiveAll(id, outputDir, ENABLE_HIGH_QUALITY);
    } 

}