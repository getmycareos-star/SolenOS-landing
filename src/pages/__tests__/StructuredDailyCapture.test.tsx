import { jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockCompressImage = jest.fn(async (file: File) =>
  new File([file.slice(0, Math.max(1, Math.floor(file.size / 2)))], file.name, { type: file.type }),
);

await jest.unstable_mockModule('../../lib/imageCompression', () => ({
  compressImage: mockCompressImage,
  dataURLtoFile: jest.fn((dataUrl: string, filename: string) =>
    new File([dataUrl], filename, { type: 'image/png' }),
  ),
}));

const { default: StructuredDailyCapture } = await import('../StructuredDailyCapture');

function installFetchMock() {
  const fetchMock = jest.fn(async (url: unknown, _options?: RequestInit) => {
    const path = String(url);
    if (path.startsWith('blob:')) {
      return { ok: true, blob: async () => new Blob(['compressed image'], { type: 'image/png' }) };
    }
    if (path.includes('/caregivers/person/')) {
      return { ok: true, json: async () => [{ id: 'test-caregiver', name: 'Test Caregiver' }] };
    }
    if (path.includes('/upload')) {
      return { ok: true, json: async () => ({ evidence_id: 'test-evidence-id', file_id: 'test-file-id' }) };
    }
    if (path.includes('/daily/log')) {
      return { ok: true, json: async () => ({ id: 'test-daily-log' }) };
    }
    const body = path.includes('/caregivers/person/')
      ? [{ id: 'test-caregiver', name: 'Test Caregiver' }]
      : path.includes('/upload')
        ? { evidence_id: 'test-evidence-id', file_id: 'test-file-id' }
        : path.includes('/daily/log')
          ? { id: 'test-daily-log' }
          : [];
    return {
      ok: true,
      headers: { get: (name: string) => name.toLowerCase() === 'content-type' ? 'application/json' : null },
      text: async () => JSON.stringify(body),
      json: async () => body,
    };
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function mockFileReader() {
  const fileReaderMock = {
    onload: null as null | ((event: { target: { result: string } }) => void),
    readAsDataURL: jest.fn(() => {
      setTimeout(() => fileReaderMock.onload?.({ target: { result: 'data:image/png;base64,dummy' } }), 0);
    }),
  };
  global.FileReader = jest.fn(() => fileReaderMock) as unknown as typeof FileReader;
}

describe('StructuredDailyCapture medication image workflow', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    mockCompressImage.mockImplementation(async (file: File) =>
      new File([file.slice(0, Math.max(1, Math.floor(file.size / 2)))], file.name, { type: file.type }),
    );
    installFetchMock();
  });

  it('compresses a selected image and uploads the compressed file when adding medication', async () => {
    const fetchMock = installFetchMock();
    render(<StructuredDailyCapture />);

    const fileInput = screen.getByLabelText(/or upload from device/i);
    const testFile = new File(['dummy image content'], 'medication.png', { type: 'image/png' });
    mockFileReader();
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    expect(await screen.findByRole('button', { name: /remove preview/i })).toBeInTheDocument();
    expect(mockCompressImage).toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText(/enter medication name/i), {
      target: { value: 'Test Medication' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add medication/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/upload'),
        expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
      );
    });
    expect(mockCompressImage).toHaveBeenCalledTimes(2);
  });

  it('shows compression status while image compression is pending', async () => {
    mockCompressImage.mockImplementationOnce(async (file: File) => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return new File([file], file.name, { type: file.type });
    });
    render(<StructuredDailyCapture />);

    const fileInput = screen.getByLabelText(/or upload from device/i);
    mockFileReader();
    fireEvent.change(fileInput, {
      target: { files: [new File(['dummy image content'], 'medication.png', { type: 'image/png' })] },
    });

    expect(await screen.findByText(/compressing image/i)).toBeInTheDocument();
  });

  it('falls back to the original image when compression fails', async () => {
    const fetchMock = installFetchMock();
    mockCompressImage.mockRejectedValueOnce(new Error('Compression failed'));
    render(<StructuredDailyCapture />);

    const fileInput = screen.getByLabelText(/or upload from device/i);
    mockFileReader();
    fireEvent.change(fileInput, {
      target: { files: [new File(['dummy image content'], 'medication.png', { type: 'image/png' })] },
    });

    expect(await screen.findByRole('button', { name: /remove preview/i })).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/enter medication name/i), {
      target: { value: 'Test Medication' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add medication/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/upload'),
        expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
      );
    });
  });
});
