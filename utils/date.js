module.exports = { timestampToLocaleString, timeStampToDashedString, timeStampToDateComponents }

//The world is not exist before 21st century
const TIME_STARTS = 949381200000 //2000-1-1

function timestampToLocaleString(unixTimestamp){
    if (unixTimestamp < TIME_STARTS) unixTimestamp *= 1000
    return new Date(unixTimestamp).toLocaleString()
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