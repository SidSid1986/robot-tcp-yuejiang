const fs = require('fs')
const path = require('path')
const { app } = require('electron')

const logDir = path.join(app.getPath('userData'), 'logs')
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true })
}

function log(message) {
  const logPath = path.join(logDir, 'app.log')
  const logMessage = `[${new Date().toISOString()}] ${message}\n`
  fs.appendFileSync(logPath, logMessage)
  console.log(logMessage.trim())
}

module.exports = { log }