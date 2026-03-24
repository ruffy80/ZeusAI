const { handleRequest } = require('./index');

module.exports = async (req, res) => {
  return handleRequest(req, res);
};
