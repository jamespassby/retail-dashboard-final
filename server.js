// Example using Express.js
const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000; // You can use any port, 3000 is common

// Serve your static files
app.use(express.static(path.join(__dirname, 'public'))); 

// Your main route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ...any other routes you might have...

// IMPORTANT: Listen on 0.0.0.0
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});