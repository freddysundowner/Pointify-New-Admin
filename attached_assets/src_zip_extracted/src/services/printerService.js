const escpos = require("escpos");
escpos.USB = require("escpos-usb");

let printerConfig = {
  type: "USB",
  interface: "/dev/usb/lp0",
  width: 32,
  characterSet: "PC437_USA",
};

exports.setConfig = (config) => {
  printerConfig = config;
};

exports.getConfig = () => {
  return printerConfig;
};

exports.testPrint = () => {
  return new Promise((resolve, reject) => {
    const device = new escpos.USB();
    const printer = new escpos.Printer(device);

    let finished = false;

    // Fail safe: force error if no response in 5 seconds
    const timeout = setTimeout(() => {
      if (!finished) {
        finished = true;
        reject(
          new Error(
            "Printer did not respond in time. Check USB connection or permissions."
          )
        );
      }
    }, 5000);

    device.open((err) => {
      if (finished) return;
      clearTimeout(timeout);

      if (err) {
        finished = true;
        return reject(err);
      }

      printer
        .encode(printerConfig.characterSet)
        .text("*** Test Receipt ***")
        .text("Hello from your POS!")
        .cut()
        .close();

      finished = true;
      resolve("Test print completed");
    });
  });
};

exports.openCashDrawer = () => {
  return new Promise((resolve, reject) => {
    const device = new escpos.USB();
    const printer = new escpos.Printer(device);

    device.open(() => {
      printer.cashdraw();
      printer.close();
      resolve("Cash drawer opened");
    });
  });
};

exports.printReceipt = ({
  store,
  cashier,
  items,
  subtotal,
  tax,
  total,
  footer,
}) => {
  return new Promise((resolve, reject) => {
    const device = new escpos.USB();
    const printer = new escpos.Printer(device);

    device.open(() => {
      printer
        .encode(printerConfig.characterSet)
        .align("CT")
        .text(store || "My Shop")
        .text(`Cashier: ${cashier || "-"}`)
        .text("-----------------------------")
        .align("LT");

      items.forEach((item) => {
        printer.text(
          `${item.qty} x ${item.name.padEnd(15)} ${(
            item.price * item.qty
          ).toFixed(2)}`
        );
      });

      printer
        .text("-----------------------------")
        .align("RT")
        .text(`Subtotal: ${subtotal.toFixed(2)}`)
        .text(`Tax: ${tax.toFixed(2)}`)
        .text(`Total: ${total.toFixed(2)}`)
        .align("CT")
        .text(footer || "Thank you!")
        .cut()
        .close();

      resolve("Receipt printed successfully");
    });
  });
};
