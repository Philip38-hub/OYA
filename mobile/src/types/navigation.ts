// Navigation types for OYAH! mobile application

export type RootStackParamList = {
  SplashScreen: undefined;
  MainActionScreen: undefined;
  ImageCaptureScreen: undefined;
  AudioRecordingScreen: undefined;
  ConfirmationScreen: {
    data: {
      [key: string]: number;
    };
    submissionType: 'image_ocr' | 'audio_stt';
  };
  DashboardScreen: undefined;
};

export type NavigationScreens = keyof RootStackParamList;