import { useRef, useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
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
  IconTrash,
  IconUpload,
  IconRefresh,
} from '@tabler/icons-react';
import {
  useCreateReport,
  useReportTypes,
  type ReportType,
  type CreateReportInput,
} from '../api/client';
import { Spinner, EmptyState, ErrorState, cx } from '../../../shared/ui';
import { CameraCapture, type CameraError } from '../components/CameraCapture';
import {
  GpsCapture,
  MAX_GPS_ACCURACY_M,
  type CapturedLocation,
  type GpsCaptureHandle,
} from '../components/GpsCapture';
import { type IssueLocation } from '../components/issueLocation';
import { getQueue } from '../offline/queue';
import { useToast } from '../components/Toast';
import { evidencePreviewHandlers, scrubFile } from '../security/evidenceGuards';
import { useReverseGeocode } from '../../../shared/geo/useReverseGeocode';
import { ApiError } from '../../../auth/api';
import { useMessages } from '../messages';
import { readSession } from '../../../auth/storage';
import { clearDraft, loadDraft, saveDraft } from '../offline/drafts';
import { requestBackgroundSync } from '../offline/swBridge';
import { trackProductEvent } from '../../../shared/analytics';

const FORM_STEPS = ['Category', 'Details', 'Location', 'Evidence', 'Review'] as const;
type Step = (typeof FORM_STEPS)[number];

const localTestUploadEnabled =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_TEST_UPLOAD !== 'false';

function currentStep(typeId: string, location: CapturedLocation | null): Step {
  if (!typeId) return 'Category';
  if (!location) return 'Location';
  return 'Evidence';
}

const CATEGORY_PRIORITY: Record<string, number> = {
  garbage: 1,
  metal_scrap: 3,
  e_waste: 4,
  roads: 5,
  electricity: 6,
  water_sewage: 7,
  sewage: 8,
  drainage: 8,
  stray_animal: 9,
  dead_animal: 9,
  tree: 10,
  vegetation: 10,
  air_pollution: 11,
  burning: 11,
  noise_pollution: 12,
  encroachment: 13,
  illegal_construction: 13,
  public_property: 14,
  traffic_signal: 15,
  traffic_signage: 15,
  traffic_violation: 15,
  illegal_parking: 15,
  other: 99,
};

