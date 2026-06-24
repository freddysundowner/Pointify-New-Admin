const printerService = require("../services/printerService");

exports.getPrinterStatus = (req, res) => {
  res.json({
    initialized: true,
    config: printerService.getConfig(),
  });
};

exports.initializePrinter = (req, res) => {
  printerService.setConfig(req.body);
  console.log("Updated printer config:", printerService.getConfig());
  res.json({ success: true });
};

exports.testPrint = async (req, res) => {
  try {
    const result = await printerService.testPrint();
    res.json({ success: true, message: result });
  } catch (err) {
    console.error("Test print failed:", err);
    res
      .status(500)
      .json({ success: false, message: err.message || "Printer failed." });
  }
};

exports.openCashDrawer = async (req, res) => {
  await printerService.openCashDrawer();
  res.json({ success: true, message: "Cash drawer opened" });
};

exports.printReceipt = async (req, res) => {
  await printerService.printReceipt(req.body);
  res.json({ success: true, message: "Receipt printed successfully" });
};
