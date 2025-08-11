const React = require('react');

const View = ({ children, className, style, ...props }) => 
  React.createElement('div', { className, style, ...props }, children);

const Text = ({ children, className, style, ...props }) => 
  React.createElement('span', { className, style, ...props }, children);

const TouchableOpacity = ({ children, onPress, className, style, testID, ...props }) => 
  React.createElement('button', { 
    onClick: onPress, 
    className, 
    style, 
    'data-testid': testID,
    ...props 
  }, children);

const ScrollView = ({ children, className, style, ...props }) => 
  React.createElement('div', { className, style, ...props }, children);

module.exports = {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
};