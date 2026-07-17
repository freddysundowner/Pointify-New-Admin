const Supplier = require("../models/supplier");
const Purchase = require("../models/purchase");
const UserPayment = require("../models/payment");
const purchase = require("../models/purchase");
const mongoose = require("mongoose");

// Create a new supplier
const createSupplier = async (req, res) => {
  const { name, shopId, phoneNumber } = req.body;
  console.log(req.body)
  try {
    const supplier = new Supplier({ name, shopId,phoneNumber });
    await supplier.save();
    res.status(201).json(supplier);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get all suppliers
const getSupplierSupplies = async (req, res) => {
  try {
    const { shopId, page = 1, limit =20 } = req.query;
    let filter = {};
    if (shopId) {
      filter.shopId = shopId;
    }

    const pages = Number(page);
    const limits = Number(limit);
    const skip = (pages - 1) * limits;

    const total = await Supplier.countDocuments(filter);

    const suppliers = await Supplier.find(filter)
      .skip(skip)
      .limit(limits);

    res.status(200).json({ suppliers, pagination: { total, page, limit } });
    res.status(200).json(suppliers);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};
const bulkDeleteSuppliers = async (req, res) => {
  try {
    const { supplierIds, shopId } = req.body;
    if(!shopId){
      return res.status(400).json({ error: "Shop ID is required" });
    }
    if(!supplierIds || supplierIds.length === 0){
      return res.status(400).json({ error: "Supplier IDs are required" });
    }
    await Supplier.deleteMany({ _id: { $in: supplierIds } ,shopId:shopId });
    res.status(200).json({ message: "Suppliers deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}
// Get all suppliers
const getAllSuppliers = async (req, res) => {
  try {
    const { shopId, page = 1, limit =20 } = req.query;
    let filter = {};
    if (shopId) {
      filter.shopId = shopId;
    }

    const pages = Number(page);
    const limits = Number(limit);
    const skip = (pages - 1) * limits;

    const total = await Supplier.countDocuments(filter);

    const suppliers = await Supplier.find(filter)
      .skip(skip)
      .limit(limits);

    res.status(200).json({ suppliers, pagination: { total, page, limit } });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

const paySupplierCredit = async (supplierId, amount, attendantId) => {
  let remaining = amount;

  // pay oldest purchase balances first
  while (remaining > 0) {
    const unpaidPurchase = await Purchase.findOne({
      supplierId,
      paymentType: 'credit',
      outstandingBalance: { $gt: 0 }
    }).sort({ createdAt: 1 });

    if (!unpaidPurchase) break;

    const toPay = Math.min(unpaidPurchase.outstandingBalance, remaining);
    unpaidPurchase.outstandingBalance -= toPay;
    unpaidPurchase.payments.push({
      amount: toPay,
      attendantId,
      paymentNo: `REC${Math.floor(100000 + Math.random() * 9000000)}`,
      paymentType: "cash"
    });
    await unpaidPurchase.save();
    remaining -= toPay;
  }

  // update wallet ledger
  const supplier = await Supplier.findById(supplierId);
  supplier.wallet = (supplier.wallet ?? 0) + amount; // paying increases wallet towards positive
  await supplier.save();
  return supplier;
};


// Update a supplier by ID
const updateSupplier = async (req, res) => {
  const { id } = req.params;
  console.log(req.body)
  try {
    const { name, shopId, phoneNumber, email, address, amount ,attendantId} = req.body;
    if (amount > 0) {
      const lastPayment = await UserPayment.findOne({
        supplierId: id
      }).sort({ createdAt: -1 });

      await UserPayment.create({
        type: "payment",
        shopId: shopId,
        supplierId: id,
        attendantId,
        totalAmount: amount,
        balance: (lastPayment?.balance??0) + amount
      });
      //clear random credit receipt
      let customer = await paySupplierCredit(id, amount, attendantId)
      return res.json(customer);
    }
    const updatedSupplier = await Supplier.findByIdAndUpdate(
      id,
      { name, shopId, phoneNumber, email, address },
      { new: true }
    );
    if (!updatedSupplier) {
      return res.status(404).json({ error: "Supplier not found" });
    }
    res.status(200).json(updatedSupplier);
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: "Internal server error" });
  }
};

// Delete a supplier by ID
const deleteSupplier = async (req, res) => {
  const { id } = req.params;
  try {
    const deletedSupplier = await Supplier.findByIdAndRemove(id);
    if (!deletedSupplier) {
      return res.status(404).json({ error: "Supplier not found" });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};
const importSuppliers = async (req, res) => {
  console.log("importSuppliers")
  try {
    let { suppliers } = req.body;
    let successCount = 0;
    let failCount = 0;
    let faledResults = [];
  console.log("importSuppliers",suppliers) 

    const promises = suppliers.map(async (i) => {
      try { 
        // Find the category by name
        if (i.debt && i.debt > 0) { 
          i.wallet -= i.debt;
        }
        await Supplier.findOneAndUpdate(
          { name: i.name, shopId:i.shopId  },
          i,
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        successCount++;
      } catch (error) {
        faledResults.push(i.name);
        console.error(`Failed to import product: ${i.name}`, error);
        failCount++;
      }
    });

    // Wait for all product creations to complete
    await Promise.all(promises);
    console.log(faledResults);
    res.status(200).json({
      message: `Imported ${successCount} Suppliers, ${failCount} failed.`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};
module.exports = {
  createSupplier,
  getAllSuppliers,
  updateSupplier,
  deleteSupplier,
  getSupplierSupplies,
  importSuppliers,
  bulkDeleteSuppliers
};
