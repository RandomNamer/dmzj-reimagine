const { Axios } = require("axios");
const { exit } = require("process");
const { getNovelDetail, getNovelChapters, getChapterText } = require("./novel")
const fs = require("fs")
const path = require("path")
const Epub = require("epub-gen")

id = 2580;

outputDir = "/Users/zzy/Downloads/dmzj/"

async function gatherInfo(novelId) {
    let info = await getNovelDetail(novelId)
    if (!info) exit(1)
    console.log(`Got novel ${info.name}, author ${info.authors}, status ${info.status}, last updated chapter ${info.lastUpdateChapterName}, currently has ${info.volume.length} volumes.`)
    let volumes = await getNovelChapters(novelId)
    if (!volumes) exit(1)
    volumes.forEach(vol => {
        console.log(`Volume ${vol.volumeName}, chapters [${vol.chapters.map(chap => chap.chapterName).toString()}]`)
    });
    return [info, volumes]
}

async function makeEpub(novelId) {
    let [info, volumes] = await gatherInfo(novelId)
    for (let volume of volumes) {
        for (let chapter of volume.chapters) {
            let text = await getChapterText(volume.volumeId, chapter.chapterId)
            chapter.text = text
        }
        volume.chapters = volume.chapters.sort((a, b) => a.chapterOrder - b.chapterOrder)
    }
    // volumes = volumes.sort((a, b) => a.volumeOrder - b.volumeOrder)
    let volumesStr = JSON.stringify(volumes)
    console.log("Successfully get raw text", volumesStr)
    const workingDir = path.join(outputDir, info.novelId.toString())
    if (!fs.existsSync(workingDir)) {
        fs.mkdirSync(workingDir);
    }
    // fs.writeFileSync(path.join(workingDir, 'volumes.json'), volumesStr, err => {
    //     console.error(err)
    // })

    var content = []
    volumes.forEach(vol => {
        content.push({
            title: vol.volumeName,
            data: ""
        })
        for (let chap of vol.chapters) {
            content.push({
                title: chap.chapterName,
                data: `<div>${chap.text}/div`
            })
        }
    })


    const options = {
        title: info.name,
        author: info.authors,
        cover: info.cover,
        lang: "zh",
        tocTitle: "目录",
        content: content,
        verbose: true
    }

    book = await new Epub(options, path.join(workingDir, `${info.name}.epub`))
    return book
}

function epubMakerTest() {
    var text = "第一卷&nbsp;&nbsp;转载信息<br/>书名：终将成为你 佐伯沙弥香的追忆<br />\n&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;<br />\n原名：やがて君になる 佐伯沙弥香について<br />\n作者：入间人间<br />\n插图：仲谷鳰<br />\n出版：KADOKAWA<br />\n翻译：flankoi<br />\n轻之国度 http://www.lightnovel.cn<br />\n仅供个人学习交流使用，禁作商业用途<br />\n下载后请在24小时内删除，LK不负担任何责任<br />\n请尊重翻译、扫图、录入、校对的辛勤劳动，转载请保留信息<br />\n&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;<br/>"
    text = `<div>${text}</div>`
    let options = {
        title: "test",
        author: "test author",
        lang: "zh",
        tocTitle: "目录",
        content: [
            {
                title: "empty",
                data: ""
            },
            {
                title: "content",
                data: text
            }
        ],
        verbose: true
    }
    new Epub(options, "/Users/zzy/Downloads/dmzj/test.epub")
}


makeEpub(id)
// epubMakerTest()