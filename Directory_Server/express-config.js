const express = require('express');
const path = require('path'); // Import path module for __dirname

const app = express();
const publicPath = path.join(__dirname, 'public'); // Define publicPath, __dirname needs to be from this file's context

// Middleware for CORS
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// Root route
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// Static file serving
app.use(express.static(publicPath));

module.exports = app;
