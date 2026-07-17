const PurchaseReturn = require("../models/PurchaseReturn");
const Product = require("../models/product");
const PurchaseItem = require("../models/purchaseitem");
const mongoose = require("mongoose");
const Purchase = require("../models/purchase");
const { toDateFormat, fromDateFormat } = require("../shared/validationUtils");

exports.createPurchaseReturn = async (req, res) => {
  let { purchaseId, items, reason, deleteReceipt, invoiceType } = req.body;
  console.log(req.body);

  // try {
  const updatedPurchaseItems = [];
  let refundAmount = 0;
  if (invoiceType == "return") {
    await PurchaseReturn.findByIdAndRemove(purchaseId);
    return res.status(200).json({ message: "Invoice returned" });
  }
  let purchaseResponse = await Purchase.findById(purchaseId).populate(
    "supplierId" 
  );
  if (!purchaseResponse) {
    return res.status(404).json({ error: "Invoice not found" });
  }
  
    for (const returnItem of items) {

      if (deleteReceipt == false) {
        const purchaseItem = await PurchaseItem.findOne({
          product: returnItem.product,
          purchase: purchaseId,
        });

        if (!purchaseItem) {
          return res.status(404).json({ error: "Purchase item not found" });
        }
        refundAmount += returnItem.quantity * purchaseItem.unitPrice;

        const availableQuantity = purchaseItem.quantity;

        if (returnItem.quantity > availableQuantity) {
          return res
            .status(400)
            .json({ error: "Not enough quantity available for the return" });
        }

        // Update the purchased item quantity
        purchaseItem.quantity -= returnItem.quantity;
      
        await purchaseItem.save();

        updatedPurchaseItems.push({
          product: returnItem.product,
          quantity: returnItem.quantity,
          unitPrice: purchaseItem.unitPrice,
        });
        //update receipt
        console.log("refundAmount ",refundAmount, purchaseResponse.totalAmount)
        purchaseResponse.totalAmount = purchaseResponse.totalAmount - refundAmount;

       
        await purchaseResponse.save();
      }


    // Find and update the corresponding product to reduce its quantity
    const product = await Product.findById(returnItem.product);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Update product quantity
    product.quantity -= returnItem.quantity;

    // Update the product in the database
    await product.save();
    }
  if (purchaseResponse.totalAmount < 0) { 
    deleteReceipt = true;
  }
  if (deleteReceipt === false) {
    console.log("creating PurchaseReturn ",purchaseResponse.totalAmount)
      await PurchaseReturn.create({
        purchaseId,
        items: updatedPurchaseItems,
        refundAmount,
        supplierId: purchaseResponse.supplierId,
        shopId: purchaseResponse.shopId,
        attendantId: purchaseResponse.attendantId,
        reason,
        paymentType: purchaseResponse?.paymentType
      });
  }
  console.log("deleteReceipt ",deleteReceipt)
      

     //update outstanding balance
        if (purchaseResponse.paymentType == 'credit') { 
          let totalPaid = 0
          purchaseResponse.payments.forEach(element => {
            totalPaid += element.amount;
          });
          purchaseResponse.outstandingBalance = purchaseResponse.totalAmount - totalPaid;
          await purchaseResponse.save();
        }
      let results = await Purchase.findById(purchaseId)
        .populate({
          path: "items",
          populate: {
            path: "product",
            select: "name",
          },
        })
        .populate({
          path: "supplierId",
        })
        .populate({
          path: "supplierId",
        })
        .populate({
          path: "attendantId",
        })
        .sort({ createdAt: -1 });
    
    
  if (deleteReceipt && deleteReceipt === true) {
      console.log("deleteReceipt ",new mongoose.Types.ObjectId(purchaseId),deleteReceipt)
      await PurchaseItem.findOneAndRemove({ purchase: new mongoose.Types.ObjectId(purchaseId) });
      await Purchase.findByIdAndRemove(purchaseId);
      res.status(201).json({
        deleteReceipt:true,
      }); 
    } else {
      res.status(201).json(results);
    }
  // } catch (error) {
  //   console.log(error);
  //   res.status(500).json({ error: "Error creating purchase return" });
  // }
};

