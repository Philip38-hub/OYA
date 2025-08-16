declare module '@react-native-ml-kit/text-recognition' {
  interface MLKitBounding {
    left: number;
    top: number;
    right: number;
    bottom: number;
  }

  interface MLKitTextBlock {
    text: string;
    bounding?: MLKitBounding;
    confidence?: number;
  }

  interface TextRecognitionAPI {
    recognize(uri: string): Promise<MLKitTextBlock[]>;
  }

  const TextRecognition: TextRecognitionAPI;
  export default TextRecognition;
}