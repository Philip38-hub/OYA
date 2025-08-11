const React = require('react');

const Ionicons = ({ name, size, color, style, testID }) => {
  return React.createElement('span', {
    'data-testid': testID || `icon-${name}`,
    style: { fontSize: size, color, ...style },
    'data-icon': name,
  }, name);
};

module.exports = { Ionicons };