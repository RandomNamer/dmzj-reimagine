module.exports = { timestampToLocaleString, timeStampToDashedString }

function timestampToLocaleString(unixTimestamp){
    return new Date(unixTimestamp * 1000).toLocaleDateString()
}

function timeStampToDashedString(unixTimestamp) {
    let d = new Date(unixTimestamp * 1000)
    return `${d.getFullYear()}_${d.getMonth() + 1}_${d.getDate()}`
}