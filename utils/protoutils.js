module.exports = {decode}
protobuf = require("protobufjs")

async function decode(template, typename, messageBuffer){
    let root = await protobuf.load(template).catch(e => console.log(e))
    const Message = root.lookupType(typename)
    return Message.decode(messageBuffer)
}