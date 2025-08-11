// Common Tailwind CSS class combinations for OYAH! app

export const commonStyles = {
  // Container styles
  container: 'flex-1 bg-white',
  centeredContainer: 'flex-1 bg-white items-center justify-center p-5',

  // Text styles
  title: 'text-3xl font-bold text-primary-800',
  subtitle: 'text-lg font-semibold text-gray-700',
  body: 'text-base text-gray-600',
  caption: 'text-sm text-gray-500',

  // Button styles
  primaryButton: 'bg-primary-600 px-6 py-3 rounded-lg',
  primaryButtonText: 'text-white font-semibold text-center',
  secondaryButton: 'bg-gray-200 px-6 py-3 rounded-lg',
  secondaryButtonText: 'text-gray-800 font-semibold text-center',

  // Card styles
  card: 'bg-white rounded-lg shadow-md p-4 m-2',
  cardTitle: 'text-lg font-semibold text-gray-800 mb-2',
  cardContent: 'text-base text-gray-600',

  // Input styles
  input: 'border border-gray-300 rounded-lg px-4 py-3 text-base',
  inputFocused: 'border-primary-500',
  inputError: 'border-red-500',

  // Status styles
  statusPending: 'bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm',
  statusVerified: 'bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm',
  statusError: 'bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm',

  // Layout styles
  row: 'flex-row items-center',
  column: 'flex-col',
  spaceBetween: 'justify-between',
  spaceAround: 'justify-around',

  // Spacing
  marginBottom: 'mb-4',
  marginTop: 'mt-4',
  padding: 'p-4',
  paddingHorizontal: 'px-4',
  paddingVertical: 'py-4',
};

// Helper function to combine classes
export const cn = (...classes: (string | undefined | false)[]): string => {
  return classes.filter(Boolean).join(' ');
};
