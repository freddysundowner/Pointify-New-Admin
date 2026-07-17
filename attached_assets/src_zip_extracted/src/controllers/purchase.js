const PurchaseReturn = require("../models/PurchaseReturn");

const Shop = require("../models/shop");
const Purchase = require("../models/purchase");
const PurchaseItem = require("../models/purchaseitem");
const Product = require("../models/product");
const UserPayment = require("../models/payment");
const PDFDocument = require("pdfkit");
const Supplier = require("../models/supplier");
const Inventory = require("../models/inventory");
const { handleValidationErrors } = require("../shared/validationUtils"); // Adjust the path as needed
const purchaseitem = require("../models/purchaseitem");
const { toDateFormat, fromDateFormat } = require("../shared/validationUtils");
const { createNewBatch } = require("../shared/functions");
const mongoose = require("mongoose");
const { sendEmail } = require("../shared/emailsetup");

const fs = require("fs");
const createPurchaseWithItems = async (req, res) => {
  try {
    const {
      purchase,
      purchaseItems,
      amountpaid = 0,
      trackBatches = false,
    } = req.body;
    console.log(req.body);
    let totalAmount = 0;
    for (const item of purchaseItems) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res
          .status(400)
          .json({ error: `Product with ID ${item.product} not found` });
      }
      totalAmount += item.unitPrice * item.quantity;
    }
    if (
      purchase.paymentType === "credit" &&
      (purchase.supplierId == "" || purchase.supplierId == null)
    ) {
      return res.status(400).json({ error: "you have to select a supplier " });
    }
    let outstandingBalance = 0;
    if (purchase.paymentType === "credit") {
      outstandingBalance = totalAmount - amountpaid;
    }
    // Create a new Purchase instance with the extracted data
    let purchaseData = {
      totalAmount,
      outstandingBalance: outstandingBalance,
      shopId: purchase.shopId,
      supplierId: purchase.supplierId,
      attendantId: purchase.attendantId,
      paymentType: purchase.paymentType,
      amountPaid: amountpaid,
      payments: []
    };
    const sale = new Purchase(purchaseData);

    // Save the sale to the database
    await sale.save();

    // Reduce the quantity of products and create entries in SaleItem
    for (const item of purchaseItems) {
      if (trackBatches == true) {
        let data = {
          _id: item.product,
          buyingPrice: item.unitPrice,
          quantity: item.quantity,
          shopId: purchase.shopId,
        };
        await createNewBatch(data, true);
      }
      const inventoryFilter = {
        shop: new mongoose.Types.ObjectId(purchase.shopId),
        product: new mongoose.Types.ObjectId(item.product),
      };

      const existingInventory = await Inventory.findOne(inventoryFilter);

      const product = await Product.findById(item.product);
      if (existingInventory) {
        if (existingInventory.quantity < 0) {
          // overwrite with new value
          existingInventory.quantity = product.quantity;
        } else {
          // increment normally
          existingInventory.quantity += item.quantity;
        }

        await existingInventory.save();
      } else {
        await Inventory.create({
          product: new mongoose.Types.ObjectId(item.product),
          shop: new mongoose.Types.ObjectId(purchase.shopId),
          attendant: purchase.attendantId?._id
            ? new mongoose.Types.ObjectId(purchase.attendantId._id)
            : new mongoose.Types.ObjectId(purchase.attendantId),
          quantity: item.quantity,
        });
      }
      product.quantity += item.quantity;
      if (trackBatches == false) {
        product.buyingPrice = item.unitPrice;
      }
      product.sellingPrice = item.sellingPrice;
      await product.save();
      const saleItem = new PurchaseItem({
        product: item.product,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        purchase: sale._id,
        attendantId: purchase.attendantId,
        shop: purchase.shopId,
      });

      await saleItem.save();
      sale.items.push(saleItem._id);
    }
    await sale.save();

    if (purchase.paymentType === "credit" && outstandingBalance > 0) {
      let ress = await Supplier.findByIdAndUpdate(
        purchase.supplierId,
        {
          $inc: { wallet: -outstandingBalance },
        }
      );
      if (ress?.wallet > 0) {
        let amounntpaid = 0;
        let balance = 0;
        if (ress?.wallet >= outstandingBalance) {
          amounntpaid = outstandingBalance
          balance = ress?.wallet - outstandingBalance;
        } else {
          amounntpaid = ress?.wallet;
        }
        await UserPayment.create({
          type: "payment",
          shopId: purchase.shopId,
          supplierId: purchase.supplierId,
          attendantId: purchase.attendantId,
          totalAmount: amounntpaid,
          balance: ress?.wallet
        });
        sale.payments = [{
          amount: amounntpaid,
          attendantId: purchase.attendantId,
          paymentNo: `REC${Math.floor(100000 + Math.random() * 9000000)}`,
          paymentType: "cash"
        }]
        await sale.save();
      }
    }

    let ressales = await Purchase.findById(sale._id)
      .populate("attendantId", "username")
      .populate("shopId", "name")
      .populate("supplierId", "name")
      .populate("items.product", "name")
      .populate({
        path: "items",
        populate: {
          path: "product",
        },
      })
      .populate({
        path: "items",
        populate: {
          path: "product",
          populate: {
            path: "batches",
          },
        },
      });
    res.status(201).json({
      message: "Purchase created successfully",
      purchase: ressales,
    });
  } catch (error) {
    console.log(error);
    handleValidationErrors(error, res);
  }
};

