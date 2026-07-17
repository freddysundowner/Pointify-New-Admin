const Admin = require("../models/admin");
const { emailOptionInit } = require("../shared/emailsetup");
const EmailMessage = require("../models/messagesEmail");
const emailsSent = require("../models/emailsSent");
const mongoose = require("mongoose");
const {sendSms} = require('../shared/functions')
const communication = require("../models/communication");
const sendByType = async ({ type, to, body, subject }) => {
  if (type === "sms") {
    return await sendSms(to, body);
  }

  if (type === "email") {
    await emailOptionInit(to, subject || "Notification", body, [], false);
    return { status: 200 };
  }

  throw new Error("Unsupported communication type");
};

exports.sendCommunication = async (req, res) => {
  try {
    const { to, body, type = "sms", user, subject } = req.body;

    if (!to || !body) {
      return res.status(400).json({
        status: 400,
        message: "Recipient and message body are required",
      });
    }
    console.log(req.body);

    const response = await sendByType({ type, to, body, subject });
    console.log(response);

    const cm = new communication({
      message: body,
      status: response?.status === 200 ? "sent" : "failed",
      type,
      user,
      failedreason: response?.message ?? null,
      contact: to,
    });

    await cm.save();

    return res.status(200).json(response);
  } catch (error) {
    console.error("Communication error:", error);

    return res.status(500).json({
      status: 500,
      message: "Failed to send communication",
      error: error.message,
    });
  }
};

exports.resendCommunication = async (req, res) => {
  try {
    const { id } = req.params;
    const { to } = req.body;

    const comm = await communication.findById(id);
    if (!comm) {
      return res.status(404).json({
        status: 404,
        message: "Communication record not found",
      });
    }

    const response = await sendByType({
      type: comm.type,
      to: to,
      body: comm.message,
      subject: comm.subject,
    });

    comm.status = response?.status === 200 ? "sent" : "failed";
    comm.failedreason = response?.message ?? null;
    comm.contact = to;

    await comm.save();

    return res.status(200).json({
      message: "Communication resend attempted",
      response,
      data: comm,
    });
  } catch (error) {
    console.error("Resend error:", error);

    return res.status(500).json({
      status: 500,
      message: "Failed to resend communication",
      error: error.message,
    });
  }
};

exports.getCommunications = async (req, res) => {
  try {
    const {
      status,
      type,
      user,
      to,
      fromDate,
      toDate,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    if (status) filter.status = status;
    if (type) filter.type = type;
    if (user) filter.user = user;
    if (to) filter.contact = to;

    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = new Date(fromDate);
      if (toDate) filter.createdAt.$lte = new Date(toDate);
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      communication
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      communication.countDocuments(filter),
    ]);

    return res.status(200).json({
      total,
      page: Number(page),
      limit: Number(limit),
      data,
    });
  } catch (error) {
    console.error("Get SMS error:", error);

    return res.status(500).json({
      status: 500,
      message: "Failed to fetch SMS",
      error: error.message,
    });
  }
};
// Valid audiences. "all" = every user with a phone.
const VALID_USER_TYPES = new Set([
  "all",
  "trial_active",
  "trial_expired",
  "production_active",
  "production_expired",
]);

/**
 * Resolve the UNIQUE set of recipients (one entry per Admin/user) for an audience.
 * A user who owns 5 matching shops collapses to a single recipient, because we
 * group by the Admin _id. We also require a non-empty phone up front.
 */
async function resolveBulkRecipients(userType) {
  // "all" → every user that has a phone, deduped inherently (one Admin doc each).
  if (userType === "all") {
    const admins = await Admin.find(
      { phone: { $nin: [null, ""] } },
      { phone: 1 }
    ).lean();
    return admins.map((a) => ({ _id: a._id, phone: a.phone }));
  }

  // "<type>_<state>" → trial|production  ×  active|expired
  const [type, state] = userType.split("_");
  const now = new Date();
  const endDateMatch = state === "active" ? { $gt: now } : { $lte: now };

  // Root the pipeline at Admin and look at ALL their shops (via shop.adminId),
  // not just primaryShop. $group at the end guarantees one row per user.
  const rows = await Admin.aggregate([
    { $match: { phone: { $nin: [null, ""] } } },
    {
      $lookup: {
        from: "shops",
        localField: "_id",
        foreignField: "adminId",
        as: "shop",
      },
    },
    { $unwind: "$shop" },
    {
      $lookup: {
        from: "subscriptions",
        localField: "shop.subscription",
        foreignField: "_id",
        as: "subscription",
      },
    },
    { $unwind: "$subscription" },
    {
      $match: {
        "subscription.type": type,
        "subscription.endDate": endDateMatch,
      },
    },
    // Dedupe: one recipient per user regardless of how many shops matched.
    { $group: { _id: "$_id", phone: { $first: "$phone" } } },
  ]);

  return rows.map((r) => ({ _id: r._id, phone: r.phone }));
}

