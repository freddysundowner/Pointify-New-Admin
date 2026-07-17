const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    sync: { type: Boolean, default: false },
    buyingPrice: {
        type: Number,
    },
    sellingPrice: {
        type: Number,
    },
    wholesalePrice: {
        type: Number,
    },
    batches: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Batch",
        },
    ],
    images: {
        type: Array,
        default: [],
    },
    dealerPrice: {
        type: Number,
    },
    minSellingPrice: {
        type: Number,
    },
    quantity: {
        type: Number,
    },
    lastCount: {
        type: Number,
        default: 0,
    },
    maxDiscount: {
        type: Number,
    },
    reorderLevel: {
        type: Number,
        default: 0,
    },
    productCategoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ProductCategory",
    },
    measure: {
        type: String,
        default: "",
    },
    manufacturer: {
        type: String,
        default: "",
    },
    measureUnit: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Measure",
    },
    deleted: {
        type: Boolean,
        default: false,
    },
    virtual: {
        type: Boolean,
        default: false,
    },
    bundle: {
        type: Boolean,
        default: false,
    },
    manageByPrice: {
        type: Boolean,
        default: false,
    },
    taxable: {
        type: Boolean,
        default: false,
    },
    supplierId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Supplier",
    },
    shopId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Shop",
    },
    description: {
        type: String,
    },
    uploadImage: {
        type: String,
    },
    attendantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Attendant",
        required: true,
    },
    admin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin",
    },
    lastcoundate: {
        type: Date,
        default: null,
    },
    expiryDate: {
        type: Date,
        default: null,
    },
    serialnumber: {
        type: String,
        default: null,
    },
    barcode: {
        type: String,
        default: null,
    },
    productType: {
        type: String,
        default: "product",
    },

    date: {
        type: Date,
        default: Date.now,
    },
});
const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");
productSchema.plugin(markUnsyncedPlugin);
const Product = mongoose.model("Product", productSchema);

module.exports = Product;
