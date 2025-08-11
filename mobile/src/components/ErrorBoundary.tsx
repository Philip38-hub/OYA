import React, { Component, ReactNode } from 'react';
import { View, Text, ScrollView } from 'react-native';
import styled from 'styled-components/native';
import { theme } from '@/utils/theme';
import { StyledButton } from './StyledButton';
import { errorHandlingService } from '@/services/errorHandlingService';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
}

const Container = styled.View`
  flex: 1;
  background-color: white;
  padding: ${theme.spacing.lg}px;
  justify-content: center;
  align-items: center;
`;

const ErrorIcon = styled.Text`
  font-size: 64px;
  margin-bottom: ${theme.spacing.lg}px;
`;

const ErrorTitle = styled.Text`
  font-size: ${theme.fontSize['2xl']}px;
  font-weight: ${theme.fontWeight.bold};
  color: ${theme.colors.error};
  text-align: center;
  margin-bottom: ${theme.spacing.md}px;
`;

const ErrorMessage = styled.Text`
  font-size: ${theme.fontSize.base}px;
  color: ${theme.colors.gray[600]};
  text-align: center;
  line-height: ${theme.fontSize.base * 1.5}px;
  margin-bottom: ${theme.spacing.lg}px;
`;

const ButtonContainer = styled.View`
  width: 100%;
  max-width: 300px;
  gap: ${theme.spacing.md}px;
`;

const DetailsContainer = styled.View`
  margin-top: ${theme.spacing.lg}px;
  width: 100%;
  max-width: 400px;
`;

const DetailsToggle = styled.TouchableOpacity`
  padding: ${theme.spacing.sm}px;
  align-items: center;
`;

const DetailsToggleText = styled.Text`
  color: ${theme.colors.primary};
  font-size: ${theme.fontSize.sm}px;
`;

const DetailsContent = styled.View`
  background-color: ${theme.colors.gray[100]};
  padding: ${theme.spacing.md}px;
  border-radius: ${theme.borderRadius.md}px;
  margin-top: ${theme.spacing.sm}px;
`;

const DetailsText = styled.Text`
  font-family: monospace;
  font-size: ${theme.fontSize.xs}px;
  color: ${theme.colors.gray[700]};
`;

export class ErrorBoundary extends Component<Props, State> {
  private showDetailsTimeout: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Log error to error handling service
    errorHandlingService.logError(error, {
      component: 'ErrorBoundary',
      action: 'component_crash',
      timestamp: new Date().toISOString(),
      additionalData: errorInfo,
    }, 'critical');

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReload = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleRestart = () => {
    // In a real app, this might restart the app or navigate to home
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReportError = async () => {
    if (this.state.error) {
      await errorHandlingService.reportIssue(this.state.error, {
        component: 'ErrorBoundary',
        action: 'user_report',
        timestamp: new Date().toISOString(),
        additionalData: this.state.errorInfo,
      });
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Container>
          <ScrollView contentContainerStyle={{ alignItems: 'center', justifyContent: 'center', flexGrow: 1 }}>
            <ErrorIcon>💥</ErrorIcon>
            <ErrorTitle>Oops! Something went wrong</ErrorTitle>
            <ErrorMessage>
              The app encountered an unexpected error. Don't worry, your data is safe.
              You can try reloading the screen or restarting the app.
            </ErrorMessage>
            
            <ButtonContainer>
              <StyledButton
                title="Reload Screen"
                onPress={this.handleReload}
                variant="primary"
              />
              <StyledButton
                title="Restart App"
                onPress={this.handleRestart}
                variant="outline"
              />
              <StyledButton
                title="Report Issue"
                onPress={this.handleReportError}
                variant="outline"
              />
            </ButtonContainer>

            <ErrorDetails 
              error={this.state.error}
              errorInfo={this.state.errorInfo}
            />
          </ScrollView>
        </Container>
      );
    }

    return this.props.children;
  }
}

interface ErrorDetailsProps {
  error: Error | null;
  errorInfo: any;
}

const ErrorDetails: React.FC<ErrorDetailsProps> = ({ error, errorInfo }) => {
  const [showDetails, setShowDetails] = React.useState(false);

  if (!error) return null;

  return (
    <DetailsContainer>
      <DetailsToggle onPress={() => setShowDetails(!showDetails)}>
        <DetailsToggleText>
          {showDetails ? 'Hide' : 'Show'} Error Details
        </DetailsToggleText>
      </DetailsToggle>
      
      {showDetails && (
        <DetailsContent>
          <ScrollView style={{ maxHeight: 200 }}>
            <DetailsText>
              Error: {error.name}{'\n'}
              Message: {error.message}{'\n'}
              {error.stack && `Stack: ${error.stack}`}
              {errorInfo && errorInfo.componentStack && `\nComponent Stack: ${errorInfo.componentStack}`}
            </DetailsText>
          </ScrollView>
        </DetailsContent>
      )}
    </DetailsContainer>
  );
};