exports.sendBulkSmsByUserType = async (req, res) => {
  try {
    const {
      userType,
      message,
      batchSize = 25, // how many sends run concurrently per batch
      delay = 1000,   // pause (ms) between batches to respect gateway limits
      user,           // admin id of the operator sending (for the audit log)
    } = req.body;

    // ---- Validate input ----
    if (!userType || !message) {
      return res
        .status(400)
        .json({ message: "userType and message are required" });
    }
    if (!VALID_USER_TYPES.has(userType)) {
      return res.status(400).json({ message: `Invalid userType: ${userType}` });
    }

    // ---- Build the deduped recipient list (fast: just DB reads) ----
    const recipients = await resolveBulkRecipients(userType);

    if (!recipients.length) {
      return res.status(200).json({
        message: "No users found for this audience",
        userType,
        total: 0,
        sent: 0,
        failed: 0,
      });
    }

    // ---- Respond IMMEDIATELY so the request never hangs / freezes ----
    res.status(202).json({
      message: "Bulk SMS accepted; sending in the background",
      userType,
      total: recipients.length,
      status: "processing",
    });

    // ---- Send in the background, in bounded batches, never throwing out ----
    setImmediate(async () => {
      let sent = 0;
      let failed = 0;

      // One recipient send that can never reject — always returns true/false
      // and always writes an audit row, even on a thrown gateway error.
      const sendOne = async ({ phone }) => {
        try {
          const response = await sendSms(phone, message); // FIX: real phone
          const ok = response?.status === 200;
          await communication.create({
            message,
            status: ok ? "sent" : "failed",
            type: "sms",
            user,
            contact: phone,
            failedreason: ok ? null : response?.message ?? "send failed",
          });
          return ok;
        } catch (err) {
          try {
            await communication.create({
              message,
              status: "failed",
              type: "sms",
              user,
              contact: phone,
              failedreason: err?.message ?? "send error",
            });
          } catch (_) {
            /* swallow audit-write errors so one bad row can't stop the run */
          }
          return false;
        }
      };

      try {
        for (let i = 0; i < recipients.length; i += batchSize) {
          const batch = recipients.slice(i, i + batchSize);
          const results = await Promise.all(batch.map(sendOne)); // sendOne never throws
          for (const ok of results) ok ? sent++ : failed++;

          if (i + batchSize < recipients.length) {
            await new Promise((r) => setTimeout(r, delay));
          }
        }
        console.log(
          `Bulk SMS [${userType}] complete: ${sent} sent, ${failed} failed of ${recipients.length}`
        );
      } catch (err) {
        // Catch-all so the background task never becomes an unhandled rejection.
        console.error("Bulk SMS background run error:", err?.message ?? err);
      }
    });
  } catch (error) {
    console.error("Bulk SMS error:", error);
    if (!res.headersSent) {
      return res
        .status(500)
        .json({ message: "Failed to start bulk SMS", error: error.message });
    }
  }
};



