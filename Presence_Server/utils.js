const bigInt = require('./BigInt'); // Assuming BigInt.js is in the same directory
const lib = require('./lib'); // Assuming lib.js is in the same directory
const sjcl = require('./sjcl'); // Assuming sjcl.js is in the same directory
const Chance = require('chance'); // For get_key_pair

// Moved from lp.js
const key_base = 95; // Used by base16toHigh and baseHighto16

const h2s = (h) => {
    let ret = "";
    h.replace(/(..)/g, (s) => {
        ret += String.fromCharCode(parseInt(s, 16));
    });
    return ret;
};

const padLeadingZeroes = (str, len) => {
    let zeroes = len - str.length;
    let pad = "";
    while (zeroes > 0) {
        pad += "0";
        zeroes--;
    }
    return pad + str;
};

const base16toHigh = (str) => {
    const bInt = bigInt.str2bigInt(str, 16);
    return bigInt.bigInt2str(bInt, key_base);
};

const baseHighto16 = (str) => {
    const bInt = bigInt.str2bigInt(str, key_base);
    return padLeadingZeroes(bigInt.bigInt2str(bInt, 16), 64).toLowerCase();
};

const increment_base64 = (a) => {
    const _chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let i = a.length - 1;
    let return_string = "";
    while (i > -1) {
        const val = _chars.indexOf(a.charAt(i));
        if (val !== 63) {
            return_string = a.slice(0, i) + _chars[val + 1] + return_string;
            i = -1;
        } else {
            return_string = _chars[0] + return_string;
            i--;
        }
    }
    return return_string;
};

const decrement_base64 = (a) => {
    const _chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let i = a.length - 1;
    let return_string = "";
    while (i > -1) {
        const val = _chars.indexOf(a.charAt(i));
        if (val !== 0) {
            return_string = a.slice(0, i) + _chars[val - 1] + return_string;
            i = -1;
        } else {
            return_string = _chars[63] + return_string;
            i--;
        }
    }
    return return_string;
};

const strip = (a) => {
    a = JSON.parse(a);
    return `${a.ct},${a.salt}`;
};

const strip_simple = (a) => {
    a = JSON.parse(a);
    return `${a.ct},${a.salt},${a.iv}`;
};

const dress = (s, iv) => {
    s = s.split(",");
    let dressed_obj = {}; // Renamed 'a' to 'dressed_obj' for clarity
    dressed_obj.v = 1;
    dressed_obj.iter = 1000;
    dressed_obj.ks = 128;
    dressed_obj.ts = 64;
    dressed_obj.mode = "gcm";
    dressed_obj.adata = "";
    dressed_obj.cipher = "aes";
    dressed_obj.ct = s[0];
    dressed_obj.salt = s[1];
    dressed_obj.iv = iv;
    return JSON.stringify(dressed_obj);
};

const encrypt_simple = (msg, sID) => {
    const encrypted = sjcl.encrypt(sID, msg, { mode: "gcm" });
    return strip_simple(encrypted);
};

const decrypt = (msg, sID, IV) => {
    const dressed_msg = dress(msg, IV); // Renamed 'msg' to 'dressed_msg'
    return sjcl.decrypt(sID, dressed_msg);
};

const encrypt = (msg, sID, IV) => {
    const encrypted = sjcl.encrypt(sID, msg, { mode: "gcm", iv: IV });
    return strip(encrypted);
};

// decrypt_from_client and encrypt_for_client might need access to the 'identifier' object's
// key and IVs. For now, I'll assume 'client' object passed will have 'key', 'decrypt_iv', 'encrypt_iv'.
const decrypt_from_client = (msg, client) => {
    const sID = client.key;
    const IV = client.decrypt_iv;
    const return_data = decrypt(msg, sID, IV);
    client.decrypt_iv = increment_base64(IV); // This mutates the client object directly
    return return_data;
};

const encrypt_for_client = (msg, client) => {
    const sID = client.key;
    const IV = client.encrypt_iv;
    const return_data = encrypt(msg, sID, IV);
    client.encrypt_iv = decrement_base64(IV); // This mutates the client object directly
    return return_data;
};

const array_is_full = (arr) => {
    const len = arr.length;
    for (let i = 0; i < len; i++) {
        if (!(i in arr)) {
            return false;
        }
    }
    return true;
};

const get_key_pair = () => {
    const chance = new Chance(); // Instantiate Chance here or pass as an arg if used elsewhere too
    const privKey = chance.string({
        length: 64,
        pool: '0123456789abcdef'
    });
    const pubKey = lib.straight_hex(lib.curve25519_to8bitString(lib.curve25519(lib.curve25519_from8bitString(h2s(privKey)), lib.curve25519_nine())));
    return {
        privateKey: privKey,
        publicKey: pubKey,
    };
};

module.exports = {
    h2s,
    padLeadingZeroes,
    base16toHigh,
    baseHighto16,
    increment_base64,
    decrement_base64,
    strip,
    strip_simple,
    dress,
    encrypt_simple,
    decrypt,
    encrypt,
    decrypt_from_client,
    encrypt_for_client,
    array_is_full,
    get_key_pair,
    // key_base is not exported as it's only used internally by base16toHigh/baseHighto16
};
