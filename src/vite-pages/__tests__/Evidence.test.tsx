import { jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.unstable_mockModule('../../lib/imageCompression', () => ({
  compressImage: jest.fn(async (file: File) =>
    new File([file.slice(0, Math.floor(file.size / 2))], file.name, { type: file.type }),
  ),
  dataURLtoFile: jest.fn((dataUrl: string, filename: string, mimeType: string) =>
    new File([dataUrl], filename, { type: mimeType }),
  ),
}));

const { default: Evidence } = await import('../Evidence');
const { compressImage } = await import('../../lib/imageCompression');

describe('Evidence Component Image Compression Integration', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    localStorage.setItem('solenos_person_id', '11111111-1111-4111-8111-111111111111');
    localStorage.setItem('solenos_caregiver_id', '22222222-2222-4222-8222-222222222222');
  });

  it('should compress image before upload when using gallery upload', async () => {
    // Mock the API calls
    global.fetch = jest.fn().mockImplementation(async (url, options) => {
      if (url.includes('/upload')) {
        return {
          ok: true,
          json: async () => ({ evidence_id: 'test-evidence-id' })
        };
      }
      if (url.includes('/evidence')) {
        return {
          ok: true,
          json: async () => []
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    // Render the component
    render(<Evidence />);

    // Find and interact with file input
    const fileInput = screen.getByLabelText(/or upload from device/i);
    const testFile = new File(['dummy image content', 'dummy image content'], 'test.png', { 
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

    // Find and click submit button
    const submitButton = screen.getByRole('button', { name: /create evidence/i });
    fireEvent.click(submitButton);

    // Wait for submission to complete
    await waitFor(() => {
      expect(submitButton).toHaveTextContent('Create Evidence');
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

  it('should show compression status during image processing', async () => {
    render(<Evidence />);

    // Initially, compression status should not be visible
    expect(screen.queryByText(/compressing image/i)).not.toBeInTheDocument();

    // Mock file input and FileReader
    const fileInput = screen.getByLabelText(/or upload from device/i);
    const testFile = new File(['dummy image content'], 'test.png', { 
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

  it('should handle compression errors gracefully', async () => {
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
      if (url.includes('/evidence')) {
        return {
          ok: true,
          json: async () => []
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    render(<Evidence />);

    // Mock file input and FileReader
    const fileInput = screen.getByLabelText(/or upload from device/i);
    const testFile = new File(['dummy image content'], 'test.png', { 
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

    // Find and click submit button
    const submitButton = screen.getByRole('button', { name: /create evidence/i });
    fireEvent.click(submitButton);

    // Wait for submission to complete (should use original image due to fallback)
    await waitFor(() => {
      expect(submitButton).toHaveTextContent('Create Evidence');
    });

    // Verify that fetch was still called (fallback to original image worked)
    expect(fetch).toHaveBeenCalled();
  });
});