const ready = jest.fn(() => Promise.resolve());
const loadGraphModel = jest.fn();

module.exports = {
  ready,
  loadGraphModel,
};