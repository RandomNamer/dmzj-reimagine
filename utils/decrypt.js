module.exports = {decryptBlocksWithDefaultKey}
const crypto = require("crypto");

const DEFAULT_PRIVATE_KEY = "MIICeAIBADANBgkqhkiG9w0BAQEFAASCAmIwggJeAgEAAoGBAK8nNR1lTnIfIes6oRWJNj3mB6OssDGx0uGMpgpbVCpf6+VwnuI2stmhZNoQcM417Iz7WqlPzbUmu9R4dEKmLGEEqOhOdVaeh9Xk2IPPjqIu5TbkLZRxkY3dJM1htbz57d/roesJLkZXqssfG5EJauNc+RcABTfLb4IiFjSMlTsnAgMBAAECgYEAiz/pi2hKOJKlvcTL4jpHJGjn8+lL3wZX+LeAHkXDoTjHa47g0knYYQteCbv+YwMeAGupBWiLy5RyyhXFoGNKbbnvftMYK56hH+iqxjtDLnjSDKWnhcB7089sNKaEM9Ilil6uxWMrMMBH9v2PLdYsqMBHqPutKu/SigeGPeiB7VECQQDizVlNv67go99QAIv2n/ga4e0wLizVuaNBXE88AdOnaZ0LOTeniVEqvPtgUk63zbjl0P/pzQzyjitwe6HoCAIpAkEAxbOtnCm1uKEp5HsNaXEJTwE7WQf7PrLD4+BpGtNKkgja6f6F4ld4QZ2TQ6qvsCizSGJrjOpNdjVGJ7bgYMcczwJBALvJWPLmDi7ToFfGTB0EsNHZVKE66kZ/8Stx+ezueke4S556XplqOflQBjbnj2PigwBN/0afT+QZUOBOjWzoDJkCQClzo+oDQMvGVs9GEajS/32mJ3hiWQZrWvEzgzYRqSf3XVcEe7PaXSd8z3y3lACeeACsShqQoc8wGlaHXIJOHTcCQQCZw5127ZGs8ZDTSrogrH73Kw/HvX55wGAeirKYcv28eauveCG7iyFR0PFB/P/EDZnyb+ifvyEFlucPUI0+Y87F"
const MAX_BLOCK_LENGTH = 128

function decryptBlocksWithDefaultKey(text){
    let pemKey  = crypto.createPrivateKey({
        key: Buffer.from(DEFAULT_PRIVATE_KEY, 'base64'),
        format: 'der',
        type: 'pkcs8',
    })
    var buf = Buffer.from(text, 'base64')
    let textLen = buf.byteLength;
    var loc = 0;
    var decryptedBufs = [];
    while(loc < textLen){
        if( (textLen - loc) > MAX_BLOCK_LENGTH){
            try {
                decryptedBufs.push(
                    crypto.privateDecrypt({
                        key: pemKey,
                        padding: crypto.constants.RSA_PKCS1_PADDING,
                    }, buf.slice(loc, loc + 128))
                )
            } catch (error) {
                console.log(error)
            }
        }
        else {
            decryptedBufs.push(
                crypto.privateDecrypt({
                    key: pemKey,
                    padding: crypto.constants.RSA_PKCS1_PADDING,
                }, buf.slice(loc, textLen))
            )
        }
        loc += 128
    }
    return Buffer.concat(decryptedBufs)
}

// let s = decryptBlocksWithDefaultKey("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")
// console.log(s)