const populateFields = (query) => {
  const fields = ["shopId", "supplierId", "attendantId", "items"];
  const select = {
    shopId: "name",
    supplierId: "name",
    attendantId: "username",
  };
  fields.forEach((field) => {
    if (field === "items") {
      query = query.populate({
        path: "items",
        populate: {
          path: "product",
          select: "name quantity",
        },
      });
    } else {
      query = query.populate({
        path: field,
        select: select[field] || "", // You can customize the select object if needed
      });
    }
  });
  return query;
};
const getProductPurchasesReceiptItems = async (req, res) => {
  try {
    const {
      attendantId,
      startDate,
      endDate,
      product,
      shop,
      warehouse = false,
    } = req.query;
    let filter = {};
    if (startDate && endDate) {
      new Date(startDate).setUTCHours(23, 59, 59, 999);
      new Date(endDate).setHours(0, 0, 0, 0);
      filter.createdAt = {
        $gte: new Date(startDate).setHours(0, 0, 0, 0),
        $lte: new Date(endDate).setUTCHours(23, 59, 59, 999),
      };
    }

    if (attendantId) {
      filter.attendantId = attendantId;
    }
    if (product) {
      filter.product = product;
    }
    if (shop && warehouse == "true") {
      filter.shop = shop;
    }

    // Use Mongoose to find sales matching the filter and populate the referenced fields
    const purchases = await purchaseitem
      .find(filter)
      .populate("attendantId", "username")
      .populate("purchase", "purchaseNo")
      .populate("product", "name buyingPrice, sellingPrice")
      .sort({ createdAt: -1 });

    res.status(200).json({ purchases });
  } catch (error) {
    console.error("Error fetching sales:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
const getAllPurchases = async (req, res) => {
  try {
    const { shopId, attendantId, supplierId, paymentType, start, end, purchaseNo, page, limit, name } =
      req.query;
    let filter = {
      totalAmount: { $gt: 0 },
    };
    console.log(req.query)
    if (start && end) {
      new Date(end).setUTCHours(23, 59, 59, 999);
      new Date(start).setHours(0, 0, 0, 0);
      filter.createdAt = {
        $gte: new Date(start).setHours(0, 0, 0, 0),
        $lte: new Date(end).setUTCHours(23, 59, 59, 999),
      };
    }

    if (shopId) {
      filter.shopId = shopId;
    }
    if (name) {
      let ids = await Shop.find({ name: { $regex: name, $options: "i" } }).select("_id");
      filter.shopId = { $in: ids };
    }

    if (attendantId) {
      filter.attendantId = attendantId;
    }

    if (supplierId) {
      filter.supplierId = supplierId;
    }
    if (purchaseNo) {
      filter.purchaseNo = { $regex: purchaseNo, $options: "i" }
    }

    if (paymentType) {
      filter.paymentType = paymentType;
      if (paymentType == "credit") {
        // filter.paymentType = { $in: ["credit"] };
        filter.outstandingBalance = { $gt: 0 };
      } else {
        filter.paymentType = { $in: ["mpesa", "cash", "bank", "credit"] };
        filter.outstandingBalance = { $lte: 0 };
      }
    }
    if (limit && page) {
      let purchases = await Purchase.find(filter).populate({
        path: "items",
        populate: {
          path: "product",
          select: "name quantity",
        },
      }).populate('shopId', 'name').populate('supplierId').populate('attendantId', 'username')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);
      return res.status(200).json({
        purchases,
        page,
        limit,
        total: await Purchase.countDocuments(filter),
      });
    }
    let query = Purchase.find(filter).sort({ createdAt: -1 });
    query = populateFields(query);

    const purchases = await query.exec();

    res.status(200).json(purchases);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get a single purchase by ID
const getPurchaseById = async (req, res) => {
  const { purchaseId } = req.params;
  try {
    let query = Purchase.findById(purchaseId);
    query = populateFields(query);

    const purchase = await query.exec();

    if (!purchase) {
      return res.status(404).json({ error: "Purchase not found" });
    }
    res.status(200).json(purchase);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Update a purchase by ID
const updatePurchase = async (req, res) => {
  const { purchaseId } = req.params;
  const updateData = req.body;

  try {
    const purchase = await Purchase.findByIdAndUpdate(purchaseId, updateData, {
      new: true,
    });

    if (!purchase) {
      return res.status(404).json({ error: "Purchase not found" });
    }

    res.status(200).json(purchase);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

// Delete a purchase by ID
const deletePurchase = async (req, res) => {
  const { id } = req.params;

  try {
    const purchase = await Purchase.findById(id).populate("items");

    if (!purchase) {
      return res.status(404).json({ error: "Purchase not found" });
    }

    // Loop through each purchase item to reverse quantity updates
    for (const item of purchase.items) {
      const product = await Product.findById(item.product);
      if (product) {
        product.quantity -= item.quantity;
        await product.save();
      }

      // Update inventory quantity if applicable
      await Inventory.updateOne(
        {
          product: item.product,
          shop: purchase.shopId,
        },
        {
          $inc: { quantity: -item.quantity },
        }
      );

      // Delete purchase item
      await PurchaseItem.findByIdAndDelete(item._id);
    }

    console.log(purchase)
    if (purchase?.paymentType == 'credit' && purchase?.outstandingBalance > 0) {
      await Supplier.findByIdAndUpdate(
        purchase?.supplierId,
        { $inc: { wallet: purchase?.outstandingBalance } }
      );
    }

    // Finally, delete the purchase record
    await Purchase.findByIdAndDelete(id);

    res.status(204).json({ status: true, message: "purchase deleted" }); // No content in response
  } catch (error) {
    console.error("Error deleting purchase:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};


const getPurchaseItemsByPurchaseId = async (req, res) => {
  try {
    const purchaseId = req.params.purchaseId; // Assuming you pass the purchase ID as a URL parameter

    // Query the database to retrieve purchase items by purchase ID and populate attendantId and product
    const purchaseItems = await PurchaseItem.find({ purchase: purchaseId })
      .populate("attendantId", "username") // Populate attendantId with username
      .populate("product", "name"); // Populate product with name

    if (purchaseItems.length === 0) {
      return res.status(404).json({
        error: "No purchase items found for the specified purchase.",
      });
    }

    // You can also fetch additional data related to the purchase, like purchaseNo or purchase details, if needed
    const purchase = await Purchase.findById(purchaseId); // Example if you have a Purchase model

    // Create the desired object structure
    const result = {
      purchaseNo: purchase.purchaseNo, // Add the actual field name from your Purchase model
      purchaseId, // Purchase ID from the URL parameter
      items: purchaseItems, // Array of purchase items with attendantId and product populated
    };

    res.json(result);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error fetching purchase items by purchase ID" });
  }
};
const getPurchaseItemsBySupplierId = async (req, res) => {
  try {
    const supplierId = req.params.supplierId; // Assuming you pass the supplier ID as a URL parameter

    // Query the database to retrieve purchase items by supplier ID
    const purchaseItems = await PurchaseItem.find({ supplierId: supplierId });

    if (purchaseItems.length === 0) {
      return res
        .status(404)
        .json({ error: "No purchase items found for the specified supplier." });
    }

    res.json(purchaseItems);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error fetching purchase items by supplier ID" });
  }
};
const getPurchasesBySupplierId = async (req, res) => {
  try {
    const { supplierId } = req.params;
    const { credit } = req.query;

    // Construct the query based on supplierId and credit status
    const query = { supplierId };

    if (credit == "true") {
      // Filter by credit status (true or false)
      query.outstandingBalance = { $gt: 0 };
    }

    console.log(query);

    // Use the query to find purchases
    const purchases = await Purchase.find(query).populate({
      path: "attendantId",
      select: "username",
    });

    res.status(200).json(purchases);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const searchPurchasesByPurchaseNo = async (req, res) => {
  try {
    const { purchaseNo } = req.query;

    try {
      const regex = new RegExp(purchaseNo, "i");
      let query = Purchase.find({ purchaseNo: regex });
      query = populateFields(query);

      const purchases = await query.exec();

      res.status(200).json(purchases);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }

    // Use a regular expression to perform a case-insensitive search
    // const regex = new RegExp(purchaseNo, "i");
    // const query = Purchase.find({ purchaseNo: regex });
    // query = populateFields(query);

    // const purchases = await query.exec();

    // res.status(200).json(purchases);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error searching purchases" });
  }
};

const groupPurchasesByMonth = async (req, res) => {
  const { product, startDate, endDate, shop, usewarehouse = false } = req.query;
  try {
    let matchQuery = {
      product: new mongoose.Types.ObjectId(product),
      createdAt: {
        $gte: new Date(startDate),
        $lt: new Date(endDate),
      },
    };
    if (usewarehouse == "true") {
      matchQuery.shop = new mongoose.Types.ObjectId(shop);
    }
    console.log(matchQuery);

    const result = await purchaseitem.aggregate([
      {
        $match: matchQuery,
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          totalSales: {
            $sum: {
              $subtract: [
                { $multiply: ["$unitPrice", "$quantity"] },
                "$lineDiscount",
              ],
            },
          },
          count: { $sum: 1 },
          totalQuantity: { $sum: "$quantity" },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 },
      },
    ]);

    // Create an object to store sales data for each month
    const salesByMonth = {};

    // Iterate through the result and populate the salesByMonth object
    result.forEach((item) => {
      const monthName = new Date(
        item._id.year,
        item._id.month - 1
      ).toLocaleString("en-US", { month: "long" });

      salesByMonth[monthName] = {
        totalPurchases: item.totalSales,
        count: item.count,
        quantity: item.totalQuantity,
      };
    });

    // Ensure all months are present in the final result, even if sales are 0
    console.log(salesByMonth);
    const allMonths = [...Array(12).keys()].map((month) => {
      const monthName = new Date(2000, month, 1).toLocaleString("en-US", {
        month: "long",
      });
      return {
        month: monthName,
        totalPurchases: salesByMonth[monthName]
          ? salesByMonth[monthName].totalPurchases
          : 0,
        count: salesByMonth[monthName] ? salesByMonth[monthName].count : 0,
        totalQuantity: salesByMonth[monthName]
          ? salesByMonth[monthName].quantity
          : 0,
      };
    });

    res.status(200).json(allMonths);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const getPurchasesSummary = async (req, res) => {
  try {
    const { fromDate, toDate, shopid, supplierId, attendantId, purchaseNo, paymentType } = req.query;
    let filter = {}
    if (fromDate && toDate) {
      filter.createdAt = {
        $gte: fromDateFormat(fromDate),
        $lte: toDateFormat(toDate),
      }
    }
    if (shopid) {
      filter.shopId = new mongoose.Types.ObjectId(shopid)
    }
    if (supplierId) {
      filter.supplierId = new mongoose.Types.ObjectId(supplierId);
    }
    if (attendantId) {
      filter.attendantId = attendantId;
    }
    if (purchaseNo) {
      filter.purchaseNo = { $regex: purchaseNo, $options: "i" }
    }

    if (paymentType) {
      filter.paymentType = paymentType;
      if (paymentType == "credit") {
        // filter.paymentType = { $in: ["credit"] };
        filter.outstandingBalance = { $gt: 0 };
      } else {
        filter.paymentType = { $in: ["mpesa", "cash", "bank", "credit"] };
        filter.outstandingBalance = { $lte: 0 };
      }
    }
    console.log(filter)

    const totalCashPurchases = await Purchase.aggregate([
      {
        $match: { ...filter, paymentType: { $in: ["mpesa", "cash", "bank", "credit"] }, outstandingBalance: { $lte: 0 } },
      },
      {
        $group: {
          _id: null,
          totalCashPurchases: { $sum: "$totalAmount" },
        },
      },
    ]);

    const totalCreditPurchases = await Purchase.aggregate([
      {
        $match: { ...filter, paymentType: 'credit', outstandingBalance: { $gt: 0 } },
      },
      {
        $group: {
          _id: null,
          totalCreditPurchases: { $sum: '$outstandingBalance' },
          totalCreditPaid: {
            $sum: { $subtract: ["$totalAmount", "$outstandingBalance"] },
          },
        },
      },
    ]);
    console.log(totalCreditPurchases)

    const totalRefundAmount = await PurchaseReturn.aggregate([
      {
        $match: filter,
      },
      {
        $group: {
          _id: null,
          totalRefundAmount: { $sum: "$refundAmount" },
        },
      },
    ]);
    let paid = totalCashPurchases.length > 0
      ? totalCashPurchases[0].totalCashPurchases
      : 0;
    paid += totalCreditPurchases.length > 0 ? totalCreditPurchases[0].totalCreditPaid : 0;

    let cash = totalCashPurchases.length > 0
      ? totalCashPurchases[0].totalCashPurchases
      : 0;

    let credit = totalCreditPurchases.length > 0
      ? totalCreditPurchases[0].totalCreditPurchases
      : 0;

    let returns =
      totalRefundAmount.length > 0
        ? totalRefundAmount[0].totalRefundAmount
        : 0;

    let totalpurchases = credit + paid
    res.json({
      cash,
      credit,
      returns,
      paid,
      totalpurchases
    });
  } catch (error) {
    console.error("Error fetching sales summary:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

sendreportemail = async (req, res) => {
  let { fromDate, toDate, shop, paymentTag, status, email } = req.query;

  console.log(req.query);
  generatePurchasesReportByDatePDF(fromDate, toDate, shop, email, paymentTag);
  res.json({ message: "Statement request was successful, check your email." });
};

generatePurchasesReportByDatePDF = async (
  startDate,
  endDate,
  shop,
  email,
  paymentType
) => {
  let filter = {
    createdAt: {
      $gte: fromDateFormat(startDate),
      $lt: toDateFormat(endDate),
    },
    shopId: shop,
  };
  if (paymentType) {
    filter.paymentType = paymentType;
  }

  console.log(filter);

  const purchase = await Purchase.find(filter)
    .populate({
      path: "items",
      populate: {
        path: "product",
      },
    })
    .populate("supplierId")
    .sort({ createdAt: -1 });

  const shopData = await Shop.findById(shop).populate("adminId");
  const purchaseData = [];
  let total = 0;
  purchase.forEach((purchase) => {
    purchase.items.forEach((item) => {
      const product = item.product;
      total += item.unitPrice * item.quantity;
      purchaseData.push({
        Product: product.name,
        Date: purchase.createdAt.toLocaleString(),
        Supplier: `${purchase?.supplierId ? purchase?.supplierId?.name : ""}`,
        Cost: `${shopData.currency}  ${item.unitPrice.toFixed(2)}`,
        Total: `${item.quantity} @ ${shopData.currency} ${(
          item.unitPrice * item.quantity
        ).toFixed(2)}`,
      });
    });
  });

  const pdfDoc = new PDFDocument({ margin: 20, size: "A4" });
  const fileName = `purchase_report_${startDate}_to_${endDate}.pdf`;
  const filePath = `/var/www/pointify/new-api/${fileName}`;

  pdfDoc.pipe(fs.createWriteStream(filePath));

  pdfDoc.fontSize(18).text("PURCHASES REPORT", { align: "center" }); // Title centered at the top

  // Center-align shop details
  pdfDoc.fontSize(12);
  const pageWidth =
    pdfDoc.page.width - pdfDoc.page.margins.left - pdfDoc.page.margins.right;

  // Helper function to center-align text
  function drawCenteredText(text, y) {
    const textWidth = pdfDoc.widthOfString(text);
    const xPos = (pageWidth - textWidth) / 2 + pdfDoc.page.margins.left;
    pdfDoc.text(text, xPos, y);
  }

  // Draw centered details
  let currentY = pdfDoc.y + 20; // Leave space below the title
  drawCenteredText(`${shopData.name}`, currentY);
  currentY += 15; // Add space between lines
  drawCenteredText(`From: ${startDate} to ${endDate}`, currentY);
  currentY += 15;
  drawCenteredText(`Total: ${shopData.currency} ${total}`, currentY);

  pdfDoc.moveDown(2); // Add space before moving to the table

  const columnWidths = [150, 100, 80, 80, 100]; // Adjusted widths for Product, Date, Cost, Quantity, Total

  drawTableHeader(
    pdfDoc,
    ["Product", "Date", "Supplier", "Cost", "Total"],
    columnWidths
  );

  currentY = pdfDoc.y; // Start the first row just below the header

  purchaseData.forEach((row, index) => {
    // Add a new page if reaching the bottom of the page
    if (currentY > 720) {
      pdfDoc.addPage();
      drawTableHeader(
        pdfDoc,
        ["Product", "Date", "Supplier", "Cost", "Total"],
        columnWidths
      );
      currentY = pdfDoc.y; // Reset Y position below the new header
    }

    currentY = drawTableRow(pdfDoc, row, columnWidths, currentY);
  });

  pdfDoc.end();
  if (!shopData.adminId) return;

  let replacements = {
    shopname: shopData.name,
    backup_date: `${startDate} - ${endDate}`,
    username: shopData.adminId.username,
  };

  sendEmail(email, "Purchases Report", "statement", replacements, [
    {
      filename: fileName,
      path: filePath,
    },
  ]);
};

function drawTableRow(pdfDoc, row, columnWidths, currentY) {
  pdfDoc.font("Helvetica").fontSize(10);

  let xPos = 50; // Starting X position
  let maxHeight = 0; // Track the maximum height of a cell in the row

  Object.values(row).forEach((value, index) => {
    const textOptions = {
      width: columnWidths[index] - 10, // Slight padding inside the column
      align: "left", // Align numbers to the right
    };

    // Calculate the height of the text to dynamically adjust row height
    const cellHeight = pdfDoc.heightOfString(value, textOptions);
    maxHeight = Math.max(maxHeight, cellHeight);

    // Ensure text fits within the column or truncate if necessary
    const truncatedValue =
      typeof value === "string" && value.length > 50
        ? value.substring(0, 47) + "..."
        : value;

    // Draw the text
    pdfDoc.text(truncatedValue, xPos, currentY, textOptions);
    xPos += columnWidths[index]; // Move to the next column
  });

  // Add a horizontal line below the row for separation
  pdfDoc
    .moveTo(50, currentY + maxHeight + 5)
    .lineTo(550, currentY + maxHeight + 5)
    .stroke();

  return currentY + maxHeight + 10; // Return updated Y position with row height
}

function drawTableHeader(pdfDoc, headers, columnWidths) {
  pdfDoc.font("Helvetica-Bold").fontSize(10);

  let xPos = 50; // Starting X position
  const yPos = pdfDoc.y; // Current Y position for the header

  headers.forEach((header, index) => {
    pdfDoc.text(header, xPos, yPos, {
      width: columnWidths[index] - 10, // Slight padding inside the column
      align: "left", // Align numbers to the right
    });
    xPos += columnWidths[index]; // Move to the next column
  });

  // Add a horizontal line below the header for clarity
  pdfDoc
    .moveTo(50, yPos + 15)
    .lineTo(550, yPos + 15)
    .stroke();

  pdfDoc.moveDown(1); // Add vertical space after the header
}

module.exports = {
  getAllPurchases,
  getPurchaseById,
  updatePurchase,
  deletePurchase,
  createPurchaseWithItems,
  getPurchaseItemsByPurchaseId,
  getPurchaseItemsBySupplierId,
  getPurchasesBySupplierId,
  searchPurchasesByPurchaseNo,
  getProductPurchasesReceiptItems,
  groupPurchasesByMonth,
  getPurchasesSummary,

  sendreportemail,
};
