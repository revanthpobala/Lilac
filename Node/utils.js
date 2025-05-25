const Chance = require('chance');
const bigInt = require('./BigInt'); // Assuming ./BigInt.js
const lib = require('./lib');       // Assuming ./lib.js
const sjcl = require('./sjcl');     // Assuming ./sjcl.js
const { key_base } = require('./config'); // Import key_base from config

// Helper functions
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

// SJCL wrappers
const strip = (a) => {
    const parsed = JSON.parse(a);
    return `${parsed.ct},${parsed.salt}`;
};

const strip_simple = (a) => {
    const parsed = JSON.parse(a);
    return `${parsed.ct},${parsed.salt},${parsed.iv}`;
};

const dress = (s, iv) => {
    const parts = s.split(",");
    const dressed_obj = {
        v: 1,
        iter: 1000,
        ks: 128,
        ts: 64,
        mode: "gcm",
        adata: "",
        cipher: "aes",
        ct: parts[0],
        salt: parts[1],
        iv: iv,
    };
    return JSON.stringify(dressed_obj);
};

const encrypt_simple = (msg, sID) => {
    const encrypted = sjcl.encrypt(sID, msg, { mode: "gcm" });
    return strip_simple(encrypted);
};

const decrypt = (msg, sID, IV) => {
    const dressed_msg = dress(msg, IV);
    return sjcl.decrypt(sID, dressed_msg);
};

const encrypt = (msg, sID, IV) => {
    const encrypted = sjcl.encrypt(sID, msg, { mode: "gcm", iv: IV });
    return strip(encrypted);
};

const decrypt_from_client = (msg, client) => {
    const sID = client.sID;
    const IV = client.decrypt_iv;
    const return_data = decrypt(msg, sID, IV);
    client.decrypt_iv = increment_base64(IV); // Mutates client object
    return return_data;
};

const encrypt_for_client = (msg, client) => {
    const sID = client.sID;
    const IV = client.encrypt_iv;
    const return_data = encrypt(msg, sID, IV);
    client.encrypt_iv = decrement_base64(IV); // Mutates client object
    return return_data;
};

const decrypt_from_node = (msg, client) => {
    const sID = client.node_key;
    const IV = client.decrypt_node_iv;
    const return_data = decrypt(msg, sID, IV);
    if (client.hasOwnProperty('initiator')) {
        client.decrypt_node_iv = decrement_base64(IV);
    } else {
        client.decrypt_node_iv = increment_base64(IV);
    }
    return return_data;
};

const encrypt_for_node = (msg, client) => {
    const sID = client.node_key;
    const IV = client.encrypt_node_iv;
    const return_data = encrypt(msg, sID, IV);
    if (client.hasOwnProperty('initiator')) {
        client.encrypt_node_iv = increment_base64(IV);
    } else {
        client.encrypt_node_iv = decrement_base64(IV);
    }
    return return_data;
};

const encrypt_fix_IV = (msg, key) => {
    const IV = "AAAAAAAAAAAA"; // Fixed IV
    return encrypt(msg, key, IV);
};

const decrypt_fix_IV = (msg, key) => {
    const IV = "AAAAAAAAAAAA"; // Fixed IV
    return decrypt(msg, key, IV);
};

// Key generation
const get_key_pair = () => {
    const chance = new Chance(); // Instantiate Chance for key generation
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

const compute_shared_secret = (keypairA, keypairB, pubkeyA, pubkeyB) => {
    // keypairA, keypairB are objects { privateKey, publicKey }
    // pubkeyA, pubkeyB are hex strings
    const csecret1 = bigInt.str2bigInt(lib.straight_hex(lib.curve25519_to8bitString(lib.curve25519(lib.curve25519_from8bitString(h2s(keypairA.privateKey)), lib.curve25519_from8bitString(h2s(pubkeyA))))), 16, 64);
    const csecret2 = bigInt.str2bigInt(lib.straight_hex(lib.curve25519_to8bitString(lib.curve25519(lib.curve25519_from8bitString(h2s(keypairB.privateKey)), lib.curve25519_from8bitString(h2s(pubkeyB))))), 16, 64);
    const sfinal = bigInt.bigInt2str(bigInt.mult(csecret1, csecret2), 16);
    return sfinal;
};

// Queue validation
const isValidQueue = (queue) => {
    // Original nc.js: (typeof queue != "undefined" && queue != null && queue.getLength() > 0)
    // Assuming queue is an instance of Queue.Queue from Queue.js which has getLength()
    return (typeof queue !== "undefined" && queue !== null && typeof queue.getLength === 'function' && queue.getLength() > 0);
};

// Padding functions
// These need config values for delimiter and text_length
const { delimiter, text_length, base64_chars: padding_pool_chars } = require('./config');

const add_padding = (data, myClient) => { // data is an object like {x: "some_encrypted_string"}
    if ((!myClient.hasOwnProperty('client')) || (!myClient.client)) {
        data.x += delimiter;
        const padding_length = text_length - data.x.length;
        if (padding_length > 0) {
            const chance = new Chance(); // For padding string
            data.x += chance.string({ length: padding_length, pool: padding_pool_chars });
        }
        data.x = encrypt_for_node(data.x, myClient); // encrypt_for_node is already in utils
    }
    return data;
};

const remove_padding = (data, myClient) => { // data is an object like {x: "some_encrypted_string_with_padding"}
    if ((!myClient.hasOwnProperty('client')) || (!myClient.client)) {
        data.x = decrypt_from_node(data.x, myClient); // decrypt_from_node is already in utils
        data.x = data.x.substring(0, data.x.lastIndexOf(delimiter));
    }
    return data;
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
    decrypt_from_node,
    encrypt_for_node,
    encrypt_fix_IV,
    decrypt_fix_IV,
    get_key_pair,
    compute_shared_secret,
    isValidQueue,
    add_padding,
    remove_padding,
    array_is_full, // Added array_is_full
};

// Definition for array_is_full (if it was missed)
// This function was in the original nc.js, used by the 'x' handler.
function array_is_full(arr) {
    const len = arr.length;
    for (let i = 0; i < len; i++) {
        if (!(i in arr)) {
            return false;
        }
    }
    return true;
}
