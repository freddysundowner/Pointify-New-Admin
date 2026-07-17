const Package = require("../models/package");
const Subscription = require("../models/subscription");
const Shop = require("../models/shop");
const User = require("../models/admin");
const Affiliate = require("../models/affliate");
const functions = require("../shared/functions");
const { sendEmailNew } = require("../shared/emailsetup");
const { Types } = require("mongoose");
const ObjectId = Types.ObjectId;
require("dotenv").config({ path: ".env" });
const path = require("path");
const awardsSchema = require("../models/awards");
const { creditAffiliateAward } = require("../shared/affiliateAward");

function getDateRange(period) {
    const now = new Date();

    let start, end;

    switch (period) {
        case "today":
            start = new Date(
                Date.UTC(
                    now.getUTCFullYear(),
                    now.getUTCMonth(),
                    now.getUTCDate(),
                ),
            );
            end = null;
            break;

        case "yesterday":
            end = new Date(
                Date.UTC(
                    now.getUTCFullYear(),
                    now.getUTCMonth(),
                    now.getUTCDate(),
                ),
            );
            start = new Date(end);
            start.setUTCDate(start.getUTCDate() - 1);
            break;

        case "thisWeek":
            const day = now.getUTCDay();
            start = new Date(
                Date.UTC(
                    now.getUTCFullYear(),
                    now.getUTCMonth(),
                    now.getUTCDate() - day,
                ),
            );
            end = new Date(start);
            end.setUTCDate(end.getUTCDate() + 7);
            break;

        case "thisMonth":
            start = new Date(
                Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
            );
            end = new Date(
                Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
            );
            break;

        case "lastMonth":
            end = new Date(
                Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
            );
            start = new Date(
                Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
            );
            break;

        case "allTime":
            start = null;
            end = null;
            break;
    }

    return { start, end };
}
async function getSubscriptionSummary(period) {
    const { start, end } = getDateRange(period);

    const match = {};

    if (start) match.createAt = { $gte: start };
    if (end) match.createAt = { ...match.createAt, $lt: end };

    return await Subscription.aggregate([
        { $match: match },
        {
            $group: {
                _id: null,
                count: { $sum: 1 },
                revenue: { $sum: "$amount" },
                shops: { $addToSet: "$shop" },
            },
        },
        {
            $project: {
                count: 1,
                revenue: 1,
                shopCount: { $size: "$shops" },
            },
        },
    ]);
}

