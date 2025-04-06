const ProtoUtils = require("../utils/protoutils")
const PROTO_TEMPLATE = `${__dirname}/ComicV2.proto`

const fs = require('fs')
const path = require('path')
const { getWithRetry, axiosProxyGetWithRetry, createAxioProxyWithUA } = require('../utils/axios')
const { decryptComicV2Response, getCoreTokenV3 } = require("../utils/decrypt.js")
const Constants = require("../utils/constants.js")

const { makeCbz } = require("./cbzMaker")
const { default: axios } = require("axios")


const DEFAULT_URL = `https://${Constants.NNAPI_V4}.${Constants.DOMAIN_DEFAULT}`
const COMIC_UA = "Android,DMZJ1,3.9.1"


const DETAIL_API = `${DEFAULT_URL}/v2/comic/detail/`
const CHAPTER_API = `${DEFAULT_URL}/v2/comic/chapter/`
const DEFAULT_REQ_SUFFIX = "&channel=Android&version=3.9.1&app_channel=101_01_01_000"
const ENABLE_DEBUG_REQ = false
const DEFAULT_UID = "103520038"


const TEST = {
    comic_id: 47971,
    chapter_id: 148547,
    local_resp: "/Users/zzy/Downloads/dmzj_resp_comic_detail.bin"
}

const COMIC_DETAILS_API_MAX_RETRY = 3

const axiosProxy = createAxioProxyWithUA(COMIC_UA)


module.exports = { getComicDetailV2, getChapterDetailV2 }

async function protoTestLocalResponse() {
    let respProto = fs.readFileSync(TEST.local_resp)
    let respObj = await ProtoUtils.decode(PROTO_TEMPLATE, "comic.ComicResponse", respProto)
    console.log(JSON.stringify(respObj))
    return respObj
}

function getComicReqParams(uid = DEFAULT_UID) {
    return `?coreToken=${getCoreTokenV3()}${DEFAULT_REQ_SUFFIX}&_debug=${ENABLE_DEBUG_REQ ? 1 : 0}&uid=${uid}`
}

/**
 * 
 * @param {string} id 
 * @returns {ComicInfo}
 * @example {"id":"47971","title":"憧憬成为魔法少女","direction":1,"islong":2,"cover":"https://images.idmzj.com/webpic/14/chongjingchengweimofashaonvjsan.jpg","description":"在一个实际有魔法少女存在，由她们对抗奇异魔物来保护众人的世界裡，就读国中2年级的柊舞缇娜，","lastUpdatetime":"1698994422","lastUpdateChapterName":"第45话","firstLetter":"c","comicPy":"chongjingchengweimofashaonv","hidden":1,"hotNum":"36588171","hitNum":"31883374","lastUpdateChapterId":148547,"types":[{"tagId":11,"tagName":"魔法"},{"tagId":3243,"tagName":"ゆり"},status":[{"tagId":2309,"tagName":"连载中"}],"authors":[{"tagId":12533,"tagName":"小野中彰大"}],"subscribeNum":"151702","chapters":[{"title":"连载","data":[{"chapterId":"148547","chapterTitle":"45话","updatetime":"1698994422","filesize":7358037,"chapterOrder":480}]}
 */
async function getComicDetailV2(id, uid=undefined) {
    let url = `${DETAIL_API}${id}${getComicReqParams(uid)}`
    let resp
    try {
        resp = await getWithRetry(axiosProxy, url, 2)
    } catch(e) {
        console.error(`Error getting comic detail for ${id}:`, e)
        return null
    }
    let protoMsgBuf = decryptComicV2Response(resp.data)
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

async function getChapterDetailV2(comicId, chapterId, uid=undefined) {
    let url = `${CHAPTER_API}${comicId}/${chapterId}${getComicReqParams(uid)}`
    let resp
    try {
        resp = await getWithRetry(axiosProxy, url, COMIC_DETAILS_API_MAX_RETRY);
    } catch(e) {
        console.error(`Error getting chapter detail after ${COMIC_DETAILS_API_MAX_RETRY} retries for ${comicId}/${chapterId}:`, e)
        return null
    }
    if (resp == null || resp.data == null) return null  
    let protoMsgBuf = decryptComicV2Response(resp.data)
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


// protoTestLocalResponse()
// getChapterDetailV2(TEST.comic_id, TEST.chapter_id).then(resp => {
//     console.log(JSON.stringify(resp))
//     fs.writeFileSync("./sample_resp_comic_chapter.json", JSON.stringify(resp))
// })
// getComicDetailV2(TEST.comic_id).then(resp => {
//     console.log(JSON.stringify(resp))
//     fs.writeFileSync("./sample_resp_comic_detail_v2.json", JSON.stringify(resp))
// })