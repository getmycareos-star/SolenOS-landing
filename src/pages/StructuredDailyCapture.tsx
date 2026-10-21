import React, { useState, useEffect } from 'react';
import { getJSON, postJSON, getPersonId } from '../api/client';
import { useCameraPermission } from '../lib/permissions/useCameraPermission';
import { compressImage } from '../lib/imageCompression';
import { useOptimisticMutation } from '../lib/optimistic';

type MedicationEntry = {
  medication_name: string;
  status: string;
  dose: string | null;
  scheduled_for: string | null;
  administered_at: string | null;
  photo_evidence_id: string | null;
  note: string | null;
};
type VitalEntry = {
  vital_type: string;
  value: number;
  measured_at: string;
  unit: string | null;
  note: string | null;
};
type ScaleEntry = {
  axis: string;
  score: number;
  observed_at: string;
  note: string | null;
};
type MedicationFormState = MedicationEntry;
type VitalFormState = Omit<VitalEntry, 'measured_at'> & { measured_at: string };
type ScaleFormState = ScaleEntry;
type DailyLogVariables = {
  personId: string;
  caregiverId: string;
  medications: MedicationEntry[];
  vitals: VitalEntry[];
  scales: ScaleEntry[];
  notes: string;
};

const VITAL_TYPES = ['bp_systolic', 'bp_diastolic', 'heart_rate', 'oxygen_sat', 'temperature', 'weight'];
const SCALE_AXES = ['mood', 'agitation', 'wellbeing_stress'];

