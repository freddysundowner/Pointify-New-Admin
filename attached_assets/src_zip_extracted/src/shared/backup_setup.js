const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const cron = require("node-cron");
const archiver = require("archiver");
var nodemailer = require('nodemailer');
var transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'pointifypos@gmail.com',
    pass: 'qwnu kega eabw pjtm'
  }
});
// Config
const BACKUP_ROOT = "/backup/mongodb";
const MONGO_USER = "pos";
const MONGO_PASS = "pos";
const DB_NAME = "restored_db";
const AUTH_DB = "restored_db";

// Step 1: Create Timestamped Backup Directory
function createBackupDir() {
  const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
  const dir = path.join(BACKUP_ROOT, timestamp);
  fs.mkdirSync(dir, { recursive: true });
  return { dir, timestamp };
}

// Step 2: Run mongodump
function runMongoDump(backupDir) {
  return new Promise((resolve, reject) => {
    const cmd = `mongodump --host localhost --port 27017 \
                --username ${MONGO_USER} \
                --password ${MONGO_PASS} \
                --authenticationDatabase ${AUTH_DB} \
                --db ${DB_NAME} \
                --gzip \
                --out ${backupDir}`;

    exec(cmd, (err, stdout, stderr) => {
      if (err) return reject(stderr);
      resolve();
    });
  });
}

// Step 3: Zip the backup
function zipBackup(backupDir, timestamp) {
  return new Promise((resolve, reject) => {
    const zipPath = `${backupDir}.zip`;
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolve(zipPath));
    archive.on("error", (err) => reject(err));
    archive.pipe(output);
    archive.directory(backupDir, false);
    archive.finalize();
  });
}

// Step 4: Send email using your existing system
async function sendBackupEmail(zipPath, timestamp) {
  const attachments = [
    {
      filename: `mongodb_backup_${timestamp}.zip`,
      path: zipPath
    }
  ];
  const mailOptions = {
        from: "githumbi3fred@gmail.com",
        to: "githumbi3fred@gmail.com", // Replace with the recipient's email
        subject: "Latest MongoDB Backup",
        text: `Attached is the latest backup file`,
        attachments: attachments,
      };
  
      // Send the email
      await transporter.sendMail(mailOptions);
}

// Step 5: Cleanup folder and zipped file
function cleanup(backupDir, zipPath) {
  fs.rmSync(backupDir, { recursive: true, force: true });
  fs.unlinkSync(zipPath); // or leave it for retention
}

// Run the job
async function backupAndEmailMongo() {
  try {
    const { dir: backupDir, timestamp } = createBackupDir();
    console.log(`🔁 Backup started at ${timestamp}`);

    await runMongoDump(backupDir);
    console.log("✅ Mongo dump complete.");

    const zipPath = await zipBackup(backupDir, timestamp);
    console.log(`✅ Zipped at: ${zipPath}`);

    await sendBackupEmail(zipPath, timestamp);
    console.log("📤 Email sent.");

    cleanup(backupDir, zipPath);
    console.log("🧹 Cleanup done.");
  } catch (error) {
    console.error("❌ Backup failed:", error);
  }
}


cron.schedule("5 2 * * *", backupAndEmailMongo);
