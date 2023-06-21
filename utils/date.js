module.exports = { timestampToLocaleString }

function timestampToLocaleString(unixTimestamp){
    return new Date(unixTimestamp * 1000).toLocaleDateString()
}