async function summary(req, res) {
    try {
        const [today, yesterday, thisWeek, thisMonth, lastMonth, allTime] =
            await Promise.all([
                getSubscriptionSummary("today"),
                getSubscriptionSummary("yesterday"),
                getSubscriptionSummary("thisWeek"),
                getSubscriptionSummary("thisMonth"),
                getSubscriptionSummary("lastMonth"),
                getSubscriptionSummary("allTime"),
            ]);

        res.send({
            success: true,
            data: {
                today: today?.[0] || { count: 0, revenue: 0, shopCount: 0 },
                yesterday: yesterday?.[0] || {
                    count: 0,
                    revenue: 0,
                    shopCount: 0,
                },
                thisWeek: thisWeek?.[0] || {
                    count: 0,
                    revenue: 0,
                    shopCount: 0,
                },
                thisMonth: thisMonth?.[0] || {
                    count: 0,
                    revenue: 0,
                    shopCount: 0,
                },
                lastMonth: lastMonth?.[0] || {
                    count: 0,
                    revenue: 0,
                    shopCount: 0,
                },
                allTime: allTime?.[0] || { count: 0, revenue: 0, shopCount: 0 },
            },
        });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
}

const confirmPayment = async (req, res) => {
    try {
        let { subscriptionid, shopid } = req.body;
        const subscriptions = await Subscription.find({
            _id: subscriptionid,
            shops: shopid,
            status: true,
        }).populate("packageId");
        let status = subscriptions.length > 0 ? true : false;
        res.json({
            status,
            message:
                status == true
                    ? "Subscription successful"
                    : "no payment received yet",
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};
async function depositElimu(req, res) {
    let { amount, phone, id } = req.body;
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    let mpesaresponse = await callMpesaApi(
        amount,
        randomPart,
        phone,
        "elimu",
        id,
    );
    return res.json(mpesaresponse);
}
async function createSubscription(req, res) {
    try {
        let {
            userId,
            package,
            startDate = new Date(),
            shop,
            shops = [],
            paymentType = "mpesa",
            phonenumber,
        } = req.body;
        console.log(req.body);
        const startDatee = new Date(startDate);
        // let { durationUnit, durationValue, amount, discount, amountusd,type } = await Package.findById(package);
        const user = await User.findById(userId);
        const selectedPackage = await Package.findById(package);

        let {
            durationUnit,
            durationValue,
            amount,
            newAmount,
            amountusd,
            newAmountusd,
            discount,
            type,
        } = selectedPackage;

        // 👇 THIS IS THE MAGIC LINE
        const isOld = user?.pricingGroup === "old";
        if (!isOld) {
            const maxAllowed =
                selectedPackage.newMaxShops || selectedPackage.maxShops;

            if (maxAllowed && shops.length > maxAllowed) {
                return res.status(400).json({
                    message: `This plan allows maximum ${maxAllowed} shops`,
                });
            }
        }

        // choose price
        const selectedShopCount = shops.length;

        const finalAmount = isOld
            ? amount
            : functions.calculateNewPriceByShops(selectedShopCount);
        console.log(finalAmount);
        const finalAmountUsd = isOld ? amountusd : newAmountusd || amountusd;

        let endDate;
        if (isOld) {
            switch (durationUnit) {
                case "days":
                    endDate = new Date(
                        startDatee.setDate(
                            startDatee.getDate() + durationValue,
                        ),
                    );
                    break;
                case "weeks":
                    endDate = new Date(
                        startDatee.setDate(
                            startDatee.getDate() + durationValue * 7,
                        ),
                    );
                    break;
                case "months":
                    endDate = new Date(
                        startDatee.setMonth(
                            startDatee.getMonth() + durationValue,
                        ),
                    );
                    break;
                default:
                    endDate = null;
            }
        } else {
            // 🔥 new users → ALWAYS 30 days
            endDate = new Date(startDatee.setDate(startDatee.getDate() + 30));
        }
        let toPay = discount ? finalAmount - discount : finalAmount;
        const randomPart = Math.floor(1000 + Math.random() * 9000);
        const newSubscription = new Subscription({
            userId,
            packageId: package,
            startDate,
            endDate,
            shop,
            invoiceNo: randomPart,
            amount: 0,
            type,
            shops,
        });
        const savedSubscription = await newSubscription.save();

        //call mpesa api
        if (paymentType == "mpesa") {
            let mpesaresponse = await callMpesaApi(
                toPay,
                randomPart,
                phonenumber,
            );
            mpesaresponse.subscriptionid = savedSubscription._id;
            console.log(mpesaresponse);
            res.json(mpesaresponse);
        } else {
            const stripe = require("stripe")(process.env.stripeSecretKey);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: finalAmountUsd * 100,
                currency: "usd",
                automatic_payment_methods: {
                    enabled: true,
                },
            });
            return res.json({
                status: 200,
                subscriptionid: savedSubscription._id,
                amount: paymentIntent["amount_received"],
                client_secret: paymentIntent["client_secret"],
            });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

const updateSubscriptionInappPayment = async (req, res) => {
    try {
        console.log(req.body);
        const { package, shops, userId, transaction_code } = req.body;
        const startDatee = new Date();
        const user = await User.findById(userId);
        const selectedPackage = await Package.findById(package);

        const isOld = user?.pricingGroup === "old";

        let { durationUnit, durationValue, amount, newAmount, type } =
            selectedPackage;

        // price
        const finalAmount = isOld
            ? amount
            : functions.calculateNewPriceByShops(shops.length);

        // duration
        let endDate;
        if (isOld) {
            switch (durationUnit) {
                case "days":
                    endDate = new Date(
                        startDatee.setDate(
                            startDatee.getDate() + durationValue,
                        ),
                    );
                    break;
                case "weeks":
                    endDate = new Date(
                        startDatee.setDate(
                            startDatee.getDate() + durationValue * 7,
                        ),
                    );
                    break;
                case "months":
                    endDate = new Date(
                        startDatee.setMonth(
                            startDatee.getMonth() + durationValue,
                        ),
                    );
                    break;
                default:
                    endDate = null;
            }
        } else {
            endDate = new Date(startDatee.setDate(startDatee.getDate() + 30));
        }

        const randomPart = Math.floor(1000 + Math.random() * 9000);
        const newSubscription = new Subscription({
            mpesaCode: transaction_code,
            userId,
            packageId: package,
            startDate: new Date(),
            endDate,
            shop: shops[0],
            invoiceNo: randomPart,
            amount: finalAmount,
            type,
            shops,
            paid: true,
            currency: "usd",
        });
        const savedSubscription = await newSubscription.save();
        await Shop.updateMany(
            { _id: { $in: shops } },
            { subscription: savedSubscription?.id },
            { new: true },
        );
        const shopsResponse = await Shop.find({ _id: { $in: shops } }).populate(
            "adminId",
        );
        await sendEmailNew({
            recipientEmail: shopsResponse[0].adminId.email,
            subject: "New Subscription",
            recipientName: shopsResponse[0].adminId.username,
            slug: "subscription",
            placeholders: {
                username: shopsResponse[0].adminId.username,
                shopname: shopsResponse.map((shop) => shop?.name).join(", "),
            },
        });
        return res.json({
            status: 200,
            message: "subscription success, click okay to refresh",
        });
    } catch (error) {
        return res.json({
            status: 400,
            message: "Error happened when creating subscription",
        });
    }
};

const verifyTransaction = async (req, res) => {
    try {
        const { transaction_code } = req.body;
        let id = req.params.id;
        console.log(req.body);
        // check if transaction_code has already been used
        const subscriptioncheck = await Subscription.findOne({
            mpesaCode: transaction_code,
        });
        if (!subscriptioncheck) {
            let subscription = await Subscription.findByIdAndUpdate(
                id,
                { status: true, mpesaCode: transaction_code, paid: true },
                { new: true },
            )
                .populate("packageId")
                .populate("userId")
                .populate("shops");
            // console.log(subscription);
            let shops = subscription.shops.map((shop) => shop._id);
            await Shop.updateMany(
                { _id: { $in: shops } },
                { subscription: subscription?.id },
                { new: true },
            );
            const isOld = subscription.userId?.pricingGroup === "old";

            const finalPaidAmount = isOld
                ? subscription.packageId.amount
                : functions.calculateNewPriceByShops(subscription.shops.length);

            await Subscription.findOneAndUpdate(
                { _id: id },
                { amount: finalPaidAmount },
                { new: true },
            );
            let shopnames = subscription.shops
                .map((shop) => shop.name)
                .join(", ");
            const durationText = isOld
                ? `${subscription.packageId.durationValue} ${subscription.packageId.durationUnit}`
                : "30 days";
            functions.sendSms(
                subscription?.userId?.phone,
                "Your subscription plan for these shops " +
                    shopnames +
                    " has been updated for a duration of " +
                    durationText,
            );
            sendEmailNew({
                recipientEmail: subscription?.userId?.email,
                subject: "New Subscription",
                recipientName: subscription?.userId?.username,
                slug: "subscription",
                placeholders: {
                    username: subscription?.userId?.username,
                    shopname: shopnames,
                },
            });
            return res.json({
                status: true,
                message: "success",
            });
        } else {
            return res.json({
                status: false,
                message: "Transaction code has already been used",
            });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

const updateSubscriptionPayment = async (req, res) => {
    const { subscriptionid, transaction_code, currency = "kes" } = req.body;

    const subscription = await Subscription.findById(subscriptionid)
        .populate("packageId")
        .populate("userId");
    if (!subscription) {
        return res.status(404).json({ message: "Subscription not found" });
    }
    const isOld = subscription.userId?.pricingGroup === "old";

    const finalPaidAmount = isOld
        ? subscription.packageId.amount
        : functions.calculateNewPriceByShops(subscription.shops.length);

    subscription.status = true;
    subscription.mpesaCode = transaction_code;
    subscription.commission = 0;
    subscription.paid = true;
    subscription.currency = currency;
    subscription.amount = finalPaidAmount;

    await subscription.save();

    await Shop.updateMany(
        { _id: { $in: subscription?.shops } },
        { subscription: subscriptionid },
        { new: true },
    ).populate("adminId");

    let shops = await Shop.find({ _id: { $in: subscription?.shops } }).populate(
        "adminId",
    );

    //award affliate
    let affliateId = subscription.userId.affliate;
    let award = 0;
    if (affliateId) {
        const awardResult = await creditAffiliateAward({
            affiliateId: affliateId,
            amount: subscription.amount,
            mpesaCode: transaction_code,
            shops: subscription?.shops,
            currency: subscription?.currency,
            shopNames: shops.map((shop) => shop?.name).join(", "),
            subscriberName: subscription?.userId?.username,
        });
        award = awardResult.totalAward;
    }

    await sendEmailNew({
        recipientEmail: shops[0].adminId.email,
        recipientName: shops[0].adminId.username,
        subject: "New Subscription",
        slug: "subscription",
        placeholders: {
            username: shops[0].adminId.username,
            shopname: shops.map((shop) => shop?.name).join(", "),
        },
    });
    res.json({
        status: 200,
        message: "subscription success, click okay to refresh",
    });
};

const callMpesaApi = async (
    amount,
    randomPart,
    phonenumber,
    type = "",
    user_id = "",
) => {
    if (
        phonenumber == "0723082113" ||
        phonenumber == "254723082113" ||
        phonenumber == "+254723082113"
    ) {
        amount = 5000;
    } else {
        amount =
            phonenumber == "254715363474" || phonenumber == "0715363474"
                ? 1
                : amount;
    }
    // amount = phonenumber == '254723082113' || phonenumber == '0723082113' || '+254723082113' ? 5000 : amount;
    var data = {
        amount: amount,
        randomPart: randomPart,
        phone: phonenumber,
        call_back: process.env.MPESA_DEPOSIT_CALLBACK,
        type: type,
        user_id,
    };
    return await functions.subscribe(data);
};

const getSubscriptionsByShopIds = async (req, res) => {
    try {
        const { userId, status, name } = req.query;
        const userIds = await User.find({ affliate: userId }).distinct("_id");
        let filter = { userId: { $in: userIds } };
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        if (status) {
            if (status == "active") {
                filter.endDate = { $gte: today };
                filter.status = true;
            }
            console.log(status);
            if (status == "expired") {
                filter.endDate = { $lte: today };
            }
        }
        // console.log(filter)

        let latestSubscriptions = await Subscription.aggregate([
            { $match: filter }, // Filter by shop IDs
            { $sort: { createAt: -1 } },
            {
                $group: {
                    _id: "$shop", // Group by shop ID
                    latestSubscription: { $first: "$$ROOT" }, // Take the first document in each group (latest)
                },
            },
            {
                $replaceRoot: { newRoot: "$latestSubscription" }, // Replace the root with the latest subscription document
            },
        ]);

        // Manually populate the fields
        latestSubscriptions = await Subscription.populate(latestSubscriptions, [
            { path: "packageId" },
            { path: "shops", select: "name" },
            { path: "shop", select: "name" },
            { path: "userId" },
        ]);
        latestSubscriptions.sort((a, b) => b.createAt - a.createAt);

        res.json(latestSubscriptions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};
async function getAllSubscriptions(req, res) {
    try {
        let {
            status,
            type,
            page,
            limit,
            shop,
            shopname,
            createAt,
            expiryperiodTo,
            expiryperiodFrom,
            invoiceNo,
        } = req.query;
        console.log(req.query);

        const filter = {};
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        // --- STATUS FILTERS ---
        if (status === "Active") {
            filter.status = true;
            filter.endDate = { ...(filter.endDate || {}), $gt: today };
            // if (type === 'trial') filter.endDate.$gt = today; // same anyway
        } else if (status === "Cancelled") {
            filter.status = false;
            if (type === "trial") {
                // you had special logic, keeping it if needed
                filter.endDate = { ...(filter.endDate || {}), $lte: today };
            }
        } else if (status === "Expired") {
            filter.endDate = { ...(filter.endDate || {}), $lte: today };
            // NOTE: you didn't filter by status here originally, so I keep that behaviour
        }

        // --- CREATED AT (SINGLE DAY) FILTER ---
        if (createAt) {
            const startOfDay = new Date(createAt);
            startOfDay.setUTCHours(0, 0, 0, 0);

            const endOfDay = new Date(createAt);
            endOfDay.setUTCHours(23, 59, 59, 999);

            filter.createAt = {
                $gte: startOfDay,
                $lte: endOfDay,
            };
        }

        // --- EXPIRY PERIOD FILTER (RANGE) ---
        if (
            expiryperiodFrom &&
            expiryperiodTo &&
            expiryperiodTo !== "null" &&
            expiryperiodFrom !== "null"
        ) {
            const from = new Date(expiryperiodFrom);
            from.setUTCHours(0, 0, 0, 0);

            const to = new Date(expiryperiodTo);
            to.setUTCHours(23, 59, 59, 999);

            // merge with any existing endDate conditions
            filter.endDate = {
                ...(filter.endDate || {}),
                $gte: from,
                $lte: to,
            };

            // You had "status: true" here originally, keeping that logic
            filter.status = true;
        }

        // --- TYPE FILTER (trial / production) ---
        if (type) {
            const packages = await Package.find({ type }).select("_id");
            const packageIds = packages.map((p) => p._id);

            if (packageIds.length > 0) {
                filter.packageId = { $in: packageIds };
            } else {
                // No packages of this type → force empty result
                filter.packageId = { $in: [] };
            }
        }

        // --- SHOP FILTER (by name, regex) ---
        if (shop) {
            filter.$or = [
                { shops: { $in: [new ObjectId(shop)] } },
                { shop: new Types.ObjectId(shop) },
            ];
        }

        if (shopname) {
            let shops = await Shop.find({
                name: { $regex: new RegExp(shopname, "i") },
            });
            let shopIds = shops.map((s) => s._id);
            filter.$or = [
                { shops: { $in: shopIds } },
                { shop: { $in: shopIds } },
            ];
        }
        if (invoiceNo) {
            filter.invoiceNo = invoiceNo;
        }
        console.log("getAllSubscriptions filter:", filter);

        // --- PAGINATION ---
        const hasPagination = !!page;
        const pageInt = hasPagination ? parseInt(page, 10) || 1 : 1;
        const limitInt = parseInt(limit, 10) || 10;
        const skip = hasPagination ? (pageInt - 1) * limitInt : 0;

        let subscriptionQuery = Subscription.find(filter)
            .populate("packageId")
            .populate("shop")
            .populate("shops")
            .populate("userId")
            .sort({ createAt: -1 });

        if (hasPagination) {
            subscriptionQuery = subscriptionQuery.skip(skip).limit(limitInt);
        }

        const subscriptions = await subscriptionQuery;

        if (hasPagination) {
            const totalSubscriptions =
                await Subscription.countDocuments(filter);
            const totalPages = Math.ceil(totalSubscriptions / limitInt);

            return res.json({
                data: subscriptions,
                count: totalSubscriptions,
                totalPages,
                currentPage: pageInt,
            });
        } else {
            return res.json(subscriptions);
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

async function getSubscriptionById(req, res) {
    const subscriptionId = req.params.id;
    try {
        const subscription = await Subscription.findById(subscriptionId);
        if (!subscription) {
            return res.status(404).json({ error: "Subscription not found" });
        }
        res.json(subscription);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

async function extendSubscription(req, res) {
    const subscriptionId = req.params.id;

    try {
        const { endDate, mpesaCode } = req.body;
        console.log(req.body);
        let status = new Date(endDate) > new Date();
        let subs = await Subscription.findById(subscriptionId)
            .populate("packageId")
            .populate("userId");
        const isOld = subs.userId?.pricingGroup === "old";

        const finalAmount = isOld
            ? subs.packageId.amount
            : functions.calculateNewPriceByShops(subs.shops.length);
        const updatedSubscription = await Subscription.findByIdAndUpdate(
            subscriptionId,
            { endDate, status, paid: status, amount: finalAmount, mpesaCode },
            { new: true },
        ).populate("userId");
        let message = "";
        if (status == true) {
            message =
                "Your subscription plan has been updated, expiry date is " +
                endDate;
        } else {
            message = "Your subscription plan has expired";
        }
        functions.sendSms(updatedSubscription?.userId?.phone, message);
        if (!updatedSubscription) {
            return res.status(404).json({ error: "Subscription not found" });
        }
        res.json(updatedSubscription);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

async function assignShopsToSubscription(req, res) {
    try {
        const { subscriptionId, shops, mpesaCode } = req.body;

        if (!subscriptionId) {
            return res
                .status(400)
                .json({ error: "subscriptionId is required" });
        }

        if (!Array.isArray(shops)) {
            return res.status(400).json({ error: "shops must be an array" });
        }

        // Validate ObjectId
        if (!Types.ObjectId.isValid(subscriptionId)) {
            return res.status(400).json({ error: "Invalid subscriptionId" });
        }

        // Normalize shop IDs
        const shopIds = shops
            .filter((id) => Types.ObjectId.isValid(id))
            .map((id) => new Types.ObjectId(id));

        // Load subscription
        const subscription = await Subscription.findById(
            subscriptionId,
        ).populate("userId", "affliate");

        if (!subscription) {
            return res.status(404).json({ error: "Subscription not found" });
        }

        // Load and verify shops exist
        const shopDocs = await Shop.find({ _id: { $in: shopIds } });
        if (shopDocs.length !== shopIds.length) {
            return res.status(400).json({
                error: "Some shops do not exist or were invalid",
            });
        }

        // ----- Update subscription object -----
        const old = subscription.shops.map((id) => id.toString());
        const incoming = shopIds.map((id) => id.toString());

        const merged = [...new Set([...old, ...incoming])];

        const user = await User.findById(subscription.userId);
        const selectedPackage = await Package.findById(subscription.packageId);

        const isOld = user?.pricingGroup === "old";

        if (!isOld) {
            const maxAllowed =
                selectedPackage.newMaxShops || selectedPackage.maxShops;

            if (maxAllowed && merged.length > maxAllowed) {
                return res.status(400).json({
                    error: `This plan allows maximum ${maxAllowed} shops`,
                });
            }
        }

        subscription.shops = merged.map((id) => new Types.ObjectId(id));
        await subscription.save();

        // 2. Assign subscription to new shops
        await Shop.updateMany(
            { _id: { $in: shopIds } },
            { subscription: subscriptionId },
        );

        let affliateId = subscription.userId.affliate;
        let awardedwithmpesacode = await awardsSchema.findOne({
            mpesaCode: subscription.mpesaCode,
        });
        if (affliateId && !awardedwithmpesacode) {
            await creditAffiliateAward({
                affiliateId: affliateId,
                amount: subscription.amount,
                mpesaCode: subscription.mpesaCode,
                shops: subscription?.shops,
            });
        }

        // Return updated subscription with populated shops
        const updatedSubscription = await Subscription.findById(subscriptionId)
            .populate("shops")
            .populate("userId")
            .populate("packageId");

        res.json({
            success: true,
            message: "Shops assigned successfully",
            subscription: updatedSubscription,
        });
    } catch (error) {
        console.error("assignShopsToSubscription error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

async function updateSubscription(req, res) {
    const subscriptionId = req.params.id;

    try {
        const { userId, packageId, startDate } = req.body;
        const updatedSubscription = await Subscription.findByIdAndUpdate(
            subscriptionId,
            { userId, packageId, startDate },
            { new: true },
        );
        if (!updatedSubscription) {
            return res.status(404).json({ error: "Subscription not found" });
        }
        res.json(updatedSubscription);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

async function deleteSubscription(req, res) {
    const subscriptionId = req.params.id;

    try {
        const deletedSubscription =
            await Subscription.findByIdAndDelete(subscriptionId);
        if (!deletedSubscription) {
            return res.status(404).json({ error: "Subscription not found" });
        }
        res.json({ message: "Subscription deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

async function subscriptionSuccess(req, res) {
    const stripe = require("stripe")(process.env.stripeSecretKey);
    const session_id = req.query.session_id;
    const session = await stripe.checkout.sessions.retrieve(session_id);
    const filePath = path.join(__dirname, "../../public/success.html");
    res.sendFile(filePath);
    const requestBody = {
        subscriptionid: session["metadata"]["subscriptionId"],
        transaction_code: "",
        currency: "usd",
    };
    await axios.put(
        "https://api.pointifypos.com/updateAfterStripeSuccessPayment",
        requestBody,
    );
}
async function stripeCheckout(req, res) {
    try {
        const stripe = require("stripe")(process.env.stripeSecretKey);
        const session = await stripe.checkout.sessions.create({
            line_items: [
                {
                    price_data: {
                        currency: "usd",
                        product_data: {
                            name: "Subscription",
                        },
                        unit_amount: req.body.amount,
                    },
                    quantity: 1,
                },
            ],
            mode: "payment",
            metadata: {
                subscriptionId: req.body.subscriptionId,
                customerId: req.body.customerId,
            },

            success_url:
                "https://api.pointifypos.com/subscripions/stripesucess?session_id={CHECKOUT_SESSION_ID}",
            cancel_url: "https://api.pointifypos.com/cancel",
        });
        console.log(`called response ${session}`);
        res.json({ success: true, url: session.url });
    } catch (e) {
        console.log(e);
        res.json({ success: false, error: e });
    }
}
async function getlicence(req, res) {
    console.log("getlicence");
    const SECRET_KEY = process.env.LICENSE_SECRET || "your_secret_key";
    try {
        const { id } = req.params;
        let { shop } = req.query;
        if (!id) {
            return res.status(400).json({ error: "id  required" });
        }
        // Find active subscription
        const subscription = await Subscription.findOne({
            userId: id,
            $or: [{ shop: shop }, { shops: shop }],
            status: true,
            paid: true,
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() },
        }).populate("packageId");

        if (!subscription) {
            return res
                .status(404)
                .json({ error: "No valid subscription found" });
        }

        // Build payload
        const payload = {
            userId: subscription.userId,
            shopId: shop,
            packageId: subscription.packageId._id,
            validUntil: subscription.endDate,
        };

        // Sign the license key (expires same day as subscription)
        const token = jwt.sign(payload, SECRET_KEY, {
            expiresIn: Math.floor(
                (new Date(subscription.endDate) - new Date()) / 1000,
            ),
        });

        return res.json({
            licenseKey: token,
            validUntil: subscription.endDate,
            package: {
                title: subscription.packageId.title,
                features: subscription.packageId.features,
            },
        });
    } catch (err) {
        console.error("License generation error:", err);
        return res.status(500).json({ error: "Server error" });
    }
}

async function subscriptionStatistics(req, res) {
    try {
        const now = new Date();

        const adminStats = {
            active: { trial: 0, production: 0 },
            expired: { trial: 0, production: 0 },
        };

        const shopStats = {
            active: { trial: 0, production: 0 },
            expired: { trial: 0, production: 0 },
        };

        const data = await Shop.aggregate([
            { $match: { subscription: { $ne: null } } },

            {
                $lookup: {
                    from: "subscriptions",
                    localField: "subscription",
                    foreignField: "_id",
                    as: "subscription",
                },
            },
            { $unwind: "$subscription" },

            {
                $lookup: {
                    from: "packages",
                    localField: "subscription.packageId",
                    foreignField: "_id",
                    as: "package",
                },
            },
            { $unwind: "$package" },

            {
                $project: {
                    adminId: "$adminId",
                    type: "$package.type", // trial | production
                    isActive: {
                        $and: [
                            { $eq: ["$subscription.paid", true] },
                            { $lte: ["$subscription.startDate", now] },
                            { $gte: ["$subscription.endDate", now] },
                        ],
                    },
                },
            },
        ]);

        /* =========================
       SHOP-LEVEL STATS
    ========================= */
        for (const shop of data) {
            if (shop.isActive) {
                shopStats.active[shop.type]++;
            } else {
                shopStats.expired[shop.type]++;
            }
        }

        /* =========================
       ADMIN-LEVEL STATS
    ========================= */
        const adminMap = new Map();

        for (const shop of data) {
            const adminId = shop.adminId.toString();

            if (!adminMap.has(adminId)) {
                adminMap.set(adminId, {
                    activeProduction: false,
                    activeTrial: false,
                    expiredProduction: false,
                    expiredTrial: false,
                });
            }

            const admin = adminMap.get(adminId);

            if (shop.isActive) {
                if (shop.type === "production") admin.activeProduction = true;
                else admin.activeTrial = true;
            } else {
                if (shop.type === "production") admin.expiredProduction = true;
                else admin.expiredTrial = true;
            }
        }

        for (const admin of adminMap.values()) {
            if (admin.activeProduction) {
                adminStats.active.production++;
            } else if (admin.activeTrial) {
                adminStats.active.trial++;
            } else if (admin.expiredProduction) {
                adminStats.expired.production++;
            } else if (admin.expiredTrial) {
                adminStats.expired.trial++;
            }
        }

        /* =========================
       RESPONSE
    ========================= */
        return res.status(200).json({
            users: {
                active: {
                    total:
                        adminStats.active.trial + adminStats.active.production,
                    ...adminStats.active,
                },
                expired: {
                    total:
                        adminStats.expired.trial +
                        adminStats.expired.production,
                    ...adminStats.expired,
                },
            },
            shops: {
                active: {
                    total: shopStats.active.trial + shopStats.active.production,
                    ...shopStats.active,
                },
                expired: {
                    total:
                        shopStats.expired.trial + shopStats.expired.production,
                    ...shopStats.expired,
                },
            },
        });
    } catch (error) {
        console.error("subscriptionStatistics error:", error);
        return res.status(500).json({ message: "Server error" });
    }
}

module.exports = {
    subscriptionStatistics,
    getlicence,
    createSubscription,
    getAllSubscriptions,
    getSubscriptionById,
    updateSubscription,
    deleteSubscription,
    confirmPayment,
    updateSubscriptionPayment,
    summary,
    getSubscriptionsByShopIds,
    extendSubscription,
    stripeCheckout,
    subscriptionSuccess,
    updateSubscriptionInappPayment,
    depositElimu,
    assignShopsToSubscription,
    verifyTransaction,
};
