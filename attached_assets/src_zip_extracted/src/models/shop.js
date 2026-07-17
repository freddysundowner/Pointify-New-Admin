const mongoose = require("mongoose");

const shopSchema = new mongoose.Schema({
    name: { type: String },
    sync: { type: Boolean, default: false },
    address: { type: String },
    shopCategoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ShopCategory",
        default: null,
    },
    isGuestHouse: { type: Boolean, default: false },
    mpesa_require_validation: { type: Boolean, default: false },
    viewAllCustomers: { type: Boolean, default: false },
    showstockonline: { type: Boolean, default: false },
    showpriceonline: { type: Boolean, default: false },
    sunpay_merchant_id: { type: String, default: null },
    sunpay_merchant_ref: { type: String, default: null }, // e.g. "SP3" — shown to customers
    sunpay_paybill_type: { type: String, default: null }, // "till" | "paybill"
    sunpay_linked_at: { type: Date, default: null },
    sunpay_link_error: { type: String, default: null },
    isRestaurant: { type: Boolean, default: false },
    location: {
        type: {
            type: String,
            default: "Point",
        },
        coordinates: {
            type: [Number],
            default: [0, 0],
        },
    },
    subscription: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Subscription",
    },
    deletewarning: {
        type: Number,
        default: 0,
    },
    tax: {
        type: Number,
        default: 0,
    },
    affliate: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Affliate",
        default: null,
    },
    backupdate: {
        type: Date,
        default: null,
    },
    currency: { type: String },
    warehouseemail: { type: String },
    contact: { type: String },
    paybill_till: { type: String },
    paybill_account: { type: String },
    address_receipt: { type: String },
    backupInterval: { type: String },
    backupemail: { type: String },
    receiptemail: { type: String, default: "" },
    warehouse: { type: Boolean, default: false },
    allowBackup: { type: Boolean, default: true },
    useWarehouse: { type: Boolean, default: false },
    trackbatches: { type: Boolean, default: false },
    allowOnlineSelling: { type: Boolean, default: true },
    allownegativeselling: { type: Boolean, default: false },
    production: { type: Boolean, default: false },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin",
    },
    createAt: {
        type: Date,
        default: Date.now,
    },
});
shopSchema.index({ location: "2dsphere" });
shopSchema.index({ adminId: 1 });
shopSchema.index({ affliate: 1 });
shopSchema.index({ createAt: -1 });
// Example usage
const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");
shopSchema.plugin(markUnsyncedPlugin);
const Shop = mongoose.model("Shop", shopSchema);
// // Example usage
// const invalidShop = new Shop({});

// try {
//   invalidShop.validateSync();
// } catch (error) {
//   console.error('Validation Error:', error.message);
//   // Handle or log the error as needed
// }

module.exports = Shop;
