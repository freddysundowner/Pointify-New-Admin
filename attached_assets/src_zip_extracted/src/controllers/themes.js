const Settings = require("../models/Setting");
const fs = require("fs");
const path = require("path"); 

exports.getTheme = async (req, res) => {
    try {
        const theme = await Settings.findOne({ name: "theme" });
        res.send(theme?.setting);
    } catch (err) {
        res.status(500).send({
            message: err.message,
        });
    }
};

exports.createTheme = async (req, res) => {
  try {
    let data = { ...req.body };

    if (req.file) {
    const oldTheme = await Settings.findOne({ name: "theme" });
    const oldImage = oldTheme?.setting?.image;

    if (oldImage) {
        // "/uploads/file.png" -> POINTIFYAPI/uploads/file.png
        const filePath = path.join(
        __dirname,
        "..",
        "..",
        oldImage.replace(/^\/+/, "")
        );

        if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        }
    }

    data.image = `/uploads/${req.file.filename}`;
    }


    const setData = {};
    for (const key in data) {
      setData[`setting.${key}`] = data[key];
    }

    await Settings.updateOne(
      { name: "theme" },
      { $set: setData },
      { upsert: true }
    );

    res.send({ message: "Theme saved successfully!" });

  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};


