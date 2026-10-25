import React, { useState, useEffect } from 'react';
import { postJSON, postFormData, getPersonId, getCaregiverId } from '@/api/client';
import { useCameraPermission } from '@/lib/permissions/useCameraPermission';
import { compressImage, dataURLtoFile } from '@/lib/imageCompression';
import { useOptimisticMutation } from '@/lib/optimistic';
import CareDeltaPanel from '@/components/CareDeltaPanel';

const VITAL_TYPES = ['bp_systolic', 'bp_diastolic', 'heart_rate', 'oxygen_sat', 'temperature', 'weight'];
const VITAL_LABELS: Record<string, string> = {
  bp_systolic: 'Blood pressure — systolic',
  bp_diastolic: 'Blood pressure — diastolic',
  heart_rate: 'Heart rate',
  oxygen_sat: 'Oxygen level',
  temperature: 'Temperature',
  weight: 'Weight',
};
const VITAL_UNITS: Record<string, string> = {
  bp_systolic: 'mmHg',
  bp_diastolic: 'mmHg',
  heart_rate: 'bpm',
  oxygen_sat: '%',
  temperature: '°C',
  weight: 'kg',
};
function toLocalDateTimeInput(date = new Date()): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
const SCALE_AXES = ['mood', 'agitation', 'wellbeing_stress'];

