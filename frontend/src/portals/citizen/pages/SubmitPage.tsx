import { useRef, useState, useEffect, type FormEvent } from 'react';
import { type JSX } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconArrowLeft,
  IconArrowRight,
  IconCamera,
  IconMapPin,
  IconAlertTriangle,
  IconCheck,
  IconFileText,
  IconShield,
  IconPencil,
  IconUpload,
} from '@tabler/icons-react';
import {
  useCreateReport,
  useReportTypes,
  type ReportType,
  type CreateReportInput,
} from '../api/client';
import { Spinner, cx } from '../../moderator/design';
import { CameraCapture, type CameraError } from '../components/CameraCapture';
import { GpsCapture, type CapturedLocation, type GpsCaptureHandle } from '../components/GpsCapture';
import { getQueue } from '../offline/queue';
import { useToast } from '../components/Toast';
import { evidencePreviewHandlers } from '../security/evidenceGuards';
import { useReverseGeocode } from '../../../shared/geo/useReverseGeocode';
import { ApiError } from '../../../auth/api';

const FORM_STEPS = ['Category', 'Details', 'Location', 'Evidence', 'Review'] as const;
type Step = (typeof FORM_STEPS)[number];

function currentStep(typeId: string, location: CapturedLocation | null): Step {
  if (!typeId) return 'Category';
  if (!location) return 'Location';
  return 'Evidence';
}

