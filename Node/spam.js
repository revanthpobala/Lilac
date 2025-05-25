const Chance = require('chance');
const { spamArraySize, base64_chars } = require('./config');

let spamArray = []; // Initialize as empty, will be filled by refillSpam
let spamLength = 0; // Will be set after spamArray is filled

const refillSpam = () => {
    const chance = new Chance(); // Instantiate Chance here
    spamArray = []; // Clear before refilling
    for (let i = 0; i < spamArraySize; i++) {
        // Original: chance.string({length: 682, pool: base64_chars}) + "==," + chance.string({length: 22, pool: base64_chars}) + "==";
        // The "==" might be for Base64 padding, but typically not added manually like this if sjcl handles full base64.
        // For now, replicating the structure.
        spamArray[i] = chance.string({ length: 682, pool: base64_chars }) + "==," + chance.string({ length: 22, pool: base64_chars }) + "==";
    }
    if (spamArray.length > 0) {
        spamLength = spamArray[0].length;
    }
    // console.log("Spam array refilled. Size:", spamArray.length, "Item length:", spamLength);
};

const getSpam = () => {
    if (spamArray.length === 0 || spamLength === 0) {
        // console.warn("Spam array not initialized or empty. Call refillSpam first.");
        // Fallback or throw error, for now, return an empty string structure
        return ","; 
    }
    const chance = new Chance(); // Instantiate Chance here
    const piece1 = chance.integer({ min: 0, max: spamArray.length - 1 });
    const piece2 = chance.integer({ min: 0, max: spamArray.length - 1 });
    const splt = chance.integer({ min: 0, max: spamLength });
    
    // Ensure spamArray[piece1] and spamArray[piece2] are defined
    const part1 = spamArray[piece1] ? spamArray[piece1].substring(0, splt) : "";
    const part2 = spamArray[piece2] ? spamArray[piece2].substring(splt, spamLength) : "";
    
    return part1 + part2;
};

// Initialize spam array when module is loaded
refillSpam();

module.exports = {
    getSpam,
    refillSpam, // Export if external re-filling is desired, otherwise can be kept internal
};
