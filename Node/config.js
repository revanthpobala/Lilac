// nc.js original name: port
const defaultPort = 8091;

// nc.js original name: nodeServer_address
const nodeServer_address = "http://thelilacproject.org";

// nc.js original name: fixed_data_size
const fixed_data_size = 365;
// nc.js original name: guard_data_size
const guard_data_size = 256;
// nc.js original name: middle_data_size
const middle_data_size = 160;
// nc.js original name: exit_data_size
const exit_data_size = 88;

// nc.js original name: key_base
const key_base = 95;

// nc.js original name: spamArraySize
const spamArraySize = 10000;

// nc.js original name: delimiter
const delimiter = '!'; // Used in add_padding/remove_padding

// nc.js original name: text_length
const text_length = 504; // Used in add_padding

// nc.js original name: interval
const heartbeatInterval = 300;

// Not in original nc.js but used by spam.js if it's moved from nc.js
const base64_chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";


module.exports = {
    defaultPort,
    nodeServer_address,
    fixed_data_size,
    guard_data_size,
    middle_data_size,
    exit_data_size,
    key_base,
    spamArraySize,
    delimiter,
    text_length,
    heartbeatInterval,
    base64_chars,
};