export default function StructuredDailyCapture() {
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<unknown | null>(null);
  const [qwenAnalysis, setQwenAnalysis] = useState<{ status: string; candidates: any; analysisId: string | null; recordedAt: string | null } | null>(null);
  const [reviewDrafts, setReviewDrafts] = useState<Record<number, { subject: string; observation: string }>>({});
  const [reviewingCandidate, setReviewingCandidate] = useState<number | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState<string | null>(null);
  const [deltaAutoInput, setDeltaAutoInput] = useState<{ personId: string; content: string; source: string; eventDate: string; token: number; evidenceIds?: string[]; sourceEventId?: string } | null>(null);
  const [deltaToken, setDeltaToken] = useState(0);
  const [vitalError, setVitalError] = useState<string | null>(null);
  const [vitalFeedback, setVitalFeedback] = useState<string | null>(null);
  
  // Form state
  const [form, setForm] = useState({
    medications: [] as Array<{
      medication_name: string;
      status: string;
      dose: string | null;
      scheduled_for: string | null;
      administered_at: string | null;
      photo_evidence_id: string | null;
      note: string | null;
    }>,
    vitals: [] as Array<{
      vital_type: string;
      value: number;
      measured_at: string;
      unit: string | null;
      note: string | null;
      is_out_of_range?: boolean;
    }>,
    scales: [] as Array<{
      axis: string;
      score: number;
      observed_at: string;
      note: string | null;
    }>,
    notes: '',
  });
  
  // Medication form state
  const [medicationForm, setMedicationForm] = useState<{
    medication_name: string;
    status: string;
    dose: string | null;
    scheduled_for: string | null;
    administered_at: string | null;
    photo_evidence_id: string | null;
    note: string | null;
  }>({
    medication_name: '',
    status: '',
    dose: null,
    scheduled_for: null,
    administered_at: null,
    photo_evidence_id: null,
    note: null,
  });
  
  // Vitals form state
  const [vitalForm, setVitalForm] = useState<{
    vital_type: string;
    value: number;
    measured_at: string;
    unit: string | null;
    note: string | null;
  }>({
    vital_type: 'bp_systolic',
    value: Number.NaN,
    measured_at: toLocalDateTimeInput(),
    unit: VITAL_UNITS.bp_systolic,
    note: null,
  });
  
  // Scale form state
  const [scaleForm, setScaleForm] = useState<{
    axis: string;
    score: number;
    observed_at: string;
    note: string | null;
  }>({
    axis: 'mood',
    score: Number.NaN,
    observed_at: new Date().toISOString(),
    note: null,
  });
  
  // Image upload state for medications
  const [medicationImagePreview, setMedicationImagePreview] = useState<string | null>(null);
  useEffect(() => {
    return () => {
      if (medicationImagePreview?.startsWith('blob:')) URL.revokeObjectURL(medicationImagePreview);
    };
  }, [medicationImagePreview]);
  const [medicationUploading, setMedicationUploading] = useState(false);
  const [medicationCompressing, setMedicationCompressing] = useState(false);
  
  // Permission hooks
  const { state: cameraState, requestCamera: requestCam, stopCamera: stopCam } = useCameraPermission();
  
  // Person ID
  const personId = getPersonId();
  
  // Load caregivers (simplified for now)
  const caregiverId = getCaregiverId() ?? '';

  const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = reader.result ?? (event?.target as FileReader | null)?.result;
      if (typeof result === 'string') resolve(result);
      else reject(new Error('Could not read image preview.'));
    };
    reader.onerror = () => reject(new Error('Could not read image preview.'));
    reader.readAsDataURL(file);
  });
  

  // Handle image capture for medication
  const handleMedicationImageCapture = async () => {
    try {
      const stream = await requestCam();
      if (!stream) throw new Error('Camera access was not granted.');
      // Create a video element to capture a frame
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
        const file = dataURLtoFile(dataUrl, 'medication_capture.png');
        
        // Show compression status
        setMedicationCompressing(true);
        
        // Compress the image
        const compressedFile = await compressImage(file, {
          maxSizeMB: 0.5, // 500KB target
          maxWidthOrHeight: 2000, // 2000px max dimension
          useWebWorker: true,
          initialQuality: 0.8,
          compressForce: false,
          rotate: true,
        });
        setMedicationCompressing(false);
        
        // Convert compressed file back to data URL for preview
        setMedicationImagePreview(await fileToDataUrl(compressedFile));
        
        // Clean up
      }
      
      // Stop the stream
      stopCam();
    } catch (err) {
      console.error('Failed to capture image:', err);
      alert("We couldn't take that photo. Check camera permission or choose an image from your device.");
      stopCam();
      setMedicationCompressing(false);
    }
  };
  
  // Handle image upload for medication
  const handleMedicationImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }
    
    // Show compression status
    setMedicationCompressing(true);
    
    try {
      // Compress the image
      const compressedFile = await compressImage(file, {
        maxSizeMB: 0.5, // 500KB target
        maxWidthOrHeight: 2000, // 2000px max dimension
        useWebWorker: true,
        initialQuality: 0.8,
        compressForce: false,
        rotate: true,
      });
      
      // Convert compressed file to data URL for preview
      setMedicationImagePreview(await fileToDataUrl(compressedFile));
      
      // Clean up
    } catch (err) {
      console.error('Image compression failed:', err);
      // Fallback to original image if compression fails
      const reader = new FileReader();
      reader.onload = (event) => {
        setMedicationImagePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    } finally {
      setMedicationCompressing(false);
    }
  };
  
  // Handle medication form submission
  const handleMedicationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personId || !caregiverId) {
      alert('Open your care record first, then try adding this medication again.');
      return;
    }
    if (!medicationForm.medication_name.trim()) {
      alert('Medication name is required');
      return;
    }
    if (!medicationForm.status) {
      alert('Select the actual medication status before adding this record.');
      return;
    }
    setMedicationUploading(true);
    
    try {
      // If we have an image preview, upload it first to get an evidence ID
      let evidenceId: string | null = null;
      if (medicationImagePreview) {
        // Convert the preview data URL to a file without a network fetch.
        const file = dataURLtoFile(medicationImagePreview, 'medication.png');

        // Compress the image before upload
        setMedicationCompressing(true);
        const compressedFile = await compressImage(file, {
          maxSizeMB: 0.5, // 500KB target
          maxWidthOrHeight: 2000, // 2000px max dimension
          useWebWorker: true,
          initialQuality: 0.8,
          compressForce: false,
          rotate: true,
        });
        setMedicationCompressing(false);
        
        const formData = new FormData();
        formData.append('file', compressedFile);
        formData.append('caregiver_id', caregiverId);
        formData.append('person_id', personId);
        
        const uploadResult = await postFormData('/upload', formData) as { evidence_id?: string };
        if (!uploadResult?.evidence_id) {
          throw new Error('Image upload did not return an evidence ID');
        }
        evidenceId = uploadResult.evidence_id;
      }
      
      // Add medication to the form
      const medicationData = {
        ...medicationForm,
        medication_name: medicationForm.medication_name.trim(),
        scheduled_for: medicationForm.scheduled_for ? new Date(medicationForm.scheduled_for).toISOString() : null,
        administered_at: medicationForm.administered_at ? new Date(medicationForm.administered_at).toISOString() : null,
        photo_evidence_id: evidenceId, // Set the photo evidence ID from upload
      };
      

      // Optimistically add to medications list
      setForm(prev => ({
        ...prev,
        medications: [...prev.medications, medicationData]
      }));
      
      // Reset medication form
      setMedicationForm({
        medication_name: '',
        status: '',
        dose: null,
        scheduled_for: null,
        administered_at: null,
        photo_evidence_id: null,
        note: null,
      });
      
      // Reset image preview
      setMedicationImagePreview(null);
      
      alert('Added to this daily-care draft. Save the daily care update below to keep it.');
    } catch (err: any) {
      setMedicationUploading(false);
      setMedicationCompressing(false);
      alert("We couldn’t add this medication. Check the details and try again.");
    } finally {
      setMedicationUploading(false);
    }
  };
  
  // Add a vital to the current daily-capture draft. It is persisted when the
  // caregiver saves the complete daily capture below.
  const handleVitalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setVitalError(null);
    setVitalFeedback(null);

    const measuredAt = new Date(vitalForm.measured_at);
    if (!Number.isFinite(vitalForm.value) || vitalForm.value <= 0) {
      setVitalError('Enter a value greater than zero.');
      return;
    }
    if (Number.isNaN(measuredAt.getTime())) {
      setVitalError('Choose when this measurement was taken.');
      return;
    }

    const vitalData = {
      ...vitalForm,
      unit: vitalForm.unit?.trim() || VITAL_UNITS[vitalForm.vital_type] || null,
      measured_at: measuredAt.toISOString(),
    };

    setForm(prev => ({ ...prev, vitals: [...prev.vitals, vitalData] }));
    setVitalForm({
      vital_type: 'bp_systolic',
      value: Number.NaN,
      measured_at: toLocalDateTimeInput(),
      unit: VITAL_UNITS.bp_systolic,
      note: null,
    });
    setVitalFeedback('Added to this daily-care draft. Save daily capture below to keep it.');
  };
  
  // Handle scale form submission
  const handleScaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const scaleData = {
        ...scaleForm,
        observed_at: new Date(scaleForm.observed_at).toISOString(),
      };
      if (!Number.isInteger(scaleData.score) || scaleData.score < 1 || scaleData.score > 5) {
        alert('Select the observed score before adding this record.');
        return;
      }
      
      // Optimistically add to scales list
      setForm(prev => ({
        ...prev,
        scales: [...prev.scales, scaleData]
      }));
      
      // Reset scale form
      setScaleForm({
        axis: 'mood',
        score: Number.NaN,
        observed_at: new Date().toISOString(),
        note: null,
      });
      
      alert('Added to this daily-care draft. Save the daily care update below to keep it.');
    } catch (err: any) {
      alert("We couldn’t add this rating. Check the details and try again.");
    }
  };
  
  async function reviewCaptureCandidate(index: number, decision: 'accept' | 'correct' | 'reject') {
    const analysisId = qwenAnalysis?.analysisId;
    if (!analysisId) {
      setReviewFeedback('We couldn’t save your review just now. Your original care entry is still saved.');
      return;
    }
    const candidate = qwenAnalysis?.candidates?.observations?.[index];
    if (!candidate) {
      setReviewFeedback('This suggestion is no longer available. Refresh the page and try again.');
      return;
    }
    const draft = reviewDrafts[index] || {
      subject: candidate.subject || '',
      observation: candidate.observation || '',
    };
    if (decision === 'correct' && !(draft.subject.trim() || draft.observation.trim())) {
      setReviewFeedback('Enter a corrected subject or observation before saving a correction.');
      return;
    }
    setReviewingCandidate(index);
    setReviewFeedback(null);
    try {
      const result = await postJSON(`/capture/analyses/${encodeURIComponent(analysisId)}/review`, {
        candidate_index: index,
        decision,
        corrected_subject: decision === 'correct' ? draft.subject.trim() || undefined : undefined,
        corrected_observation: decision === 'correct' ? draft.observation.trim() || undefined : undefined,
      }) as {
        candidate?: any;
        message?: string;
        source_event_id?: string | null;
        written_to_lcr?: boolean;
      };
      if (!result?.candidate || result.written_to_lcr !== false) {
        throw new Error('The backend did not confirm a review-only decision. No reconciliation was started.');
      }
      setQwenAnalysis(current => {
        if (!current || !Array.isArray(current.candidates?.observations)) return current;
        const observations = [...current.candidates.observations];
        observations[index] = result.candidate;
        return { ...current, candidates: { ...current.candidates, observations } };
      });
      setReviewFeedback(result.message || 'Review decision saved. The Living Care Record was not changed.');
      if (decision !== 'reject' && personId && typeof result.source_event_id === 'string') {
        const reviewedText = [
          result.candidate.subject ? `Subject: ${result.candidate.subject}` : '',
          result.candidate.observation ? `Caregiver-reviewed observation: ${result.candidate.observation}` : '',
          result.candidate.source_quote ? `Original source quote: ${result.candidate.source_quote}` : '',
        ].filter(Boolean).join('\n');
        const nextToken = deltaToken + 1;
        setDeltaToken(nextToken);
        setDeltaAutoInput({
          personId,
          content: reviewedText,
          source: 'Caregiver-reviewed Daily Capture candidate',
          eventDate: qwenAnalysis.recordedAt || new Date().toISOString(),
          token: nextToken,
          sourceEventId: result.source_event_id,
        });
      }
    } catch (reason) {
      setReviewFeedback('We couldn’t save that review. Please try again.');
    } finally {
      setReviewingCandidate(null);
    }
  }


  // Handle form submission to backend with optimistic update
  const { mutate: submitDailyLog, loading: submittingMutation } = useOptimisticMutation<
    any,
    {
      personId: string;
      caregiverId: string;
      medications: Array<{
        medication_name: string;
        status: string;
        dose: string | null;
        scheduled_for: string | null;
        administered_at: string | null;
        photo_evidence_id: string | null;
        note: string | null;
      }>;
      vitals: Array<{
        vital_type: string;
        value: number;
        measured_at: string;
        unit: string | null;
        note: string | null;
      }>;
      scales: Array<{
        axis: string;
        score: number;
        observed_at: string;
        note: string | null;
      }>;
      notes: string;
    }
  >({
    mutationFn: ({ personId, caregiverId, medications, vitals, scales, notes }) => 
      postJSON('/daily/log', {
        person_id: personId,
        caregiver_id: caregiverId,
        medications: medications.map(med => ({
          ...med,
          scheduled_for: med.scheduled_for ? new Date(med.scheduled_for).toISOString() : null,
          administered_at: med.administered_at ? new Date(med.administered_at).toISOString() : null,
        })),
        vitals: vitals.map(vital => ({
          ...vital,
          measured_at: new Date(vital.measured_at).toISOString(),
        })),
        scales: scales.map(scale => ({
          ...scale,
          observed_at: new Date(scale.observed_at).toISOString(),
        })),
        notes: notes,
      }),
    onMutate: async (variables) => {
      // Return snapshot for potential rollback
      return { 
        prevForm: form, 
        prevMedicationForm: medicationForm,
        prevVitalForm: vitalForm,
        prevScaleForm: scaleForm,
        prevMedicationImagePreview: medicationImagePreview
      };
    },
    onSuccess: async (data, variables, context) => {
      setQwenAnalysis({
        status: typeof data?.qwen_extraction_status === 'string' ? data.qwen_extraction_status : 'not_reported',
        candidates: data?.qwen_candidates ?? null,
        analysisId: typeof data?.qwen_analysis_id === 'string' ? data.qwen_analysis_id : null,
        recordedAt: typeof data?.recorded_at === 'string' ? data.recorded_at : null,
      });
      setReviewDrafts({});
      setReviewFeedback(null);
      // On success, reset the form
      setForm({
        medications: [],
        vitals: [],
        scales: [],
        notes: '',
      });
      
      // Reset medication form
      setMedicationForm({
        medication_name: '',
        status: '',
        dose: null,
        scheduled_for: null,
        administered_at: null,
        photo_evidence_id: null,
        note: null,
      });
      
      // Reset vitals form
      setVitalForm({
        vital_type: 'bp_systolic',
        value: Number.NaN,
        measured_at: toLocalDateTimeInput(),
        unit: null,
        note: null,
      });
      
      // Reset scale form
      setScaleForm({
        axis: 'mood',
        score: Number.NaN,
        observed_at: new Date().toISOString(),
        note: null,
      });
      
      // Reset image preview
      setMedicationImagePreview(null);
      
      setSaveError(null);
      setSaved(true);
      // Once Daily Capture is persisted, reconcile the saved observations against the longitudinal LCR.
      // Reconciliation failure is shown by the Delta panel and never rolls back a successfully saved capture.
      const deltaContent = JSON.stringify({
        medications: variables.medications,
        vitals: variables.vitals,
        scales: variables.scales,
        notes: variables.notes,
      }, null, 2);
      const nextDeltaToken = deltaToken + 1;
      setDeltaToken(nextDeltaToken);
      setDeltaAutoInput({
        personId,
        content: deltaContent,
        source: 'SolenOS Daily Capture',
        eventDate: new Date().toISOString(),
        token: nextDeltaToken,
        sourceEventId: typeof data?.id === 'string' ? data.id : undefined,
      });
    },
    onError: async (error, variables, context) => {
      // On error, rollback to previous state
      if (context && typeof context === 'object' && 'prevForm' in context) {
        const prevContext = context as {
          prevForm: typeof form;
          prevMedicationForm: typeof medicationForm;
          prevVitalForm: typeof vitalForm;
          prevScaleForm: typeof scaleForm;
          prevMedicationImagePreview: string | null;
        };
        
        setForm(prevContext.prevForm);
        setMedicationForm(prevContext.prevMedicationForm);
        setVitalForm(prevContext.prevVitalForm);
        setScaleForm(prevContext.prevScaleForm);
        setMedicationImagePreview(prevContext.prevMedicationImagePreview);
      }
      
      setSaveError(error);
      setSaved(false);
      // The inline save-error state provides a clear retry path without exposing service details.
    },
    onSettled: () => {
      setSubmitting(false);
    },
  });

  // Handle form submission to backend
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!personId || !caregiverId) {
      const error = new Error('A signed-in caregiver and care record are required to save daily capture.');
      setSaveError(error);
      return;
    }

    await submitDailyLog({
      personId,
      caregiverId,
      medications: form.medications,
      vitals: form.vitals,
      scales: form.scales,
      notes: form.notes
    });
  };

  // Helper to render medication items
  const renderMedications = () => {
    return form.medications.map((med, index) => (
      <div key={index} style={{ 
        border: '1px solid var(--border)', 
        borderRadius: '6px', 
        padding: '12px', 
        marginBottom: '12px', 
        backgroundColor: 'var(--surface)' 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <h4 style={{ margin: 0, fontSize: '16px' }}>
            {med.medication_name}
          </h4>
          <span style={{ 
            fontSize: '12px', 
            padding: '2px 6px', 
            borderRadius: '4px', 
            backgroundColor: med.status === 'given' ? 'var(--success-soft)' : 
                         med.status === 'refused' ? 'var(--error-soft)' : 
                         med.status === 'missed' ? 'var(--warning-soft)' : 'var(--bg)', 
            color: med.status === 'given' ? 'var(--success)' : 
                   med.status === 'refused' ? 'var(--error)' : 
                   med.status === 'missed' ? 'var(--warning)' : 'var(--text-secondary)' 
          }}>
            {med.status.charAt(0).toUpperCase() + med.status.slice(1)}
          </span>
        </div>
        
        {med.dose && (
          <p style={{ margin: '4px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
            Dose: {med.dose}
          </p>
        )} 
        
        {med.scheduled_for && (
          <p style={{ margin: '4px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
            Scheduled: {new Date(med.scheduled_for).toLocaleString()}
          </p>
        )}
        
        {med.administered_at && (
          <p style={{ margin: '4px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
            Administered: {new Date(med.administered_at).toLocaleString()}
          </p>
        )}
        
        {med.note && (
          <p style={{ margin: '4px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
            Note: {med.note}
          </p>
        )}
        
        {med.photo_evidence_id && (
          <div style={{ marginTop: '8px', padding: '8px', backgroundColor: 'var(--bg)', borderRadius: '4px' }}>
            <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Photo attached
            </p>
          </div>
        )}
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button
            type="button"
            onClick={() => {
              const newMedications = [...form.medications];
              newMedications.splice(index, 1);
              setForm(prev => ({ ...prev, medications: newMedications }));
            }}
            style={{ 
              fontSize: '12px', 
              color: '#dc2626', 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer', 
              padding: '4px 8px', 
              borderRadius: '4px' 
            }}
          >
            Remove
          </button>
        </div>
      </div>
    ));
  };
  
  // Helper to render vitals items
  const renderVitals = () => {
    return form.vitals.map((vital, index) => (
      <div key={index} style={{ 
        border: '1px solid var(--border)', 
        borderRadius: '6px', 
        padding: '12px', 
        marginBottom: '12px', 
        backgroundColor: 'var(--surface)' 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <h4 style={{ margin: 0, fontSize: '16px' }}>
            {vital.vital_type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </h4>
          <span style={{ 
            fontSize: '12px', 
            padding: '2px 6px', 
            borderRadius: '4px', 
            backgroundColor: vital.is_out_of_range ? 'var(--error-soft)' : 'var(--success-soft)', 
            color: vital.is_out_of_range ? 'var(--error)' : 'var(--success)' 
          }}>
            {vital.is_out_of_range ? 'Out of range' : 'Normal'}
          </span>
        </div>
        
        <p style={{ margin: '4px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
          Value: {vital.value} {vital.unit || ''}
        </p>
        
        {vital.measured_at && (
          <p style={{ margin: '4px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
            Measured: {new Date(vital.measured_at).toLocaleString()}
          </p>
        )}
        
        {vital.note && (
          <p style={{ margin: '4px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
            Note: {vital.note}
          </p>
        )}
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button
            type="button"
            onClick={() => {
              const newVitals = [...form.vitals];
              newVitals.splice(index, 1);
              setForm(prev => ({ ...prev, vitals: newVitals }));
            }}
            style={{ 
              fontSize: '12px', 
              color: '#dc2626', 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer', 
              padding: '4px 8px', 
              borderRadius: '4px' 
            }}
          >
            Remove
          </button>
        </div>
      </div>
    ));
  };
  
  // Helper to render scales items
  const renderScales = () => {
    return form.scales.map((scale, index) => (
      <div key={index} style={{ 
        border: '1px solid var(--border)', 
        borderRadius: '6px', 
        padding: '12px', 
        marginBottom: '12px', 
        backgroundColor: 'var(--surface)' 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <h4 style={{ margin: 0, fontSize: '16px' }}>
            {scale.axis.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </h4>
          <span style={{ 
            fontSize: '12px', 
            padding: '2px 6px', 
            borderRadius: '4px', 
            backgroundColor: 'var(--accent-soft)', 
            color: 'var(--accent)' 
          }}>
            {scale.score}/5
          </span>
        </div>
        
        <p style={{ margin: '4px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
          Observed: {new Date(scale.observed_at).toLocaleString()}
        </p>
        
        {scale.note && (
          <p style={{ margin: '4px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
            Note: {scale.note}
          </p>
        )}
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button
            type="button"
            onClick={() => {
              const newScales = [...form.scales];
              newScales.splice(index, 1);
              setForm(prev => ({ ...prev, scales: newScales }));
            }}
            style={{ 
              fontSize: '12px', 
              color: '#dc2626', 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer', 
              padding: '4px 8px', 
              borderRadius: '4px' 
            }}
          >
            Remove
          </button>
        </div>
      </div>
    ));
  };
  
  return (
    <div className="structured-daily-capture">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '4px' }}>Daily care update</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5', maxWidth: '500px' }}>
          Keep track of medicines, measurements, and daily ratings in one place.
        </p>
      </div>
      
      {/* Saved indicator */}
      {saved && (
        <div style={{ 
          background: 'var(--trust-soft)', 
          border: '1px solid var(--trust)', 
          borderRadius: '8px', 
          padding: '12px 16px', 
          marginBottom: '24px' 
        }}>
          <span style={{ fontSize: '13px', color: 'var(--trust)', fontWeight: '500' }}>
            Saved. {form.notes || 'Entry recorded.'}
          </span>
        </div>
      )}
      
      {saved && qwenAnalysis && (
        <section aria-label="Review suggested care details" style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '8px', padding: '12px 16px', marginBottom: '24px'
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>Review suggested details</h2>
          <p role="status" style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            These suggestions are not yet part of your care record. Check or correct them before using them to compare care updates.
          </p>
          {Array.isArray(qwenAnalysis.candidates?.observations) && qwenAnalysis.candidates.observations.length > 0 ? (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {qwenAnalysis.candidates.observations.map((candidate: any, index: number) => {
                const draft = reviewDrafts[index] || {
                  subject: candidate.subject || '',
                  observation: candidate.observation || '',
                };
                const reviewStatus = String(candidate.review_status || 'pending_review');
                const alreadyReviewed = reviewStatus !== 'pending_review';
                return (
                  <li key={index} style={{ fontSize: '12px', marginBottom: '12px', padding: '12px 0', borderTop: '1px solid var(--border)' }}>
                    <strong>Suggested detail {index + 1}</strong>
                    <p style={{ color: 'var(--text-secondary)', margin: '4px 0 8px' }}>
                      {reviewStatus === 'pending_review' ? 'Please check this detail' : reviewStatus === 'accepted' ? 'Marked for comparison' : reviewStatus === 'corrected' ? 'Correction saved' : reviewStatus === 'rejected' ? 'Dismissed' : 'Reviewed'}
                    </p>
                    <label style={{ display: 'block', marginBottom: '8px' }}>
                      What is this about?
                      <input
                        aria-label={`Corrected subject ${index + 1}`}
                        value={draft.subject}
                        disabled={alreadyReviewed || reviewingCandidate !== null}
                        onChange={event => setReviewDrafts(current => ({ ...current, [index]: { ...(current[index] || { subject: candidate.subject || '', observation: candidate.observation || '' }), subject: event.target.value } }))}
                        maxLength={160}
                        style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: '4px', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', color: 'var(--text)' }}
                      />
                    </label>
                    <label style={{ display: 'block', marginBottom: '8px' }}>
                      What was observed?
                      <textarea
                        aria-label={`Corrected observation ${index + 1}`}
                        value={draft.observation}
                        disabled={alreadyReviewed || reviewingCandidate !== null}
                        onChange={event => setReviewDrafts(current => ({ ...current, [index]: { ...(current[index] || { subject: candidate.subject || '', observation: candidate.observation || '' }), observation: event.target.value } }))}
                        maxLength={500}
                        rows={3}
                        style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: '4px', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', color: 'var(--text)' }}
                      />
                    </label>
                    <div style={{ color: 'var(--text-secondary)', marginBottom: '8px', overflowWrap: 'anywhere' }}>
                      {candidate.source_quote ? <>From your note: {candidate.source_quote}</> : null}
                    </div>
                    {!alreadyReviewed && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        <button type="button" disabled={reviewingCandidate !== null || !qwenAnalysis.analysisId} onClick={() => void reviewCaptureCandidate(index, 'accept')}>Use for care comparison</button>
                        <button type="button" disabled={reviewingCandidate !== null || !qwenAnalysis.analysisId} onClick={() => void reviewCaptureCandidate(index, 'correct')}>Save correction</button>
                        <button type="button" disabled={reviewingCandidate !== null || !qwenAnalysis.analysisId} onClick={() => void reviewCaptureCandidate(index, 'reject')}>Dismiss suggestion</button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {qwenAnalysis.status === 'pending_review'
                ? 'No additional details stood out in this update. Your original entry is saved.'
                : 'No additional observations are available. Your saved entry remains recorded.'}
            </p>
          )}
          {reviewFeedback && <p role="status" style={{ marginTop: '10px', color: 'var(--text-secondary)' }}>{reviewFeedback}</p>}
          {Array.isArray(qwenAnalysis.candidates?.open_questions) && qwenAnalysis.candidates.open_questions.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              <strong style={{ fontSize: '12px' }}>Questions to clarify</strong>
              <ul style={{ margin: '4px 0 0', paddingLeft: '18px' }}>
                {qwenAnalysis.candidates.open_questions.map((question: string, index: number) => (
                  <li key={index} style={{ fontSize: '12px', marginBottom: '4px' }}>{question}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Save error indicator */}
      {Boolean(saveError) && !saved && (
        <div style={{ 
          background: 'var(--error-soft)', 
          border: '1px solid var(--error)', 
          borderRadius: '8px', 
          padding: '12px 16px', 
          marginBottom: '24px' 
        }}>
          <span style={{ fontSize: '13px', color: 'var(--error)', fontWeight: '500' }}>
            Failed to save. Please try again.
          </span>
        </div>
      )}
      
      {/* Submission indicator */}
      {submittingMutation && !saved && !saveError && (
        <div style={{ 
          background: 'var(--warning-soft)', 
          border: '1px solid var(--warning)', 
          borderRadius: '8px', 
          padding: '12px 16px', 
          marginBottom: '24px' 
        }}>
          <span style={{ fontSize: '13px', color: 'var(--warning)', fontWeight: '500' }}>
            Saving...
          </span>
        </div>
      )}
      
      {/* Medications section */}
      <section>
        <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>Medications</h2>
        
        {/* Medication form */}
        <div style={{ 
          background: 'var(--surface)', 
          border: '1px solid var(--border)', 
          borderRadius: '8px', 
          padding: '16px', 
          marginBottom: '24px' 
        }}>
          <h3 style={{ marginTop: '0', marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>Add Medication</h3>
          
          <form onSubmit={handleMedicationSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label htmlFor="capture-medication-name" style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Medication Name</label>
              <input
                id="capture-medication-name"
                type="text"
                value={medicationForm.medication_name}
                onChange={(e) => setMedicationForm(prev => ({ ...prev, medication_name: e.target.value }))}
                placeholder="Enter medication name"
                style={{ 
                  width: '100%', 
                  padding: '10px 12px', 
                  borderRadius: '6px', 
                  border: '1px solid var(--border)', 
                  background: 'var(--bg)', 
                  fontSize: '14px' 
                }}
              />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <label htmlFor="capture-medication-status" style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Status</label>
                <select
                  id="capture-medication-status"
                  value={medicationForm.status}
                  required
                  onChange={(e) => setMedicationForm(prev => ({ ...prev, status: e.target.value }))}
                  style={{ 
                    width: '100%', 
                    padding: '10px 12px', 
                    borderRadius: '6px', 
                    border: '1px solid var(--border)', 
                    background: 'var(--bg)', 
                    fontSize: '14px' 
                  }}
                >
                  <option value="">Select actual status</option>
                  <option value="given">Given</option>
                  <option value="refused">Refused</option>
                  <option value="missed">Missed</option>
                </select>
              </div>
              
              <div style={{ flex: 1 }}>
                <label htmlFor="medication-dose" style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Dose</label>
                <input
                  type="text"
                  id="medication-dose"
                  value={medicationForm.dose || ''}
                  onChange={(e) => setMedicationForm(prev => ({ ...prev, dose: e.target.value || null }))}
                  placeholder="Enter dose (e.g., 10mg)"
                  style={{ 
                    width: '100%', 
                    padding: '10px 12px', 
                    borderRadius: '6px', 
                    border: '1px solid var(--border)', 
                    background: 'var(--bg)', 
                    fontSize: '14px' 
                  }}
                />
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Scheduled For</label>
                <input
                  type="datetime-local"
                  value={medicationForm.scheduled_for || ''}
                  onChange={(e) => setMedicationForm(prev => ({ ...prev, scheduled_for: e.target.value || null }))}
                  style={{ 
                    width: '100%', 
                    padding: '10px 12px', 
                    borderRadius: '6px', 
                    border: '1px solid var(--border)', 
                    background: 'var(--bg)', 
                    fontSize: '14px' 
                  }}
                />
              </div>
              
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Administered At</label>
                <input
                  type="datetime-local"
                  value={medicationForm.administered_at || ''}
                  onChange={(e) => setMedicationForm(prev => ({ ...prev, administered_at: e.target.value || null }))}
                  style={{ 
                    width: '100%', 
                    padding: '10px 12px', 
                    borderRadius: '6px', 
                    border: '1px solid var(--border)', 
                    background: 'var(--bg)', 
                    fontSize: '14px' 
                  }}
                />
              </div>
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Note</label>
              <textarea
                value={medicationForm.note || ''}
                onChange={(e) => setMedicationForm(prev => ({ ...prev, note: e.target.value || null }))}
                placeholder="Add any notes about the medication"
                rows={2}
                style={{ 
                  width: '100%', 
                  padding: '10px 12px', 
                  borderRadius: '6px', 
                  border: '1px solid var(--border)', 
                  background: 'var(--bg)', 
                  fontSize: '14px', 
                  resize: 'vertical' 
                }}
              />
            </div>
            
            {/* Image upload for medication */}
            <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'var(--bg)', borderRadius: '6px' }}>
              <h4 style={{ marginTop: '0', marginBottom: '12px', fontSize: '16px', fontWeight: '600' }}>Medication Photo (Optional)</h4>
              
              {medicationImagePreview ? (
                <div>
                  <div style={{ 
                    width: '100%', 
                    height: '200px', 
                    backgroundColor: 'var(--surface)', 
                    border: '1px solid var(--border)', 
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '12px'
                  }}>
                    <img 
                      src={medicationImagePreview} 
                      alt="Medication preview" 
                      style={{ maxWidth: '100%', maxHeight: '100%' }} 
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => setMedicationImagePreview(null)}
                      style={{ 
                        fontSize: '12px', 
                        color: '#dc2626', 
                        background: 'none', 
                        border: 'none', 
                        cursor: 'pointer', 
                        padding: '6px 10px', 
                        borderRadius: '4px' 
                      }}
                    >
                      Remove Preview
                    </button>
                    <button
                      type="button"
                      onClick={handleMedicationSubmit}
                      disabled={medicationUploading || !medicationForm.medication_name.trim()}
                      style={{ 
                        fontSize: '13px', 
                        fontWeight: '500', 
                        color: 'white', 
                        background: medicationUploading || !medicationForm.medication_name.trim() 
                                   ? 'var(--text-secondary)' 
                                   : 'var(--accent)', 
                        padding: '8px 16px', 
                        borderRadius: '6px', 
                        cursor: medicationUploading || !medicationForm.medication_name.trim() 
                               ? 'default' 
                               : 'pointer' 
                      }}
                    >
                      {medicationUploading ? 'Adding...' : 'Add Medication with Photo'}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <button
                      type="button"
                      onClick={handleMedicationImageCapture}
                      disabled={submitting || medicationUploading || cameraState.status === 'denied' || cameraState.status === 'unsupported' ? true : false}
                      style={{ 
                        fontSize: '12px', 
                        padding: '8px 12px', 
                        borderRadius: '4px', 
                        border: '1px solid var(--border)', 
                        background: cameraState.status === 'unknown' ? 'var(--accent)' : 'var(--text-secondary)', 
                        color: 'white', 
                        cursor: cameraState.status === 'unknown' ? 'pointer' : 'default' 
                      }}
                    >
                      {cameraState.status === 'unknown' ? 'Take Photo' : cameraState.status === 'denied' || cameraState.status === 'unsupported' ? 'Camera Unavailable' : 'Camera Ready'}
                    </button>
                    <input
                      id="medication-file-input"
                      type="file"
                      accept="image/*"
                      onChange={handleMedicationImageUpload}
                      className='medication-file-input'
                      disabled={submitting || medicationUploading}
                    />
                    <label htmlFor="medication-file-input" className='medication-file-label'>
                      or upload from device
                    </label>
                  </div>
                  {medicationUploading && (
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                      Uploading...
                    </p>
                  )}
                  {medicationCompressing && (
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                      Compressing image...
                    </p>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                    <button
                      type="button"
                      onClick={handleMedicationSubmit}
                      disabled={medicationUploading || !medicationForm.medication_name.trim()}
                      style={{ 
                        fontSize: '13px', 
                        fontWeight: '500', 
                        color: 'white', 
                        background: medicationUploading || !medicationForm.medication_name.trim() 
                                   ? 'var(--text-secondary)' 
                                   : 'var(--accent)', 
                        padding: '8px 16px', 
                        borderRadius: '6px', 
                        cursor: medicationUploading || !medicationForm.medication_name.trim() 
                               ? 'default' 
                               : 'pointer' 
                      }}
                    >
                      {medicationUploading ? 'Adding...' : 'Add Medication'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </form>
        </div>
        
        {/* Display current medications */}
        {form.medications.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <h3 style={{ marginBottom: '12px', fontSize: '18px', fontWeight: '600' }}>Current Medications</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {renderMedications()}
            </div>
          </div>
        )}
      </section>
      
      {/* Vitals section */}
      <section>
        <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>Vitals</h2>
        
        {/* Vitals form */}
        <div style={{ 
          background: 'var(--surface)', 
          border: '1px solid var(--border)', 
          borderRadius: '8px', 
          padding: '16px', 
          marginBottom: '24px' 
        }}>
          <h3 style={{ marginTop: '0', marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>Add Vital</h3>
          
          <form onSubmit={handleVitalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label htmlFor="capture-vital-type" style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Vital Type</label>
              <select
                id="capture-vital-type"
                value={vitalForm.vital_type}
                onChange={(e) => {
                  const nextType = e.target.value;
                  setVitalError(null);
                  setVitalFeedback(null);
                  setVitalForm(prev => ({
                    ...prev,
                    vital_type: nextType,
                    unit: !prev.unit || Object.values(VITAL_UNITS).includes(prev.unit)
                      ? VITAL_UNITS[nextType]
                      : prev.unit,
                  }));
                }}
                style={{ 
                  width: '100%', 
                  padding: '10px 12px', 
                  borderRadius: '6px', 
                  border: '1px solid var(--border)', 
                  background: 'var(--bg)', 
                  fontSize: '14px' 
                }}
              >
                {VITAL_TYPES.map(type => (
                  <option key={type} value={type}>
                    {VITAL_LABELS[type] ?? type.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <label htmlFor="capture-vital-value" style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Value</label>
                <input
                  id="capture-vital-value"
                  type="number"
                  min="0.01"
                  step="any"
                  value={Number.isFinite(vitalForm.value) ? vitalForm.value : ''}
                  required
                  onChange={(e) => {
                  setVitalError(null);
                  setVitalFeedback(null);
                  setVitalForm(prev => ({ ...prev, value: e.target.value === '' ? Number.NaN : Number(e.target.value) }));
                }}
                  placeholder="Enter value"
                  style={{ 
                    width: '100%', 
                    padding: '10px 12px', 
                    borderRadius: '6px', 
                    border: '1px solid var(--border)', 
                    background: 'var(--bg)', 
                    fontSize: '14px' 
                  }}
                />
              </div>
              
              <div style={{ flex: 1 }}>
                <label htmlFor="vital-unit" style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Unit</label>
                <input
                  type="text"
                  id="vital-unit"
                  value={vitalForm.unit || VITAL_UNITS[vitalForm.vital_type] || ''}
                  onChange={(e) => {
                    setVitalError(null);
                    setVitalFeedback(null);
                    setVitalForm(prev => ({ ...prev, unit: e.target.value || null }));
                  }}
                  placeholder="Enter unit (e.g., mmHg, bpm)"
                  style={{ 
                    width: '100%', 
                    padding: '10px 12px', 
                    borderRadius: '6px', 
                    border: '1px solid var(--border)', 
                    background: 'var(--bg)', 
                    fontSize: '14px' 
                  }}
                />
              </div>
              
              <div>
                <label htmlFor="capture-vital-measured-at" style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Measured at</label>
                <input
                  type="datetime-local"
                  id="capture-vital-measured-at"
                  value={vitalForm.measured_at}
                  onChange={(e) => {
                    setVitalError(null);
                    setVitalFeedback(null);
                    setVitalForm(prev => ({ ...prev, measured_at: e.target.value }));
                  }}
                  style={{ 
                    width: '100%', 
                    padding: '10px 12px', 
                    borderRadius: '6px', 
                    border: '1px solid var(--border)', 
                    background: 'var(--bg)', 
                    fontSize: '14px' 
                  }}
                />
              </div>
              
              <div>
                <label htmlFor="capture-vital-note" style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Note (optional)</label>
                <textarea
                  id="capture-vital-note"
                  value={vitalForm.note || ''}
                  onChange={(e) => {
                    setVitalError(null);
                    setVitalFeedback(null);
                    setVitalForm(prev => ({ ...prev, note: e.target.value || null }));
                  }}
                  placeholder="Add any notes about the vital"
                  rows={2}
                  style={{ 
                    width: '100%', 
                    padding: '10px 12px', 
                    borderRadius: '6px', 
                    border: '1px solid var(--border)', 
                    background: 'var(--bg)', 
                    fontSize: '14px', 
                    resize: 'vertical' 
                  }}
                />
              </div>
            </div>
              
              {vitalError && <p role="alert" style={{ margin: 0, padding: '10px 12px', borderRadius: 8, background: '#fff4dc', border: '1px solid #c8a85d', color: '#3b2e11' }}>{vitalError}</p>}
              {vitalFeedback && <p role="status" style={{ margin: 0, padding: '10px 12px', borderRadius: 8, background: '#edf5eb', border: '1px solid #8eae8a', color: '#172b35' }}>{vitalFeedback}</p>}
              <div style={{ marginTop: '16px', textAlign: 'right' }}>
                <button
                  type="submit"
                  className="workspace-primary"
                  disabled={submitting}
                  style={{ fontSize: '14px', fontWeight: 700, padding: '10px 16px', borderRadius: '8px', cursor: submitting ? 'not-allowed' : 'pointer' }}
                >
                  {submitting ? 'Adding…' : 'Add vital'}
                </button>
              </div>
            </form>
          </div>
          
          {/* Display current vitals */}
          {form.vitals.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <h3 style={{ marginBottom: '12px', fontSize: '18px', fontWeight: '600' }}>Current Vitals</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {renderVitals()}
              </div>
            </div>
          )}
        </section>
        
        {/* Scales section */}
        <section>
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>Scales</h2>
          
          {/* Scales form */}
          <div style={{ 
            background: 'var(--surface)', 
            border: '1px solid var(--border)', 
            borderRadius: '8px', 
            padding: '16px', 
            marginBottom: '24px' 
          }}>
            <h3 style={{ marginTop: '0', marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>Add Scale Observation</h3>
            
            <form onSubmit={handleScaleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label htmlFor="capture-scale-type" style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Scale Type</label>
                <select
                  id="capture-scale-type"
                  value={scaleForm.axis}
                  onChange={(e) => setScaleForm(prev => ({ ...prev, axis: e.target.value }))}
                  style={{ 
                    width: '100%', 
                    padding: '10px 12px', 
                    borderRadius: '6px', 
                    border: '1px solid var(--border)', 
                    background: 'var(--bg)', 
                    fontSize: '14px' 
                  }}
                >
                  {SCALE_AXES.map(axis => (
                    <option key={axis} value={axis}>
                      {axis.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>
              
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="capture-scale-score" style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Score (1-5)</label>
                <input
                  id="capture-scale-score"
                  type="number"
                  min={1}
                  max={5}
                  value={Number.isFinite(scaleForm.score) ? scaleForm.score : ''}
                  required
                  onChange={(e) => setScaleForm(prev => ({ ...prev, score: e.target.value === '' ? Number.NaN : Number.parseInt(e.target.value, 10) }))}
                  placeholder="Enter score"
                  style={{ 
                    width: '100%', 
                    padding: '10px 12px', 
                    borderRadius: '6px', 
                    border: '1px solid var(--border)', 
                    background: 'var(--bg)', 
                    fontSize: '14px' 
                  }}
                />
              </div>
              
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Observed At</label>
                <input
                  type="datetime-local"
                  value={scaleForm.observed_at}
                  onChange={(e) => setScaleForm(prev => ({ ...prev, observed_at: e.target.value }))}
                  style={{ 
                    width: '100%', 
                    padding: '10px 12px', 
                    borderRadius: '6px', 
                    border: '1px solid var(--border)', 
                    background: 'var(--bg)', 
                    fontSize: '14px' 
                  }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Note</label>
                <textarea
                  value={scaleForm.note || ''}
                  onChange={(e) => setScaleForm(prev => ({ ...prev, note: e.target.value || null }))}
                  placeholder="Add any notes about the scale observation"
                  rows={2}
                  style={{ 
                    width: '100%', 
                    padding: '10px 12px', 
                    borderRadius: '6px', 
                    border: '1px solid var(--border)', 
                    background: 'var(--bg)', 
                    fontSize: '14px', 
                    resize: 'vertical' 
                  }}
                />
              </div>
              
            </div>
              
              <div style={{ marginTop: '16px', textAlign: 'right' }}>
                <button
                  type="button"
                  onClick={handleScaleSubmit}
                  disabled={submitting}
                  style={{ 
                    fontSize: '13px', 
                    fontWeight: '500', 
                    color: 'white', 
                    background: submitting ? 'var(--text-secondary)' : 'var(--accent)', 
                    padding: '8px 16px', 
                    borderRadius: '6px', 
                    cursor: submitting ? 'default' : 'pointer' 
                  }}
                >
                  {submitting ? 'Adding...' : 'Add Scale'}
                </button>
              </div>
            </form>
          </div>
          
          {/* Display current scales */}
          {form.scales.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <h3 style={{ marginBottom: '12px', fontSize: '18px', fontWeight: '600' }}>Current Scale Observations</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {renderScales()}
              </div>
            </div>
          )}
        </section>
        
        {/* Notes section */}
        <section>
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>Notes</h2>
          
          <div style={{ 
            background: 'var(--surface)', 
            border: '1px solid var(--border)', 
            borderRadius: '8px', 
            padding: '16px' 
          }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '8px' }}>Additional Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Add any additional notes about the day"
              rows={4}
              style={{ 
                width: '100%', 
                padding: '10px 12px', 
                borderRadius: '6px', 
                border: '1px solid var(--border)', 
                background: 'var(--bg)', 
                fontSize: '14px', 
                resize: 'vertical' 
              }}
            />
          </div>
        </section>
        
        {/* Submit button */}
        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submittingMutation}
            style={{ 
              fontSize: '16px', 
              fontWeight: '600', 
              color: 'white', 
              background: submittingMutation ? 'var(--text-secondary)' : 'var(--trust)', 
              padding: '12px 24px', 
              borderRadius: '8px', 
              cursor: submittingMutation ? 'default' : 'pointer' 
            }}
          >
            {submittingMutation ? 'Saving…' : 'Save daily care update'}
          </button>
        </div>
      <CareDeltaPanel key={personId} personId={personId} autoInput={deltaAutoInput} showPanel={false} />
      </div>
    );
}