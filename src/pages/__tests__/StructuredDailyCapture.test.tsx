import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StructuredDailyCapture from '../StructuredDailyCapture';
import { compressImage } from '../../lib/imageCompression';

// Mock the compression library
jest.mock('../../lib/imageCompression', () => ({
  ...jest.requireActual('../../lib/imageCompression'),
  compressImage: jest.fn().mockImplementation(async (file) => {
    // Return a smaller file for testing
    return new File([file.slice(0, Math.floor(file.size / 2))], file.name, { 
      type: file.type 
    });
  })
}));

describe('StructuredDailyCapture Component Image Compression Integration', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    localStorage.setItem('solenos_person_id', '550e8400-e29b-41d4-a716-446655440000');
    localStorage.setItem('solenos_caregiver_id', '550e8400-e29b-41d4-a716-446655440001');
  });

  it('should compress medication image before upload when using gallery upload', async () => {
    // Mock the API calls
    global.fetch = jest.fn().mockImplementation(async (url, options) => {
      if (url.includes('/upload')) {
        return {
          ok: true,
          json: async () => ({ evidence_id: 'test-evidence-id' })
        };
      }
      if (url.includes('/daily/log')) {
        return {
          ok: true,
          json: async () => ({ success: true })
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    // Render the component
    render(<StructuredDailyCapture />);

    // Find and interact with file input
    const fileInput = screen.getByLabelText(/or upload from device/i);
    const testFile = new File(['dummy image content', 'dummy image content'], 'medication.png', { 
      type: 'image/png' 
    });
    
    // Mock the FileReader
    const fileReaderMock = {
      onload: null,
      readAsDataURL: jest.fn((file) => {
        // Simulate FileReader.onload being called with a data URL
        const dataURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        setTimeout(() => fileReaderMock.onload?.({ target: { result: dataURL } }), 0);
      })
    };
    global.FileReader = jest.fn(() => fileReaderMock);

    // Trigger file selection
    fireEvent.change(fileInput, {
      target: { files: [testFile] }
    });

    // Wait for image preview to appear
    expect(await screen.findByRole('button', { name: /remove preview/i })).toBeInTheDocument();

    // Fill medication form and submit
    const medicationInput = screen.getByPlaceholderText(/enter medication name/i);
    fireEvent.change(medicationInput, { target: { value: 'Test Medication' } });
    fireEvent.change(screen.getByLabelText(/status/i), { target: { value: 'given' } });
    
    const submitMedicationButton = screen.getByRole('button', { name: /add medication/i });
    fireEvent.click(submitMedicationButton);

    // Wait for submission to complete
    await waitFor(() => {
      expect(submitMedicationButton).toHaveTextContent('Add Medication');
    });

    // Verify that compressImage was called
    expect(compressImage).toHaveBeenCalled();
    
    // Verify that the compressed file was sent in the upload request
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/upload'),
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData)
      })
    );
  });

  it('should show compression status during medication image processing', async () => {
    render(<StructuredDailyCapture />);

    // Initially, compression status should not be visible
    expect(screen.queryByText(/compressing image/i)).not.toBeInTheDocument();

    // Mock file input and FileReader
    const fileInput = screen.getByLabelText(/or upload from device/i);
    const testFile = new File(['dummy image content'], 'medication.png', { 
      type: 'image/png' 
    });
    
    const fileReaderMock = {
      onload: null,
      readAsDataURL: jest.fn((file) => {
        const dataURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        setTimeout(() => fileReaderMock.onload?.({ target: { result: dataURL } }), 0);
      })
    };
    global.FileReader = jest.fn(() => fileReaderMock);

    // Trigger file selection - this should start compression
    fireEvent.change(fileInput, {
      target: { files: [testFile] }
    });

    // Compression status should be visible during processing
    expect(await screen.findByText(/compressing image/i)).toBeInTheDocument();
  });

  it('should handle medication compression errors gracefully', async () => {
    // Mock compressImage to throw an error
    (compressImage as jest.Mock).mockRejectedValueOnce(new Error('Compression failed'));

    // Mock the API calls
    global.fetch = jest.fn().mockImplementation(async (url, options) => {
      if (url.includes('/upload')) {
        return {
          ok: true,
          json: async () => ({ evidence_id: 'test-evidence-id' })
        };
      }
      if (url.includes('/daily/log')) {
        return {
          ok: true,
          json: async () => ({ success: true })
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    render(<StructuredDailyCapture />);

    // Mock file input and FileReader
    const fileInput = screen.getByLabelText(/or upload from device/i);
    const testFile = new File(['dummy image content'], 'medication.png', { 
      type: 'image/png' 
    });
    
    const fileReaderMock = {
      onload: null,
      readAsDataURL: jest.fn((file) => {
        const dataURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        setTimeout(() => fileReaderMock.onload?.({ target: { result: dataURL } }), 0);
      })
    };
    global.FileReader = jest.fn(() => fileReaderMock);

    // Trigger file selection
    fireEvent.change(fileInput, {
      target: { files: [testFile] }
    });

    // Wait for image preview to appear
    expect(await screen.findByRole('button', { name: /remove preview/i })).toBeInTheDocument();

    // Fill medication form and submit
    const medicationInput = screen.getByPlaceholderText(/enter medication name/i);
    fireEvent.change(medicationInput, { target: { value: 'Test Medication' } });
    
    const submitMedicationButton = screen.getByRole('button', { name: /add medication/i });
    fireEvent.click(submitMedicationButton);

    // Wait for submission to complete (should use original image due to fallback)
    await waitFor(() => {
      expect(submitMedicationButton).toHaveTextContent('Add Medication');
    });

    // Verify that fetch was still called (fallback to original image worked)
    expect(fetch).toHaveBeenCalled();
  });
});