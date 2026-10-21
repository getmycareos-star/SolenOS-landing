import React, { useState, useEffect } from 'react';
import { getJSON, postFormData, postJSON, getCaregiverId, getPersonId } from '../api/client';
import { useCameraPermission } from '../lib/permissions/useCameraPermission';
import { formatDate, formatConfidence } from '../lib/utils';
import { compressImage, dataURLtoFile } from '../lib/imageCompression';
import { SourceIndicator } from '../components/SourceIndicator';
import { InformationStatus } from '../components/InformationStatus';
import { AIAttribution } from '../components/AIAttribution';
import { PrivacyIndicator } from '../components/PrivacyIndicator';
import { useOptimisticMutation } from '../lib/optimistic';

const typeIcon = {
  free_form_note: 'ðŸ“',
  document: 'ðŸ“„',
  device_reading: 'ðŸ’“',
  caregiver_input: 'ðŸ‘¨â€âš•ï¸',
  family_report: 'ðŸ‘ª',
  clinician_note: 'ðŸ‘¨â€âš•ï¸',
  lab_result: 'ðŸ”¬',
};

const statusColor = {
  ACTIVE: { bg: 'var(--success-soft)', color: 'var(--success)' },
  DEPRECATED: { bg: 'var(--warning-soft)', color: 'var(--warning)' },
  SUPERSEDED: { bg: 'var(--error-soft)', color: 'var(--error)' },
};

export interface EvidenceProps {
  compressImageFn?: typeof compressImage;
  dataURLtoFileFn?: typeof dataURLtoFile;
}

