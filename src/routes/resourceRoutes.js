const express = require('express');
const resourceController = require('../controllers/resourceController');
const { authorizeResource } = require('../middleware/authorizeResource');

const router = express.Router();

router.get('/:schema/:table', authorizeResource('view'), resourceController.list);
router.post('/:schema/:table', authorizeResource('create'), resourceController.create);
router.get('/:schema/:table/:id', authorizeResource('view'), resourceController.getOne);
router.patch('/:schema/:table/:id?', authorizeResource('edit'), resourceController.update);
router.delete('/:schema/:table/:id?', authorizeResource('delete'), resourceController.remove);

module.exports = router;
