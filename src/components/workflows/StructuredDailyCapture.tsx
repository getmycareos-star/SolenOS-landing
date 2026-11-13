import React, { useState, useEffect, useRef } from 'react';
import { postJSON, postFormData, getJSON, getPersonId, getCaregiverId } from '@/api/client';
import { useCameraPermission } from '@/lib/permissions/useCameraPermission';
import { compressImage, dataURLtoFile } from '@/lib/imageCompression';
import { useOptimisticMutation } from '@/lib/optimistic';
import CareDeltaPanel from '@/components/CareDeltaPanel';

const VITAL_TYPES = ['blood_pressure', 'heart_rate', 'oxygen_sat', 'temperature', 'weight', 'blood_glucose', 'other'];
const VITAL_LABELS: Record<string, string> = {
  blood_pressure: 'Blood pressure',
  bp_systolic: 'Blood pressure — systolic',
  bp_diastolic: 'Blood pressure — diastolic',
  heart_rate: 'Pulse',
  oxygen_sat: 'Oxygen level (SpO₂)',
  temperature: 'Temperature',
  weight: 'Weight',
  blood_glucose: 'Blood glucose',
  other: 'Other measurement',
};
const VITAL_UNITS: Record<string, string> = {
  blood_pressure: 'mmHg',
  bp_systolic: 'mmHg',
  bp_diastolic: 'mmHg',
  heart_rate: 'bpm',
  oxygen_sat: '%',
  temperature: '°C',
  weight: 'kg',
  blood_glucose: 'mg/dL',
  other: '',
};
function toLocalDateTimeInput(date = new Date()): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
const SCALE_AXES = ['mood', 'agitation', 'wellbeing_stress'];
const SCALE_LABELS: Record<string, string> = {
  mood: 'Mood',
  agitation: 'Agitation',
  wellbeing_stress: 'Stress and wellbeing',
};

type DailyCaptureMode = "all" | "something" | "medicine" | "measurement" | "note";

