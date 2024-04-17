const ProtoUtils = require("../utils/protoutils")
const PROTO_TEMPLATE = `${__dirname}/Comic.proto`

const fs = require('fs')
const path = require('path')
const { DefaultAxiosProxy } = require('../utils/axios')
const { decryptBlocksWithDefaultKey } = require("../utils/decrypt.js")
const Constants = require("../utils/constants.js")

const { makeCbz } = require("./cbzMaker")


const APIV4_DEFAULT_URL = `https://${Constants.API_V4}.${Constants.DOMAIN_DEFAULT}`
const COMIC_DEFAULT_UA = "Android,DMZJ1,2.9.0"


const DETAIL_API = `${APIV4_DEFAULT_URL}/comic/detail/`
const CHAPTER_API = `${APIV4_DEFAULT_URL}/comic/chapter/`
const DEFAULT_REQ_SUFFIX = "?disable_level=1&channel=Android&_id=e30"


const TEST = {
    comic_id: 47971,
    chapter_id: 148547,
    local_resp: "/Users/zzy/Downloads/dmzj_resp_comic_chapter.bin"
}


module.exports = { getComicDetail, getChapterDetail, COMIC_DEFAULT_UA, findComicFolderById, makeCbz }

function findComicFolderById(directory, id) {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, recursive = true);
    }
    const filesAndFolders = fs.readdirSync(directory);
    const folder = filesAndFolders.find(name => name.split('_')[0] == id.toString());
    return folder ? path.join(directory, folder) : null;
}


async function testLocalResponse() {
    let respProto = fs.readFileSync(TEST.local_resp)
    let respObj = await ProtoUtils.decode(PROTO_TEMPLATE, "comic.ChapterResponse", respProto)
    console.log(JSON.stringify(respObj))
    return respObj
}

/**
 * 
 * @param {string} id 
 * @returns {ComicInfo}
 * @example {"id":"47971","title":"憧憬成为魔法少女","direction":1,"islong":2,"cover":"https://images.idmzj.com/webpic/14/chongjingchengweimofashaonvjsan.jpg","description":"在一个实际有魔法少女存在，由她们对抗奇异魔物来保护众人的世界裡，就读国中2年级的柊舞缇娜，","lastUpdatetime":"1698994422","lastUpdateChapterName":"第45话","firstLetter":"c","comicPy":"chongjingchengweimofashaonv","hidden":1,"hotNum":"36588171","hitNum":"31883374","lastUpdateChapterId":148547,"types":[{"tagId":11,"tagName":"魔法"},{"tagId":3243,"tagName":"ゆり"},status":[{"tagId":2309,"tagName":"连载中"}],"authors":[{"tagId":12533,"tagName":"小野中彰大"}],"subscribeNum":"151702","chapters":[{"title":"连载","data":[{"chapterId":"148547","chapterTitle":"45话","updatetime":"1698994422","filesize":7358037,"chapterOrder":480}]}
 */
async function getComicDetail(id) {
    let url = `${DETAIL_API}${id}${DEFAULT_REQ_SUFFIX}`
    let resp = await DefaultAxiosProxy.get(url, {
        userAgent: COMIC_DEFAULT_UA
    } ).catch(e => {
        console.error(`Error getting comic detail`, e)
        return null
    })
    let protoMsgBuf = decryptBlocksWithDefaultKey(resp.data)
    let respObj = await ProtoUtils.decode(PROTO_TEMPLATE, "comic.ComicResponse", protoMsgBuf)
    if (respObj.errno || respObj.errmsg) {
        console.log(`Error getting novel chapters, errno: ${respObj.errno}, errmsg: ${errmsg}`)
        return null
    }
    //handle long
    let data = respObj.data
    data.id = data.id.toNumber()
    data.lastUpdatetime = data.lastUpdatetime.toNumber()
    return data
}

async function getChapterDetail(comicId, chapterId) {
    let url = `${CHAPTER_API}${comicId}/${chapterId}${DEFAULT_REQ_SUFFIX}`
    let resp = await DefaultAxiosProxy.get(url, {
        userAgent: COMIC_DEFAULT_UA
    }).catch(e => {
        console.error(`Error getting comic chapter detail with URL ${url}`, e)
        return null
    })  
    let protoMsgBuf = decryptBlocksWithDefaultKey(resp.data)
    let respObj = await ProtoUtils.decode(PROTO_TEMPLATE, "comic.ChapterResponse", protoMsgBuf)
    if (respObj.errno || respObj.errmsg || !respObj.data) {
        console.log(`Error getting novel chapters, got response: ${JSON.stringify(respObj)}`)
        return null
    }
    //handle long
    let data = respObj.data
    data.chapterId = data.chapterId.toNumber()
    data.comicId = data.comicId.toNumber()
   
    return respObj.data
}


// testLocalResponse()
// getChapterDetail(TEST.comic_id, TEST.chapter_id).then(resp => {
//     console.log(JSON.stringify(resp))
//     fs.writeFileSync("./sample_resp_comic_chapter.json", JSON.stringify(resp))
// })
// getComicDetail(TEST.comic_id).then(resp => {
//     console.log(JSON.stringify(resp))
//     fs.writeFileSync("./sample_resp_comic_detail.json", JSON.stringify(resp))
// })