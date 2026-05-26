// routes/activation.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const License = require('../models/License');
const { addLicense } = require("../controller/license")

router.post('/activate', async (req, res) => {
  const { productKey } = req.body;

  try {
    // 1. Find the key in the database
    const license = await License.findOne({ key: productKey });

    // 2. Check if it exists and is valid
    if (!license) return res.status(404).json({ error: 'Invalid product key' });
    if (!license.isActive) return res.status(403).json({ error: 'Key has been deactivated' });
    if (license.isUsed) return res.status(403).json({ error: 'Key is already in use' });

    // 3. Mark as used
    license.isUsed = true;
    license.activatedAt = new Date();
    await license.save();

    // 4. Generate an access token (JWT)
    const token = jwt.sign(
      { activated: true, keyId: license._id }, 
      process.env.JWT_SECRET || 'fallback_secret_for_local_development', 
      { expiresIn: '30d' } // Set an expiration based on your needs
    );

    res.json({ success: true, token });

  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.route('/addLicense').get(addLicense)

module.exports = router;