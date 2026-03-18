exports.success = (res, data) => res.json(data);
exports.error = (res, err) => res.status(400).json({error: err});
