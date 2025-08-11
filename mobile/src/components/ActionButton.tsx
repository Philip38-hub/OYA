import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ActionButtonProps {
  title: string;
  subtitle?: string;
  iconName: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  style?: ViewStyle;
  testID?: string;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  title,
  subtitle,
  iconName,
  onPress,
  variant = 'primary',
  style,
  testID,
}) => {
  const getButtonStyle = () => {
    const styles = [actionButtonStyles.base];
    
    if (variant === 'primary') {
      styles.push(actionButtonStyles.primary);
    } else {
      styles.push(actionButtonStyles.secondary);
    }
    
    return styles;
  };

  const iconColor = variant === 'primary' ? '#ffffff' : '#2563eb';
  const titleStyle = variant === 'primary' ? actionButtonStyles.primaryTitle : actionButtonStyles.secondaryTitle;
  const subtitleStyle = variant === 'primary' ? actionButtonStyles.primarySubtitle : actionButtonStyles.secondarySubtitle;

  return (
    <TouchableOpacity
      style={[...getButtonStyle(), style]}
      onPress={onPress}
      testID={testID}
      activeOpacity={0.8}
    >
      <View style={actionButtonStyles.content}>
        <Ionicons 
          name={iconName} 
          size={48} 
          color={iconColor}
          style={actionButtonStyles.icon}
        />
        <Text style={[actionButtonStyles.baseTitle, titleStyle]}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[actionButtonStyles.baseSubtitle, subtitleStyle]}>
            {subtitle}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const actionButtonStyles = StyleSheet.create({
  base: {
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  primary: {
    backgroundColor: '#2563eb',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  secondary: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#2563eb',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  content: {
    alignItems: 'center',
  },
  icon: {
    marginBottom: 12,
  },
  baseTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  primaryTitle: {
    color: '#ffffff',
  },
  secondaryTitle: {
    color: '#2563eb',
  },
  baseSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  primarySubtitle: {
    color: '#dbeafe',
  },
  secondarySubtitle: {
    color: '#6b7280',
  },
});