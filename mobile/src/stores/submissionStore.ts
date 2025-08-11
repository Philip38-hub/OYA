import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface SubmissionData {
  pollingStationId: string;
  results: {
    [candidateName: string]: number;
    spoilt: number;
  };
  submissionType: 'image_ocr' | 'audio_stt';
  confidence: number;
  gpsCoordinates?: {
    latitude: number;
    longitude: number;
  };
  timestamp?: string;
}

export interface SubmissionState {
  currentSubmission: SubmissionData | null;
  isSubmitting: boolean;
  submissionHistory: SubmissionData[];
  error: string | null;
}

export interface SubmissionActions {
  setSubmissionData: (data: Partial<SubmissionData>) => void;
  submitResults: () => Promise<void>;
  clearCurrentSubmission: () => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export type SubmissionStore = SubmissionState & SubmissionActions;

const initialState: SubmissionState = {
  currentSubmission: null,
  isSubmitting: false,
  submissionHistory: [],
  error: null,
};

export const useSubmissionStore = create<SubmissionStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      setSubmissionData: (data: Partial<SubmissionData>) => {
        const current = get().currentSubmission;
        set({
          currentSubmission: {
            pollingStationId: '',
            results: { spoilt: 0 },
            submissionType: 'image_ocr',
            confidence: 0,
            ...current,
            ...data,
          },
        });
      },

      submitResults: async () => {
        const { currentSubmission } = get();
        if (!currentSubmission) {
          set({ error: 'No submission data available' });
          return;
        }

        set({ isSubmitting: true, error: null });

        try {
          // TODO: Implement actual API submission
          // For now, simulate submission
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Add timestamp and GPS coordinates
          const submissionWithMetadata: SubmissionData = {
            ...currentSubmission,
            timestamp: new Date().toISOString(),
            gpsCoordinates: {
              latitude: -1.2921, // Mock Nairobi coordinates
              longitude: 36.8219,
            },
          };

          set(state => ({
            isSubmitting: false,
            submissionHistory: [...state.submissionHistory, submissionWithMetadata],
            currentSubmission: null,
          }));
        } catch (error) {
          set({
            isSubmitting: false,
            error: error instanceof Error ? error.message : 'Failed to submit results',
          });
        }
      },

      clearCurrentSubmission: () => {
        set({ currentSubmission: null });
      },

      setError: (error: string | null) => {
        set({ error });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'submission-store',
    }
  )
);