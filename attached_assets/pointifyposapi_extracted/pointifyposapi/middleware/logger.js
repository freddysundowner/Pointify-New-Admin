const fs = require('fs');
const path = require('path');

const logger = (req, res, next) => {
  const logEntry = `[${new Date().toISOString()}] ${req.method} ${req.originalUrl}\n`;
  fs.appendFileSync(path.join(__dirname, 'request.log'), logEntry);
  console.log(logEntry.trim());
  next();
};

module.exports = logger;