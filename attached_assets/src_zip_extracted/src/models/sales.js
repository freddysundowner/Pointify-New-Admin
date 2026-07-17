const mongoose = require("mongoose");

const saleSchema = new mongoose.Schema({
  createdAt: {
    type: Date,
    default: Date.now,
  },
  sync: { type: Boolean, default: false },
  totalAmount: {
    type: Number,
    required: true,
  },
  mpesaNewTotal: {
    type: Number,
    default: 0
  },
  bankTotal: {
    type: Number,
    default: 0
  },
  totalWithDiscount: {
    type: Number,
    required: true,
  },
  totaltax: {
    type: Number,
  },
  extraChargesTotal: {
    type: Number,
    default: 0,
  },
  extraCharges: [
    {
      name: {
        type: String,
        required: true,
      },
      amount: {
        type: Number,
        required: true,
        default: 0,
      },
    },
  ],
  saleType: {
    type: String,
    enum: ["Retail", "Dealer", "Wholesale", "Order"],
    default: "Retail",
  },
  order: {
    type: String,
    // enum: ["pending", "cancelled", "completed", "refunded"],
    default: null
  },
  status: {
    type: String,
    default: "cashed",
  },
  items: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SaleItem",
    },
  ],
  duedate: {
    type: Date,
    default: null
  },
  salesnote: {
    type: String,
  },
  receiptNo: {
    type: String,
  },
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
    required: true,
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
  },
  attendantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Attendant",
  },
  paymentType: {
    type: String,
    enum: ["cash", "credit", "wallet", "mpesa", 'later', 'card', 'bank', 'split'],
    default: "cash",
    required: true,
  },
  paymentTag: {
    type: String,
    default: "cash",
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
  },
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Batch",
  },
  amountPaid: {
    type: Number,
    default: 0
  },
  saleDiscount: {
    type: Number,
    default: 0
  },
  totalDiscount: {
    type: Number,
    get: function () {
      if (this.items && this.items.length > 0) {
        return this.items.reduce((total, item) => {
          return total + item.lineDiscount * item.quantity;
        }, 0);
      }
      return 0; // Default to 0 if no items
    },
  },
  outstandingBalance: {
    type: Number,
    default: 0
  },
  clientRef: {
    type: String,
    default: undefined,
  },
  
  saleDate: {
    type: Date,
    default: Date.now
  },
  payments: [
    {
      amount: {
        type: Number,
        required: true,
      },
      attendantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Attendant",
        required: true,
      },
      paymentNo: {
        type: String,
      },
      balance: {
        type: Number,
      },
      mpesaCode: {
        type: String,
        default: null
      },
      paymentType: {
        type: String,
      },
      date: {
        type: Date,
        default: Date.now,
      },
    },
  ],
});
// Define a pre-save middleware to generate the purchaseNo
saleSchema.pre("save", function (next) {
  if (!this.receiptNo) {
    // If purchaseNo is not already set, generate it
    const prefix = "REC"; // Customize the prefix as needed
    const randomPart = Math.floor(10000 + Math.random() * 900000);
    this.receiptNo = `${prefix}${randomPart}`;
  }
  next();
});
const markUnsyncedPlugin = require("../shared/markUnsynced.plugin");
saleSchema.plugin(markUnsyncedPlugin);
saleSchema.index({ clientRef: 1 }, { unique: true, sparse: true });
module.exports = mongoose.model("Sale", saleSchema);
