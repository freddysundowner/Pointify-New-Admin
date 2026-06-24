const crypto = require("crypto");
const Package = require("../models/package");
const Subscription = require("../models/subscription");
const Shop = require("../models/shop");
const Affliate = require("../models/affliate");
const functions = require("../shared/functions");
const { sendEmail, sendEmailNew } = require("../shared/emailsetup");
const Admin = require("../models/admin");
const awardsSchema = require("../models/awards");
const Transaction = require("../models/transactions");

exports.handlePaystackWebhook = async (req, res) => {
  try {
    // 1️⃣ Verify signature
    const hash = crypto
      .createHmac("sha512", 'sk_test_d30826695b97a3b2621f27f233621e40dec13dee')
      .update(req.body)
      .digest("hex");

    if (hash !== req.headers["x-paystack-signature"]) {
      console.log("❌ Invalid Paystack signature");
      return res.sendStatus(401);
    }

    // 2️⃣ Parse event
    const event = JSON.parse(req.body.toString());

    console.log("✅ Paystack event:", event.event);
    console.log("✅ Paystack event data:", event.data);
    // 3️⃣ Handle payment
    if (event.event === "charge.success") {
      const reference = event.data.reference;
      const amount = event.data.amount / 100;
      const currency = event.data.currency;
      const email = event.data.customer.email;
      const { packageId: package, shops, userId, shop  } = event.data.metadata
      const startDate = new Date();
      console.log("💰 Payment success:", {
        reference,
        amount,
        email,
      });
      let checkExists = await Subscription.findOne({ invoiceNo: reference });
      if (checkExists) {
        return res.sendStatus(200);
      }

      console.log(req.body)
      const startDatee = new Date(startDate);
      let { durationUnit, durationValue, discount, type } = await Package.findById(package);
      let endDate;
      switch (durationUnit) {
        case 'days':
          endDate = new Date(startDatee.setDate(startDatee.getDate() + durationValue));
          break;
        case 'weeks':
          endDate = new Date(startDatee.setDate(startDatee.getDate() + durationValue * 7));
          break;
        case 'months':
          endDate = new Date(startDatee.setMonth(startDatee.getMonth() + durationValue));
          break
        default:
          endDate = null;
      }
      
      const newSubscription = new Subscription({ userId, packageId: package, startDate, endDate, invoiceNo: reference, amount, type, shops, currency, paid: true, status: true, shop });
      const savedSubscription = await newSubscription.save();
      await Shop.updateMany(
        { _id: { $in: shops } },
        { subscription: savedSubscription?._id },
        { new: true }
      );
      const subscriptioresponsen = await Subscription.findById(savedSubscription?._id).populate("packageId").populate("userId").populate("shops");

      const shopNames = Object.keys(subscriptioresponsen?.shops).map(key => subscriptioresponsen.shops[key].name);
      console.log(shopNames);
     
      await sendEmailNew({
        recipientEmail: subscriptioresponsen.userId.email,
        subject: 'New Subscription',
        recipientName: subscriptioresponsen.userId.username,
        slug: 'subscription',
        placeholders: {
          username: subscriptioresponsen.userId.username,
          shopname: shopNames
        }
      });

      // sendEmailNew(subscriptioresponsen.userId.email, 'Pointify Subscription', 'subscription', replacements);
      let expiryDate = new Date(subscriptioresponsen.endDate) ;
      functions.sendSms(subscriptioresponsen?.userId?.phone, "Your Subscription has successfully been activated, expiry date is " + expiryDate.toDateString() + "\n Thank you for doing business with us!");
      let award = 0;
      if (subscriptioresponsen.userId.affliate && currency == "KES") {
          let affliateReponse = await Affliate.findById(subscriptioresponsen.userId.affliate);
        let awardres = await functions.getAffiliateBonus(subscriptioresponsen.userId.affliate, subscriptioresponsen.amount);//(subscription.amount / 100) * affliateReponse.commission;
          console.log(awardres);
          award = parseFloat(awardres['award']);
          console.log(award);
        let bal = ((affliateReponse?.wallet ?? 0) + award).toFixed(2);
          await awardsSchema.create({
              type: "earnings",
              awardType: "subscription",
              shops: subscriptioresponsen?.shops,
              user: affliateReponse?._id,
              totalAmount: award,
              balance: bal,
          });
          affliateReponse.wallet = affliateReponse.wallet + award;
          affliateReponse.save();
          const replacementss = {
              referrerName: affliateReponse.name,
              shopName: shopNames,
              ownerName: subscriptioresponsen?.userId.username,
              points: award,
              type: "subscription",
              currency: "KES",
          };
          sendEmail(affliateReponse.email, 'Earnings!!', 'partneraward', replacementss);
          functions.sendSms(affliateReponse?.phonenumber,"Congratulations!! you have earned KES "+award+" for "+subscriptioresponsen?.userId?.username+" subscription, your new balance is KES"+bal);

      }
      //award a user as an affliate
      if (subscriptioresponsen.userId.referal && currency == "KES") {
      let adminResponse = await Admin.findById(subscriptioresponsen.userId.referal).populate("primaryShop");
          award = (amount / 100) * 10;
          await awardsSchema.create({
              type: "earnings",
              awardType: "subscription",
              shops: subscriptioresponsen?.shops,
              user: adminResponse?._id,
              totalAmount: award,
              balance: (adminResponse?.referalCredit ?? 0) + award,
          });
          adminResponse.referalCredit = adminResponse.referalCredit + award;
          adminResponse.save();
          const replacementss = {
              referrerName: adminResponse.username,
              shopName: shopNames,
              ownerName: adminResponse.username,
              points: award,
              type: "subscription",
              currency: adminResponse.primaryShop == null ? "KES" : adminResponse.primaryShop.currency,
          };
          sendEmail(adminResponse.email, 'Awarded!!', 'openshopaward', replacementss);
          functions.sendSms(adminResponse?.phone,"Congratulations!! you have earned KES "+award+" for sharing app with "+subscriptioresponsen?.userId?.username);
      }
      const transactoinResponse = await Transaction.create({
          amount: req.body.TransAmount,
          balance: 0,
          type: "subscription",
          user: subscriptioresponsen.userId?._id,
          transId: req.body.BillRefNumber,
          status: true,
          affliate: subscriptioresponsen?.userId?.affliate,
          affliateAmount: award
      })
      transactoinResponse.save();

      // ✅ CREDIT WALLET / MARK ORDER PAID HERE
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("Webhook error:", err);
    res.sendStatus(500);
  }
};
