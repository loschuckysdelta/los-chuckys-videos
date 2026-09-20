const { Router } = require('express');
const collection = require('../controllers/collection');

const router = Router();

router.get('/', collection.getResources);

module.exports = router;