saveUpdateTemplate = async (templateId,data) => {
    if (templateId) {
        await EmailMessage.findByIdAndUpdate(templateId,data)
    } else {
        console.log(data);
        const message = await EmailMessage.findOneAndUpdate(
          { subject: data.subject},
          data,
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        console.log(message);
        // let message = await EmailMessage(data);
        templateId =  message._id;
    }
    console.log(templateId);
    return templateId;
}
exports.sendAdminEmail = async (req, res) => {
    const { to, sms, subject, body, type, sheduled =null, name, interval, campaign, audience, templateId, save } = req.body;
    console.log(req.body);
    try {
            let data = {
                subject,body,sheduled,campaign,audience,name, audienceAddress:to,type: sms ==true? 'sms' :'email'
            }

            if (sheduled) {
                data['interval'] = interval
            }
            
             const footer = `
                <hr style="border: 0; height: 1px; background: #ffffff;">
                <p style="color: #000000;">Contacts: <a href="mailto:pointifypos@gmail.com" style="color: #000000;">marketing@pointifypos.com</a> | +254 791 334 234</p>
                <p style="color: #000000;">Download our POS system:</p>
                <ul style="list-style: none; padding: 0;">
                <li style="display: inline; margin-right: 10px;">
                    <a href="https://play.google.com/store/apps/details?id=com.pointify.com&hl=en&gl=US" style="color: #000000;">
                    <img src="https://pointifypos.com/imgs/gg.png" alt="Google Play Store" style="height: 40px;">
                    </a>
                </li>
                <li style="display: inline; margin-right: 10px;">
                    <a href="https://apps.apple.com/us/app/pointify-pos/id6456891671" style="color: #000000;">
                    <img src="https://pointifypos.com/imgs/apple-app-store-logo.jpg" alt="App Store" style="height: 40px;">
                    </a>
                </li>
                <li style="display: inline; margin-right: 10px;">
                    <a href="https://pointifypos.com/pointify.dmg" style="color: #000000;">
                    <img src="https://pointifypos.com/imgs/wnd.png" alt="App Store" style="height: 40px;">
                    </a>
                </li>
                </ul>
            `;
    
                let youtubeVideoId = 'b162CC6xw5A';
                const youtubeThumbnail = youtubeVideoId
                ? `
                <div style="position: relative; width: 100%; max-width: 600px; overflow: hidden;">
                    <a href="https://www.youtube.com/watch?v=${youtubeVideoId}" target="_blank" style="display: block;">
                    <img src="https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg" alt="Watch Video" style="width: 100%; display: block;">
                    </a>
                            <img src="https://img.icons8.com/ios-filled/100/000000/play.png" alt="Play Button" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 80px; height: 80px;">

                </div>
                `
                : '';
                let emailBody = `
                    <div style="background-color: #ffffff; color: #000000; padding: 20px; width:600px; margin:0 auto; font-family: 'open sans', 'helvetica neue', sans-serif;font-size:18px;">
                    ${body}
                    ${footer}
                    </div>
                `;
        if (!audience) {
            return res.status(400).json({message: "set the audience type", status: 400});
        }
        if (audience =='custom' && to == '') {
            return res.status(400).json({message: "set recipient emails address to receive the message", status: 400});
        }
    
        let tmpId;
        if (save || templateId) {
            if(sms ==true && to !=null && to !=''){
                data['audienceAddress'] = to.join(',');
            }
            tmpId = await saveUpdateTemplate(templateId, data);
        }
        if (audience == 'custom') {
            if (!to) {
                return res.status(400).json({message: "set audience", status: 400});
            }
            let emailsArray = to;
            if(sms ==false){
                emailsArray = to.split(',');
            }
            let users = await Admin.aggregate([
                        {
                            $match: {
                            $or: [
                                { email: { $in: emailsArray } },
                                { phone: { $in: emailsArray } }
                            ]
                            }
                        },
                        {
                            $group: {
                            _id: "$phone",  // Group by phone field, you can also group by email if needed
                            user: { $first: "$$ROOT" } // Get the first document in each group
                            }
                        },
                        {
                            $replaceRoot: { newRoot: "$user" } // Replace the root with the user document
                        }
                        ]);
            users.forEach(async adminData => {
                let { email, username, phone } = adminData;
                emailBody = emailBody.replace(/{username}/g, username);
                if (sms == true) { 
                    emailBody = body;
                    email = phone;
                }
                await emailOptionInit(email, subject, emailBody,[], sms);
            })
        } else if (audience != "custom") {
            let adminsresponse = [];
            if (audience == "all") {
             adminsresponse = await Admin.find();
            }
            if (audience == "dormant") {
                const thirtyDaysFromNow = new Date();
                thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() - 30);
                adminsresponse = await Admin.aggregate([
                        {
                            $match: {
                                primaryShop: { $ne: null }
                            }
                        },
                        { 
                            $lookup: {
                            from: 'shops', 
                            localField: 'primaryShop',
                            foreignField: '_id',
                            as: 'primaryShopDetails'
                            }
                        },
                        { $unwind: "$primaryShopDetails" },
                        {
                            $lookup: {
                                from: 'subscriptions', // Name of the subscription collection
                                localField: 'primaryShopDetails.subscription',
                                foreignField: '_id',
                                as: 'primaryShopDetails.subscriptionDetails'
                            }
                        },
                        { $unwind: "$primaryShopDetails.subscriptionDetails" },
                        {
                            $match: {
                                'primaryShopDetails.subscriptionDetails.endDate': { $lt: thirtyDaysFromNow },
                            }
                        }
                        ]);
            }
            if (audience == "expired") {
                adminsresponse = await Admin.aggregate([
                        {
                            $match: {
                                primaryShop: { $ne: null }
                            }
                        },
                        { 
                            $lookup: {
                            from: 'shops', 
                            localField: 'primaryShop',
                            foreignField: '_id',
                            as: 'primaryShopDetails'
                            }
                        },
                        { $unwind: "$primaryShopDetails" },
                        {
                            $lookup: {
                                from: 'subscriptions', // Name of the subscription collection
                                localField: 'primaryShopDetails.subscription',
                                foreignField: '_id',
                                as: 'primaryShopDetails.subscriptionDetails'
                            }
                        },
                        { $unwind: "$primaryShopDetails.subscriptionDetails" },
                        {
                            $match: {
                                'primaryShopDetails.subscriptionDetails.endDate': { $lt: new Date() },
                                "primaryShopDetails.subscriptionDetails.type" : {$ne : 'trial'}
                            }
                        }
                        ]);
            }
            if (audience == "subscribers") {
                adminsresponse = await Admin.aggregate([
                        {
                            $match: {
                                primaryShop: { $ne: null }
                            }
                        },
                        { 
                            $lookup: {
                            from: 'shops', 
                            localField: 'primaryShop',
                            foreignField: '_id',
                            as: 'primaryShopDetails'
                            }
                        },
                        { $unwind: "$primaryShopDetails" },
                        {
                            $lookup: {
                                from: 'subscriptions', // Name of the subscription collection
                                localField: 'primaryShopDetails.subscription',
                                foreignField: '_id',
                                as: 'primaryShopDetails.subscriptionDetails'
                            }
                        },
                        { $unwind: "$primaryShopDetails.subscriptionDetails" },
                        {
                            $match: {
                                'primaryShopDetails.subscriptionDetails.endDate': { $gt: new Date() },
                                "primaryShopDetails.subscriptionDetails.type" : {$ne : 'trial'}
                            }
                        }
                        ]);
            }
            if (audience == "trial") {
                adminsresponse = await Admin.aggregate([
                        {
                            $match: {
                                primaryShop: { $ne: null }
                            }
                        },
                        { 
                            $lookup: {
                            from: 'shops', 
                            localField: 'primaryShop',
                            foreignField: '_id',
                            as: 'primaryShopDetails'
                            }
                        },
                        { $unwind: "$primaryShopDetails" },
                        {
                            $lookup: {
                                from: 'subscriptions', // Name of the subscription collection
                                localField: 'primaryShopDetails.subscription',
                                foreignField: '_id',
                                as: 'primaryShopDetails.subscriptionDetails'
                            }
                        },
                        { $unwind: "$primaryShopDetails.subscriptionDetails" },
                        {
                            $match: {
                                'primaryShopDetails.subscriptionDetails.endDate': { $gt: new Date() },
                                "primaryShopDetails.subscriptionDetails.type" : {$ne : 'production'}
                            }
                        }
                        ]);
            }
            if (audience == "trial_expired") {
                adminsresponse = await Admin.aggregate([
                        {
                            $match: {
                                primaryShop: { $ne: null }
                            }
                        },
                        { 
                            $lookup: {
                            from: 'shops', 
                            localField: 'primaryShop',
                            foreignField: '_id',
                            as: 'primaryShopDetails'
                            }
                        },
                        { $unwind: "$primaryShopDetails" },
                        {
                            $lookup: {
                                from: 'subscriptions', // Name of the subscription collection
                                localField: 'primaryShopDetails.subscription',
                                foreignField: '_id',
                                as: 'primaryShopDetails.subscriptionDetails'
                            }
                        },
                        { $unwind: "$primaryShopDetails.subscriptionDetails" },
                        {
                            $match: {
                                'primaryShopDetails.subscriptionDetails.endDate': { $lt: new Date() },
                                "primaryShopDetails.subscriptionDetails.type" : {$ne : 'production'}
                            }
                        }
                        ]);
            }
            console.log(audience,adminsresponse.length,adminsresponse);
            const batchSize = 50; // Adjust as needed
            const interval = 5000; // 5 seconds interval, adjust as needed
            let currentIndex = 0;
            let allSentEmails = 0;
            function sendBatchOfEmails() {
                const batchUsers = adminsresponse.slice(currentIndex, currentIndex + batchSize);
                currentIndex += batchSize;
                batchUsers.forEach(async adminData => {
                    let { email,username,phone } = adminData;
                    console.log(email)
                    allSentEmails += 1;
                    if (allSentEmails == adminsresponse.length) {
                        console.log("all emails sent ", allSentEmails)
                        em = emailsSent({
                            subject,
                            emailTemplate: tmpId,
                            usersCount: allSentEmails
                        });
                        em.save();
                    }
                    let emailBody = emailTemplate(body);
                    emailBody = emailBody.replace(/{username}/g, username);
                    // console.log(emailBody);
                    if (sms == true) { 
                        emailBody = body;
                        email = phone;
                    }
                    await emailOptionInit(email, subject, emailBody, [],sms)
                });
                if (currentIndex < adminsresponse.length) {
                    setTimeout(sendBatchOfEmails, interval);
                }
            }
            sendBatchOfEmails();
        }
      
        res.status(201).json({message: "emails sent", status: 200});
    } catch (err) {
        console.log(err.message)
    res.status(400).json({ error: err.message });
  }
};