export default function StructuredDailyCapture() {
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<unknown | null>(null);
  
  // Form state
  const [form, setForm] = useState<{
    medications: MedicationEntry[];
    vitals: VitalEntry[];
    scales: ScaleEntry[];
    notes: string;
  }>({
    medications: [],
    vitals: [],
    scales: [],
    notes: '',
  });

  
  // Medication form state
  const [medicationForm, setMedicationForm] = useState<MedicationFormState>({
    medication_name: '',
    status: 'given', // default to given
    dose: null,
    scheduled_for: null,
    administered_at: null,
    photo_evidence_id: null,
    note: null,
  });
  
  // Vitals form state
  const [vitalForm, setVitalForm] = useState<VitalFormState>({
    vital_type: 'bp_systolic',
    value: 0,
    measured_at: new Date().toISOString(),
    unit: null,
    note: null,
  });
  
  // Scale form state
  const [scaleForm, setScaleForm] = useState<ScaleFormState>({
    axis: 'mood',
    score: 3,
    observed_at: new Date().toISOString(),
    note: null,
  });
  
  // Image upload state for medications
  const [medicationImagePreview, setMedicationImagePreview] = useState<string | null>(null);
  const [medicationUploading, setMedicationUploading] = useState(false);
  const [medicationCompressing, setMedicationCompressing] = useState(false);
  
  // Permission hooks
  const { state: cameraState, requestCamera: requestCam } = useCameraPermission();
  
  // Person ID
  const personId = getPersonId();
  
  // Resolve the caregiver linked to this person; never submit a fabricated ID.
  const [caregiverId, setCaregiverId] = useState<string>('');
  const [loadingCaregivers, setLoadingCaregivers] = useState<boolean>(true);
  const [caregiverError, setCaregiverError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoadingCaregivers(true);
    setCaregiverId('');
    setCaregiverError(null);
    getJSON(`/caregivers/person/${personId}`)
      .then((data: Array<{ id: string; name: string }>) => {
        if (!active) return;
        setCaregiverId(data[0]?.id || '');
        if (!data.length) setCaregiverError('No caregiver is linked to this person yet.');
      })
      .catch(() => {
        if (active) setCaregiverError('Could not load caregivers. Check the connection and try again.');
      })
      .finally(() => {
        if (active) setLoadingCaregivers(false);
      });
    return () => { active = false; };
  }, [personId]);

  useEffect(() => () => {
    if (medicationImagePreview?.startsWith('blob:')) URL.revokeObjectURL(medicationImagePreview);
  }, [medicationImagePreview]);

  
  // Handle image capture for medication
  const handleMedicationImageCapture = async () => {
    try {
      const stream = await requestCam();
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
        const file = new File([await (await fetch(dataUrl)).blob()], 'medication_capture.png', { type: 'image/png' });
        
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
        const compressedUrl = URL.createObjectURL(compressedFile);
        setMedicationImagePreview(compressedUrl);
        
        // Clean up
      }
      
      // Stop the stream
      stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      console.error('Failed to capture image:', err);
      alert('Failed to capture image: ' + (err instanceof Error ? err.message : 'Unknown camera error'));
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
      const compressedUrl = URL.createObjectURL(compressedFile);
      setMedicationImagePreview(compressedUrl);
      
      // Keep the preview URL alive while the image is displayed and until
      // submission or component cleanup. Revoking it here breaks preview/upload.
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
    setMedicationUploading(true);
    
    try {
      // If we have an image preview, upload it first to get an evidence ID
      let evidenceId: string | null = null;
      if (medicationImagePreview) {
        // Convert data URL to file
        const response = await fetch(medicationImagePreview);
        const blob = await response.blob();
        const file = new File([blob], 'medication.png', { type: 'image/png' });
        
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
        
        const uploadResponse = await fetch(`${((import.meta.env || {}).VITE_API_BASE || '/api/v1').replace(/\/$/, '')}/upload`, {
          method: 'POST',
          body: formData,
        });
        
        if (!uploadResponse.ok) {
          throw new Error('Failed to upload image');
        }
        
        const uploadResult = await uploadResponse.json();
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
      
      // Validate required fields
      if (!medicationData.medication_name) {
        alert('Medication name is required');
        setMedicationUploading(false);
        return;
      }
      
      // Optimistically add to medications list
      setForm(prev => ({
        ...prev,
        medications: [...prev.medications, medicationData]
      }));
      
      // Reset medication form
      setMedicationForm({
        medication_name: '',
        status: 'given',
        dose: null,
        scheduled_for: null,
        administered_at: null,
        photo_evidence_id: null,
        note: null,
      });
      
      // Reset image preview
      setMedicationImagePreview(null);
      
      alert('Medication added successfully');
    } catch (err: any) {
      setMedicationUploading(false);
      setMedicationCompressing(false);
      alert(`Failed to add medication: ${err.message}`);
    } finally {
      setMedicationUploading(false);
    }
  };
  
  // Handle vitals form submission
  const handleVitalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const vitalData = {
        ...vitalForm,
        measured_at: new Date(vitalForm.measured_at).toISOString(),
      };
      
      // Validate required fields
      if (isNaN(vitalData.value) || vitalData.value === 0) {
        alert('Please enter a valid value');
        return;
      }
      
      // Optimistically add to vitals list
      setForm(prev => ({
        ...prev,
        vitals: [...prev.vitals, vitalData]
      }));
      
      // Reset vitals form
      setVitalForm({
        vital_type: 'bp_systolic',
        value: 0,
        measured_at: new Date().toISOString(),
        unit: null,
        note: null,
      });
      
      alert('Vital added successfully');
    } catch (err: any) {
      alert(`Failed to add vital: ${err.message}`);
    }
  };
  
  // Handle scale form submission
  const handleScaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const scaleData = {
        ...scaleForm,
        observed_at: new Date(scaleForm.observed_at).toISOString(),
      };
      
      // Optimistically add to scales list
      setForm(prev => ({
        ...prev,
        scales: [...prev.scales, scaleData]
      }));
      
      // Reset scale form
      setScaleForm({
        axis: 'mood',
        score: 3,
        observed_at: new Date().toISOString(),
        note: null,
      });
      
      alert('Scale added successfully');
    } catch (err: any) {
      alert(`Failed to add scale: ${err.message}`);
    }
  };
  
  // Handle form submission to backend with optimistic update.
  const { mutate: submitDailyLog, loading: submittingMutation } =
    useOptimisticMutation<unknown, DailyLogVariables>();

  const dailyLogMutationOptions = {
    mutationFn: (variables: DailyLogVariables) =>
      postJSON('/daily/log', {
        person_id: variables.personId,
        caregiver_id: variables.caregiverId,
        medications: variables.medications.map(med => ({
          ...med,
          scheduled_for: med.scheduled_for ? new Date(med.scheduled_for).toISOString() : null,
          administered_at: med.administered_at ? new Date(med.administered_at).toISOString() : null,
        })),
        vitals: variables.vitals.map(vital => ({
          ...vital,
          measured_at: new Date(vital.measured_at).toISOString(),
        })),
        scales: variables.scales.map(scale => ({
          ...scale,
          observed_at: new Date(scale.observed_at).toISOString(),
        })),
        notes: variables.notes,
      }),
    onMutate: async (_variables: DailyLogVariables) => ({
      prevForm: form,
      prevMedicationForm: medicationForm,
      prevVitalForm: vitalForm,
      prevScaleForm: scaleForm,
      prevMedicationImagePreview: medicationImagePreview,
    }),
    onSuccess: async (
      _data: unknown,
      _variables: DailyLogVariables,
      _context: unknown,
    ) => {
      setForm({ medications: [], vitals: [], scales: [], notes: '' });
      setMedicationForm({
        medication_name: '',
        status: 'given',
        dose: null,
        scheduled_for: null,
        administered_at: null,
        photo_evidence_id: null,
        note: null,
      });
      setVitalForm({
        vital_type: 'bp_systolic',
        value: 0,
        measured_at: new Date().toISOString(),
        unit: null,
        note: null,
      });
      setScaleForm({
        axis: 'mood',
        score: 3,
        observed_at: new Date().toISOString(),
        note: null,
      });
      setMedicationImagePreview(null);
      setSaveError(null);
      setSaved(true);
    },
    onError: async (
      error: unknown,
      _variables: DailyLogVariables,
      context: unknown,
    ) => {
      if (context && typeof context === 'object' && 'prevForm' in context) {
        const previous = context as {
          prevForm: typeof form;
          prevMedicationForm: MedicationFormState;
          prevVitalForm: VitalFormState;
          prevScaleForm: ScaleFormState;
          prevMedicationImagePreview: string | null;
        };
        setForm(previous.prevForm);
        setMedicationForm(previous.prevMedicationForm);
        setVitalForm(previous.prevVitalForm);
        setScaleForm(previous.prevScaleForm);
        setMedicationImagePreview(previous.prevMedicationImagePreview);
      }
      setSaveError(error);
      setSaved(false);
      alert(`Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
    onSettled: async () => {
      setSubmitting(false);
    },
    retry: true,
    maxRetries: 3,
  };

  // Handle form submission to backend.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loadingCaregivers || !caregiverId) {
      setSaveError(new Error('A valid caregiver must be linked to this person before saving.'));
      setSaved(false);
      return;
    }

    setSubmitting(true);
    setSaved(false);
    try {
      await submitDailyLog(dailyLogMutationOptions, {
        personId,
        caregiverId,
        medications: form.medications,
        vitals: form.vitals,
        scales: form.scales,
        notes: form.notes,
      });
    } catch {
      // The mutation's onError handler retains the draft and displays the error.
    }
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
            backgroundColor: 'var(--surface-soft)', 
            color: 'var(--text-secondary)' 
          }}>
            Recorded
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
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '4px' }}>Structured Daily Capture</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5', maxWidth: '500px' }}>
          Record medications, vitals, and scales in a structured format for accurate tracking and reporting.
        </p>
      </div>
      
      {caregiverError && (
        <div role="alert" style={{ color: 'var(--error)', marginBottom: '12px', fontSize: '13px' }}>
          {caregiverError}
        </div>
      )}

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
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Medication Name</label>
              <input
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
            
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Status</label>
                <select
                  value={medicationForm.status}
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
                  <option value="given">Given</option>
                  <option value="refused">Refused</option>
                  <option value="missed">Missed</option>
                </select>
              </div>
              
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Dose</label>
                <input
                  type="text"
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
                      type="file"
                      id="medication-image-input"
                      accept="image/*"
                      onChange={handleMedicationImageUpload}
                      className='medication-file-input'
                      disabled={submitting || medicationUploading}
                    />
                    <label htmlFor="medication-image-input" className='medication-file-label'>
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
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Vital Type</label>
              <select
                value={vitalForm.vital_type}
                onChange={(e) => setVitalForm(prev => ({ ...prev, vital_type: e.target.value }))}
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
                    {type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
            
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Value</label>
                <input
                  type="number"
                  value={vitalForm.value}
                  onChange={(e) => setVitalForm(prev => ({ ...prev, value: parseFloat(e.target.value) || 0 }))}
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
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Unit</label>
                <input
                  type="text"
                  value={vitalForm.unit || ''}
                  onChange={(e) => setVitalForm(prev => ({ ...prev, unit: e.target.value || null }))}
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
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Measured At</label>
                <input
                  type="datetime-local"
                  value={vitalForm.measured_at}
                  onChange={(e) => setVitalForm(prev => ({ ...prev, measured_at: e.target.value }))}
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
                  value={vitalForm.note || ''}
                  onChange={(e) => setVitalForm(prev => ({ ...prev, note: e.target.value || null }))}
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
              
              <div style={{ marginTop: '16px', textAlign: 'right' }}>
                <button
                  type="button"
                  onClick={handleVitalSubmit}
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
                  {submitting ? 'Adding...' : 'Add Vital'}
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
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Scale Type</label>
                <select
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
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Score (1-5)</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={scaleForm.score}
                  onChange={(e) => setScaleForm(prev => ({ ...prev, score: parseInt(e.target.value) || 3 }))}
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
            disabled={submittingMutation || loadingCaregivers || !caregiverId}
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
            {submittingMutation ? 'Saving...' : 'Save Daily Capture'}
          </button>
        </div>
      </div>
    );
}