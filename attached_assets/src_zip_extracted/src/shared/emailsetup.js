const Brevo = require('@getbrevo/brevo');
const Settings = require("../models/Setting");
const EmailTemplate = require("../models/email_templates");

async function sendEmailNew(options) {
  const {
    recipientEmail,
    recipientName,
    subject = "Pointify POS",
    slug,
    placeholders = {},
    attachments = []
  } = options;

  // Get email settings
  try{
  let responsee = await Settings.findOne({ name: 'EMAIL_CONFIG' }).select('setting');
  let settings = responsee.setting;
  let apiKey = settings['BREVO_API_KEY'];
  let senderEmail = settings['BREVO_SENDER_EMAIL'];
  let senderName = settings['BREVO_SENDER_NAME'];
  console.log(settings);

  if (!apiKey || !senderEmail || !senderName) {
    throw new Error('Missing email configuration. Check EMAIL_CONFIG settings.');
  }

  // Initialize Brevo API - Alternative approach
  const brevoApi = new Brevo.TransactionalEmailsApi();
  brevoApi.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey);

  // Fetch template
  let template = await EmailTemplate.findOne({ slug: slug });
  if (!template) {
    throw new Error(`Template with slug "${slug}" not found`);
  }

  // Replace placeholders
  let personalizedHtml = template.htmlContent;
  let personalizedSubject = subject || template.subject;

  const allPlaceholders = {
    name: recipientName,
    email: recipientEmail,
    ...placeholders
  };

  for (const [key, value] of Object.entries(allPlaceholders)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
    personalizedHtml = personalizedHtml.replace(regex, value || '');
    // personalizedSubject = personalizedSubject.replace(regex, value || '');
  }

  // Build email object using Brevo model
  const sendSmtpEmail = new Brevo.SendSmtpEmail();
  sendSmtpEmail.to = [{ email: recipientEmail, name: recipientName }];
  sendSmtpEmail.sender = { email: senderEmail, name: senderName };
  sendSmtpEmail.subject = personalizedSubject;
  sendSmtpEmail.htmlContent = personalizedHtml;

  // Add attachments if provided
  if (attachments && attachments.length > 0) {
    sendSmtpEmail.attachment = attachments.map(att => ({
      name: att.filename,
      content: fs.readFileSync(att.path, { encoding: 'base64' })
    }));
  }

  const response = await brevoApi.sendTransacEmail(sendSmtpEmail);
  return response; 
}
catch(e){
  console.log(e);
  return false;
}

}

var nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const {sendSms} = require("./functions")

const cron = require("node-cron");
// const welcome = require('')
// Create a transporter with your email configuration
var transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'pointifypos@gmail.com', 
    pass: 'qwnu kega eabw pjtm'
  }
});

const readHTMLFile = (path) => {
  return new Promise((resolve, reject) => {
    fs.readFile(path, { encoding: 'utf-8' }, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
};

const sendEmail = async (to, subject, emailType, replacements, attachments = []) => {
  try {

    let pathh = path.join(__dirname, 'emailtemplates', emailType + "Template.html"); 
    const template = await readHTMLFile(pathh);

    // Replace placeholders in the template with actual data
    let emailContent = template;
    for (const key in replacements) {
      emailContent = emailContent.replace(new RegExp(`{{${key}}}`, 'g'), replacements[key]);
    }
      console.log(to)

    // Set up email options 
    const mailOptions = { 
      from: 'Pointify pointify254@gmail.com',
      to, 
      subject,
      html: emailContent
    };
    if (attachments.length > 0) {
      mailOptions.attachments = attachments;
    }
    // Send the email 
    transporter.sendMail(mailOptions, (error, info) => {
        attachments.forEach((f)=>{ 
          fs.unlinkSync(f.path);
        })
      if (error) {
        console.error(error);
      } else {
        console.log('Email sent: ' + info.response);
      }
    });
  } catch (error) {
    console.error(error);
  }
};

const emailOptionInit = async (to, subject, emailContent, attachments = [],sms) => {
  //send sms
  if (sms == true) {
    await sendSms(to,emailContent);
  } else {
    const mailOptions = {
      from: 'Pointify pointify254@gmail.com',
      to,
      subject,
      html: emailContent
    };
    if (attachments.length > 0) {
      mailOptions.attachments = attachments;
    }
    // Send the email 
    transporter.sendMail(mailOptions, (error, info) => {
      attachments.forEach((f) => {
        fs.unlinkSync(f.path);
      })
      if (error) {
        console.error(error);
      } else {
        console.log('Email sent: ' + info.response);
      }
    });
  }
}


const sendBackupFile = async () => {
  try {
    const backupDir = "/backup/mongodb"; // Directory where backups are saved
    const files = fs.readdirSync(backupDir);

    // Find the most recent backup file
    const latestFile = files
      .filter((file) => file.endsWith(".zip"))
      .map((file) => ({ file, time: fs.statSync(path.join(backupDir, file)).mtime }))
      .sort((a, b) => b.time - a.time)[0];
 
    if (!latestFile) {
      console.error("No backup files found.");
      return;
    }

    const filePath = path.join(backupDir, latestFile.file);

    // Email options
    const mailOptions = {
      from: "githumbi3fred@gmail.com",
      to: "githumbi3fred@gmail.com", // Replace with the recipient's email
      subject: "Latest MongoDB Backup",
      text: `Attached is the latest backup file: ${latestFile.file}`,
      attachments: [
        {
          filename: latestFile.file,
          path: filePath,
        },
      ],
    };

    // Send the email
    await transporter.sendMail(mailOptions);
    console.log("Backup file sent successfully.");
  } catch (error) {
    console.error("Error sending backup file:", error);
  }
};
// cron.schedule("39 0 * * *", sendBackupFile);
// cron.schedule("* * * * *", sendBackupFile);

module.exports = {
    sendEmail,
    emailOptionInit,
    sendEmailNew,
}