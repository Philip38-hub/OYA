import React from 'react';
import { TouchableOpacity, Text, TouchableOpacityProps, StyleSheet, ViewStyle, TextStyle } from 'react-native';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  style,
  ...props
}) => {
  const getButtonStyle = (): ViewStyle[] => {
    const styles = [buttonStyles.base];
    
    // Variant styles
    switch (variant) {
      case 'primary':
        styles.push(buttonStyles.primary);
        break;
      case 'secondary':
        styles.push(buttonStyles.secondary);
        break;
      case 'outline':
        styles.push(buttonStyles.outline);
        break;
    }
    
    // Size styles
    switch (size) {
      case 'sm':
        styles.push(buttonStyles.sm);
        break;
      case 'md':
        styles.push(buttonStyles.md);
        break;
      case 'lg':
        styles.push(buttonStyles.lg);
        break;
    }
    
    // Disabled style
    if (disabled || loading) {
      styles.push(buttonStyles.disabled);
    }
    
    return styles;
  };

  const getTextStyle = (): TextStyle[] => {
    const styles = [buttonStyles.baseText];
    
    // Variant text styles
    switch (variant) {
      case 'primary':
        styles.push(buttonStyles.primaryText);
        break;
      case 'secondary':
        styles.push(buttonStyles.secondaryText);
        break;
      case 'outline':
        styles.push(buttonStyles.outlineText);
        break;
    }
    
    // Size text styles
    switch (size) {
      case 'sm':
        styles.push(buttonStyles.smText);
        break;
      case 'md':
        styles.push(buttonStyles.mdText);
        break;
      case 'lg':
        styles.push(buttonStyles.lgText);
        break;
    }
    
    return styles;
  };

  return (
    <TouchableOpacity
      style={[...getButtonStyle(), style]}
      disabled={disabled || loading}
      {...props}
    >
      <Text style={getTextStyle()}>
        {loading ? 'Loading...' : title}
      </Text>
    </TouchableOpacity>
  );
};

const buttonStyles = StyleSheet.create({
  base: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: '#2563eb',
  },
  secondary: {
    backgroundColor: '#e5e7eb',
  },
  outline: {
    borderWidth: 2,
    borderColor: '#2563eb',
    backgroundColor: 'transparent',
  },
  sm: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  md: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  lg: {
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  disabled: {
    opacity: 0.5,
  },
  baseText: {
    fontWeight: '600',
  },
  primaryText: {
    color: '#ffffff',
  },
  secondaryText: {
    color: '#374151',
  },
  outlineText: {
    color: '#2563eb',
  },
  smText: {
    fontSize: 14,
  },
  mdText: {
    fontSize: 16,
  },
  lgText: {
    fontSize: 18,
  },
});
