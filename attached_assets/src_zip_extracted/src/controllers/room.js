const Room = require("../models/room");
const Booking = require("../models/bookings");

const getAllRooms = async (req, res) => {
    try {
        const { shop } = req.query;
        if (!shop) {
            return res
                .status(400)
                .json({ error: "shop query param is required" });
        }
        const rooms = await Room.find({ shop }).sort({ name: 1 }).limit(1000);
        res.status(200).json(rooms);
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Normalise amenities to a clean array of non-empty strings (max 30).
const parseAmenities = (value) => {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    const out = [];
    for (const a of value) {
        const s = String(a || "").trim();
        const key = s.toLowerCase();
        if (!s || seen.has(key)) continue;
        seen.add(key);
        out.push(s);
        if (out.length >= 30) break;
    }
    return out;
};

const createRoom = async (req, res) => {
    try {
        const { shop, name, nightlyRate } = req.body;
        if (!shop || !name || !String(name).trim()) {
            return res
                .status(400)
                .json({ error: "shop and name are required" });
        }
        const rate = Number(nightlyRate);
        if (!Number.isFinite(rate) || rate < 0) {
            return res
                .status(400)
                .json({ error: "nightlyRate must be a number >= 0" });
        }
        const trimmed = String(name).trim();
        const exists = await Room.findOne({
            shop,
            name: {
                $regex: `^${trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
                $options: "i",
            },
        });
        if (exists) {
            return res
                .status(409)
                .json({ error: "A room with that name already exists" });
        }
        const room = new Room({
            shop,
            name: trimmed,
            group: String(req.body.group || "").trim(),
            nightlyRate: rate,
            amenities: parseAmenities(req.body.amenities),
        });
        await room.save();
        res.status(201).json(room);
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Bulk create: body { shop, rooms: [{ name, nightlyRate }, ...] }
// Silently skips names that already exist in the shop (case-insensitive).
const bulkCreateRooms = async (req, res) => {
    try {
        const { shop, rooms } = req.body;
        if (!shop || !Array.isArray(rooms) || rooms.length === 0) {
            return res.status(400).json({
                error: "shop and a non-empty rooms array are required",
            });
        }
        if (rooms.length > 500) {
            return res
                .status(400)
                .json({ error: "Too many rooms in one request (max 500)" });
        }

        const existing = await Room.find({ shop }).select("name");
        const existingNames = new Set(
            existing.map((r) => r.name.toLowerCase()),
        );

        const toCreate = [];
        const seenInRequest = new Set();
        let skipped = 0;
        for (const r of rooms) {
            const name = String(r && r.name ? r.name : "").trim();
            const rate = Number(r && r.nightlyRate);
            if (!name || !Number.isFinite(rate) || rate < 0) {
                skipped++;
                continue;
            }
            const key = name.toLowerCase();
            if (existingNames.has(key) || seenInRequest.has(key)) {
                skipped++;
                continue;
            }
            seenInRequest.add(key);
            toCreate.push({
                shop,
                name,
                group: String((r && r.group) || "").trim(),
                nightlyRate: rate,
                amenities: parseAmenities(r && r.amenities),
            });
        }

        const created =
            toCreate.length > 0 ? await Room.insertMany(toCreate) : [];
        res.status(201).json({
            success: true,
            created: created.length,
            skipped,
            rooms: created,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal server error" });
    }
};

const updateRoomById = async (req, res) => {
    const { id } = req.params;
    try {
        const update = {};
        if (req.body.name !== undefined) {
            const trimmed = String(req.body.name).trim();
            if (!trimmed) {
                return res.status(400).json({ error: "name cannot be empty" });
            }
            update.name = trimmed;
        }
        if (req.body.group !== undefined) {
            update.group = String(req.body.group).trim();
        }
        if (req.body.nightlyRate !== undefined) {
            const rate = Number(req.body.nightlyRate);
            if (!Number.isFinite(rate) || rate < 0) {
                return res
                    .status(400)
                    .json({ error: "nightlyRate must be a number >= 0" });
            }
            update.nightlyRate = rate;
        }
        if (req.body.amenities !== undefined) {
            update.amenities = parseAmenities(req.body.amenities);
        }
        const room = await Room.findByIdAndUpdate(id, update, { new: true });
        if (!room) {
            return res.status(404).json({ error: "Room not found" });
        }
        res.status(200).json(room);
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal server error" });
    }
};

const deleteRoomById = async (req, res) => {
    const { id } = req.params;
    try {
        // Refuse to delete a room that still has active bookings.
        const active = await Booking.findOne({
            roomId: id,
            status: { $in: ["booked", "checked_in"] },
        });
        if (active) {
            return res.status(409).json({
                error: "Room has active bookings — cancel or check them out first",
            });
        }
        const deleted = await Room.findByIdAndDelete(id);
        if (!deleted) {
            return res.status(404).json({ error: "Room not found" });
        }
        res.status(200).json({ success: true, message: "Room deleted" });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal server error" });
    }
};

module.exports = {
    getAllRooms,
    createRoom,
    bulkCreateRooms,
    updateRoomById,
    deleteRoomById,
};
