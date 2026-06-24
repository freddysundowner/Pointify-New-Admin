const express = require('express');
const router = express.Router();
const {
  createAffiliate,
  getAllAffiliates,
  getAffiliateById,
  updateAffiliate,
  deleteAffiliate,
  loginAffliate,
  registerAffliate
} = require('../controllers/affliate');


router.post("/auth/register", registerAffliate);

router.post("/auth/login", loginAffliate);


router.post('/', createAffiliate);

router.get('/', getAllAffiliates);

router.get('/:id', getAffiliateById);

router.put('/:id', updateAffiliate);
router.delete('/:id', deleteAffiliate);

module.exports = router;
