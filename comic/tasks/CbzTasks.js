const fs = require("fs")
const path = require("path")
const { findComicFolderById, makeCbz } = require("../index");

const COMIC_OUTPUT_DIR = "/Volumes/medialibrary/Books/Comic/dmzj/raw"
const CBZ_OUTPUT_DIR = "/Volumes/medialibrary/Books/Comic/dmzj/cbz"

async function triggerGenerateMissingCbz(folder) {
    await makeCbz(folder, CBZ_OUTPUT_DIR, 1000, true)
}

triggerGenerateMissingCbz(`${COMIC_OUTPUT_DIR}/70524_广井菊里的深酒日记`)