export default function Evidence({ compressImageFn = compressImage, dataURLtoFileFn = dataURLtoFile }: EvidenceProps = {}) {
  const [filter, setFilter] = useState({
    search: '',
    type: '',
    status: '',
  });
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [selectedEvidence, setSelectedEvidence] = useState(null);

  // Form state for creating new evidence
  const [form, setForm] = useState({
    source_type: 'free_form_note',
    source_text: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageAttachment, setImageAttachment] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [submitError, setSubmitError] = useState<unknown | null>(null);

  useEffect(() => () => {
    if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  // Optimistic mutation for creating evidence
  const { mutate: createEvidenceOptimistic, loading: creating, error: createError } = useOptimisticMutation<
    any,
    {
      source_type: string;
      source_text: string;
      caregiver_id: string;
      person_id: string;
    }
  >({
    mutationFn: ({ source_type, source_text, caregiver_id, person_id }) => 
      postJSON('/evidence', {
        person_id,
        type: source_type,
        source_type,
        source_text,
        uploaded_by_caregiver_id: caregiver_id,
      }),
    onMutate: async (variables) => {
      // Return snapshot for potential rollback
      return { 
        prevForm: form,
        prevImagePreview: imagePreview
      };
    },
    onSuccess: async (data, variables, context) => {
      // On success, we want to refetch the evidence list to show the new evidence
      // But we also optimistically added it, so we could add it to the list
      // For simplicity, we'll refetch the list
      try {
        const freshData = await getJSON(`/evidence/${getPersonId()}`);
        setItems(freshData);
      } catch (err) {
        console.error('Failed to refresh evidence list:', err);
      }
      
      // Reset form
      setForm({
        source_type: 'free_form_note',
        source_text: '',
      });
      setImagePreview(null);
      setSubmitError(null);
    },
    onError: async (error, variables, context) => {
      // On error, rollback to previous state
      if (context && typeof context === 'object' && 'prevForm' in context) {
        const prevContext = context as {
          prevForm: typeof form;
          prevImagePreview: string | null;
        };
        
        setForm(prevContext.prevForm);
        setImagePreview(prevContext.prevImagePreview);
      }
      
      setSubmitError(error);
      console.error('Failed to create evidence:', error);
    },
    onSettled: () => {
      setSubmitting(false);
      setCompressing(false);
    },
    retry: true,
    maxRetries: 3
  });

  // Camera permission hook
  const { state: cameraState, requestCamera: requestCam, stopCamera: stopCam } = useCameraPermission();

  useEffect(() => {
    async function loadEvidence() {
      try {
        const data = await getJSON(`/evidence/${getPersonId()}`);
        setItems(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadEvidence();
  }, []);

  const handleImageCapture = async () => {
    try {
      const stream = await requestCam();
      // We need to get a frame from the stream to create an image preview
      // For simplicity, we'll use a canvas to capture a frame
      // But note: this is a simplified implementation. In production, you might want to use a library or a more robust method.
      // We'll create a video element, play the stream, and then capture a frame.
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      // Wait for the video to play
      await new Promise<void>((resolve) => {
        video.onplaying = () => resolve();
      });

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        
        // Convert data URL to file for compression
        const file = dataURLtoFileFn(dataUrl, 'captured_image.png');
        
        // Show compression status
        setCompressing(true);
        
        // Compress the image
        const compressedFile = await compressImageFn(file, {
          maxSizeMB: 0.5, // 500KB target
          maxWidthOrHeight: 2000, // 2000px max dimension
          useWebWorker: true,
          initialQuality: 0.8,
          compressForce: false,
          rotate: true,
        });
        
        // Convert compressed file back to data URL for preview
        setImageAttachment(compressedFile);
        const compressedUrl = URL.createObjectURL(compressedFile);
        setImagePreview(compressedUrl);
        setCompressing(false);
      }

      // Stop the stream
      stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      console.error('Failed to capture image:', err);
      alert('Failed to capture image: ' + err.message);
      setCompressing(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('Please select a JPEG, PNG, or WebP image.');
      return;
    }
    
    // Show compression status
    setCompressing(true);
    
    try {
      // Compress the image
      const compressedFile = await compressImageFn(file, {
        maxSizeMB: 0.5, // 500KB target
        maxWidthOrHeight: 2000, // 2000px max dimension
        useWebWorker: true,
        initialQuality: 0.8,
        compressForce: false,
        rotate: true,
      });
      
      // Convert compressed file to data URL for preview
      setImageAttachment(compressedFile);
      const compressedUrl = URL.createObjectURL(compressedFile);
      setImagePreview(compressedUrl);
      
      // Clean up
      URL.revokeObjectURL(compressedUrl);
    } catch (err) {
      console.error('Image compression failed:', err);
      // Fallback to original image if compression fails
      setImageAttachment(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    } finally {
      setCompressing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!form.source_text.trim() && !imagePreview) {
      alert('Please enter some text or upload an image');
      return;
    }
    
    const caregiverId = getCaregiverId();
    const personId = getPersonId();
    if (!caregiverId || !personId || personId === 'demo-person-id') {
      setSubmitError(new Error('Sign in and link a caregiver identity before creating evidence.'));
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      if (imagePreview) {
        setUploading(true);
        const uploadFile = imageAttachment ?? dataURLtoFileFn(imagePreview, 'care-image.png');
        const uploadForm = new FormData();
        uploadForm.append('file', uploadFile);
        uploadForm.append('caregiver_id', caregiverId);
        uploadForm.append('person_id', personId);
        const uploaded = await postFormData('/upload', uploadForm) as { evidence_id?: string };
        if (!uploaded.evidence_id) throw new Error('Upload response did not include an evidence ID.');
        setImagePreview(null);
        setImageAttachment(null);
        const freshEvidence = await getJSON(`/evidence/${personId}`);
        setItems(freshEvidence);
      }

      if (form.source_text.trim()) {
        await createEvidenceOptimistic({
          source_type: form.source_type,
          source_text: form.source_text.trim(),
          caregiver_id: caregiverId,
          person_id: personId,
        });
      } else {
        setForm({ source_type: 'free_form_note', source_text: '' });
        setSubmitError(null);
      }
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause : new Error('Evidence could not be saved.'));
    } finally {
      setUploading(false);
      setSubmitting(false);
    }
  };

  const selectEvidence = (evidence: any) => {
    setSelectedEvidence(evidence);
  };

  const closeDetail = () => {
    setSelectedEvidence(null);
  };

  return (
    <div>
      <div className='evidence-page'>
        {selectedEvidence ? (
          <div className='evidence-detail'>
            <div className='evidence-detail-header'>
              <h2>Evidence Details</h2>
              <button onClick={closeDetail} className='btn btn-outline'>
                Close
              </button>
            </div>
            <div className='evidence-detail-body'>
              {/* Evidence detail content */}
              <div className='evidence-detail-section'>
                <h3>Source Information</h3>
                <div className='evidence-detail-item'>
                  <span className='evidence-detail-label'>Type:</span>
                  <span className='evidence-detail-value'>{selectedEvidence.type.replace(/_/g, ' ')}</span>
                </div>
                <div className='evidence-detail-item'>
                  <span className='evidence-detail-label'>Status:</span>
                  <span className={`
                    evidence-detail-status ${statusColor[selectedEvidence.status as keyof typeof statusColor]?.bg || ''}
                  `}>{selectedEvidence.status}</span>
                </div>
                <div className='evidence-detail-item'>
                  <span className='evidence-detail-label'>Created:</span>
                  <span className='evidence-detail-value'>{formatDate(selectedEvidence.created_at)}</span>
                </div>
              </div>
              <div className='evidence-detail-section'>
                <h3>Content</h3>
                <p className='evidence-detail-text'>{selectedEvidence.source_text}</p>
              </div>
              {/* If the evidence is an image, show the preview */}
              {selectedEvidence.type === 'document' && selectedEvidence.source_text === 'Image upload' && (
                <div className='evidence-detail-section'>
                  <h3>Image Preview</h3>
                  {/* We would need to fetch the image from the backend to show it */}
                  {/* For now, we show a placeholder */}
                  <div style={{ width: '200px', height: '200px', backgroundColor: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                    Image preview not available in detail view
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className='evidence-list'>
            <div className='evidence-list-header'>
              <h1>Evidence</h1>
              <p className='evidence-list-description'>
                Collect and organize observations, measurements, and artifacts that tell the story of care over time.
              </p>
            </div>
            
            <div className='evidence-list-filter'>
              <div className='evidence-list-filter-group'>
                <label htmlFor="evidence-filter-type" className='evidence-list-filter-label'>Evidence Type</label>
                <select
                  id="evidence-filter-type"
                  value={filter.type}
                  onChange={(e) => setFilter({ ...filter, type: e.target.value })}
                  className='evidence-list-filter-select'
                >
                  <option value="">All Types</option>
                  {Object.keys(typeIcon).map(t => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div className='evidence-list-filter-group'>
                <label htmlFor="evidence-filter-status" className='evidence-list-filter-label'>Status</label>
                <select
                  id="evidence-filter-status"
                  value={filter.status}
                  onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                  className='evidence-list-filter-select'
                >
                  <option value="">All Statuses</option>
                  {Object.keys(statusColor).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className='evidence-list-filter-group'>
                <label htmlFor="evidence-filter-search" className='evidence-list-filter-label'>Search</label>
                <input
                  id="evidence-filter-search"
                  type="text"
                  placeholder="Search evidence..."
                  value={filter.search}
                  onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                  className='evidence-list-filter-input'
                />
              </div>
            </div>
            
            <div className='evidence-list-actions'>
              <button
                onClick={() => {
                  // Toggle between simple form and advanced form? We'll just show the form for now.
                  // We'll show the form for creating evidence.
                  // We'll reset the form and clear the image preview.
                  setForm({
                    source_type: 'free_form_note',
                    source_text: '',
                  });
                  setImagePreview(null);
                  setImageAttachment(null);
                }}
                className='btn btn-primary'
              >
                Reset evidence form
              </button>
            </div>
            
            {/* Evidence creation form */}
            <div className='evidence-list-form'>
              <h3>Create New Evidence</h3>
              <form onSubmit={handleSubmit} className='evidence-list-form-inner'>
                <div className='evidence-list-form-group'>
                  <label htmlFor="evidence-source-type" className='evidence-list-form-label'>Evidence Type</label>
                  <select
                    id="evidence-source-type"
                    value={form.source_type}
                    onChange={(e) => setForm({ ...form, source_type: e.target.value })}
                    className='evidence-list-form-select'
                  >
                    <option value="free_form_note">Free Form Note</option>
                    <option value="document">Document</option>
                    <option value="device_reading">Device Reading</option>
                    <option value="caregiver_input">Caregiver Input</option>
                    <option value="family_report">Family Report</option>
                    <option value="clinician_note">Clinician Note</option>
                    <option value="lab_result">Lab Result</option>
                  </select>
                </div>
                <div className='evidence-list-form-group'>
                  <label htmlFor="evidence-source-text" className='evidence-list-form-label'>Source Text</label>
                  <textarea
                    id="evidence-source-text"
                    value={form.source_text}
                    onChange={(e) => setForm({ ...form, source_text: e.target.value })}
                    rows={4}
                    className='evidence-list-form-textarea'
                  />
                </div>
                {/* Image upload controls */}
                <div className='evidence-list-form-group'>
                  <p className='evidence-list-form-label'>Image Attachment</p>
                  <div className='evidence-list-form-image-controls'>
                    {imagePreview ? (
                      <div>
                        <div className='evidence-list-image-preview'>
                          <img src={imagePreview} alt="Preview" className='evidence-list-image-preview-img' />
                        </div>
                        <button
                          type="button"
                          aria-label="Remove preview"
                          onClick={() => { setImagePreview(null); setImageAttachment(null); }}
                          className='btn btn-outline'
                        >
                          Remove Preview
                        </button>
                      </div>
                    ) : (
                      <div>
                        <button
                          type="button"
                          onClick={handleImageCapture}
                          disabled={submitting || cameraState.status === 'denied' || cameraState.status === 'unsupported' ? true : false}
                          className={`
                            btn ${cameraState.status === 'unknown' ? 'btn-primary' : 'btn-outline'}
                          `}
                        >
                          {cameraState.status === 'unknown' ? 'Take Photo' : cameraState.status === 'denied' || cameraState.status === 'unsupported' ? 'Camera Unavailable' : 'Camera Ready'}
                        </button>
                        <input
                          id="evidence-image-file"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleImageUpload}
                          className='evidence-list-file-input'
                          disabled={submitting}
                        />
                        <label htmlFor="evidence-image-file" className='evidence-list-file-label'>
                          or upload from device
                        </label>
                      </div>
                    )}
                    {/* Show compression status */}
                    {compressing && (
                      <div className='compression-status'>
                        Compressing image...
                      </div>
                    )}
                    {/* Show submitting status */}
                    {submitting && !creating && (
                      <div className='submission-status'>
                        Preparing upload...
                      </div>
                    )}
                    {/* Show creating status */}
                    {creating && (
                      <div className='creation-status'>
                        Creating evidence...
                      </div>
                    )}
                    {/* Show error status */}
                    {submitError && !creating && (
                      <div className='error-status'>
                        Failed to create evidence: {(submitError as Error)?.message || 'Unknown error'}
                      </div>
                    )}
                  </div>
                </div>
                <div className='evidence-list-form-actions'>
                  <button
                    type="submit"
                    disabled={submitting || creating}
                    className='btn btn-primary'
                  >
                    {submitting || creating ? 'Creating...' : 'Create Evidence'}
                  </button>
                </div>
              </form>
            </div>
            
            {/* Evidence list */}
            <div className='evidence-list-items'>
              {loading && <p className='evidence-list-loading'>Loading evidence...</p>}
              {!loading && items.length === 0 && (
                <p>No evidence found. Create your first evidence above.</p>
              )}
              {!loading && items.length > 0 && (
                <div className='evidence-list-grid'>
                  {items.map((item: any) => {
                    const sc = statusColor[item.status as keyof typeof statusColor] || statusColor.ACTIVE;
                    return (
                      <div
                        key={item.id}
                        onClick={() => selectEvidence(item)}
                        className='evidence-list-item'
                        style={{
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          padding: '16px',
                          backgroundColor: 'var(--surface)',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'} 
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                      >
                        <div className='evidence-list-item-header'>
                          <div className='evidence-list-item-type'>
                            <span className='evidence-list-item-type-icon'>{typeIcon[item.type] || 'ðŸ“Ž'}</span>
                            <span className='evidence-list-item-type-text'>{item.type.replace(/_/g, ' ')}</span>
                          </div>
                          <div className='evidence-list-item-status'>
                            <span className={`evidence-list-item-status-dot ${sc.bg}`} />
                            <span className='evidence-item-status-text'>{item.status}</span>
                          </div>
                        </div>
                        <div className='evidence-list-item-content'>
                          <p className='evidence-list-item-text'>{item.source_text}</p>
                        </div>
                        <div className='evidence-list-item-meta'>
                          <span className='evidence-list-item-date'>{formatDate(item.created_at)}</span>
                          {item.confidence_overall != null && (
                            <span className='evidence-list-item-confidence'>
                              Confidence: {formatConfidence(item.confidence_overall)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}