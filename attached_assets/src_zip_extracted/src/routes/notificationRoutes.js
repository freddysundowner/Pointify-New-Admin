const express = require("express");
const notificationRouter = express.Router();
const userModel = require("../models/admin");
const functions = require("../shared/functions")

notificationRouter.route("/all").post(async (req, res) => {
    let users = [];
    for (let i = 0; i < users.length; i++) {
        let user = await userModel.findById(users[i]);
        functions.sendNotificationToAll({
            included_segments: ["Subscribed Users"],
            data: { screen: "Homescreen", id: 1 },
            headings: { en: "Welcome to Pointify" },
            contents: {
                en:
                    user.username +
                    " Welcome to Pointify",
            },
        });
    }
    res.json({})
});

notificationRouter.route("/").post(async (req, res) => {

    try {

        var userNotificationTokens = []

        for (let i = 0; i < req.body.users.length; i++) {
            var user = await userModel.findOne({ _id: req.body.users[i] })

            if (user != null && user.notificationToken != ""){
                userNotificationTokens.push(user["notificationToken"])
            }
            
        }

        if (userNotificationTokens.length > 0) {
            functions.sendNotificationOneSignal(userNotificationTokens, req.body.title, req.body.message, req.body.screen, req.body.id)
        }

        res
        .status(200)
        .setHeader("Content-Type", "application/json")
        .json({"Success": true});


    } catch (e) {
        console.log("Error sending notification " + e);
        res
        .status(400)
        .setHeader("Content-Type", "application/json")
        .json({"Success": false});
    }



});


module.exports = notificationRouter;