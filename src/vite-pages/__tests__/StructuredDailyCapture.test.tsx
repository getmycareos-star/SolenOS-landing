import { jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.unstable_mockModule('../../lib/imageCompression', () => ({
  compressImage: jest.fn(async (file: File) =>
    new File([file.slice(0, Math.floor(file.size / 2))], file.name, { type: file.type }),
  ),
}));

const { default: StructuredDailyCapture } = await import('../StructuredDailyCapture');
const { compressImage } = await import('../../lib/imageCompression');

describe('StructuredDailyCapture Component Image Compression Integration', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    localStorage.setItem('solenos_person_id', '11111111-1111-4111-8111-111111111111');
    localStorage.setItem('solenos_caregiver_id', '22222222-2222-4222-8222-222222222222');
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
        const dataURL = 'data:image/png;base64,dummy';
        setTimeout(() => fileReaderMock.onload?.({ target: { result: dataURL } }), 0);
      })
    };
    global.FileReader = jest.fn(() => fileReaderMock);

    // Trigger file selection
    fireEvent.change(fileInput, {
      target: { files: [testFile] }
    });

    // Wait for image preview to appear
    expect(await screen.findByLabelText(/remove preview/i)).toBeInTheDocument();

    // Fill medication form and submit
    const medicationInput = screen.getByPlaceholderText(/enter medication name/i);
    fireEvent.change(medicationInput, { target: { value: 'Test Medication' } });
    
    const submitMedicationButton = screen.getByRole('button', { name: /add medication/i });
    fireEvent.click(submitMedicationButton);

    // Wait for submission to complete
    await waitFor(() => {
      expect(screen.queryByLabelText(/remove preview/i)).not.toBeInTheDocument();
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
        const dataURL = 'data:image/png;base64,dummy';
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
        const dataURL = 'data:image/png;base64,dummy';
        setTimeout(() => fileReaderMock.onload?.({ target: { result: dataURL } }), 0);
      })
    };
    global.FileReader = jest.fn(() => fileReaderMock);

    // Trigger file selection
    fireEvent.change(fileInput, {
      target: { files: [testFile] }
    });

    // Wait for image preview to appear
    expect(await screen.findByLabelText(/remove preview/i)).toBeInTheDocument();

    // Fill medication form and submit
    const medicationInput = screen.getByPlaceholderText(/enter medication name/i);
    fireEvent.change(medicationInput, { target: { value: 'Test Medication' } });
    
    const submitMedicationButton = screen.getByRole('button', { name: /add medication/i });
    fireEvent.click(submitMedicationButton);

    // Wait for submission to complete (should use original image due to fallback)
    await waitFor(() => {
      expect(screen.queryByLabelText(/remove preview/i)).not.toBeInTheDocument();
    });

    // Verify that fetch was still called (fallback to original image worked)
    expect(fetch).toHaveBeenCalled();
  });
});