export default function SubmitPage(): JSX.Element {
  const navigate = useNavigate();
  const toast = useToast();
  const types = useReportTypes();
  const create = useCreateReport();
  const gpsRef = useRef<GpsCaptureHandle | null>(null);
  const [typeId, setTypeId] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [location, setLocation] = useState<CapturedLocation | null>(null);
  const [address, setAddress] = useState<string>('');
  const placeName = useReverseGeocode(location?.latitude ?? NaN, location?.longitude ?? NaN);
  const [files, setFiles] = useState<File[]>([]);
  const [showVideo, setShowVideo] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<'type' | 'title' | 'description' | 'location' | 'evidence', string>>
  >({});
  const [currentViewStep, setCurrentViewStep] = useState<Step>('Category');

  function onCameraError(err: CameraError): void {
    setError(err.message);
  }

  function setFieldError(field: keyof typeof fieldErrors, message: string | null): void {
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (message === null) {
        delete next[field];
      } else {
        next[field] = message;
      }
      return next;
    });
  }

  function removeFile(idx: number): void {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function addPhoto(f: File): void {
    const photoCount = files.filter((x) => x.type.startsWith('image/')).length;
    if (photoCount >= 5) {
      setError('You can attach up to 5 photos.');
      return;
    }
    setFiles((prev) => [...prev, f].slice(0, 6));
  }

  function addVideo(f: File): void {
    setFiles((prev) => [...prev.filter((x) => !x.type.startsWith('video/')), f].slice(0, 6));
  }

  function isNetworkFailure(err: unknown): boolean {
    return !(err instanceof ApiError);
  }

  function validateForm(): boolean {
    const errors: typeof fieldErrors = {};
    if (!typeId) {
      errors.type = 'Pick a category.';
    }
    if (title.trim().length < 5) {
      errors.title = 'Title should be at least 5 characters.';
    }
    if (description.trim().length < 10) {
      errors.description = 'Description should be at least 10 characters.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function goToStep(step: Step): void {
    setCurrentViewStep(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleCategoryNext(): void {
    if (!typeId) {
      setFieldError('type', 'Pick a category.');
      return;
    }
    setFieldError('type', null);
    goToStep('Details');
  }

  function handleDetailsNext(): void {
    const errors: Partial<typeof fieldErrors> = {};
    if (title.trim().length < 5) {
      errors.title = 'Title should be at least 5 characters.';
    }
    if (description.trim().length < 10) {
      errors.description = 'Description should be at least 10 characters.';
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...errors }));
      return;
    }
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.title;
      delete next.description;
      return next;
    });
    goToStep('Location');
  }

  function handleLocationNext(): void {
    if (!location) {
      setFieldError('location', 'Allow location access to tag the report.');
      return;
    }
    setFieldError('location', null);
    goToStep('Evidence');
  }

  function handleEvidenceNext(): void {
    const hasPhoto = files.some((f) => f.type.startsWith('image/'));
    const hasVideo = files.some((f) => f.type.startsWith('video/'));
    if (selectedType?.requires_photo && !hasPhoto) {
      setFieldError('evidence', 'This category requires at least one photo.');
      return;
    }
    if (selectedType?.requires_video && !hasVideo) {
      setFieldError('evidence', 'This category requires a video.');
      return;
    }
    setFieldError('evidence', null);
    goToStep('Review');
  }

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!validateForm()) {
      return;
    }

    const activeLocation = location ?? (await gpsRef.current?.requestLocation()) ?? null;
    if (activeLocation === null) {
      setFieldError('location', 'Allow location access to tag the report.');
      goToStep('Location');
      return;
    }

    const hasPhoto = files.some((f) => f.type.startsWith('image/'));
    const hasVideo = files.some((f) => f.type.startsWith('video/'));
    if (selectedType?.requires_photo && !hasPhoto) {
      setFieldError('evidence', 'This category requires at least one photo.');
      goToStep('Evidence');
      return;
    }
    if (selectedType?.requires_video && !hasVideo) {
      setFieldError('evidence', 'This category requires a video.');
      goToStep('Evidence');
      return;
    }

    const preciseAddress = address.trim() || placeName.trim();
    const payload: CreateReportInput = {
      report_type_id: typeId,
      title,
      description,
      latitude: activeLocation.latitude,
      longitude: activeLocation.longitude,
      accuracy_m: activeLocation.accuracy_m ?? undefined,
      address: preciseAddress || undefined,
      media_files: files,
      mock_gps_score: activeLocation.mock_heuristic.score,
    };

    setSubmitting(true);
    try {
      const res = await create.mutateAsync(payload);
      void navigate(`/citizen/reports/${res.id}`);
    } catch (err) {
      if (isNetworkFailure(err)) {
        await getQueue().enqueue({ kind: 'report.create', payload });
        toast.show("Saved offline - we'll submit it when you're back online.", 'info', 6000);
        void navigate('/citizen');
        return;
      }
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  }

  const selectedType: ReportType | undefined = types.data?.find((t) => t.id === typeId);
  const evidenceRequired = Boolean(selectedType?.requires_photo || selectedType?.requires_video);
  const reportTypes = types.data ?? [];
  const activeStep = currentStep(typeId, location);
  const stepIndex = FORM_STEPS.indexOf(currentViewStep);

  const completedSteps: Step[] = [];
  if (typeId) completedSteps.push('Category');
  if (typeId && title.trim().length >= 5 && description.trim().length >= 10)
    completedSteps.push('Details');
  if (location) completedSteps.push('Location');
  if (location && (!evidenceRequired || files.length > 0)) completedSteps.push('Evidence');

  useEffect(() => {
    if (selectedType?.requires_video) {
      setShowVideo(true);
    }
  }, [selectedType?.requires_video]);

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="min-h-screen bg-slate-50 pb-32">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#d9d7d0] bg-white shadow-sm">
        <div className="mx-auto max-w-3xl px-4">
          <div className="flex items-center gap-3 py-3">
            <button
              type="button"
              onClick={() => void navigate('/citizen')}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#d8d6cf] bg-[#faf9f6] text-[#6f6e69] transition hover:bg-white"
              aria-label="Back to citizen home"
            >
              <IconArrowLeft className="h-5 w-5" stroke={1.6} />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-medium tracking-[-0.015em] text-[#1d1d1b]">New Report</h1>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
                Step {stepIndex + 1} of {FORM_STEPS.length}
              </p>
            </div>
          </div>

          {/* Progress dots */}
          <div className="flex items-center gap-2 pb-3">
            {FORM_STEPS.map((step, i) => {
              const isActive = step === currentViewStep;
              const isComplete = completedSteps.includes(step);
              return (
                <button
                  key={step}
                  type="button"
                  onClick={() => {
                    if (i < FORM_STEPS.indexOf(activeStep) || completedSteps.includes(step)) {
                      goToStep(step);
                    }
                  }}
                  disabled={i > FORM_STEPS.indexOf(activeStep) && !completedSteps.includes(step)}
                  className={cx(
                    'group flex flex-1 items-center gap-1.5 rounded-full py-1 transition',
                    isActive || isComplete ? 'cursor-pointer' : 'cursor-not-allowed opacity-40',
                  )}
                  aria-label={`Step ${i + 1}: ${step}${isComplete ? ' (completed)' : ''}${isActive ? ' (current)' : ''}`}
                  aria-current={isActive ? 'step' : undefined}
                >
                  <span
                    className={cx(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium transition',
                      isComplete
                        ? 'bg-[#1d1d1b] text-white'
                        : isActive
                          ? 'bg-[#1d1d1b] text-white'
                          : 'bg-[#efeee9] text-[#85847f]',
                    )}
                  >
                    {isComplete ? <IconCheck className="h-3.5 w-3.5" stroke={1.8} /> : i + 1}
                  </span>
                  <span
                    className={cx(
                      'hidden text-xs font-medium sm:block',
                      isActive ? 'text-[#1d1d1b]' : isComplete ? 'text-[#1d1d1b]' : 'text-[#85847f]',
                    )}
                  >
                    {step}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-4 pt-6">
        {/* Step 1: Category Selection */}
        {currentViewStep === 'Category' && (
          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-medium tracking-[-0.015em] text-[#1d1d1b]">Report Category</h2>
              <p className="mt-1 text-sm text-[#6f6e69]">
                Select the category that best describes the civic issue you wish to report.
              </p>
            </div>

            {types.isLoading ? (
              <div className="flex items-center justify-center rounded-xl bg-white p-12 shadow-sm ring-1 ring-slate-200">
                <Spinner label="Loading categories" />
              </div>
            ) : types.isError ? (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-medium text-red-800">
                  Could not load categories. Your session may have expired. Please log in again.
                </p>
              </div>
            ) : reportTypes.length === 0 ? (
              <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-800">
                  No active report categories are available. Please contact an administrator.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {reportTypes.map((t) => (
                  <label
                    key={t.id}
                    className={cx(
                      'flex cursor-pointer items-center gap-4 rounded-xl bg-white p-4 shadow-sm ring-1 transition',
                      typeId === t.id
                        ? 'ring-2 ring-[#1d1d1b] shadow-md'
                        : 'ring-slate-200 hover:ring-slate-300',
                      fieldErrors.type && !typeId ? 'ring-2 ring-red-400 bg-red-50' : '',
                    )}
                  >
                    <input
                      type="radio"
                      name="report-category"
                      value={t.id}
                      checked={typeId === t.id}
                      onChange={() => setTypeId(t.id)}
                      className="sr-only"
                    />
                    <span
                      aria-hidden
                      className={cx(
                        'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg transition',
                        typeId === t.id ? 'bg-[#1d1d1b] text-white' : 'bg-[#efeee9] text-[#6f6e69]',
                      )}
                      style={{ color: typeId === t.id ? 'white' : (t.color ?? '#334155') }}
                    >
                      <IssueIcon code={t.code} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-[#1d1d1b]">{t.name}</span>
                      <span className="block text-xs text-[#6f6e69]">
                        {t.requires_photo ? 'Evidence required' : 'Evidence optional'}
                        {t.requires_video ? ' · Video required' : ''}
                      </span>
                    </span>
                    {typeId === t.id && (
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white">
                        <IconCheck className="h-3.5 w-3.5 text-[#1d1d1b]" stroke={1.8} />
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}
            {fieldErrors.type ? (
              <p role="alert" className="text-sm font-medium text-red-600 px-1">
                {fieldErrors.type}
              </p>
            ) : null}

            <button
              type="button"
              onClick={handleCategoryNext}
              className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#1d1d1b] px-6 text-base font-medium text-white shadow-sm transition hover:bg-black active:scale-[0.98]"
            >
              Continue
              <IconArrowRight className="h-4 w-4" stroke={1.6} />
            </button>
          </section>
        )}

        {/* Step 2: Issue Details */}
        {currentViewStep === 'Details' && (
          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-medium tracking-[-0.015em] text-[#1d1d1b]">Issue Details</h2>
              <p className="mt-1 text-sm text-[#6f6e69]">
                Provide a clear description of the issue to help officials address it promptly.
              </p>
            </div>

            <div className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div>
                <label htmlFor="report-title" className="text-sm font-medium text-[#1d1d1b]">
                  Report Title <span className="text-red-500">*</span>
                </label>
                <p className="mt-1 text-xs text-[#6f6e69]">
                  A brief, descriptive headline (minimum 5 characters).
                </p>
                <input
                  id="report-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Large pothole near metro gate 3"
                  aria-invalid={fieldErrors.title ? true : undefined}
                  aria-describedby={fieldErrors.title ? 'title-error' : undefined}
                  className={cx(
                    'mt-2 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3.5 min-h-12 text-base placeholder:text-[#85847f] focus:border-[#1d1d1b] focus:outline-none focus:ring-1 focus:ring-[#1d1d1b]',
                    fieldErrors.title ? 'border-red-400 bg-red-50' : '',
                  )}
                  required
                />
                {fieldErrors.title ? (
                  <p
                    id="title-error"
                    role="alert"
                    className="mt-2 text-sm font-medium text-red-600"
                  >
                    {fieldErrors.title}
                  </p>
                ) : null}
              </div>

              <div>
                <label htmlFor="report-description" className="text-sm font-medium text-[#1d1d1b]">
                  Detailed Description <span className="text-red-500">*</span>
                </label>
                <p className="mt-1 text-xs text-[#6f6e69]">
                  Include size, duration, safety concerns (minimum 10 characters).
                </p>
                <textarea
                  id="report-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Describe the issue: how long it exists, who it affects, any safety hazards…"
                  aria-invalid={fieldErrors.description ? true : undefined}
                  aria-describedby={fieldErrors.description ? 'desc-error' : undefined}
                  className={cx(
                    'mt-2 block w-full resize-y rounded-lg border border-slate-300 bg-white px-4 py-3.5 min-h-24 text-base placeholder:text-[#85847f] focus:border-[#1d1d1b] focus:outline-none focus:ring-1 focus:ring-[#1d1d1b]',
                    fieldErrors.description ? 'border-red-400 bg-red-50' : '',
                  )}
                  required
                />
                {fieldErrors.description ? (
                  <p id="desc-error" role="alert" className="mt-2 text-sm font-medium text-red-600">
                    {fieldErrors.description}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => goToStep('Category')}
                className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 text-base font-medium text-[#1d1d1b] shadow-sm transition hover:bg-slate-50 active:scale-[0.98]"
              >
                <IconArrowLeft className="h-4 w-4" stroke={1.6} />
                Back
              </button>
              <button
                type="button"
                onClick={handleDetailsNext}
                className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#1d1d1b] px-6 text-base font-medium text-white shadow-sm transition hover:bg-black active:scale-[0.98]"
              >
                Continue
                <IconArrowRight className="h-4 w-4" stroke={1.6} />
              </button>
            </div>
          </section>
        )}

        {/* Step 3: Location Verification */}
        {currentViewStep === 'Location' && (
          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-medium tracking-[-0.015em] text-[#1d1d1b]">Location Verification</h2>
              <p className="mt-1 text-sm text-[#6f6e69]">
                Your precise location is required to route this report to the correct department.
              </p>
            </div>

            {/* Privacy notice */}
            <div className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <IconShield className="mt-0.5 h-5 w-5 shrink-0 text-[#6f6e69]" stroke={1.6} />
              <p className="text-sm leading-relaxed text-[#6f6e69]">
                <strong className="font-medium text-[#1d1d1b]">Privacy notice:</strong> Your GPS
                coordinates are used solely for report routing and are not shared publicly.
              </p>
            </div>

            {/* GPS capture */}
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#efeee9]">
                  <IconMapPin className="h-5 w-5 text-[#6f6e69]" stroke={1.6} />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#1d1d1b]">Capture Location</p>
                  <p className="text-xs text-[#6f6e69]">Tap the button to detect your position</p>
                </div>
              </div>
              <GpsCapture ref={gpsRef} onCapture={setLocation} />
            </div>

            {fieldErrors.location ? (
              <p role="alert" className="text-sm font-medium text-red-600 px-1">
                {fieldErrors.location}
              </p>
            ) : null}

            {location !== null ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500">
                    <IconCheck className="h-5 w-5 text-white" stroke={1.8} />
                  </div>
                  <div className="text-sm">
                    <p className="font-semibold text-emerald-900">Location captured</p>
                    <p className="mt-1 text-sm text-emerald-700">
                      {placeName || 'Location captured'}
                      {location.accuracy_m !== null
                        ? ` · ±${Math.round(location.accuracy_m)} m accuracy`
                        : ''}
                    </p>
                  </div>
                </div>
                {location.accuracy_m !== null && location.accuracy_m > 100 ? (
                  <p className="mt-3 rounded-lg bg-amber-100 px-4 py-2.5 text-sm font-medium text-amber-800">
                    Coarse fix detected. For best results, try again in an open area.
                  </p>
                ) : null}
                {location.mock_heuristic.likely ? (
                  <p className="mt-3 rounded-lg bg-amber-100 px-4 py-2.5 text-sm font-medium text-amber-800">
                    This location appears suspicious ({location.mock_heuristic.reasons.join('; ')}).
                    It may be rejected during review.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div>
              <label htmlFor="report-address" className="text-sm font-medium text-[#1d1d1b]">
                Nearest Landmark or Address
                <span className="text-[#85847f] font-normal"> (optional)</span>
              </label>
              <p className="mt-1 text-xs text-[#6f6e69]">
                A street name or nearby landmark helps officers locate the exact spot.
              </p>
              <input
                id="report-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Near BESCOM office, 8th Main Road"
                className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3.5 min-h-12 text-base placeholder:text-[#85847f] focus:border-[#1d1d1b] focus:outline-none focus:ring-1 focus:ring-[#1d1d1b]"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => goToStep('Details')}
                className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 text-base font-medium text-[#1d1d1b] shadow-sm transition hover:bg-slate-50 active:scale-[0.98]"
              >
                <IconArrowLeft className="h-4 w-4" stroke={1.6} />
                Back
              </button>
              <button
                type="button"
                onClick={handleLocationNext}
                className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#1d1d1b] px-6 text-base font-medium text-white shadow-sm transition hover:bg-black active:scale-[0.98]"
              >
                Continue
                <IconArrowRight className="h-4 w-4" stroke={1.6} />
              </button>
            </div>
          </section>
        )}

        {/* Step 4: Evidence Upload */}
        {currentViewStep === 'Evidence' && (
          <section className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-medium tracking-[-0.015em] text-[#1d1d1b]">Attach Evidence</h2>
                <p className="mt-1 text-sm text-[#6f6e69]">
                  Up to 5 photos and 1 short video (3–5 seconds). Max 25 MB per file.
                </p>
              </div>
              <span
                className={cx(
                  'shrink-0 rounded-full px-3 py-1 text-xs font-semibold',
                  evidenceRequired ? 'bg-red-100 text-red-700' : 'bg-[#efeee9] text-[#6f6e69]',
                )}
              >
                {evidenceRequired ? 'Required' : 'Optional'}
              </span>
            </div>

            {/* Safety advisory */}
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <IconAlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" stroke={1.6} />
              <div className="text-sm leading-relaxed text-amber-800">
                <p className="font-semibold text-amber-900">Safety First</p>
                <p className="mt-0.5">
                  Never capture evidence while operating a vehicle. Pull over to a safe location
                  first.
                </p>
              </div>
            </div>

            {fieldErrors.evidence ? (
              <p role="alert" className="text-sm font-medium text-red-600 px-1">
                {fieldErrors.evidence}
              </p>
            ) : null}

            {/* Camera controls */}
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#efeee9]">
                  <IconCamera className="h-5 w-5 text-[#6f6e69]" stroke={1.6} />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#1d1d1b]">Camera</p>
                  <p className="text-xs text-[#6f6e69]">Capture photos or record video</p>
                </div>
              </div>
              <CameraCapture mode="photo" onCapture={addPhoto} onError={onCameraError} />
              <button
                type="button"
                onClick={() => setShowVideo((v) => !v)}
                className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-[#1d1d1b] transition hover:bg-slate-50 active:scale-[0.98]"
              >
                <IconCamera className="h-4 w-4" stroke={1.6} />
                {showVideo
                  ? 'Hide video recorder'
                  : `Record video${selectedType?.requires_video ? ' (required)' : ' (optional)'}`}
              </button>
              {showVideo ? (
                <CameraCapture mode="video" onCapture={addVideo} onError={onCameraError} />
              ) : null}
            </div>

            {/* File previews */}
            {files.length > 0 ? (
              <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center gap-2 mb-4">
                  <IconUpload className="h-4 w-4 text-[#6f6e69]" stroke={1.6} />
                  <p className="text-sm font-medium text-[#1d1d1b]">
                    {files.length} file{files.length !== 1 ? 's' : ''} attached
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {files.map((f, i) => (
                    <div key={i} className="relative">
                      <div className="aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                        {f.type.startsWith('image/') ? (
                          <img
                            src={URL.createObjectURL(f)}
                            alt=""
                            className="h-full w-full object-cover"
                            {...evidencePreviewHandlers()}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-slate-100">
                            <IconCamera className="h-8 w-8 text-[#85847f]" stroke={1.6} />
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#1d1d1b] text-xs font-medium text-white shadow-sm transition hover:bg-red-600"
                        aria-label={`Remove ${f.name}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => goToStep('Location')}
                className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 text-base font-medium text-[#1d1d1b] shadow-sm transition hover:bg-slate-50 active:scale-[0.98]"
              >
                <IconArrowLeft className="h-4 w-4" stroke={1.6} />
                Back
              </button>
              <button
                type="button"
                onClick={handleEvidenceNext}
                className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#1d1d1b] px-6 text-base font-medium text-white shadow-sm transition hover:bg-black active:scale-[0.98]"
              >
                Review
                <IconArrowRight className="h-4 w-4" stroke={1.6} />
              </button>
            </div>
          </section>
        )}

        {/* Step 5: Review & Submit */}
        {currentViewStep === 'Review' && (
          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-medium tracking-[-0.015em] text-[#1d1d1b]">Review Your Report</h2>
              <p className="mt-1 text-sm text-[#6f6e69]">
                Please review all details before submitting your official report.
              </p>
            </div>

            {/* Review cards */}
            <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between border-b border-[#e4e2dc] p-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
                    Category
                  </p>
                  <p className="mt-1 text-sm font-medium text-[#1d1d1b]">
                    {selectedType?.name ?? 'Unknown'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => goToStep('Category')}
                  className="inline-flex items-center gap-1 text-sm font-medium text-[#6f6e69] transition hover:text-[#1d1d1b]"
                >
                  <IconPencil className="h-3.5 w-3.5" stroke={1.6} />
                  Edit
                </button>
              </div>

              <div className="flex items-center justify-between border-b border-[#e4e2dc] p-4">
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
                    Title
                  </p>
                  <p className="mt-1 text-sm font-medium text-[#1d1d1b] truncate">{title}</p>
                </div>
                <button
                  type="button"
                  onClick={() => goToStep('Details')}
                  className="ml-2 inline-flex items-center gap-1 text-sm font-medium text-[#6f6e69] transition hover:text-[#1d1d1b]"
                >
                  <IconPencil className="h-3.5 w-3.5" stroke={1.6} />
                  Edit
                </button>
              </div>

              <div className="border-b border-[#e4e2dc] p-4">
                <div className="flex items-start justify-between">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
                    Description
                  </p>
                  <button
                    type="button"
                    onClick={() => goToStep('Details')}
                    className="ml-2 inline-flex shrink-0 items-center gap-1 text-sm font-medium text-[#6f6e69] transition hover:text-[#1d1d1b]"
                  >
                    <IconPencil className="h-3.5 w-3.5" stroke={1.6} />
                    Edit
                  </button>
                </div>
                <p className="mt-1 text-sm text-[#6f6e69] whitespace-pre-wrap">{description}</p>
              </div>

              <div className="flex items-center justify-between border-b border-[#e4e2dc] p-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
                    Location
                  </p>
                  <p className="mt-1 text-sm font-medium text-[#1d1d1b]">
                    {location
                      ? (placeName || address || 'Location captured')
                      : 'Not captured'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => goToStep('Location')}
                  className="inline-flex items-center gap-1 text-sm font-medium text-[#6f6e69] transition hover:text-[#1d1d1b]"
                >
                  <IconPencil className="h-3.5 w-3.5" stroke={1.6} />
                  Edit
                </button>
              </div>

              <div className="flex items-center justify-between p-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
                    Evidence
                  </p>
                  <p className="mt-1 text-sm font-medium text-[#1d1d1b]">
                    {files.length} file{files.length !== 1 ? 's' : ''} attached
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => goToStep('Evidence')}
                  className="inline-flex items-center gap-1 text-sm font-medium text-[#6f6e69] transition hover:text-[#1d1d1b]"
                >
                  <IconPencil className="h-3.5 w-3.5" stroke={1.6} />
                  Edit
                </button>
              </div>
            </div>

            {/* Error summary */}
            {error !== null ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-start gap-3">
                  <IconAlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" stroke={1.6} />
                  <p className="text-sm font-medium text-red-800">{error}</p>
                </div>
              </div>
            ) : null}

            {/* Submit section */}
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 space-y-4">
              <p className="text-center text-sm text-[#6f6e69]">
                By submitting, you confirm the information is accurate to the best of your
                knowledge.
              </p>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl bg-[#1d1d1b] px-6 text-base font-medium text-white shadow-sm transition hover:bg-black active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                <IconFileText className="h-5 w-5" stroke={1.6} />
                {submitting ? 'Submitting…' : 'File Report'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => goToStep('Evidence')}
              className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 text-base font-medium text-[#1d1d1b] shadow-sm transition hover:bg-slate-50 active:scale-[0.98]"
            >
              <IconArrowLeft className="h-4 w-4" stroke={1.6} />
              Back to Evidence
            </button>
          </section>
        )}
      </div>
    </form>
  );
}

function IssueIcon({ code }: { code: string }): JSX.Element {
  const iconClass = 'h-5 w-5';
  const icons: Record<string, JSX.Element> = {
    roads: (
      <svg
        viewBox="0 0 24 24"
        className={iconClass}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7 21 10 3h4l3 18" />
        <path d="M12 5v3M12 11v3M12 17v2" />
      </svg>
    ),
    water_sewage: (
      <svg
        viewBox="0 0 24 24"
        className={iconClass}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3s6 6.2 6 11a6 6 0 0 1-12 0c0-4.8 6-11 6-11Z" />
      </svg>
    ),
    electricity: (
      <svg
        viewBox="0 0 24 24"
        className={iconClass}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m13 2-8 11h6l-1 9 8-12h-6l1-8Z" />
      </svg>
    ),
    garbage: (
      <svg
        viewBox="0 0 24 24"
        className={iconClass}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 7h14M10 4h4l1 3H9l1-3ZM7 7l1 14h8l1-14" />
        <path d="M10 11v6M14 11v6" />
      </svg>
    ),
    traffic_violation: (
      <svg
        viewBox="0 0 24 24"
        className={iconClass}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="7" y="3" width="10" height="18" rx="2" />
        <circle cx="12" cy="8" r="1.5" />
        <circle cx="12" cy="12" r="1.5" />
        <circle cx="12" cy="16" r="1.5" />
      </svg>
    ),
    illegal_parking: (
      <svg
        viewBox="0 0 24 24"
        className={iconClass}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="M10 17V7h3.5a3 3 0 0 1 0 6H10" />
      </svg>
    ),
    encroachment: (
      <svg
        viewBox="0 0 24 24"
        className={iconClass}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 20h16M6 20V9l6-5 6 5v11M9 20v-5h6v5" />
        <path d="M3 11h18" />
      </svg>
    ),
    dead_animal: (
      <svg
        viewBox="0 0 24 24"
        className={iconClass}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="8" cy="8" r="2" />
        <circle cx="16" cy="8" r="2" />
        <circle cx="6" cy="13" r="2" />
        <circle cx="18" cy="13" r="2" />
        <path d="M12 12c-3 0-5 2-5 4 0 2 2 3 5 3s5-1 5-3c0-2-2-4-5-4Z" />
      </svg>
    ),
  };

  return (
    icons[code] ?? (
      <svg
        viewBox="0 0 24 24"
        className={iconClass}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="8" />
      </svg>
    )
  );
}
