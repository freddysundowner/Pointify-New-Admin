const mongoose = require("mongoose");

const orderItem = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product", 
        required: true,
    },
    sync: { type: Boolean, default: false },
    quantity: {
        type: Number,
        required: true,
    },
    sellingPrice:{
        type: Number,
        required: true,
    }

});
const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");
orderItem.plugin(markUnsyncedPlugin);
module.exports = mongoose.model("OrderItem", orderItem);