export default function StructuredDailyCapture({ mode = "all" }: { mode?: DailyCaptureMode }) {
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedEntrySummary, setSavedEntrySummary] = useState('');
  const [saveError, setSaveError] = useState<unknown | null>(null);
  const [qwenAnalysis, setQwenAnalysis] = useState<{
    status: string;
    processingStatus: string;
    jobId: string | null;
    candidates: any;
    analysisId: string | null;
    recordedAt: string | null;
  } | null>(null);
  const [changeIntelligenceStatus, setChangeIntelligenceStatus] = useState<string | null>(null);
  const [careContinuityExecution, setCareContinuityExecution] = useState<{
    stages?: Record<string, string>;
    workflow?: string;
  } | null>(null);
  const [reviewDrafts, setReviewDrafts] = useState<Record<number, { subject: string; observation: string }>>({});
  const [reviewingCandidate, setReviewingCandidate] = useState<number | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState<string | null>(null);
  const [deltaAutoInput, setDeltaAutoInput] = useState<{ personId: string; content: string; source: string; eventDate: string; token: number; evidenceIds?: string[]; sourceEventId?: string } | null>(null);
  const [deltaToken, setDeltaToken] = useState(0);
  const [vitalError, setVitalError] = useState<string | null>(null);
  const [vitalFeedback, setVitalFeedback] = useState<string | null>(null);
  const [scaleError, setScaleError] = useState<string | null>(null);
  const [scaleFeedback, setScaleFeedback] = useState<string | null>(null);
  const [medicationError, setMedicationError] = useState<string | null>(null);
  const [medicationFeedback, setMedicationFeedback] = useState<string | null>(null);
  
  const [eventOccurredAt, setEventOccurredAt] = useState("");

  // Daily Care writes are confirmed before extraction and longitudinal
  // reconciliation. Poll the durable job and then load the caregiver-scoped
  // persisted candidates; never keep the save request open for model work.
  useEffect(() => {
    const jobId = qwenAnalysis?.jobId;
    if (!jobId || !["queued", "processing"].includes(qwenAnalysis?.processingStatus || "")) {
      return;
    }
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    const poll = async () => {
      try {
        const job = await getJSON(`/assistant/jobs/${encodeURIComponent(jobId)}`) as {
          status?: string;
          daily_capture?: { analysis_id?: string | null };
        };
        if (!active) return;
        if (job.status === "completed") {
          const analysisId = job.daily_capture?.analysis_id || qwenAnalysis?.analysisId;
          if (!analysisId) {
            setQwenAnalysis(current => current?.jobId === jobId
              ? { ...current, status: "unavailable", processingStatus: "failed" }
              : current);
            setChangeIntelligenceStatus("unavailable");
            return;
          }
          const analysis = await getJSON(
            `/capture/analyses/${encodeURIComponent(analysisId)}`
          ) as {
            extraction_status?: string;
            candidates?: any;
            execution_status?: Record<string, string>;
          };
          if (!active) return;
          const execution = analysis.execution_status || {};
          setQwenAnalysis(current => current?.jobId === jobId
            ? {
                ...current,
                status: analysis.extraction_status || "unavailable",
                processingStatus: "completed",
                analysisId,
                candidates: analysis.candidates ?? null,
              }
            : current);
          setCareContinuityExecution({ stages: execution, workflow: "daily_care_entry" });
          setChangeIntelligenceStatus(
            execution.reconciliation === "completed"
              && execution.projection === "verified"
              && execution.longitudinal_retrieval === "verified"
              ? "available"
              : "unavailable"
          );
          setReviewDrafts({});
          window.dispatchEvent(new Event("careRecordUpdated"));
          return;
        }
        if (job.status === "failed" || job.status === "cancelled") {
          setQwenAnalysis(current => current?.jobId === jobId
            ? { ...current, status: "unavailable", processingStatus: job.status || "failed" }
            : current);
          setChangeIntelligenceStatus("unavailable");
          return;
        }
        attempts += 1;
        if (attempts >= 90) {
          setQwenAnalysis(current => current?.jobId === jobId
            ? { ...current, processingStatus: "unavailable" }
            : current);
          return;
        }
        const nextStatus = job.status === "processing" ? "processing" : "queued";
        setQwenAnalysis(current => current?.jobId === jobId && current.processingStatus !== nextStatus
          ? { ...current, processingStatus: nextStatus }
          : current);
        timer = setTimeout(() => { void poll(); }, 2000);
      } catch {
        attempts += 1;
        if (!active) return;
        if (attempts >= 90) {
          setQwenAnalysis(current => current?.jobId === jobId
            ? { ...current, processingStatus: "unavailable" }
            : current);
          return;
        }
        timer = setTimeout(() => { void poll(); }, 2000);
      }
    };
    void poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [qwenAnalysis?.jobId, qwenAnalysis?.processingStatus, qwenAnalysis?.analysisId]);

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
      measurement_name?: string | null;
    }>,
    scales: [] as Array<{
      axis: string;
      score: number;
      observed_at: string;
      note: string | null;
    }>,
    notes: '',
  });
  // Retain the request key across an uncertain network outcome. A changed
  // form snapshot receives a new key; an unchanged retry reuses the old one.
  const captureSubmissionRef = useRef<{ fingerprint: string; key: string } | null>(null);

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
    measurement_name: string | null;
  }>({
    vital_type: 'blood_pressure',
    value: Number.NaN,
    measured_at: toLocalDateTimeInput(),
    unit: VITAL_UNITS.blood_pressure,
    note: null,
    measurement_name: null,
  });
  
  const [diastolicValue, setDiastolicValue] = useState<number>(Number.NaN);
  const [optionalPulseValue, setOptionalPulseValue] = useState<number>(Number.NaN);

  // Scale form state
  const [scaleForm, setScaleForm] = useState<{
    axis: string;
    score: number;
    observed_at: string;
    note: string | null;
  }>({
    axis: 'mood',
    score: Number.NaN,
    observed_at: toLocalDateTimeInput(),
    note: null,
  });
  
  // Current medication choices come only from reviewed, in-window LCR assertions.
  // They are caregiver-reviewed reports, not independent clinical verification.
  const [currentMedicationRecords, setCurrentMedicationRecords] = useState<Array<{
    medication_id: string;
    name: string;
    dose: string | null;
    record_status: string;
  }>>([]);
  useEffect(() => {
    let active = true;
    const loadCurrentMedicationRecords = () => {
      void getJSON("/care-continuity/medications")
        .then((response: unknown) => {
          const payload = response as { medications?: unknown; pending_review?: unknown };
          const records = Array.isArray(payload?.medications) ? payload.medications : [];
          const pending = Array.isArray(payload?.pending_review) ? payload.pending_review : [];
          const valid = records.filter((item): item is { medication_id: string; name: string; dose: string | null; record_status: string } => {
            if (!item || typeof item !== "object") return false;
            const row = item as Record<string, unknown>;
            return typeof row.medication_id === "string" && typeof row.name === "string" && row.status === "active" && row.record_status === "caregiver_reviewed_current_report";
          });
          const pendingValid = pending.filter((item): item is { medication_id: string; name: string; dose: string | null; record_status: string; review_overdue?: boolean; source_text?: string | null } => {
            if (!item || typeof item !== "object") return false;
            const row = item as Record<string, unknown>;
            return typeof row.medication_id === "string" && typeof row.name === "string" && (row.record_status === "awaiting_caregiver_review" || row.record_status === "needs_caregiver_review");
          });
          if (active) { setCurrentMedicationRecords(valid); setPendingMedicationRecords(pendingValid); }
        })
        .catch(() => {
          // No current medication list is shown when the authoritative LCR read is unavailable.
        });
    };
    loadCurrentMedicationRecords();
    window.addEventListener("careRecordUpdated", loadCurrentMedicationRecords);
    return () => {
      active = false;
      window.removeEventListener("careRecordUpdated", loadCurrentMedicationRecords);
    };
  }, []);

  const [pendingMedicationRecords, setPendingMedicationRecords] = useState<Array<{ medication_id: string; name: string; dose: string | null; record_status: string; review_overdue?: boolean; source_text?: string | null }>>([]);
  const [medicationRecordName, setMedicationRecordName] = useState("");
  const [medicationRecordDose, setMedicationRecordDose] = useState("");
  const [medicationRecordNote, setMedicationRecordNote] = useState("");
  const [medicationRecordSaving, setMedicationRecordSaving] = useState(false);
  const [medicationRecordReviewing, setMedicationRecordReviewing] = useState<string | null>(null);
  const [medicationRecordMessage, setMedicationRecordMessage] = useState<string | null>(null);
  const [medicationRecordError, setMedicationRecordError] = useState<string | null>(null);
  // Historical reports remain available as a separate, explicitly non-current choice.
  const [previouslyRecordedMedications, setPreviouslyRecordedMedications] = useState<Array<{ name: string; dose: string | null }>>([]);
  useEffect(() => {
    let active = true;
    void getJSON("/daily-care/intelligence/history?limit=200&offset=0")
      .then((response: unknown) => {
        const records = (response as { records?: unknown })?.records;
        if (!Array.isArray(records)) return;
        const collected = new Map<string, { name: string; dose: string | null }>();
        for (const record of records) {
          const row = record as { source_type?: string; text?: string; description?: string };
          if (row.source_type !== "care_event") continue;
          const raw = row.text || row.description;
          if (!raw) continue;
          try {
            const parsed = JSON.parse(raw) as { original_capture?: Record<string, unknown>; medications?: unknown };
            const detail = parsed.original_capture || parsed;
            const medicines = detail.medications;
            if (!Array.isArray(medicines)) continue;
            for (const medicine of medicines) {
              const item = medicine as { medication_name?: unknown; dose?: unknown };
              if (typeof item.medication_name !== "string" || !item.medication_name.trim()) continue;
              const name = item.medication_name.trim();
              const key = name.toLocaleLowerCase();
              if (!collected.has(key)) {
                collected.set(key, {
                  name,
                  dose: typeof item.dose === "string" && item.dose.trim() ? item.dose.trim() : null,
                });
              }
            }
          } catch {
            // Unreadable historical entries remain in the history; they are not selectable medication records.
          }
        }
        if (active) setPreviouslyRecordedMedications([...collected.values()]);
      })
      .catch(() => {
        // The capture remains usable for a genuinely new medicine when history is unavailable.
      });
    return () => { active = false; };
  }, []);

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
    setMedicationError(null);
    setMedicationFeedback(null);
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
      setMedicationError("We couldn’t take that photo. Check camera permission or choose an image from your device.");
      stopCam();
      setMedicationCompressing(false);
    }
  };
  
  // Handle image upload for medication
  const handleMedicationImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setMedicationError(null);
    setMedicationFeedback(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMedicationError('Choose an image file to add a medicine photo.');
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
    setMedicationError(null);
    setMedicationFeedback(null);
    if (!personId || !caregiverId) {
      setMedicationError('Open your care record first, then try adding this medicine again.');
      return;
    }
    if (!medicationForm.medication_name.trim()) {
      setMedicationError('Enter the medicine name.');
      return;
    }
    if (!medicationForm.status) {
      setMedicationError('Choose what happened with this medicine before adding it.');
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
      
      setMedicationFeedback('Added to this daily-care draft. Save the daily care update below to keep it.');
    } catch {
      setMedicationUploading(false);
      setMedicationCompressing(false);
      setMedicationError("We couldn’t add this medicine. Check the details and try again.");
    } finally {
      setMedicationUploading(false);
    }
  };
  
  const handleCreateMedicationRecord = async (event: React.FormEvent) => {
    event.preventDefault();
    setMedicationRecordError(null);
    setMedicationRecordMessage(null);
    if (!personId || !caregiverId) { setMedicationRecordError("Open the care record before adding a medication."); return; }
    const name = medicationRecordName.trim();
    if (!name) { setMedicationRecordError("Enter the medicine name."); return; }
    setMedicationRecordSaving(true);
    try {
      const result = await postJSON("/care-continuity/medications", { name, dose: medicationRecordDose.trim() || undefined, note: medicationRecordNote.trim() || undefined, review_after_days: 30 }) as { medication_id?: string; record_status?: string };
      if (!result?.medication_id || result.record_status !== "awaiting_caregiver_review") throw new Error("The care record did not confirm that the medication report was saved for review.");
      setMedicationRecordName(""); setMedicationRecordDose(""); setMedicationRecordNote("");
      setMedicationRecordMessage("Added as a caregiver report. Review it below before it appears as a current medication.");
      window.dispatchEvent(new Event("careRecordUpdated"));
    } catch (error) { setMedicationRecordError(error instanceof Error ? error.message : "We couldn’t save this medication report. Try again."); }
    finally { setMedicationRecordSaving(false); }
  };

  const handleReviewMedicationRecord = async (medicationId: string) => {
    setMedicationRecordReviewing(medicationId); setMedicationRecordError(null); setMedicationRecordMessage(null);
    try {
      const path = "/care-continuity/medications/" + encodeURIComponent(medicationId) + "/review";
      const result = await postJSON(path, {}) as { record_status?: string };
      if (result?.record_status !== "caregiver_reviewed_current_report") throw new Error("The care record did not confirm the medication review.");
      setMedicationRecordMessage("Reviewed. This caregiver-reported medication is now available as a current choice.");
      window.dispatchEvent(new Event("careRecordUpdated"));
    } catch (error) { setMedicationRecordError(error instanceof Error ? error.message : "We couldn’t save the medication review. Try again."); }
    finally { setMedicationRecordReviewing(null); }
  };
  // Add a vital to the current daily-capture draft. It is persisted when the
  // caregiver saves the complete daily capture below.
  const handleVitalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setVitalError(null);
    setVitalFeedback(null);

    const measuredAt = new Date(vitalForm.measured_at);
    if (Number.isNaN(measuredAt.getTime())) {
      setVitalError('Choose when this measurement was taken.');
      return;
    }

    const common = {
      measured_at: measuredAt.toISOString(),
      note: vitalForm.note,
    };
    const unit = vitalForm.unit?.trim() || VITAL_UNITS[vitalForm.vital_type] || null;
    let additions: Array<{ vital_type: string; value: number; measured_at: string; unit: string | null; note: string | null; measurement_name?: string | null }> = [];

    if (vitalForm.vital_type === 'blood_pressure') {
      if (!Number.isFinite(vitalForm.value) || vitalForm.value <= 0 ||
          !Number.isFinite(diastolicValue) || diastolicValue <= 0) {
        setVitalError('Enter both the top and bottom blood pressure numbers.');
        return;
      }
      additions = [
        { vital_type: 'bp_systolic', value: vitalForm.value, unit: 'mmHg', ...common },
        { vital_type: 'bp_diastolic', value: diastolicValue, unit: 'mmHg', ...common },
      ];
      if (Number.isFinite(optionalPulseValue) && optionalPulseValue > 0) {
        additions.push({ vital_type: 'heart_rate', value: optionalPulseValue, unit: 'bpm', ...common });
      }
    } else {
      if (!Number.isFinite(vitalForm.value) || vitalForm.value <= 0) {
        setVitalError('Enter a value greater than zero.');
        return;
      }
      if (vitalForm.vital_type === 'other' && !vitalForm.measurement_name?.trim()) {
        setVitalError('Name the measurement you recorded.');
        return;
      }
      additions = [{
        vital_type: vitalForm.vital_type,
        value: vitalForm.value,
        unit,
        ...common,
        ...(vitalForm.vital_type === 'other' ? { measurement_name: vitalForm.measurement_name?.trim() || null } : {}),
      }];
    }

    setForm(prev => ({ ...prev, vitals: [...prev.vitals, ...additions] }));
    setVitalForm({
      vital_type: 'blood_pressure',
      value: Number.NaN,
      measured_at: toLocalDateTimeInput(),
      unit: VITAL_UNITS.blood_pressure,
      note: null,
      measurement_name: null,
    });
    setDiastolicValue(Number.NaN);
    setOptionalPulseValue(Number.NaN);
    setVitalFeedback('Added to this draft. Save the measurement to keep it in the care record.');
  };

  // Add a daily rating to the draft; it is saved with the complete daily-care update.
  const handleScaleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setScaleError(null);
    setScaleFeedback(null);
    const observedAt = new Date(scaleForm.observed_at);
    if (!Number.isInteger(scaleForm.score) || scaleForm.score < 1 || scaleForm.score > 5) {
      setScaleError('Choose a rating from 1 to 5 before adding it.');
      return;
    }
    if (Number.isNaN(observedAt.getTime())) {
      setScaleError('Choose when this was observed.');
      return;
    }
    const scaleData = { ...scaleForm, observed_at: observedAt.toISOString() };
    setForm(prev => ({ ...prev, scales: [...prev.scales, scaleData] }));
    setScaleForm({
      axis: 'mood',
      score: Number.NaN,
      observed_at: toLocalDateTimeInput(),
      note: null,
    });
    setScaleFeedback('Added to this daily-care draft. Save the daily care update below to keep it.');
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
      subject: candidate.corrected_subject ?? candidate.subject ?? '',
      observation: candidate.corrected_observation ?? candidate.observation ?? '',
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
        assertion_id?: string | null;
        care_continuity_execution?: { stages?: Record<string, string>; workflow?: string } | null;
      };
      if (result.care_continuity_execution) {
        setCareContinuityExecution(result.care_continuity_execution);
      }
      if (!result?.candidate || result.written_to_lcr !== (decision === 'accept')) {
        throw new Error('The backend did not confirm the requested review outcome. Your saved observation remains unchanged.');
      }
      setQwenAnalysis(current => {
        if (!current || !Array.isArray(current.candidates?.observations)) return current;
        const observations = [...current.candidates.observations];
        observations[index] = result.candidate;
        return { ...current, candidates: { ...current.candidates, observations } };
      });
      if (decision === 'accept' && result.assertion_id) {
        window.dispatchEvent(new Event('careRecordUpdated'));
        try {
          const projection = await getJSON('/care-continuity/current-care?limit_per_source=50') as { items?: Array<{ id?: string }> };
          const visibleInLcr = Array.isArray(projection?.items) &&
            projection.items.some(item => item.id === result.assertion_id);
          setReviewFeedback(visibleInLcr
            ? 'Accepted observation is now available in the Living Care Record.'
            : 'Acceptance was saved. The LCR projection did not return the assertion yet; refresh the Living Care Record before relying on its display.');
        } catch {
          setReviewFeedback('Acceptance was saved. The LCR could not be refreshed just now; reopen the Living Care Record to verify the accepted entry.');
        }
      } else {
        setReviewFeedback(result.message || (
          decision === 'correct'
            ? 'Correction saved. It remains pending approval and is not an LCR fact.'
            : 'Suggestion rejected. No LCR assertion was created.'
        ));
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
      captureKind: DailyCaptureMode;
      occurredAt: string | null;
      captureIdempotencyKey: string;
    }
  >({
    mutationFn: ({ personId, caregiverId, medications, vitals, scales, notes, captureKind, occurredAt, captureIdempotencyKey }) =>
      postJSON('/daily/log', {
        person_id: personId,
        caregiver_id: caregiverId,
        capture_idempotency_key: captureIdempotencyKey,
        capture_kind: captureKind,
        ...(occurredAt ? { occurred_at: new Date(occurredAt).toISOString() } : {}),
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
      captureSubmissionRef.current = null;
      setChangeIntelligenceStatus(
        data?.change_intelligence_status === 'available'
          || data?.change_intelligence_status === 'unavailable'
          || data?.change_intelligence_status === 'pending'
          ? data.change_intelligence_status
          : 'not_reported',
      );
      setCareContinuityExecution(
        data?.care_continuity_execution && typeof data.care_continuity_execution === 'object'
          ? data.care_continuity_execution
          : null,
      );
      setQwenAnalysis({
        status: typeof data?.qwen_extraction_status === 'string' ? data.qwen_extraction_status : 'not_reported',
        processingStatus: typeof data?.qwen_processing_status === 'string'
          ? data.qwen_processing_status
          : data?.qwen_job_id ? 'queued' : 'completed',
        jobId: typeof data?.qwen_job_id === 'string' ? data.qwen_job_id : null,
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
      setEventOccurredAt("");
      
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
        vital_type: 'blood_pressure',
        value: Number.NaN,
        measured_at: toLocalDateTimeInput(),
        unit: VITAL_UNITS.blood_pressure,
        note: null,
        measurement_name: null,
      });
      setDiastolicValue(Number.NaN);
      setOptionalPulseValue(Number.NaN);
      
      // Reset scale form
      setScaleForm({
        axis: 'mood',
        score: Number.NaN,
        observed_at: toLocalDateTimeInput(),
        note: null,
      });
      
      // Reset image preview
      setMedicationImagePreview(null);
      
      setSaveError(null);
      setSavedEntrySummary(variables.notes.trim() || 'Entry recorded.');
      setSaved(true);
      // Refresh the shared LCR projection only after the backend confirms persistence.
      window.dispatchEvent(new Event('careRecordUpdated'));
      // Once Daily Capture is persisted, reconcile the saved observations against the longitudinal LCR.
      // Reconciliation failure is shown by the Delta panel and never rolls back a successfully saved capture.
      // The durable Daily Care worker now owns extraction and Delta/LCR
      // reconciliation for queued captures. Do not launch a second client-side
      // reconciliation for the same event.
      if (!data?.qwen_job_id) {
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
      }
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
      const error = new Error('A secure care session is required to save this entry.');
      setSaveError(error);
      return;
    }
    if ((mode === "something" || mode === "note") && !form.notes.trim()) {
      setSaveError(new Error(mode === "something" ? "Tell us what happened before saving." : "Add a note before saving."));
      return;
    }
    if (mode === "medicine" && form.medications.length === 0) {
      setSaveError(new Error("Add a medicine event before saving."));
      return;
    }
    if (mode === "measurement" && form.vitals.length === 0) {
      setSaveError(new Error("Add a measurement before saving."));
      return;
    }

    const submission = {
      personId,
      caregiverId,
      medications: form.medications,
      vitals: form.vitals,
      scales: form.scales,
      notes: form.notes,
      captureKind: mode,
      occurredAt: eventOccurredAt || (
        mode === "medicine" && form.medications.length === 1
          ? (form.medications[0].status === "given"
            ? form.medications[0].administered_at
            : eventOccurredAt || null)
          : mode === "measurement" && form.vitals.length > 0
            ? form.vitals[0].measured_at
            : null
      ),
    };
    const fingerprint = JSON.stringify(submission);
    if (!captureSubmissionRef.current || captureSubmissionRef.current.fingerprint !== fingerprint) {
      captureSubmissionRef.current = {
        fingerprint,
        key: crypto.randomUUID(),
      };
    }
    await submitDailyLog({
      ...submission,
      captureIdempotencyKey: captureSubmissionRef.current.key,
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
                         ['not_given', 'refused', 'missed', 'uncertain'].includes(med.status) ? 'var(--warning-soft)' : 'var(--bg)',
            color: med.status === 'given' ? 'var(--success)' :
                   ['not_given', 'refused', 'missed', 'uncertain'].includes(med.status) ? 'var(--warning)' : 'var(--text-secondary)' 
          }}>
            {({
              given: "Given",
              not_given: "Not given",
              uncertain: "Not sure",
              other: "Something else",
              refused: "Refused",
              missed: "Missed",
            } as Record<string, string>)[med.status] || med.status.replace(/_/g, " ")}
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
            {vital.measurement_name || VITAL_LABELS[vital.vital_type] || vital.vital_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </h4>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Recorded reading</span>
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
        <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '4px' }}>
          {mode === "medicine" ? "Medicine" : mode === "measurement" ? "Measurement" : mode === "something" ? "Something happened" : mode === "note" ? "Note" : "Daily care update"}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5', maxWidth: '500px' }}>
          {mode === "medicine" ? "Record what happened with a medicine." : mode === "measurement" ? "Record a measurement that was actually taken." : mode === "something" ? "Tell us what happened in your own words. You do not need to organize it." : mode === "note" ? "Add a note in your own words. You can leave other details unknown." : "Add only the care information you want to record."}
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
            Saved. {savedEntrySummary || 'Entry recorded.'}
          </span>
        </div>
      )}
      
      {saved && careContinuityExecution?.stages && (
        <p role="status" style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '-12px', marginBottom: '20px' }}>
          Source saved: {careContinuityExecution.stages.source_preservation === 'verified' ? 'confirmed' : 'not confirmed'}.
          {' '}Evidence: {careContinuityExecution.stages.evidence === 'verified' ? 'linked and confirmed' : careContinuityExecution.stages.evidence === 'not_applicable' ? 'not required' : 'not confirmed'}.
          {' '}Care-record reconciliation: {['committed', 'completed'].includes(careContinuityExecution.stages.reconciliation || '') ? 'saved' : 'not confirmed'}.
        </p>
      )}
      {saved && changeIntelligenceStatus === 'available' && (
        <p role="status" style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '-12px', marginBottom: '20px' }}>
          Change and pattern assessments were recalculated from the saved care record.
        </p>
      )}
      {saved && changeIntelligenceStatus === 'unavailable' && (
        <p role="alert" style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '-12px', marginBottom: '20px' }}>
          Your care entry was saved, but change and pattern assessments could not be refreshed. Do not submit the entry again; reopen change intelligence and retry reassessment.
        </p>
      )}
      {saved && changeIntelligenceStatus === 'pending' && (
        <p role="status" style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '-12px', marginBottom: '20px' }}>
          Your care entry is saved. SolenOS is checking it against the rest of the care record in the background.
        </p>
      )}
      {saved && changeIntelligenceStatus === 'not_reported' && (
        <p role="status" style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '-12px', marginBottom: '20px' }}>
          The server did not report whether change and pattern assessments were refreshed.
        </p>
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
                  subject: candidate.corrected_subject ?? candidate.subject ?? '',
                  observation: candidate.corrected_observation ?? candidate.observation ?? '',
                };
                const reviewStatus = String(candidate.review_status || 'pending_review');
                const alreadyReviewed = ['accepted_by_caregiver', 'rejected_by_caregiver'].includes(reviewStatus);
                return (
                  <li key={index} style={{ fontSize: '12px', marginBottom: '12px', padding: '12px 0', borderTop: '1px solid var(--border)' }}>
                    <strong>Suggested detail {index + 1}</strong>
                    <p style={{ color: 'var(--text-secondary)', margin: '4px 0 8px' }}>
                      {reviewStatus === 'pending_review' ? 'Awaiting caregiver review' : reviewStatus === 'corrected_pending_approval' || reviewStatus === 'corrected_by_caregiver' ? 'Corrected — awaiting explicit approval' : reviewStatus === 'accepted_by_caregiver' ? 'Accepted — added to the Living Care Record' : reviewStatus === 'rejected_by_caregiver' ? 'Rejected — not included in the Living Care Record' : 'Review status unavailable'}
                    </p>
                    <div style={{ marginBottom: '8px', color: 'var(--text-secondary)' }}>
                      <div><strong>Original suggestion:</strong> {candidate.subject ? `${candidate.subject}: ` : ''}{candidate.observation || 'No generated observation text.'}</div>
                      {candidate.corrected_observation !== undefined && (
                        <div style={{ marginTop: '4px' }}>
                          <strong>Caregiver correction:</strong> {candidate.corrected_subject ? `${candidate.corrected_subject}: ` : ''}{candidate.corrected_observation}
                        </div>
                      )}
                    </div>
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
                    {candidate.source_quote && (
                      <div style={{ color: 'var(--text-secondary)', marginBottom: '8px', overflowWrap: 'anywhere' }}>
                        From your note: {candidate.source_quote}
                      </div>
                    )}
                    {!alreadyReviewed && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        <button type="button" className="workspace-primary" style={{ minHeight: 44, padding: '9px 12px', borderRadius: 8 }} disabled={reviewingCandidate !== null || !qwenAnalysis.analysisId} onClick={() => void reviewCaptureCandidate(index, 'accept')}>Accept and add to LCR</button>
                        <button type="button" className="workspace-primary" style={{ minHeight: 44, padding: '9px 12px', borderRadius: 8 }} disabled={reviewingCandidate !== null || !qwenAnalysis.analysisId} onClick={() => void reviewCaptureCandidate(index, 'correct')}>Save correction</button>
                        <button type="button" className="workspace-primary" style={{ minHeight: 44, padding: '9px 12px', borderRadius: 8 }} disabled={reviewingCandidate !== null || !qwenAnalysis.analysisId} onClick={() => void reviewCaptureCandidate(index, 'reject')}>Dismiss suggestion</button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {['queued', 'processing'].includes(qwenAnalysis.processingStatus)
                ? 'Your entry is saved. SolenOS is organizing the details in the background.'
                : qwenAnalysis.processingStatus === 'unavailable'
                  ? 'Your original entry is saved, but SolenOS could not finish organizing its details. You can still use the saved report.'
                  : qwenAnalysis.status === 'pending_review'
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
      {(mode === "all" || mode === "medicine") && (
      <section>
        <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>Medicines</h2>
        
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 600 }}>Add a medication to the care record</h3>
          <p style={{ margin: "0 0 12px", color: "var(--text-secondary)", fontSize: 12, lineHeight: 1.45 }}>
            Add what you have been told or what you currently understand. This starts as a caregiver report, not a verified prescription.
          </p>
          <form onSubmit={handleCreateMedicationRecord} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
              Medicine name
              <input value={medicationRecordName} onChange={(event) => setMedicationRecordName(event.target.value)} maxLength={240} required placeholder="Enter medicine name" style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
              Dose or strength (optional)
              <input value={medicationRecordDose} onChange={(event) => setMedicationRecordDose(event.target.value)} maxLength={240} placeholder="Only if known" style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
              Note (optional)
              <textarea value={medicationRecordNote} onChange={(event) => setMedicationRecordNote(event.target.value)} maxLength={2000} rows={2} placeholder="Where this information came from, if useful" style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }} />
            </label>
            <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 12 }}>This report will be marked as due for review after 30 days. You can review it now before it becomes a current medication choice.</p>
            {medicationRecordError && <p role="alert" style={{ margin: 0, color: "var(--error)" }}>{medicationRecordError}</p>}
            {medicationRecordMessage && <p role="status" style={{ margin: 0, color: "var(--text-secondary)" }}>{medicationRecordMessage}</p>}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" className="workspace-primary" disabled={medicationRecordSaving || !medicationRecordName.trim()} style={{ minHeight: 42, padding: "9px 14px", borderRadius: 8 }}>{medicationRecordSaving ? "Saving…" : "Add to care record"}</button>
            </div>
          </form>
          {pendingMedicationRecords.length > 0 && (
            <div style={{ borderTop: "1px solid var(--border)", marginTop: 14, paddingTop: 12 }}>
              <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>Reports waiting for your review</h4>
              {pendingMedicationRecords.map((item) => (
                <div key={item.medication_id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 0", borderTop: "1px solid var(--border)" }}>
                  <div style={{ minWidth: 0 }}><strong style={{ fontSize: 13 }}>{item.name}</strong>{item.dose && <span style={{ color: "var(--text-secondary)", fontSize: 12 }}> · {item.dose}</span>}<p style={{ margin: "2px 0 0", color: "var(--text-secondary)", fontSize: 11 }}>{item.review_overdue ? "Review overdue · caregiver report" : item.record_status === "needs_caregiver_review" ? "Previously reviewed · needs a fresh review" : "Caregiver report · not yet reviewed"}</p>{item.source_text && <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: 11, lineHeight: 1.4 }}>Recorded details: {item.source_text}</p>}</div>
                  <button type="button" className="workspace-primary" disabled={medicationRecordReviewing !== null} onClick={() => void handleReviewMedicationRecord(item.medication_id)} style={{ minHeight: 40, padding: "8px 12px", borderRadius: 8 }}>{medicationRecordReviewing === item.medication_id ? "Saving…" : "Review and confirm current"}</button>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Medication form */}
        <div style={{ 
          background: 'var(--surface)', 
          border: '1px solid var(--border)', 
          borderRadius: '8px', 
          padding: '16px', 
          marginBottom: '24px' 
        }}>
          <h3 style={{ marginTop: '0', marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>Add a medicine</h3>
          
          <form onSubmit={handleMedicationSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {medicationError && <p role="alert" style={{ margin: 0, padding: '10px 12px', borderRadius: 8, background: 'var(--theme-warning-bg)', border: '1px solid var(--theme-warning-border)', color: 'var(--theme-warning-fg)' }}>{medicationError}</p>}
            {medicationFeedback && <p role="status" style={{ margin: 0, padding: '10px 12px', borderRadius: 8, background: 'var(--theme-success-bg)', border: '1px solid var(--theme-success-border)', color: 'var(--theme-panel-fg)' }}>{medicationFeedback}</p>}
            {currentMedicationRecords.length > 0 && (
              <div>
                <label htmlFor="capture-current-medication" style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>
                  Choose a current medication from the care record
                </label>
                <select
                  id="capture-current-medication"
                  value=""
                  onChange={(event) => {
                    const selected = currentMedicationRecords.find((item) => item.medication_id === event.target.value);
                    if (selected) {
                      setMedicationError(null);
                      setMedicationFeedback(null);
                      setMedicationForm((current) => ({
                        ...current,
                        medication_name: selected.name,
                        dose: selected.dose ?? current.dose,
                      }));
                    }
                  }}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg)', fontSize: '14px' }}
                >
                  <option value="">Choose current medication</option>
                  {currentMedicationRecords.map((item) => (
                    <option key={item.medication_id} value={item.medication_id}>
                      {item.name}{item.dose ? ` · ${item.dose}` : ""}
                    </option>
                  ))}
                </select>
                <p style={{ margin: "5px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
                  These are caregiver-reviewed care-record entries within their review window, not independent clinical verification.
                </p>
              </div>
            )}
            {previouslyRecordedMedications.length > 0 && (
              <div>
                <label htmlFor="capture-previous-medication" style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>
                  Previously reported medicines (not confirmed current)
                </label>
                <select
                  id="capture-previous-medication"
                  value=""
                  onChange={(event) => {
                    const selected = previouslyRecordedMedications.find((item) => item.name === event.target.value);
                    if (selected) {
                      setMedicationError(null);
                      setMedicationFeedback(null);
                      setMedicationForm((current) => ({
                        ...current,
                        medication_name: selected.name,
                        dose: selected.dose ?? current.dose,
                      }));
                    }
                  }}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg)', fontSize: '14px' }}
                >
                  <option value="">Choose from care history</option>
                  {previouslyRecordedMedications.map((item) => (
                    <option key={item.name.toLocaleLowerCase()} value={item.name}>
                      {item.name}{item.dose ? ` · ${item.dose}` : ""}
                    </option>
                  ))}
                </select>
                <p style={{ margin: "5px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
                  These appeared in past caregiver reports. Their current status is unknown; selecting one does not make it active.
                </p>
              </div>
            )}
            <div>
              <label htmlFor="capture-medication-name" style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Medicine name</label>
              <input
                id="capture-medication-name"
                type="text"
                value={medicationForm.medication_name}
                onChange={(e) => { setMedicationError(null); setMedicationFeedback(null); setMedicationForm(prev => ({ ...prev, medication_name: e.target.value })); }}
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
                <label htmlFor="capture-medication-status" style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>What happened?</label>
                <select
                  id="capture-medication-status"
                  value={medicationForm.status}
                  required
                  onChange={(e) => {
                    setMedicationError(null);
                    setMedicationFeedback(null);
                    setMedicationForm(prev => ({
                      ...prev,
                      status: e.target.value,
                      administered_at: e.target.value === "given" ? prev.administered_at : null,
                    }));
                    if (e.target.value === "given") setEventOccurredAt("");
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
                  <option value="">Choose what happened</option>
                  <option value="given">Given</option>
                  <option value="not_given">Not given</option>
                  <option value="uncertain">Not sure</option>
                  <option value="scheduled">Scheduled (not confirmed as given)</option>
                  <option value="other">Something else</option>
                </select>
                {medicationForm.status === "scheduled" && (
                  <p style={{ margin: "6px 0 0", color: "var(--text-secondary)", fontSize: 12, lineHeight: 1.45 }}>
                    This records an expected dose only. It does not confirm that the medicine was given.
                  </p>
                )}
              </div>
              
              <div style={{ flex: 1 }}>
                <label htmlFor="medication-dose" style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Dose</label>
                <input
                  type="text"
                  id="medication-dose"
                  value={medicationForm.dose || ''}
                  onChange={(e) => { setMedicationError(null); setMedicationFeedback(null); setMedicationForm(prev => ({ ...prev, dose: e.target.value || null })); }}
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
                  onChange={(e) => { setMedicationError(null); setMedicationFeedback(null); setMedicationForm(prev => ({ ...prev, scheduled_for: e.target.value || null })); }}
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
              
              {medicationForm.status === "given" && (
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Administered at</label>
                  <input
                    type="datetime-local"
                    value={medicationForm.administered_at || ''}
                    onChange={(e) => { setMedicationError(null); setMedicationFeedback(null); setMedicationForm(prev => ({ ...prev, administered_at: e.target.value || null })); }}
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
              )}
              {medicationForm.status !== "given" && medicationForm.status !== "" && (
                <div style={{ flex: 1 }}>
                  <label htmlFor="medication-event-time" style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>When did this happen? (optional)</label>
                  <input
                    id="medication-event-time"
                    type="datetime-local"
                    value={eventOccurredAt}
                    onChange={(e) => setEventOccurredAt(e.target.value)}
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
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Note</label>
              <textarea
                value={medicationForm.note || ''}
                onChange={(e) => { setMedicationError(null); setMedicationFeedback(null); setMedicationForm(prev => ({ ...prev, note: e.target.value || null })); }}
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
              <h4 style={{ marginTop: '0', marginBottom: '12px', fontSize: '16px', fontWeight: '600' }}>Medicine photo (optional)</h4>
              
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
                        color: 'var(--theme-action-fg)', 
                        background: medicationUploading || !medicationForm.medication_name.trim() 
                                   ? 'var(--theme-action-disabled-bg)' 
                                   : 'var(--theme-action-bg)', 
                        padding: '8px 16px', 
                        borderRadius: '6px', 
                        cursor: medicationUploading || !medicationForm.medication_name.trim() 
                               ? 'default' 
                               : 'pointer' 
                      }}
                    >
                      {medicationUploading ? 'Adding…' : 'Add medicine with photo'}
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
                        background: cameraState.status === 'unknown' ? 'var(--theme-action-bg)' : 'var(--theme-action-disabled-bg)', 
                        color: 'var(--theme-action-fg)', 
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
                        color: 'var(--theme-action-fg)', 
                        background: medicationUploading || !medicationForm.medication_name.trim() 
                                   ? 'var(--theme-action-disabled-bg)' 
                                   : 'var(--theme-action-bg)', 
                        padding: '8px 16px', 
                        borderRadius: '6px', 
                        cursor: medicationUploading || !medicationForm.medication_name.trim() 
                               ? 'default' 
                               : 'pointer' 
                      }}
                    >
                      {medicationUploading ? 'Adding…' : 'Add medicine'}
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
            <h3 style={{ marginBottom: '12px', fontSize: '18px', fontWeight: '600' }}>Medicines in this draft</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {renderMedications()}
            </div>
          </div>
        )}
      </section>
      )}
      
      {/* Vitals section */}
      {(mode === "all" || mode === "measurement") && (
      <section>
        <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>Measurements</h2>
        
        {/* Vitals form */}
        <div style={{ 
          background: 'var(--surface)', 
          border: '1px solid var(--border)', 
          borderRadius: '8px', 
          padding: '16px', 
          marginBottom: '24px' 
        }}>
          <h3 style={{ marginTop: '0', marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>Add a measurement</h3>
          
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
                    unit: VITAL_UNITS[nextType] ?? "",
                    measurement_name: nextType === 'other' ? prev.measurement_name : null,
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
            
            {vitalForm.vital_type === 'other' && (
              <div>
                <label htmlFor="capture-vital-other-name" style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>What did you measure?</label>
                <input
                  id="capture-vital-other-name"
                  type="text"
                  value={vitalForm.measurement_name || ''}
                  onChange={(e) => setVitalForm(prev => ({ ...prev, measurement_name: e.target.value }))}
                  maxLength={100}
                  placeholder="Measurement name"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 14 }}
                />
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <label htmlFor="capture-vital-value" style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>
                  {vitalForm.vital_type === 'blood_pressure' ? 'Top number (systolic)' : 'Value'}
                </label>
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
              
              {vitalForm.vital_type === 'blood_pressure' && (
                <div style={{ flex: 1 }}>
                  <label htmlFor="capture-vital-diastolic" style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Bottom number (diastolic)</label>
                  <input
                    id="capture-vital-diastolic"
                    type="number"
                    min="0.01"
                    step="any"
                    value={Number.isFinite(diastolicValue) ? diastolicValue : ''}
                    onChange={(e) => setDiastolicValue(e.target.value === '' ? Number.NaN : Number(e.target.value))}
                    placeholder="Enter bottom number"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 14 }}
                  />
                </div>
              )}
              {vitalForm.vital_type === 'blood_pressure' && (
                <div style={{ flex: 1 }}>
                  <label htmlFor="capture-vital-pulse" style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Pulse (optional)</label>
                  <input
                    id="capture-vital-pulse"
                    type="number"
                    min="0.01"
                    step="any"
                    value={Number.isFinite(optionalPulseValue) ? optionalPulseValue : ''}
                    onChange={(e) => setOptionalPulseValue(e.target.value === '' ? Number.NaN : Number(e.target.value))}
                    placeholder="Pulse in bpm"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 14 }}
                  />
                </div>
              )}
              <div style={{ flex: 1 }}>
                <label htmlFor="vital-unit" style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Unit</label>
                <input
                  type="text"
                  id="vital-unit"
                  value={vitalForm.vital_type === 'blood_pressure' ? 'mmHg' : (vitalForm.unit ?? '')}
                  disabled={vitalForm.vital_type === 'blood_pressure'}
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
              
              {vitalError && <p role="alert" style={{ margin: 0, padding: '10px 12px', borderRadius: 8, background: 'var(--theme-warning-bg)', border: '1px solid var(--theme-warning-border)', color: 'var(--theme-warning-fg)' }}>{vitalError}</p>}
              {vitalFeedback && <p role="status" style={{ margin: 0, padding: '10px 12px', borderRadius: 8, background: 'var(--theme-success-bg)', border: '1px solid var(--theme-success-border)', color: 'var(--theme-panel-fg)' }}>{vitalFeedback}</p>}
              <div style={{ marginTop: '16px', textAlign: 'right' }}>
                <button
                  type="submit"
                  className="workspace-primary"
                  disabled={submitting}
                  style={{ fontSize: '14px', fontWeight: 700, padding: '10px 16px', borderRadius: '8px', cursor: submitting ? 'not-allowed' : 'pointer' }}
                >
                  {submitting ? 'Adding…' : 'Add measurement'}
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
      )}
        
        {/* Scales section */}
        {mode === "all" && (
        <section>
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>Daily ratings</h2>
          
          {/* Scales form */}
          <div style={{ 
            background: 'var(--surface)', 
            border: '1px solid var(--border)', 
            borderRadius: '8px', 
            padding: '16px', 
            marginBottom: '24px' 
          }}>
            <h3 style={{ marginTop: '0', marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>Add a daily rating</h3>
            
            <form onSubmit={handleScaleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label htmlFor="capture-scale-type" style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Rating type</label>
                <select
                  id="capture-scale-type"
                  value={scaleForm.axis}
                  onChange={(e) => { setScaleError(null); setScaleFeedback(null); setScaleForm(prev => ({ ...prev, axis: e.target.value })); }}
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
                      {SCALE_LABELS[axis] ?? axis.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="capture-scale-score" style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Rating (1–5)</label>
                <input
                  id="capture-scale-score"
                  type="number"
                  min={1}
                  max={5}
                  value={Number.isFinite(scaleForm.score) ? scaleForm.score : ''}
                  required
                  onChange={(e) => { setScaleError(null); setScaleFeedback(null); setScaleForm(prev => ({ ...prev, score: e.target.value === '' ? Number.NaN : Number.parseInt(e.target.value, 10) })); }}
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
                <label htmlFor="capture-scale-observed-at" style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Observed at</label>
                <input
                  id="capture-scale-observed-at"
                  type="datetime-local"
                  value={scaleForm.observed_at}
                  onChange={(e) => { setScaleError(null); setScaleFeedback(null); setScaleForm(prev => ({ ...prev, observed_at: e.target.value })); }}
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
                <label htmlFor="capture-scale-note" style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Note (optional)</label>
                <textarea
                  id="capture-scale-note"
                  value={scaleForm.note || ''}
                  onChange={(e) => { setScaleError(null); setScaleFeedback(null); setScaleForm(prev => ({ ...prev, note: e.target.value || null })); }}
                  placeholder="Add any notes about this rating"
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
              
              {scaleError && <p role="alert" style={{ margin: 0, padding: '10px 12px', borderRadius: 8, background: 'var(--theme-warning-bg)', border: '1px solid var(--theme-warning-border)', color: 'var(--theme-warning-fg)' }}>{scaleError}</p>}
              {scaleFeedback && <p role="status" style={{ margin: 0, padding: '10px 12px', borderRadius: 8, background: 'var(--theme-success-bg)', border: '1px solid var(--theme-success-border)', color: 'var(--theme-panel-fg)' }}>{scaleFeedback}</p>}
              <div style={{ marginTop: '16px', textAlign: 'right' }}>
                <button
                  type="submit"
                  className="workspace-primary"
                  disabled={submitting}
                  style={{ fontSize: '14px', fontWeight: 700, padding: '10px 16px', borderRadius: '8px', cursor: submitting ? 'not-allowed' : 'pointer' }}
                >
                  {submitting ? 'Adding…' : 'Add rating'}
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
        )}
        
        {/* Keep free-text capture first: no category or clinical assessment is required. */}
        {(mode === "all" || mode === "something" || mode === "note") && (
        <section>
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>
            {mode === "something" ? "What happened?" : mode === "note" ? "Note" : "Notes"}
          </h2>
          
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <label htmlFor="daily-capture-original-words" style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
              {mode === "something" ? "Tell us what happened" : mode === "note" ? "Your note" : "Additional notes"}
            </label>
            <textarea
              id="daily-capture-original-words"
              value={form.notes}
              onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder={mode === "something"
                ? "Share what you noticed in your own words. A few words are enough."
                : mode === "note" ? "Write your note in your own words." : "Add any additional notes, if useful."}
              rows={4}
              maxLength={4000}
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
            {(mode === "something" || mode === "note") && (
              <div style={{ marginTop: 14 }}>
                <label htmlFor="daily-capture-event-time" style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                  When did this happen? <span style={{ color: "var(--text-secondary)", fontWeight: 400 }}>Optional</span>
                </label>
                <input
                  id="daily-capture-event-time"
                  type="datetime-local"
                  value={eventOccurredAt}
                  onChange={(event) => setEventOccurredAt(event.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 14 }}
                />
              </div>
            )}
            {mode === "something" && (
              <p style={{ margin: "10px 0 0", color: "var(--text-secondary)", fontSize: 12, lineHeight: 1.5 }}>
                Your original words are saved. You do not need to choose a category or explain the cause.
              </p>
            )}
          </div>
        </section>
        )}
        
        {/* Submit button */}
        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              submittingMutation ||
              (mode === "medicine" && form.medications.length === 0) ||
              (mode === "measurement" && form.vitals.length === 0) ||
              ((mode === "something" || mode === "note") && !form.notes.trim())
            }
            style={{ 
              fontSize: '16px', 
              fontWeight: '600', 
              color: 'var(--theme-action-fg)', 
              background: submittingMutation ? 'var(--theme-action-disabled-bg)' : 'var(--theme-action-bg)', 
              padding: '12px 24px', 
              borderRadius: '8px', 
              cursor: submittingMutation ? 'default' : 'pointer' 
            }}
          >
            {submittingMutation ? 'Saving…' : 'Save to care record'}
          </button>
        </div>
      <CareDeltaPanel key={personId} personId={personId} autoInput={deltaAutoInput} showPanel={false} />
      </div>
    );
}