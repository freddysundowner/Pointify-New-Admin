const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit-table");
const saleModel = require("../../models/sales");

async function salesExcelReport(req, res) {
    try {
        const {
            fromDate,
            toDate,
            paymentType,
            shop,
            status,
            reportType,
            reportMode,
        } = req.body;
        console.log(req.body);

        let query = {
            shopId: shop,
        };

        if (fromDate && toDate) {
            query.createdAt = {
                $gte: new Date(fromDate + "T00:00:00.000Z"),
                $lte: new Date(toDate + "T23:59:59.999Z"),
            };
        }

        if (paymentType && paymentType !== "") {
            query.paymentType = paymentType;
        }

        if (status && status !== "") {
            query.status = status;
        }

        const sales = await saleModel
            .find(query)
            .populate("customerId")
            .sort({ createdAt: -1 });

        let totalSales = 0;
        let totalDiscount = 0;
        let totalFinal = 0;
        let totalMpesa = 0;
        let totalBank = 0;
        let totalCash = 0;
        let totalCredit = 0;
        let totalWallet = 0;
        let totalExtraCharges = 0;

        sales.forEach((sale) => {
            totalSales += Number(sale.totalAmount || 0);
            totalDiscount += Number(sale.saleDiscount || 0);
            totalFinal += Number(sale.totalWithDiscount || 0);
            totalExtraCharges += Number(
                sale.extraChargesTotal || 0
            );

            if (sale.paymentType === "cash") {
                totalCash += Number(
                    sale.totalWithDiscount || 0
                );
            }

            if (sale.paymentType === "mpesa") {
                totalMpesa += Number(
                    sale.totalWithDiscount || 0
                );
            }

            if (sale.paymentType === "bank") {
                totalBank += Number(
                    sale.totalWithDiscount || 0
                );
            }

            if (sale.paymentType === "credit") {
                totalCredit += Number(
                    sale.totalWithDiscount || 0
                );
            }

            if (sale.paymentType === "wallet") {
                totalWallet += Number(
                    sale.totalWithDiscount || 0
                );
            }
        });

        // PDF
        if (reportType === "pdf") {
            const doc = new PDFDocument({
                margin: 20,
                size: "A4",
            });

            res.setHeader(
                "Content-Type",
                "application/pdf"
            );

            res.setHeader(
                "Content-Disposition",
                `attachment; filename=sales-report-${Date.now()}.pdf`
            );

            doc.pipe(res);

            doc
                .fontSize(20)
                .font("Helvetica-Bold")
                .text("Sales Report", {
                    align: "center",
                });

            doc.moveDown(0.5);

            doc
                .fontSize(10)
                .font("Helvetica")
                .text(`From: ${fromDate}`, {
                    align: "center",
                });

            doc.text(`To: ${toDate}`, {
                align: "center",
            });

            doc.moveDown(1.5);

            // FULL REPORT PDF
            if (reportMode === "full") {
                const table = {
                    headers: [
                        "Receipt",
                        "Customer",
                        "Payment",
                        "Amount",
                        "Date",
                    ],

                    rows: sales.map((sale) => [
                        sale.receiptNo || "",
                        sale.customerId?.name ||
                        "Walk In",
                        sale.paymentType || "",
                        `${sale.totalWithDiscount || 0}`,
                        sale.createdAt
                            ? new Date(
                                sale.createdAt
                            ).toLocaleDateString()
                            : "",
                    ]),
                };

                await doc.table(table, {
                    width: 550,
                    prepareHeader: () =>
                        doc
                            .font("Helvetica-Bold")
                            .fontSize(10),

                    prepareRow: () =>
                        doc
                            .font("Helvetica")
                            .fontSize(9),
                });

                doc.moveDown(2);
            }

            // SUMMARY TABLE
            doc
                .font("Helvetica-Bold")
                .fontSize(14)
                .text("Summary");

            doc.moveDown(0.7);

            const summaryTable = {
                headers: [
                    "Description",
                    "Amount",
                ],
                rows: [
                    [
                        "Total Sales",
                        `${totalSales}`,
                    ],
                    [
                        "Total Discount",
                        `${totalDiscount}`,
                    ],
                    [
                        "Cash Total",
                        `${totalCash}`,
                    ],
                    [
                        "Mpesa Total",
                        `${totalMpesa}`,
                    ],
                    [
                        "Bank Total",
                        `${totalBank}`,
                    ],
                    [
                        "Credit Total",
                        `${totalCredit}`,
                    ],
                    [
                        "Wallet Total",
                        `${totalWallet}`,
                    ],
                    [
                        "Extra Charges",
                        `${totalExtraCharges}`,
                    ],
                    [
                        "Final Total",
                        `${totalFinal}`,
                    ],
                ],
            };

            await doc.table(summaryTable, {
                width: 350,
                prepareHeader: () =>
                    doc
                        .font("Helvetica-Bold")
                        .fontSize(10),

                prepareRow: () =>
                    doc
                        .font("Helvetica")
                        .fontSize(10),
            });

            doc.end();

            return;
        }

        // EXCEL
        // EXCEL
        const workbook = new ExcelJS.Workbook();

        const worksheet =
            workbook.addWorksheet("Sales Report");

        // SUMMARY REPORT
        if (reportMode === "summary") {
            worksheet.columns = [
                {
                    header: "Description",
                    key: "description",
                    width: 40,
                },
                {
                    header: "Amount",
                    key: "amount",
                    width: 30,
                },
            ];

            worksheet.addRow({
                description: "Total Sales",
                amount: totalSales,
            });

            worksheet.addRow({
                description: "Total Discount",
                amount: totalDiscount,
            });

            worksheet.addRow({
                description: "Cash Total",
                amount: totalCash,
            });

            worksheet.addRow({
                description: "Mpesa Total",
                amount: totalMpesa,
            });

            worksheet.addRow({
                description: "Bank Total",
                amount: totalBank,
            });

            worksheet.addRow({
                description: "Credit Total",
                amount: totalCredit,
            });

            worksheet.addRow({
                description: "Wallet Total",
                amount: totalWallet,
            });

            worksheet.addRow({
                description: "Extra Charges",
                amount: totalExtraCharges,
            });

            worksheet.addRow({
                description: "Final Total",
                amount: totalFinal,
            });
        }

        // FULL REPORT EXCEL
        if (reportMode === "full") {
            worksheet.columns = [
                {
                    header: "Receipt No",
                    key: "receiptNo",
                    width: 20,
                },
                {
                    header: "Customer",
                    key: "customer",
                    width: 30,
                },
                {
                    header: "Payment Type",
                    key: "paymentType",
                    width: 20,
                },
                {
                    header: "Total Amount",
                    key: "totalAmount",
                    width: 20,
                },
                {
                    header: "Discount",
                    key: "discount",
                    width: 20,
                },
                {
                    header: "Extra Charges",
                    key: "extraCharges",
                    width: 20,
                },
                {
                    header: "Final Total",
                    key: "finalTotal",
                    width: 20,
                },
                {
                    header: "Status",
                    key: "status",
                    width: 20,
                },
                {
                    header: "Date",
                    key: "date",
                    width: 25,
                },
            ];

            sales.forEach((sale) => {
                worksheet.addRow({
                    receiptNo:
                        sale.receiptNo || "",
                    customer:
                        sale.customerId?.name ||
                        "Walk In",
                    paymentType:
                        sale.paymentType || "",
                    totalAmount:
                        sale.totalAmount || 0,
                    discount:
                        sale.saleDiscount || 0,
                    extraCharges:
                        sale.extraChargesTotal || 0,
                    finalTotal:
                        sale.totalWithDiscount || 0,
                    status: sale.status || "",
                    date: sale.createdAt
                        ? new Date(
                            sale.createdAt
                        ).toLocaleString()
                        : "",
                });
            });

            worksheet.addRow({});
        }

        // SUMMARY
        worksheet.addRow({
            receiptNo: "SUMMARY",
        });

        worksheet.addRow({
            receiptNo: "Total Sales",
            totalAmount: totalSales,
        });

        worksheet.addRow({
            receiptNo: "Total Discount",
            totalAmount: totalDiscount,
        });

        worksheet.addRow({
            receiptNo: "Cash Total",
            totalAmount: totalCash,
        });

        worksheet.addRow({
            receiptNo: "Mpesa Total",
            totalAmount: totalMpesa,
        });

        worksheet.addRow({
            receiptNo: "Bank Total",
            totalAmount: totalBank,
        });

        worksheet.addRow({
            receiptNo: "Credit Total",
            totalAmount: totalCredit,
        });

        worksheet.addRow({
            receiptNo: "Wallet Total",
            totalAmount: totalWallet,
        });

        worksheet.addRow({
            receiptNo: "Extra Charges",
            totalAmount: totalExtraCharges,
        });

        worksheet.addRow({
            receiptNo: "Final Total",
            totalAmount: totalFinal,
        });

        worksheet.getRow(1).font = {
            bold: true,
        };

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );

        res.setHeader(
            "Content-Disposition",
            `attachment; filename=sales-report-${Date.now()}.xlsx`
        );

        await workbook.xlsx.write(res);

        res.end();
    } catch (e) {
        console.log(e);

        return res.status(500).json({
            success: false,
            message: e.message,
        });
    }
}

module.exports = salesExcelReport;