const emailTemplate = (body) => {
    const footer = `
                <hr style="border: 0; height: 1px; background: #ffffff;">
                <p style="color: #000000;">Contacts: <a href="mailto:pointifypos@gmail.com" style="color: #000000;">marketing@pointifypos.com</a> | +254 791 334 234</p>
                <p style="color: #000000;">Download our POS system:</p>
                <ul style="list-style: none; padding: 0;">
                <li style="display: inline; margin-right: 10px;">
                    <a href="https://play.google.com/store/apps/details?id=com.pointify.com&hl=en&gl=US" style="color: #000000;">
                    <img src="https://pointifypos.com/imgs/gg.png" alt="Google Play Store" style="height: 40px;">
                    </a>
                </li>
                <li style="display: inline; margin-right: 10px;">
                    <a href="https://apps.apple.com/us/app/pointify-pos/id6456891671" style="color: #000000;">
                    <img src="https://pointifypos.com/imgs/apple-app-store-logo.jpg" alt="App Store" style="height: 40px;">
                    </a>
                </li>
                <li style="display: inline; margin-right: 10px;">
                    <a href="https://pointifypos.com/pointify.dmg" style="color: #000000;">
                    <img src="https://pointifypos.com/imgs/wnd.png" alt="App Store" style="height: 40px;">
                    </a>
                </li>
                </ul>
            `;
    
                let youtubeVideoId = 'b162CC6xw5A';
                const youtubeThumbnail = youtubeVideoId
                ? `
                <div style="position: relative; width: 100%; max-width: 600px; overflow: hidden;">
                    <a href="https://www.youtube.com/watch?v=${youtubeVideoId}" target="_blank" style="display: block;">
                    <img src="https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg" alt="Watch Video" style="width: 100%; display: block;">
                    </a>
                            <img src="https://img.icons8.com/ios-filled/100/000000/play.png" alt="Play Button" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 80px; height: 80px;">

                </div>
                `
                : '';
                let emailBody = `
                    <div style="background-color: #ffffff; color: #000000; padding: 20px; width:600px; margin:0 auto; font-family: 'open sans', 'helvetica neue', sans-serif;font-size:18px;">
                    ${body}
                    ${footer}
                    </div>
                `;
    return emailBody;
}

exports.getEmailtemplates = async (req, res) => {
    let response = await EmailMessage.find()
    return res.status(201).json({status: 200,response}); 
}
exports.getEmailSent = async (req, res) => {
    let response = await emailsSent.find()
    return res.status(201).json({status: 200,response}); 
}
exports.deleteTemplate = async (req, res) => {
    let response = await EmailMessage.findByIdAndRemove(req.params.id)
    return res.status(201).json({status: 200,response}); 
}