function sortByPracticalOrder(types: ReportType[]): ReportType[] {
  return [...types].sort((a, b) => {
    const pa = CATEGORY_PRIORITY[a.code] ?? 50;
    const pb = CATEGORY_PRIORITY[b.code] ?? 50;
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name);
  });
}

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `report-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function SubmitPage(): JSX.Element {
  const navigate = useNavigate();
  const { t } = useMessages();
  const toast = useToast();
  const ownerId = readSession()?.user.id ?? null;
  const types = useReportTypes();
  const create = useCreateReport();
  const gpsRef = useRef<GpsCaptureHandle | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const [typeId, setTypeId] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [location, setLocation] = useState<CapturedLocation | null>(null);
  const [issueLocation, setIssueLocation] = useState<IssueLocation | null>(null);
  const [address, setAddress] = useState<string>('');
  const placeName = useReverseGeocode(
    issueLocation?.latitude ?? NaN,
    issueLocation?.longitude ?? NaN,
  );
  const [files, setFiles] = useState<File[]>([]);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [showVideo, setShowVideo] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<'type' | 'title' | 'description' | 'location' | 'evidence', string>>
  >({});
  const [currentViewStep, setCurrentViewStep] = useState<Step>('Category');
  const [idempotencyKey, setIdempotencyKey] = useState<string>(newIdempotencyKey);
  const [hasSavedDraft, setHasSavedDraft] = useState<boolean>(false);
  const draftReadyRef = useRef(false);
  const draftCompleteRef = useRef(false);

  // Keep media previews scoped to the current draft and release each object
  // URL when files change/unmount. Creating URLs inline during render leaks a
  // blob reference on every state update, which is especially costly on
  // mobile devices capturing several photos.
  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files]);

  useEffect(() => {
    if (!ownerId) {
      draftReadyRef.current = true;
      return;
    }
    let cancelled = false;
    void loadDraft(ownerId).then((draft) => {
      if (cancelled) return;
      if (draft) {
        setHasSavedDraft(true);
        setTypeId(draft.type_id);
        setTitle(draft.title);
        setDescription(draft.description);
        setLocation(draft.location);
        setIssueLocation(
          draft.issue_location ??
            (draft.location
              ? {
                  latitude: draft.location.latitude,
                  longitude: draft.location.longitude,
                  source: 'reporter_gps',
                }
              : null),
        );
        setAddress(draft.address);
        setFiles(draft.files ?? []);
        setIdempotencyKey(draft.idempotency_key || newIdempotencyKey());
        if (FORM_STEPS.includes(draft.current_step as Step)) {
          setCurrentViewStep(draft.current_step as Step);
        }
      }
      draftReadyRef.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, [ownerId]);

  useEffect(() => {
    if (!ownerId || !draftReadyRef.current || draftCompleteRef.current) return;
    void saveDraft(ownerId, {
      updated_at: Date.now(),
      type_id: typeId,
      title,
      description,
      location,
      issue_location: issueLocation,
      address,
      current_step: currentViewStep,
      files,
      idempotency_key: idempotencyKey,
    }).then(() => setHasSavedDraft(true));
  }, [
    ownerId,
    typeId,
    title,
    description,
    location,
    issueLocation,
    address,
    currentViewStep,
    files,
    idempotencyKey,
  ]);

  function onCameraError(err: CameraError): void {
    trackProductEvent('media_upload_failed', { reason: err.kind });
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
    setPreviewIndex(null);
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function discardSavedDraft(): Promise<void> {
    if (!ownerId) return;
    if (!window.confirm(t('submit.discard.confirm'))) return;

    await clearDraft(ownerId);
    // Stop the autosave effect before resetting state; the reset itself must
    // not immediately create a new empty draft.
    draftCompleteRef.current = true;
    setHasSavedDraft(false);
    setTypeId('');
    setTitle('');
    setDescription('');
    setLocation(null);
    setIssueLocation(null);
    setAddress('');
    setFiles([]);
    setPreviewIndex(null);
    setShowVideo(false);
    setError(null);
    setFieldErrors({});
    setIdempotencyKey(newIdempotencyKey());
    setCurrentViewStep('Category');
    toast.show(t('submit.discard.done'), 'info', 4000);
    void navigate('/citizen');
  }

  function addPhoto(f: File): void {
    const photoCount = files.filter((x) => x.type.startsWith('image/')).length;
    if (photoCount >= 5) {
      setError(t('submit.evidence.tooManyPhotos'));
      return;
    }
    setFiles((prev) => [...prev, f].slice(0, 6));
  }

  async function handleTestPhotoChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file for local testing.');
      return;
    }
    addPhoto(await scrubFile(file));
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
      errors.type = t('submit.category.pickCategory');
    }
    if (title.trim().length < 5) {
      errors.title = t('submit.details.titleTooShort');
    }
    if (description.trim().length > 0 && description.trim().length < 10) {
      errors.description = t('submit.details.descriptionTooShort');
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function goToStep(step: Step): void {
    setCurrentViewStep(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  useEffect(() => {
    headingRef.current?.focus();
    trackProductEvent('report_step_viewed', { step: currentViewStep });
  }, [currentViewStep]);

  function handleCategoryNext(): void {
    if (!typeId) {
      setFieldError('type', t('submit.category.pickCategory'));
      return;
    }
    setFieldError('type', null);
    goToStep('Details');
  }

  function handleDetailsNext(): void {
    const errors: Partial<typeof fieldErrors> = {};
    if (title.trim().length < 5) {
      errors.title = t('submit.details.titleTooShort');
    }
    if (description.trim().length > 0 && description.trim().length < 10) {
      errors.description = t('submit.details.descriptionTooShort');
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
      setFieldError('location', t('submit.location.allowAccess'));
      return;
    }
    setFieldError('location', null);
    goToStep('Evidence');
  }

  function handleEvidenceNext(): void {
    const hasPhoto = files.some((f) => f.type.startsWith('image/'));
    const hasVideo = files.some((f) => f.type.startsWith('video/'));
    if (selectedType?.requires_photo && !hasPhoto) {
      setFieldError('evidence', t('submit.evidence.requiresPhoto'));
      return;
    }
    if (selectedType?.requires_video && !hasVideo) {
      setFieldError('evidence', t('submit.evidence.requiresVideo'));
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
      setFieldError('location', t('submit.location.allowAccess'));
      goToStep('Location');
      return;
    }
    if (activeLocation.accuracy_m !== null && activeLocation.accuracy_m > MAX_GPS_ACCURACY_M) {
      setFieldError(
        'location',
        t('gps.coarseFix', { accuracy: Math.round(activeLocation.accuracy_m) }),
      );
      goToStep('Location');
      return;
    }

    const hasPhoto = files.some((f) => f.type.startsWith('image/'));
    const hasVideo = files.some((f) => f.type.startsWith('video/'));
    if (selectedType?.requires_photo && !hasPhoto) {
      setFieldError('evidence', t('submit.evidence.requiresPhoto'));
      goToStep('Evidence');
      return;
    }
    if (selectedType?.requires_video && !hasVideo) {
      setFieldError('evidence', t('submit.evidence.requiresVideo'));
      goToStep('Evidence');
      return;
    }

    const preciseAddress = address.trim() || placeName.trim();
    const issuePoint = issueLocation ?? {
      latitude: activeLocation.latitude,
      longitude: activeLocation.longitude,
      source: 'reporter_gps' as const,
    };
    const manuallyPinned = issuePoint.source === 'manual_pin';
    const payload: CreateReportInput = {
      report_type_id: typeId,
      title,
      description,
      latitude: issuePoint.latitude,
      longitude: issuePoint.longitude,
      reporter_latitude: activeLocation.latitude,
      reporter_longitude: activeLocation.longitude,
      reporter_accuracy_m: activeLocation.accuracy_m ?? undefined,
      reporter_gps_provider: activeLocation.gps_provider,
      reporter_captured_at: new Date(activeLocation.captured_at).toISOString(),
      // A manual issue pin is not a claim about the reporter's device
      // accuracy. Preserve reporter provenance only for GPS-derived pins.
      accuracy_m: manuallyPinned ? undefined : (activeLocation.accuracy_m ?? undefined),
      altitude: manuallyPinned ? null : activeLocation.altitude,
      heading: manuallyPinned ? null : activeLocation.heading,
      speed: manuallyPinned ? null : activeLocation.speed,
      gps_provider: manuallyPinned ? 'manual_pin' : activeLocation.gps_provider,
      captured_at: manuallyPinned ? undefined : new Date(activeLocation.captured_at).toISOString(),
      address: preciseAddress || undefined,
      media_files: files,
      mock_gps_score: activeLocation.mock_heuristic.score,
      idempotency_key: idempotencyKey,
    };

    setSubmitting(true);
    try {
      const res = await create.mutateAsync(payload);
      trackProductEvent('report_completed');
      draftCompleteRef.current = true;
      if (ownerId) void clearDraft(ownerId);
      void navigate(`/citizen/reports/${res.id}`);
    } catch (err) {
      if (isNetworkFailure(err)) {
        await getQueue(ownerId).enqueue({ kind: 'report.create', payload });
        trackProductEvent('report_queued_offline');
        void requestBackgroundSync();
        draftCompleteRef.current = true;
        if (ownerId) void clearDraft(ownerId);
        toast.show(t('submit.offlineSaved'), 'info', 6000);
        void navigate('/citizen');
        return;
      }
      setError(err instanceof Error ? err.message : t('submit.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  const selectedType: ReportType | undefined = types.data?.find((t) => t.id === typeId);
  const evidenceRequired = Boolean(selectedType?.requires_photo || selectedType?.requires_video);
  const reportTypes = sortByPracticalOrder(types.data ?? []);
  const activeStep = currentStep(typeId, location);
  const stepIndex = FORM_STEPS.indexOf(currentViewStep);
  const stepLabel = (step: Step): string =>
    ({
      Category: t('submit.step.category'),
      Details: t('submit.step.details'),
      Location: t('submit.step.location'),
      Evidence: t('submit.step.evidence'),
      Review: t('submit.step.review'),
    })[step];

  const completedSteps: Step[] = [];
  if (typeId) completedSteps.push('Category');
  if (
    typeId &&
    title.trim().length >= 5 &&
    (description.trim().length === 0 || description.trim().length >= 10)
  )
    completedSteps.push('Details');
  if (location) completedSteps.push('Location');
  if (location && (!evidenceRequired || files.length > 0)) completedSteps.push('Evidence');

  useEffect(() => {
    if (selectedType?.requires_video) {
      setShowVideo(true);
    }
  }, [selectedType?.requires_video]);

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="bg-[var(--color-canvas)]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[var(--color-border-faint)] bg-[var(--color-canvas)]">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-3 py-3">
            <button
              type="button"
              onClick={() => void navigate('/citizen')}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#d8d6cf] bg-[#faf9f6] text-[var(--color-text-secondary)] transition hover:bg-white"
              aria-label="Back to citizen home"
            >
              <IconArrowLeft className="h-5 w-5" stroke={1.6} />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-medium tracking-[-0.015em] text-[var(--color-ink)]">
                {t('submit.newReport')}
              </h1>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                {t('submit.stepCount', {
                  current: stepIndex + 1,
                  total: FORM_STEPS.length,
                })}
              </p>
            </div>
          </div>

          {hasSavedDraft && ownerId ? (
            <div className="flex justify-end pb-3">
              <button
                type="button"
                onClick={() => void discardSavedDraft()}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-red-200 bg-white px-4 text-sm font-medium text-red-700 transition hover:bg-red-50"
              >
                <IconTrash className="h-4 w-4" stroke={1.6} />
                {t('submit.discard.button')}
              </button>
            </div>
          ) : null}

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
                    'group flex min-h-[44px] flex-1 items-center gap-1.5 rounded-full py-1 transition',
                    isActive || isComplete ? 'cursor-pointer' : 'cursor-not-allowed opacity-40',
                  )}
                  aria-label={`${t('submit.stepCount', { current: i + 1, total: FORM_STEPS.length })}: ${stepLabel(step)}${isComplete ? ` (${t('detail.current')})` : ''}`}
                  aria-current={isActive ? 'step' : undefined}
                >
                  <span
                    className={cx(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium transition',
                      isComplete
                        ? 'bg-[var(--color-ink)] text-white'
                        : isActive
                          ? 'bg-[var(--color-ink)] text-white'
                          : 'bg-[var(--color-surface-alt)] text-[var(--color-text-tertiary)]',
                    )}
                  >
                    {isComplete ? <IconCheck className="h-3.5 w-3.5" stroke={1.8} /> : i + 1}
                  </span>
                  <span
                    className={cx(
                      'hidden text-xs font-medium sm:block',
                      isActive
                        ? 'text-[var(--color-ink)]'
                        : isComplete
                          ? 'text-[var(--color-ink)]'
                          : 'text-[var(--color-text-tertiary)]',
                    )}
                  >
                    {stepLabel(step)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-3xl pt-6 space-y-4">
        <div
          aria-live="polite"
          role="status"
          className="sr-only"
          aria-label={`${t('submit.stepCount', { current: stepIndex + 1, total: FORM_STEPS.length })}: ${stepLabel(currentViewStep)}`}
        />

        {/* Step 1: Category Selection */}
        {currentViewStep === 'Category' && (
          <section aria-labelledby="step-heading" className="space-y-4">
            <div className="rounded-xl bg-white p-4">
              <h2
                id="step-heading"
                ref={headingRef}
                tabIndex={-1}
                className="text-xl font-medium tracking-[-0.015em] text-[var(--color-ink)] focus:outline-none"
              >
                {t('submit.category.title')}
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {t('submit.category.subtitle')}
              </p>
            </div>

            <aside className="rounded-xl border border-amber-200 bg-amber-50 p-4" role="note">
              <p className="text-sm font-semibold text-amber-950">
                {t('submit.category.emergencyTitle')}
              </p>
              <p className="mt-1 text-sm text-amber-900">{t('submit.category.emergencyBody')}</p>
            </aside>

            <aside className="rounded-xl border border-sky-200 bg-sky-50 p-4" role="note">
              <p className="text-sm font-semibold text-sky-950">
                {t('submit.category.agencyTitle')}
              </p>
              <p className="mt-1 text-sm leading-6 text-sky-900">
                {t('submit.category.agencyBody')}
              </p>
            </aside>

            {types.isLoading ? (
              <div className="rounded-xl bg-white p-12 flex flex-col items-center justify-center gap-3">
                <Spinner label={t('submit.category.loading')} />
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {t('submit.category.loading')}…
                </p>
              </div>
            ) : types.isError ? (
              <ErrorState
                title={t('submit.category.errorTitle')}
                description={t('submit.category.error')}
                error={types.error instanceof Error ? types.error : null}
                action={
                  <button
                    type="button"
                    onClick={() => void types.refetch()}
                    className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[var(--color-ink)] px-5 text-sm font-medium text-white transition hover:bg-black active:scale-[0.98]"
                  >
                    <IconRefresh className="h-4 w-4" stroke={1.6} />
                    {t('common.retry')}
                  </button>
                }
              />
            ) : reportTypes.length === 0 ? (
              <EmptyState
                title={t('submit.category.emptyTitle')}
                description={t('submit.category.empty')}
                action={
                  <button
                    type="button"
                    onClick={() => void types.refetch()}
                    className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#d8d6cf] bg-[#faf9f6] px-5 text-sm font-medium text-[var(--color-ink)] transition hover:bg-white active:scale-[0.98]"
                  >
                    <IconRefresh className="h-4 w-4" stroke={1.6} />
                    {t('common.retry')}
                  </button>
                }
              />
            ) : (
              <div className="rounded-xl bg-white divide-y divide-[var(--color-border-subtle)]">
                {reportTypes.map((reportType) => (
                  <label
                    key={reportType.id}
                    className={cx(
                      'flex cursor-pointer items-center gap-4 p-4 transition',
                      typeId === reportType.id
                        ? 'bg-[var(--color-surface-alt)]'
                        : 'hover:bg-[#faf9f6]',
                      fieldErrors.type && !typeId ? 'bg-red-50' : '',
                    )}
                  >
                    <input
                      type="radio"
                      name="report-category"
                      value={reportType.id}
                      checked={typeId === reportType.id}
                      onChange={() => setTypeId(reportType.id)}
                      className="sr-only"
                    />
                    <span
                      aria-hidden
                      className={cx(
                        'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg transition',
                        typeId === reportType.id
                          ? 'bg-[var(--color-ink)] text-white'
                          : 'bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)]',
                      )}
                      style={{
                        color: typeId === reportType.id ? 'white' : (reportType.color ?? '#334155'),
                      }}
                    >
                      <IssueIcon code={reportType.code} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-[var(--color-ink)]">
                        {reportType.name}
                      </span>
                      <span className="block text-xs text-[var(--color-text-secondary)]">
                        {reportType.requires_photo
                          ? t('submit.category.evidenceRequired')
                          : t('submit.category.evidenceOptional')}
                        {reportType.requires_video
                          ? ` · ${t('submit.category.videoRequired')}`
                          : ''}
                      </span>
                    </span>
                    {typeId === reportType.id && (
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-ink)]">
                        <IconCheck className="h-3.5 w-3.5 text-white" stroke={1.8} />
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
              className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[var(--color-ink)] px-6 text-base font-medium text-white transition hover:bg-black active:scale-[0.98]"
            >
              {t('common.continue')}
              <IconArrowRight className="h-4 w-4" stroke={1.6} />
            </button>
          </section>
        )}

        {/* Step 2: Issue Details */}
        {currentViewStep === 'Details' && (
          <section aria-labelledby="step-heading" className="space-y-4">
            <div className="rounded-xl bg-white p-4">
              <h2
                id="step-heading"
                ref={headingRef}
                tabIndex={-1}
                className="text-xl font-medium tracking-[-0.015em] text-[var(--color-ink)] focus:outline-none"
              >
                {t('submit.details.title')}
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {t('submit.details.subtitle')}
              </p>
            </div>

            <div className="rounded-xl bg-white p-4 space-y-4">
              <div>
                <label
                  htmlFor="report-title"
                  className="text-sm font-medium text-[var(--color-ink)]"
                >
                  {t('submit.details.titleLabel')} <span className="text-red-500">*</span>
                </label>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  {t('submit.details.titleHint')}
                </p>
                <input
                  id="report-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('submit.details.titlePlaceholder')}
                  aria-invalid={fieldErrors.title ? true : undefined}
                  aria-describedby={fieldErrors.title ? 'title-error' : undefined}
                  className={cx(
                    'mt-2 block w-full rounded-lg border border-[#d8d6cf] bg-[#faf9f6] px-4 py-3.5 min-h-12 text-base placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]',
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
                <label
                  htmlFor="report-description"
                  className="text-sm font-medium text-[var(--color-ink)]"
                >
                  {t('submit.details.descriptionLabel')}{' '}
                  <span className="text-slate-500">({t('common.optional')})</span>
                </label>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  {t('submit.details.descriptionHint')}
                </p>
                <textarea
                  id="report-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder={t('submit.details.descriptionPlaceholder')}
                  aria-invalid={fieldErrors.description ? true : undefined}
                  aria-describedby={fieldErrors.description ? 'desc-error' : undefined}
                  className={cx(
                    'mt-2 block w-full resize-y rounded-lg border border-[#d8d6cf] bg-[#faf9f6] px-4 py-3.5 min-h-24 text-base placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]',
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
                className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-full border border-[#d8d6cf] bg-[#faf9f6] px-6 text-base font-medium text-[var(--color-ink)] transition hover:bg-white active:scale-[0.98]"
              >
                <IconArrowLeft className="h-4 w-4" stroke={1.6} />
                {t('common.back')}
              </button>
              <button
                type="button"
                onClick={handleDetailsNext}
                className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-full bg-[var(--color-ink)] px-6 text-base font-medium text-white transition hover:bg-black active:scale-[0.98]"
              >
                {t('common.continue')}
                <IconArrowRight className="h-4 w-4" stroke={1.6} />
              </button>
            </div>
          </section>
        )}

        {/* Step 3: Location Verification */}
        {currentViewStep === 'Location' && (
          <section aria-labelledby="step-heading" className="space-y-4">
            <div className="rounded-xl bg-white p-4">
              <h2
                id="step-heading"
                ref={headingRef}
                tabIndex={-1}
                className="text-xl font-medium tracking-[-0.015em] text-[var(--color-ink)] focus:outline-none"
              >
                {t('submit.location.title')}
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {t('submit.location.subtitle')}
              </p>
            </div>

            {/* Privacy notice */}
            <div className="rounded-xl bg-white p-4 flex items-start gap-3">
              <IconShield
                className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-text-secondary)]"
                stroke={1.6}
              />
              <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
                <strong className="font-medium text-[var(--color-ink)]">
                  {t('submit.location.privacyTitle')}
                </strong>{' '}
                {t('submit.location.privacyBody')}
              </p>
            </div>

            {/* GPS capture */}
            <div className="rounded-xl bg-white p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-surface-alt)]">
                  <IconMapPin className="h-5 w-5 text-[var(--color-text-secondary)]" stroke={1.6} />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--color-ink)]">
                    {t('submit.location.capture')}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {t('submit.location.captureHint')}
                  </p>
                </div>
              </div>
              <GpsCapture
                ref={gpsRef}
                onCapture={(captured) => {
                  setLocation(captured);
                  setIssueLocation({
                    latitude: captured.latitude,
                    longitude: captured.longitude,
                    source: 'reporter_gps',
                  });
                }}
              />
            </div>

            {fieldErrors.location ? (
              <p role="alert" className="text-sm font-medium text-red-600 px-1">
                {fieldErrors.location}
              </p>
            ) : null}

            {location !== null ? (
              <div className="rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500">
                    <IconCheck className="h-5 w-5 text-white" stroke={1.8} />
                  </div>
                  <div className="text-sm">
                    <p className="font-semibold text-emerald-900">
                      {t('submit.location.captured')}
                    </p>
                    <p className="mt-1 text-sm text-emerald-700">
                      {placeName
                        ? t('submit.location.detectedPlace', { place: placeName })
                        : t('submit.location.detectingPlace')}
                    </p>
                    <p className="mt-1 text-xs text-emerald-800">
                      {location.accuracy_m !== null
                        ? t('submit.location.detectedAccuracy', {
                            accuracy: Math.round(location.accuracy_m),
                          })
                        : t('submit.location.detectedAccuracyUnknown')}
                    </p>
                  </div>
                </div>
                {location.accuracy_m !== null && location.accuracy_m > MAX_GPS_ACCURACY_M ? (
                  <p className="mt-3 rounded-lg bg-amber-100 px-4 py-2.5 text-sm font-medium text-amber-800">
                    {t('submit.location.coarseWarning')}
                  </p>
                ) : null}
                {location.mock_heuristic.likely ? (
                  <p className="mt-3 rounded-lg bg-amber-100 px-4 py-2.5 text-sm font-medium text-amber-800">
                    {t('submit.location.suspiciousWarning', {
                      reasons: location.mock_heuristic.reasons.join('; '),
                    })}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="rounded-xl bg-white p-4">
              <label
                htmlFor="report-address"
                className="text-sm font-medium text-[var(--color-ink)]"
              >
                {t('submit.location.addressLabel')}
                <span className="text-[var(--color-text-tertiary)] font-normal">
                  {' '}
                  {t('submit.location.addressOptional')}
                </span>
              </label>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                {t('submit.location.addressHint')}
              </p>
              <input
                id="report-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={t('submit.location.addressPlaceholder')}
                className="mt-2 block w-full rounded-lg border border-[#d8d6cf] bg-[#faf9f6] px-4 py-3.5 min-h-12 text-base placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => goToStep('Details')}
                className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-full border border-[#d8d6cf] bg-[#faf9f6] px-6 text-base font-medium text-[var(--color-ink)] transition hover:bg-white active:scale-[0.98]"
              >
                <IconArrowLeft className="h-4 w-4" stroke={1.6} />
                {t('common.back')}
              </button>
              <button
                type="button"
                onClick={handleLocationNext}
                className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-full bg-[var(--color-ink)] px-6 text-base font-medium text-white transition hover:bg-black active:scale-[0.98]"
              >
                {t('common.continue')}
                <IconArrowRight className="h-4 w-4" stroke={1.6} />
              </button>
            </div>
          </section>
        )}

        {/* Step 4: Evidence Upload */}
        {currentViewStep === 'Evidence' && (
          <section aria-labelledby="step-heading" className="space-y-4">
            <div className="rounded-xl bg-white p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2
                    id="step-heading"
                    ref={headingRef}
                    tabIndex={-1}
                    className="text-xl font-medium tracking-[-0.015em] text-[var(--color-ink)] focus:outline-none"
                  >
                    {t('submit.evidence.title')}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    {t('submit.evidence.subtitle')}
                  </p>
                </div>
                <span
                  className={cx(
                    'shrink-0 rounded-full px-3 py-1 text-xs font-semibold',
                    evidenceRequired
                      ? 'bg-red-100 text-red-700'
                      : 'bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)]',
                  )}
                >
                  {evidenceRequired ? t('common.required') : t('common.optional')}
                </span>
              </div>
            </div>

            {/* Safety advisory */}
            <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
              <div className="flex items-start gap-3">
                <IconAlertTriangle
                  className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
                  stroke={1.6}
                />
                <div className="text-sm leading-relaxed text-amber-800">
                  <p className="font-semibold text-amber-900">{t('submit.evidence.safetyFirst')}</p>
                  <p className="mt-0.5">{t('submit.evidence.safetyBody')}</p>
                </div>
              </div>
            </div>

            {fieldErrors.evidence ? (
              <p role="alert" className="text-sm font-medium text-red-600 px-1">
                {fieldErrors.evidence}
              </p>
            ) : null}

            {/* Camera controls */}
            <div className="rounded-xl bg-white p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-surface-alt)]">
                  <IconCamera className="h-5 w-5 text-[var(--color-text-secondary)]" stroke={1.6} />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--color-ink)]">
                    {t('submit.evidence.camera')}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {t('submit.evidence.cameraHint')}
                  </p>
                </div>
              </div>
              <CameraCapture mode="photo" onCapture={addPhoto} onError={onCameraError} />
              {localTestUploadEnabled ? (
                <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-900">
                    Local testing only
                  </p>
                  <p className="mt-1 text-xs leading-5 text-amber-800">
                    Choose an existing photo to test the report workflow. This option is hidden in
                    production.
                  </p>
                  <label
                    htmlFor="local-test-photo"
                    className="mt-3 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-amber-300 bg-white px-4 text-sm font-medium text-amber-900 transition hover:bg-amber-100"
                  >
                    <IconUpload className="mr-2 h-4 w-4" stroke={1.6} />
                    Upload test photo
                  </label>
                  <input
                    id="local-test-photo"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => void handleTestPhotoChange(event)}
                  />
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => setShowVideo((v) => !v)}
                className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full border border-[#d8d6cf] bg-[#faf9f6] px-4 text-sm font-medium text-[var(--color-ink)] transition hover:bg-white active:scale-[0.98]"
              >
                <IconCamera className="h-4 w-4" stroke={1.6} />
                {showVideo
                  ? t('submit.evidence.hideVideo')
                  : `${t('submit.evidence.recordVideo')}${selectedType?.requires_video ? t('submit.evidence.videoRequiredSuffix') : t('submit.evidence.videoOptionalSuffix')}`}
              </button>
              {showVideo ? (
                <CameraCapture mode="video" onCapture={addVideo} onError={onCameraError} />
              ) : null}
            </div>

            {/* File previews */}
            {files.length > 0 ? (
              <div className="rounded-xl bg-white p-4">
                <div className="flex items-center gap-2 mb-4">
                  <IconUpload className="h-4 w-4 text-[var(--color-text-secondary)]" stroke={1.6} />
                  <p
                    className="text-sm font-medium text-[var(--color-ink)]"
                    role="status"
                    aria-live="polite"
                  >
                    {t('submit.evidence.filesAttached', {
                      count: files.length,
                      plural: files.length === 1 ? '' : 's',
                    })}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {files.map((f, i) => (
                    <div key={i} className="relative">
                      <div className="aspect-square overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-alt)]">
                        {f.type.startsWith('image/') ? (
                          <img
                            src={previewUrls[i]}
                            alt={f.name}
                            className="h-full w-full object-cover"
                            {...evidencePreviewHandlers()}
                          />
                        ) : (
                          <video
                            src={previewUrls[i]}
                            controls
                            muted
                            preload="metadata"
                            className="h-full w-full object-contain bg-black"
                            aria-label={t('detail.video')}
                          />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-ink)] text-xs font-medium text-white transition hover:bg-red-600"
                        aria-label={t('submit.evidence.removeFile', { name: f.name })}
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
                className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-full border border-[#d8d6cf] bg-[#faf9f6] px-6 text-base font-medium text-[var(--color-ink)] transition hover:bg-white active:scale-[0.98]"
              >
                <IconArrowLeft className="h-4 w-4" stroke={1.6} />
                {t('common.back')}
              </button>
              <button
                type="button"
                onClick={handleEvidenceNext}
                className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-full bg-[var(--color-ink)] px-6 text-base font-medium text-white transition hover:bg-black active:scale-[0.98]"
              >
                {t('submit.review.title')}
                <IconArrowRight className="h-4 w-4" stroke={1.6} />
              </button>
            </div>
          </section>
        )}

        {/* Step 5: Review & Submit */}
        {currentViewStep === 'Review' && (
          <section aria-labelledby="step-heading" className="space-y-4">
            <div className="rounded-xl bg-white p-4">
              <h2
                id="step-heading"
                ref={headingRef}
                tabIndex={-1}
                className="text-xl font-medium tracking-[-0.015em] text-[var(--color-ink)] focus:outline-none"
              >
                {t('submit.review.title')}
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {t('submit.review.subtitle')}
              </p>
            </div>

            {/* Review cards */}
            <div className="rounded-xl bg-white divide-y divide-[var(--color-border-subtle)]">
              <div className="flex items-center justify-between p-4">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                    {t('submit.review.category')}
                  </p>
                  <p className="mt-1 break-words text-sm font-medium text-[var(--color-ink)]">
                    {selectedType?.name ?? t('submit.review.unknown')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => goToStep('Category')}
                  className="ml-2 inline-flex min-h-[44px] shrink-0 items-center gap-1 text-sm font-medium text-[var(--color-text-secondary)] transition hover:text-[var(--color-ink)]"
                >
                  <IconPencil className="h-3.5 w-3.5" stroke={1.6} />
                  {t('common.edit')}
                </button>
              </div>

              <div className="flex items-center justify-between p-4">
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                    {t('submit.review.titleLabel')}
                  </p>
                  <p className="mt-1 text-sm font-medium text-[var(--color-ink)] truncate">
                    {title}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => goToStep('Details')}
                  className="ml-2 inline-flex min-h-[44px] shrink-0 items-center gap-1 text-sm font-medium text-[var(--color-text-secondary)] transition hover:text-[var(--color-ink)]"
                >
                  <IconPencil className="h-3.5 w-3.5" stroke={1.6} />
                  {t('common.edit')}
                </button>
              </div>

              <div className="p-4">
                <div className="flex items-start justify-between">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                    {t('submit.review.description')}
                  </p>
                  <button
                    type="button"
                    onClick={() => goToStep('Details')}
                    className="ml-2 inline-flex min-h-[44px] shrink-0 items-center gap-1 text-sm font-medium text-[var(--color-text-secondary)] transition hover:text-[var(--color-ink)]"
                  >
                    <IconPencil className="h-3.5 w-3.5" stroke={1.6} />
                    {t('common.edit')}
                  </button>
                </div>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">
                  {description}
                </p>
              </div>

              <div className="flex items-center justify-between p-4">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                    {t('submit.review.location')}
                  </p>
                  <p className="mt-1 break-words text-sm font-medium text-[var(--color-ink)]">
                    {issueLocation
                      ? placeName || address || t('submit.location.captured')
                      : t('submit.review.locationNotCaptured')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => goToStep('Location')}
                  className="ml-2 inline-flex min-h-[44px] shrink-0 items-center gap-1 text-sm font-medium text-[var(--color-text-secondary)] transition hover:text-[var(--color-ink)]"
                >
                  <IconPencil className="h-3.5 w-3.5" stroke={1.6} />
                  {t('common.edit')}
                </button>
              </div>

              <div className="flex items-center justify-between p-4">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                    {t('submit.review.evidence')}
                  </p>
                  <p className="mt-1 text-sm font-medium text-[var(--color-ink)]">
                    {t('submit.evidence.filesAttached', {
                      count: files.length,
                      plural: files.length === 1 ? '' : 's',
                    })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => goToStep('Evidence')}
                  className="ml-2 inline-flex min-h-[44px] shrink-0 items-center gap-1 text-sm font-medium text-[var(--color-text-secondary)] transition hover:text-[var(--color-ink)]"
                >
                  <IconPencil className="h-3.5 w-3.5" stroke={1.6} />
                  {t('common.edit')}
                </button>
              </div>
            </div>

            {files.length > 0 ? (
              <div className="rounded-xl bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                      {t('submit.review.evidence')}
                    </p>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                      {t('submit.review.evidenceHint')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => goToStep('Evidence')}
                    className="inline-flex min-h-[44px] shrink-0 items-center gap-1 text-sm font-medium text-[var(--color-text-secondary)] transition hover:text-[var(--color-ink)]"
                  >
                    <IconPencil className="h-3.5 w-3.5" stroke={1.6} />
                    {t('common.edit')}
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {files.map((file, index) =>
                    file.type.startsWith('image/') ? (
                      <button
                        key={`${file.name}-${index}`}
                        type="button"
                        onClick={() => setPreviewIndex(index)}
                        className="aspect-square overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-alt)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ink)]"
                        aria-label={t('submit.evidence.viewFile', { name: file.name })}
                      >
                        <img
                          src={previewUrls[index]}
                          alt={file.name}
                          className="h-full w-full object-cover"
                          {...evidencePreviewHandlers()}
                        />
                      </button>
                    ) : (
                      <video
                        key={`${file.name}-${index}`}
                        src={previewUrls[index]}
                        controls
                        muted
                        preload="metadata"
                        className="aspect-square w-full rounded-lg border border-[var(--color-border-subtle)] bg-black object-contain"
                        aria-label={t('detail.video')}
                      />
                    ),
                  )}
                </div>
              </div>
            ) : null}

            {/* Error summary */}
            {error !== null ? (
              <div className="rounded-xl bg-red-50 p-4 ring-1 ring-red-200">
                <div className="flex items-start gap-3">
                  <IconAlertTriangle
                    className="mt-0.5 h-5 w-5 shrink-0 text-red-500"
                    stroke={1.6}
                  />
                  <p className="text-sm font-medium text-red-800">{error}</p>
                </div>
                {error.toLowerCase().includes('idempotency-key') && ownerId ? (
                  <button
                    type="button"
                    onClick={() => void discardSavedDraft()}
                    className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-red-300 bg-white px-4 text-sm font-medium text-red-800 transition hover:bg-red-100"
                  >
                    {t('submit.discard.conflictAction')}
                  </button>
                ) : null}
              </div>
            ) : null}

            {/* Submit section */}
            <div className="rounded-xl bg-white p-4 space-y-4">
              <p className="text-center text-sm text-[var(--color-text-secondary)]">
                {t('submit.review.confirmation')}
              </p>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full bg-[var(--color-ink)] px-6 text-base font-medium text-white transition hover:bg-black active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[var(--color-text-tertiary)]"
              >
                <IconFileText className="h-5 w-5" stroke={1.6} />
                {submitting ? t('submit.review.submitting') : t('submit.review.submitButton')}
              </button>
            </div>

            <button
              type="button"
              onClick={() => goToStep('Evidence')}
              className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full border border-[#d8d6cf] bg-[#faf9f6] px-6 text-base font-medium text-[var(--color-ink)] transition hover:bg-white active:scale-[0.98]"
            >
              <IconArrowLeft className="h-4 w-4" stroke={1.6} />
              {t('submit.review.backToEvidence')}
            </button>
          </section>
        )}

        {previewIndex !== null && files[previewIndex]?.type.startsWith('image/') ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            role="dialog"
            aria-modal="true"
            aria-label={t('submit.evidence.previewTitle')}
          >
            <button
              type="button"
              className="absolute inset-0 h-full w-full cursor-default"
              onClick={() => setPreviewIndex(null)}
              aria-label={t('submit.evidence.closePreview')}
            />
            <div className="relative z-10 max-h-full max-w-3xl">
              <img
                src={previewUrls[previewIndex]}
                alt={files[previewIndex]?.name ?? ''}
                className="max-h-[85vh] max-w-full rounded-xl object-contain"
                {...evidencePreviewHandlers()}
              />
              <button
                type="button"
                onClick={() => setPreviewIndex(null)}
                className="absolute -right-2 -top-2 flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl text-[var(--color-ink)] shadow-lg"
                aria-label={t('common.close')}
              >
                ×
              </button>
            </div>
          </div>
        ) : null}
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
