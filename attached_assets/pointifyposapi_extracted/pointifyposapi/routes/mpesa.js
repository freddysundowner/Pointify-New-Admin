const express = require("express");
const functions = require("../shared/functions")
const mpesa = express.Router();
const mpesaController = require("../controllers/mpesa");
const { createSubscription, confirmPayment } = require("../controllers/subscription");
const { Types } = require("mongoose");
const Package = require("../models/package");
const Shop = require("../models/shop");
const Subscription = require("../models/subscription");
const { sendEmail, sendEmailNew } = require("../shared/emailsetup");
const { topUpUserSmsCredit, calculateNewPriceByShops } = require("../shared/functions");
const Admin = require("../models/admin");
const awardsSchema = require("../models/awards");
const Affliate = require("../models/affliate");
const Transaction = require("../models/transactions");
mpesa.post("/subscribe/confirm", confirmPayment);
mpesa.post("/registerurl", mpesaController.registerMpesaUrl);
mpesa
    .route(`/subscribe`)
    .post(
        async (req, res) => {
            console.log(req.body);

            const user = await Admin.findById(req.body.userId);
            const selectedPackage = await Package.findById(req.body.packageId);

            const isOld = user?.pricingGroup === "old";

            const selectedShopCount = Array.isArray(req.body.shops)
                ? req.body.shops.length
                : 1;

            console.log("selectedShopCount", selectedShopCount);

            const amount = isOld
                ? selectedPackage.amount
                : calculateNewPriceByShops(selectedShopCount);
            console.log(amount)

            var data = {
                amount: amount,
                package: req.body.packageId,
                shop: req.body.shopId,
                userId: req.body.userId,
                phone: req.body.phonenumber,
                call_back: process.env.MPESA_DEPOSIT_CALLBACK,
            };
            console.log(data)
            let response = await functions.subscribe(data);
            console.log("vvvv ", response);
            res.json(response);

        }
    )
mpesa
    .route(`/query`)
    .post(
        async (req, res) => {
            await functions.checkTransactionStatus(req.body).then((r) => {
                res.json({ status: 200, message: "waiting" })
            }).catch((e) => {
                res.json(e)
            })
        }
    );
mpesa
    .route(`/reverse`)
    .post(
        async (req, res) => {
            let response = await functions.reverse(req.body).then((r) => {
                res.json(response)
            }).catch((e) => {
                res.json(e)
            })
        }
    );
mpesa
    .route(`/validation`)
    .post(async (req, res) => {
        console.log("validation")
        res.send({ "ResultCode": "0", "ResultDesc": "Success", "ThirdPartyTransID": "0" });

    })

mpesa
    .route(`/confirmation`)
    .post(
        async (req, res) => {
            console.log("API CONFIRMATION", req.body);
            var transaction_code = req.body.TransID;
            if (transaction_code == undefined || transaction_code == null) {
                res.json({ status: 500, message: "invalid transaction" });
                return;
            }
            let reference = req.body.BillRefNumber
            if (reference.includes("wallet")) {
                topUpUserSmsCredit(reference, req.body.TransAmount);
                return;
            }
            const subscriptioresponsen = await Subscription.findOne({ invoiceNo: req.body.BillRefNumber }).populate("packageId").populate("userId").populate("shops");
            console.log(subscriptioresponsen);
            let subscription;
            if (subscriptioresponsen) {
                subscription = subscriptioresponsen;
                subscription.status = true;
                subscription.paid = true;
                subscription.mpesaCode = transaction_code;
                const isOld = subscription.userId?.pricingGroup === "old";

                const finalPaidAmount = isOld
                    ? subscription.packageId.amount
                    : calculateNewPriceByShops(subscription.shops.length);

                subscription.amount = finalPaidAmount;
                subscription.save();
            } else {
                return;
            }
            await Shop.updateMany(
                { _id: { $in: subscriptioresponsen?.shops } },
                { subscription: subscriptioresponsen?._id },
                { new: true }
            );

            const shopNames = Object.keys(subscriptioresponsen?.shops).map(key => subscriptioresponsen.shops[key].name);

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
            functions.sendSms(subscriptioresponsen?.userId?.phone, "Your Subscription has successfully been activated, expiry date is " + subscriptioresponsen?.endDate + "\n Thank you for doing business with us!");
            let award = 0;
            if (subscriptioresponsen.userId.affliate) {
                let affliateReponse = await Affliate.findById(subscriptioresponsen.userId.affliate);
                let awardres = await functions.getAffiliateBonus(subscriptioresponsen.userId.affliate, subscription.amount);//(subscription.amount / 100) * affliateReponse.commission;
                console.log(awardres);
                award = parseFloat(awardres['award']);
                console.log(award);
                let bal = (affliateReponse?.wallet ?? 0) + award;
                await awardsSchema.create({
                    type: "earnings",
                    awardType: "subscription",
                    shops: subscriptioresponsen?.shops,
                    user: affliateReponse?._id,
                    totalAmount: award,
                    mpesaCode: transaction_code,
                    balance: bal,
                });
                affliateReponse.wallet = affliateReponse.wallet + award;
                affliateReponse.save();
                functions.sendSms(affliateReponse?.phonenumber, "Congratulations!! you have earned KES " + award + " for " + subscriptioresponsen?.userId?.username + " subscription, your new balance is KES" + bal);

            }
            //award a user as an affliate
            if (subscriptioresponsen.userId.referal) {
                let adminResponse = await Admin.findById(subscriptioresponsen.userId.referal).populate("primaryShop");
                award = (subscription.amount / 100) * 10;
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
                functions.sendSms(adminResponse?.phone, "Congratulations!! you have earned KES " + award + " for sharing app with " + subscriptioresponsen?.userId?.username);
            }
            const transactoinResponse = await Transaction.create({
                amount: req.body.TransAmount,
                balance: 0,
                type: "subscription",
                user: subscriptioresponsen.userId?._id,
                transId: req.body.BillRefNumber,
                mpesaCode: transaction_code,
                status: true,
                affliate: subscriptioresponsen?.userId?.affliate,
                affliateAmount: award
            })
            transactoinResponse.save();

            //stop this shop other subscriptions
            // await Subscription.findOneAndUpdate(
            //     { shops: { $in: subscription.shop } },
            //     { status: false, endDate: new Date() }
            // );
        });
module.exports = mpesa;