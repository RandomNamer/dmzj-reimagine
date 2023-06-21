module.exports = { getNovelDetail, getNovelChapters, getChapterText, purgeHtmlStyles }
const Axios = require('axios').default
const fs = require('fs')
const Protobuf = require('protobufjs')
const { decryptBlocksWithDefaultKey } = require("../utils/decrypt.js")
const ProtoUtils = require("../utils/protoutils")
const crypto = require("crypto")
const Constants = require("../utils/constants.js")


const { NOVEL_KEY } = require("../utils/safestore")

const APIV4_DEFAULT_URL = `https://${Constants.API_V4}.${Constants.DOMAIN_DEFAULT}`

const DETAIL_API = `${APIV4_DEFAULT_URL}/novel/detail/`
const CHAPTER_API = `${APIV4_DEFAULT_URL}/novel/chapter/`

const TEMPLATE = `${__dirname}/Novel.proto`

const TEXT_API = `https://jurisdiction.${Constants.DOMAIN_DEFAULT}/lnovel/`

const htmlStylePattern = /style=".+?"/gm

/**
 * 
 * @param {string} id 
 * @returns {novelDetail}
 * @example {[{"novelId":1800,"name":"关于我转生后成为史莱姆的那件事","zone":"日本","status":"连载中","lastUpdateVolumeName":"第十九卷","lastUpdateChapterName":"后记","lastUpdateVolumeId":12008,"lastUpdateChapterId":122187,"lastUpdateTime":"1642942997","cover":"http://xs.dmzj.com/img/webpic/27/gywzshcwslmdnjs9l.jpg","hotHits":63744589,"introduction":"一个LOLI身大叔心的史莱姆成神的故事。\n平安无事地度着日子的三上悟被路过的歹徒刺了后，37年的人生闭幕了……应该是这样的。但突然注意到，自己看不见也听不见……在这种状况中，他察觉到自己已经转生成了史莱姆的事实。一边对自己是最弱又最有名的史莱姆这件事感到不满的同时，一边享受着史莱姆生活的三上悟，与天灾级的怪兽“暴风竜ヴェルドラ”相遇后，自己的命运也因此开始启动——。在让ヴェルドラ给自己起名为“リムル”，并作为史莱姆在新的异世界中开始生活之时，却被卷入了哥布林和牙狼族的纷争中，而且不知不觉中作为怪兽们的主人君临天下……拥有能夺取对手能力的“捕食者”和知晓世界之理的“大贤者”——这两种特殊技能作为武器的最强的史莱姆传说，现在开始！","types":["魔法/冒险/异界/穿越"],"authors":"伏濑","firstLetter":"G","subscribeNum":606851,"volume":[{"volumeId":7487,"novelId":1800,"volumeName":"web版第一章 《地位向上篇》","volumeOrder":1,"addtime":"1453715807","sumChapters":6},...]}]}
 */
async function getNovelDetail(id){
    let resp = await Axios.get(`${DETAIL_API}${id}`)
    let protoMsgBuf = decryptBlocksWithDefaultKey(resp.data)
    // console.log(`Protobuf message:\n${protoMsgBuf.toString()}`)
    let respObj = await ProtoUtils.decode(TEMPLATE, "novel.NovelInfoResponse", protoMsgBuf)
    if (respObj.errno || respObj.errmsg) {
        console.error(`Error getting novel detail, errno: ${respObj.errno}, errmsg: ${respObj.errmsg}`)
        return null
    }
    // console.log(JSON.stringify(novelDetail))
    return respObj.data[0]
}

/**
 * 
 * @param {string} id 
 * @returns {novelChapters}
 * @example [{"volumeId":7487,"volumeName_":"web版第一章 《地位向上篇》","volumeOrder":1,"chapters":[{"chapterId":56474,"chapterName":"第1-25话","chapterOrder":10},{"chapterId":56475,"chapterName":"第26话 新的能力","chapterOrder":20}]},...]
 */
async function getNovelChapters(id){
    let resp = await Axios.get(`${CHAPTER_API}${id}`)
    let protoMsgBuf = decryptBlocksWithDefaultKey(resp.data)
    // console.log(`Protobuf message:\n${protoMsgBuf.toString()}`)
    let respObj = await ProtoUtils.decode(TEMPLATE, "novel.NovelChapterResponse", protoMsgBuf)
    if (respObj.errno || respObj.errmsg) {
        console.log(`Error getting novel chapters, errno: ${respObj.errno}, errmsg: ${errmsg}`)
        return null
    }
    // console.log(JSON.stringify(novelDetail))
    return respObj.data
}

async function getChapterText(volumeId, chapterId){
    let url = `${TEXT_API}${volumeId}_${chapterId}.txt`
    let t = new Date().getTime() / 1000;
    let k = keyGen(`${NOVEL_KEY}/lnovel/${volumeId}_${chapterId}.txt${t}`)
    let resp = await Axios.get(url, {params: {t: t, k: k}}).catch(e => console.error(e))
    // console.log(resp.data)
    return resp.data
}


function keyGen(from){
    let md5 = crypto.createHash('md5')
    return md5.update(from).digest('hex')
}

/**
 * 
 * @param {string} html 
 * @returns {string}
 */
function purgeHtmlStyles(html, context) {
    let {printMatches, objectName } = context
    if (printMatches) {
        let match = htmlStylePattern.exec(html)
        if (match != null && match instanceof Array) {
            console.log(`Purging style attributes of ${objectName}: ${match[0]}`)
        }
    }
    let processed = html.replace(htmlStylePattern, "")
    return processed
}

// getNovelDetail(1800)
// getNovelChapters(1800)
// getChapterText(11615, 117485)
// getChapterText(12155, 124912)