exports.getPurchaseReturn = async (req, res) => {
  try {
    const purchaseReturnId = req.params.id; // Assuming you pass the purchase return ID in the URL

    // Fetch the purchase return by its ID
    const purchaseReturn = await PurchaseReturn.findById(purchaseReturnId);

    if (!purchaseReturn) {
      return res.status(404).json({ error: "Purchase return not found" });
    }

    // Respond with the purchase return details
    res.json(purchaseReturn);
  } catch (error) {
    res.status(500).json({ error: "Error fetching purchase return" });
  }
};

exports.updatePurchaseReturn = async (req, res) => {
  try {
    const purchaseReturnId = req.params.id; // Assuming you pass the purchase return ID in the URL
    const { originalPurchaseId, items, refundAmount, reason } = req.body; // Destructure the fields to update

    // Find and update the purchase return by its ID
    const updatedPurchaseReturn = await PurchaseReturn.findByIdAndUpdate(
      purchaseReturnId,
      {
        originalPurchaseId,
        items,
        refundAmount,
        reason,
      },
      { new: true } // Return the updated document
    );

    if (!updatedPurchaseReturn) {
      return res.status(404).json({ error: "Purchase return not found" });
    }

    // Respond with the updated purchase return
    res.json(updatedPurchaseReturn);
  } catch (error) {
    res.status(500).json({ error: "Error updating purchase return" });
  }
};

exports.deletePurchaseReturn = async (req, res) => {
  try {
    const purchaseReturnId = req.params.id; // Assuming you pass the purchase return ID in the URL

    // Find and delete the purchase return by its ID
    const deletedPurchaseReturn = await PurchaseReturn.findByIdAndRemove(
      purchaseReturnId
    );

    if (!deletedPurchaseReturn) {
      return res.status(404).json({ error: "Purchase return not found" });
    }

    // Respond with a success message or the deleted purchase return
    res.json({ message: "Purchase return deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Error deleting purchase return" });
  }
};
exports.getPurchaseReturns = async (req, res) => {
  try {
    const { supplierId, toDate, fromDate, shopId, page, limit } = req.query;

    let filter = {};
    if (shopId) {
      filter.shopId = new mongoose.Types.ObjectId(shopId);
    }
    if (fromDate && toDate) {
      filter.createdAt = {
        $gte: fromDateFormat(fromDate),
        $lte: toDateFormat(toDate),
      };
    }
    if (supplierId) {
      filter.supplierId = supplierId;
    }

    let purchaseReturns;
    let meta = null;

    if (page && limit) {
      // parse integers safely
      const _page = parseInt(page) || 1;
      const _limit = parseInt(limit) || 10;
      const skip = (_page - 1) * _limit;

      const total = await PurchaseReturn.countDocuments(filter);

      purchaseReturns = await PurchaseReturn.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(_limit)
        .populate({
          path: "attendantId",
          select: "username",
        })
        .populate({
          path: "supplierId",
          select: "name",
        })
        .populate({
          path: "shopId",
        })
        .populate({
          path: "items",
          populate: {
            path: "product",
            select: "name",
          },
        });

      meta = {
        total,
        page: _page,
        limit: _limit,
        pages: Math.ceil(total / _limit),
      };
    } else {
      // No pagination
      purchaseReturns = await PurchaseReturn.find(filter)
        .sort({ createdAt: -1 })
        .populate({
          path: "attendantId",
          select: "username",
        })
        .populate({
          path: "supplierId",
          select: "name",
        })
        .populate({
          path: "shopId",
        })
        .populate({
          path: "items",
          populate: {
            path: "product",
            select: "name",
          },
        });
    }

    res.json({
      data: purchaseReturns,
      ...(meta && { meta }),  // only include meta if paginated
    });

  } catch (error) {
    console.error("Error fetching purchase returns:", error);
    res.status(500).json({ error: "Error fetching purchase returns by supplier" });
  }
};

