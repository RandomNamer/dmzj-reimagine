module.exports = { timestampToLocaleString, timeStampToDashedString, timeStampToDateComponents }

function timestampToLocaleString(unixTimestamp){
    return new Date(unixTimestamp * 1000).toLocaleDateString()
}

function timeStampToDashedString(unixTimestamp) {
    let d = new Date(unixTimestamp * 1000)
    return `${d.getFullYear()}_${d.getMonth() + 1}_${d.getDate()}`
}

function timeStampToDateComponents(unixTimestamp) {
    let d = new Date(unixTimestamp * 1000)
    return {
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        day: d.getDate()
    }
}