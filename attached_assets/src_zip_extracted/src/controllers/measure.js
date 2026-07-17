const Measure = require("../models/measure");

// Create a new measure
const createMeasure = async (req, res) => {
  try {
    const { name } = req.body;
    const measure = new Measure({ name });
    await measure.save();
    res.status(201).json(measure);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get measure by id
const getMeasureById = async (req, res) => {
  try {
    const measures = await Measure.findById(req.params.id);
    res.status(200).json(measures);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get all measures
const getAllMeasures = async (req, res) => {
  try {
    let { page, limit } = req.query;

    // Convert page and limit to integers and calculate skip if page is provided
    const pageInt = parseInt(page) || 0;
    const limitInt = parseInt(limit) || 10;
    const skip = page ? (pageInt - 1) * limitInt : 0;

    // Define the base query
    let measuresQuery = Measure.find();

    // Apply pagination if 'page' is passed
    if (page) {
      measuresQuery = measuresQuery.skip(skip).limit(limitInt);
    }

    const measures = await measuresQuery;

    if (page) {
      // Get total count for pagination
      const totalMeasures = await Measure.countDocuments();
      const totalPages = Math.ceil(totalMeasures / limitInt);

      res.status(200).json({
        data: measures,
        count: totalMeasures,
        totalPages,
        currentPage: pageInt,
      });
    } else {
      res.status(200).json(measures);
    }
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

// Update a measure by ID
const updateMeasure = async (req, res) => {
  const { id } = req.params;
  try {
    const { name } = req.body;
    const updatedMeasure = await Measure.findByIdAndUpdate(
      id,
      { name },
      { new: true }
    );
    if (!updatedMeasure) {
      return res.status(404).json({ error: "Measure not found" });
    }
    res.status(200).json(updatedMeasure);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

// Delete a measure by ID
const deleteMeasure = async (req, res) => {
  const { id } = req.params;
  try {
    const deletedMeasure = await Measure.findByIdAndRemove(id);
    if (!deletedMeasure) {
      return res.status(404).json({ error: "Measure not found" });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  createMeasure,
  getAllMeasures,
  updateMeasure,
  deleteMeasure,getMeasureById
};
