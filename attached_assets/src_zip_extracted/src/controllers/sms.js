
const { topUpWallet } = require("../shared/functions");
const SmsLog = require("../models/smslog");

exports.getSmsLogs = async (req, res) => {
    try {
        const {
            adminId,
            shopId,
            saleId,
            status,
            smsType,
            phone,
            page = 1,
            limit = 20,
        } = req.query;

        const filter = {};

        if (adminId) filter.adminId = adminId;
        if (shopId) filter.shopId = shopId;
        if (saleId) filter.saleId = saleId;
        if (status) filter.status = status;
        if (smsType) filter.smsType = smsType;

        if (phone) {
            filter.phone = { $regex: phone, $options: "i" };
        }

        const pages = Number(page);
        const limits = Number(limit);
        const skip = (pages - 1) * limits;

        const logs = await SmsLog.find(filter)
            .populate("shopId", "name")
            .populate("saleId", "receiptNo amountPaid")
            .populate("customerId", "name phonenumber")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limits);

        const total = await SmsLog.countDocuments(filter);

        return res.status(200).json({
            success: true,
            logs,
            total,
            currentPage: pages,
            totalPages: Math.ceil(total / limits),
        });
    } catch (error) {
        console.error("getSmsLogs error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to get SMS logs",
        });
    }
};
exports.topup = async (req, res) => {
    console.log(req.body);
    const response = await topUpWallet(req.body);
    console.log(response);
    res.send(response);
}; 