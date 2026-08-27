<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Http\Controllers;

use App\Modules\Departments\Models\Department;
use App\Modules\Departments\Services\OperationDepartmentResolver;
use App\Modules\Media\Support\MediaUrl;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Http\Controllers\BaseController;
use App\Modules\TextileCollections\DTO\TextileCollectionInput;
use App\Modules\TextileCollections\Http\Requests\ApproveTextileCollectionRequest;
use App\Modules\TextileCollections\Http\Requests\AssignTextileBatchRequest;
use App\Modules\TextileCollections\Http\Requests\CreateCollectionBatchRequest;
use App\Modules\TextileCollections\Http\Requests\RecordCollectionOutcomeRequest;
use App\Modules\TextileCollections\Http\Requests\RecordDropoffReceiptRequest;
use App\Modules\TextileCollections\Http\Requests\ReorderTextileBatchStopsRequest;
use App\Modules\TextileCollections\Http\Requests\StoreTextileCollectionRequest;
use App\Modules\TextileCollections\Http\Requests\UpdateTextileZoneRequest;
use App\Modules\TextileCollections\Http\Requests\UploadTextilePhotoRequest;
use App\Modules\TextileCollections\Http\Resources\TextileCollectionResource;
use App\Modules\TextileCollections\Http\Resources\TextileServiceZoneResource;
use App\Modules\TextileCollections\Models\TextileCollectionBatch;
use App\Modules\TextileCollections\Models\TextileCollectionRequest;
use App\Modules\TextileCollections\Models\TextileServiceZone;
use App\Modules\TextileCollections\Services\TextileCollectionMediaService;
use App\Modules\TextileCollections\Services\TextileCollectionOperationsService;
use App\Modules\TextileCollections\Services\TextileCollectionService;
use App\Modules\TextileCollections\Services\TextileReceiptService;
use App\Modules\TextileCollections\Services\TextileTripService;
use App\Modules\Users\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class TextileCollectionController extends BaseController
{
    public function __construct(
        private readonly OperationDepartmentResolver $departments,
        private readonly TextileCollectionOperationsService $operations,
        private readonly TextileCollectionService $collections,
        private readonly TextileCollectionMediaService $mediaService,
        private readonly MediaUrl $mediaUrl,
        private readonly TextileReceiptService $receipts,
        private readonly TextileTripService $trips,
    ) {}

    public function zones(Request $request): JsonResponse
    {
        $query = TextileServiceZone::query()
            ->where('active', true)
            ->with('department')
            ->orderBy('name');

        $category = $request->query('category');

        if (is_string($category) && $category !== '' && in_array($category, TextileCollectionRequest::VALID_CATEGORIES, true)) {
            // Only zones whose owner-partner has a capability for the requested category.
            $query->whereHas('department', function ($deptQuery) use ($category): void {
                $deptQuery->whereHas('textilePartnerCapabilities', function ($capQuery) use ($category): void {
                    $capQuery->where('category', $category);
                });
            });
        }

        $zones = $query->get();

        return $this->respond(TextileServiceZoneResource::collection($zones)->resolve($request));
    }

    public function store(StoreTextileCollectionRequest $request): JsonResponse
    {
        $user = $this->authenticatedUser($request);
        $data = $request->validated();
        $collection = $this->collections->create(
            citizen: $user,
            input: TextileCollectionInput::fromValidated($data),
            title: $this->stringValue($data, 'title'),
            notes: $this->optionalString($data, 'notes'),
            latitude: $this->optionalFloat($data, 'latitude'),
            longitude: $this->optionalFloat($data, 'longitude'),
        );

        $collection->load(['citizen', 'serviceZone', 'batch', 'photos', 'department']);

        return $this->respond(
            (new TextileCollectionResource($collection))->toArray($request),
            'Collection request submitted.',
            201,
        );
    }

    public function citizenIndex(Request $request): JsonResponse
    {
        $user = $this->authenticatedUser($request);
        $items = TextileCollectionRequest::query()
            ->where('citizen_id', $user->id)
            ->with(['serviceZone', 'batch', 'photos', 'department'])
            ->latest('created_at')
            ->get();

        return $this->respond(TextileCollectionResource::collection($items)->resolve($request));
    }

    public function citizenShow(TextileCollectionRequest $collection, Request $request): JsonResponse
    {
        $user = $this->authenticatedUser($request);

        if ((string) $collection->citizen_id !== (string) $user->id) {
            throw ApiException::forbidden('You cannot view this collection request.');
        }

        return $this->respond((new TextileCollectionResource($collection->load(['serviceZone', 'batch', 'photos', 'department'])))->toArray($request));
    }

    public function index(Request $request): JsonResponse
    {
        $resolved = $this->assertCollectionPartner($request);

        $status = $request->query('status');
        $zoneId = $request->query('service_zone_id');
        $search = $request->query('search');
        $category = $request->query('category');
        $method = $request->query('method') ?? $request->query('collection_method');

        // Accept a single status or a comma-separated list so the desk can
        // request grouped views (e.g. `picked_up,missed,rejected,cancelled`).
        $statuses = is_string($status) && $status !== ''
            ? array_values(array_filter(array_map('trim', explode(',', $status))))
            : [];

        $page = TextileCollectionRequest::query()
            ->with(['citizen', 'serviceZone', 'batch', 'photos', 'department'])
            ->where('department_id', $resolved->id)
            ->when($statuses !== [], fn ($query) => $query->whereIn('status', $statuses))
            ->when(is_string($zoneId) && $zoneId !== '', fn ($query) => $query->where('service_zone_id', $zoneId))
            ->when(
                is_string($category) && $category !== '' && in_array($category, TextileCollectionRequest::VALID_CATEGORIES, true),
                fn ($query) => $query->where('category', $category),
            )
            ->when(is_string($method) && in_array($method, ['dropoff','premises'], true), fn ($q) => $q->where('collection_method', $method))
            ->when(is_string($search) && trim($search) !== '', function ($query) use ($search): void {
                $needle = '%'.str_replace('%', '\%', trim($search)).'%';
                $query->where(function ($inner) use ($needle): void {
                    $inner->where('reference', 'like', $needle)
                        ->orWhere('requester_name', 'like', $needle)
                        ->orWhere('contact_phone', 'like', $needle)
                        ->orWhere('title', 'like', $needle);
                });
            })
            ->orderByRaw('scheduled_date is null desc')
            ->orderBy('scheduled_date')
            ->orderBy('created_at')
            ->paginate(max(1, min(200, (int) $request->query('per_page', 25))));

        $items = collect($page->items())->map(function (TextileCollectionRequest $collection) use ($request): array {
            $payload = (new TextileCollectionResource($collection))->toArray($request);

            return $payload;
        })->all();

        return $this->respond($items, 'OK', 200, [
            'page' => $page->currentPage(),
            'per_page' => $page->perPage(),
            'total' => $page->total(),
            'last_page' => $page->lastPage(),
        ]);
    }

    public function show(TextileCollectionRequest $collection, Request $request): JsonResponse
    {
        $this->assertCollectionPartner($request, $collection);

        return $this->respond((new TextileCollectionResource($collection->load(['citizen', 'serviceZone', 'batch', 'photos', 'department'])))->toArray($request));
    }

    public function approve(TextileCollectionRequest $collection, ApproveTextileCollectionRequest $request): JsonResponse
    {
        $this->assertCollectionPartner($request, $collection);
        $data = $request->validated();
        $updated = $this->operations->approve($collection, $this->authenticatedUser($request));
        // TODO D-01 validity window from request not yet wired to confirmDropoff overload
        return $this->respond((new TextileCollectionResource($updated->load(['photos', 'department'])))->toArray($request), 'Collection request approved.');
    }

    public function lookupByReference(Request $request): JsonResponse
    {
        $this->assertCollectionPartner($request);
        $ref = (string) $request->query('reference', '');
        $item = TextileCollectionRequest::query()->where('reference', $ref)->with(['serviceZone','batch','department'])->first();
        if ($item === null) { throw ApiException::validation('Reference not found.'); }
        return $this->respond((new TextileCollectionResource($item))->toArray($request));
    }

    public function recordReceipt(TextileServiceZone $zone, RecordDropoffReceiptRequest $request): JsonResponse
    {
        $this->assertCollectionPartner($request);
        $data = $request->validated();
        $collectionId = (string) $request->input('collection_request_id', '');
        $collection = TextileCollectionRequest::query()->findOrFail($collectionId);
        $receipt = $this->receipts->record($collection, $this->authenticatedUser($request), $data['actual_bags'] ?? null, isset($data['actual_weight_kg']) ? (float) $data['actual_weight_kg'] : null, $data['proof_media_id'] ?? null, $data['exception_code'] ?? null, $data['exception_reason'] ?? null, $request->header('Idempotency-Key'));
        return $this->respond(['id' => $receipt->id, 'collection_request_id' => $receipt->collection_request_id], 'Receipt recorded.', 201);
    }

    public function assignTrip(TextileCollectionBatch $batch, AssignTextileBatchRequest $request): JsonResponse
    {
        $dept = $this->assertCollectionPartner($request);
        $this->assertBatchOwnership($batch, $dept->id);
        $data = $request->validated();
        $updated = $this->trips->assign($batch, $this->authenticatedUser($request), $data['assigned_team_id'] ?? null, $data['assigned_user_id'] ?? null, $data['vehicle_label'] ?? null, $data['reason'] ?? null);
        return $this->respond(['id' => $updated->id, 'status' => $updated->status], 'Trip assigned.');
    }

    public function startTrip(TextileCollectionBatch $batch, Request $request): JsonResponse
    {
        $dept = $this->assertCollectionPartner($request);
        $this->assertBatchOwnership($batch, $dept->id);
        $updated = $this->trips->start($batch, $this->authenticatedUser($request));
        return $this->respond(['id' => $updated->id, 'status' => $updated->status], 'Trip started.');
    }

    public function completeTrip(TextileCollectionBatch $batch, Request $request): JsonResponse
    {
        $dept = $this->assertCollectionPartner($request);
        $this->assertBatchOwnership($batch, $dept->id);
        $updated = $this->trips->complete($batch, $this->authenticatedUser($request));
        return $this->respond(['id' => $updated->id, 'status' => $updated->status], 'Trip completed.');
    }

    public function reorderStops(TextileCollectionBatch $batch, ReorderTextileBatchStopsRequest $request): JsonResponse
    {
        $dept = $this->assertCollectionPartner($request);
        $this->assertBatchOwnership($batch, $dept->id);
        $data = $request->validated();
        $updated = $this->trips->reorder($batch, $this->authenticatedUser($request), $data['ordered_ids']);
        return $this->respond(['id' => $updated->id], 'Stops reordered.');
    }

    public function myTrips(Request $request): JsonResponse
    {
        $user = $this->authenticatedUser($request);
        $batches = TextileCollectionBatch::query()->where('assigned_user_id', $user->id)->with(['serviceZone','requests'])->orderBy('collection_date')->get();
        return $this->respond($batches->toArray());
    }

    public function schedule(CreateCollectionBatchRequest $request): JsonResponse
    {
        $this->assertCollectionPartner($request);
        $user = $this->authenticatedUser($request);
        $data = $request->validated();

        $ids = $this->stringList($data, 'collection_request_ids');

        $batch = $this->operations->scheduleBatch(
            serviceZoneId: $this->stringValue($data, 'service_zone_id'),
            collectionRequestIds: $ids,
            collectionDate: $this->stringValue($data, 'collection_date'),
            windowStart: $this->optionalString($data, 'window_start'),
            windowEnd: $this->optionalString($data, 'window_end'),
            tripReference: $this->optionalString($data, 'trip_reference'),
            instructions: $this->optionalString($data, 'instructions'),
            actor: $user,
        );

        $requests = $batch->requests()
            ->with(['serviceZone', 'batch', 'department'])
            ->get()
            ->map(fn (TextileCollectionRequest $c): array => (new TextileCollectionResource($c->load('photos')))->toArray($request))
            ->all();

        return $this->respond([
            'id' => $batch->id,
            'reference' => $batch->reference,
            'service_zone_id' => $batch->service_zone_id,
            'collection_date' => $batch->collection_date->toDateString(),
            'window_start' => $batch->window_start,
            'window_end' => $batch->window_end,
            'status' => $batch->status,
            'trip_reference' => $batch->trip_reference,
            'instructions' => $batch->instructions,
            'created_by' => $batch->created_by,
            'request_count' => count($requests),
            'requests' => $requests,
        ], 'Batch scheduled.', 201);
    }

    public function recordOutcome(TextileCollectionRequest $collection, RecordCollectionOutcomeRequest $request): JsonResponse
    {
        $this->assertCollectionPartner($request, $collection);
        $user = $this->authenticatedUser($request);

        $data = $request->validated();

        $updated = $this->operations->recordOutcome(
            collection: $collection,
            outcome: $this->stringValue($data, 'outcome'),
            actualBags: $this->optionalInt($data, 'actual_bags'),
            actualWeightKg: $this->optionalFloat($data, 'actual_weight_kg'),
            reason: $this->optionalString($data, 'reason'),
            actor: $user,
        );

        return $this->respond(
            (new TextileCollectionResource($updated->load(['photos', 'department'])))->toArray($request),
            'Outcome recorded.',
        );
    }

    public function citizenCancel(TextileCollectionRequest $collection, Request $request): JsonResponse
    {
        $user = $this->authenticatedUser($request);

        if ((string) $collection->citizen_id !== (string) $user->id) {
            throw ApiException::forbidden('You cannot cancel this collection request.');
        }

        /** @var array<string, mixed> $data */
        $data = $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:500'],
        ]);
        $reason = '';

        if (array_key_exists('reason', $data) && is_string($data['reason'])) {
            $reason = $data['reason'];
        }

        if (in_array($collection->status, [
            TextileCollectionRequest::STATUS_PICKED_UP,
            TextileCollectionRequest::STATUS_CANCELLED,
            TextileCollectionRequest::STATUS_REJECTED,
        ], true)) {
            throw ApiException::validation('This collection request can no longer be cancelled.');
        }

        $updated = $this->operations->recordOutcome(
            collection: $collection,
            outcome: 'cancelled',
            actualBags: null,
            actualWeightKg: null,
            reason: $reason,
            actor: $user,
        );

        return $this->respond(
            (new TextileCollectionResource($updated->load(['photos', 'department'])))->toArray($request),
            'Collection request cancelled.',
        );
    }

    /**
     * Citizen uploads an evidence photo for their textile collection request.
     *
     * POST /api/v1/citizen/textile-collections/{collection}/photo
     */
    public function uploadCitizenPhoto(
        TextileCollectionRequest $collection,
        UploadTextilePhotoRequest $request,
    ): JsonResponse {
        $user = $this->authenticatedUser($request);

        if ((string) $collection->citizen_id !== (string) $user->id) {
            throw ApiException::forbidden('You cannot upload photos for this collection request.');
        }

        /** @var UploadedFile $file */
        $file = $request->file('photo');

        $media = $this->mediaService->uploadEvidence(
            collectionId: $collection->id,
            file: $file,
            uploaderId: (string) $user->id,
        );

        return $this->respond(
            [
                'photo' => [
                    'id' => $media->id,
                    'role' => $media->role,
                    'url' => $this->mediaUrl->temporary($media),
                ],
            ],
            'Photo uploaded.',
            201,
        );
    }

    /**
     * Staff uploads a proof photo for a textile collection request.
     *
     * POST /api/v1/department/textile-collections/{collection}/proof
     */
    public function uploadStaffProof(
        TextileCollectionRequest $collection,
        UploadTextilePhotoRequest $request,
    ): JsonResponse {
        $this->assertCollectionPartner($request, $collection);
        $user = $this->authenticatedUser($request);

        /** @var UploadedFile $file */
        $file = $request->file('photo');

        $media = $this->mediaService->uploadProof(
            collectionId: $collection->id,
            file: $file,
            uploaderId: (string) $user->id,
        );

        return $this->respond(
            [
                'photo' => [
                    'id' => $media->id,
                    'role' => $media->role,
                    'url' => $this->mediaUrl->temporary($media),
                ],
            ],
            'Proof photo uploaded.',
            201,
        );
    }

    public function report(Request $request): JsonResponse
    {
        $resolved = $this->assertCollectionPartner($request);

        $year = max(2020, (int) $request->query('year', (int) now()->format('Y')));
        $month = $request->query('month');

        $base = TextileCollectionRequest::query()
            // Qualified columns: the zone-breakdown query joins
            // textile_service_zones, which also has a department_id.
            ->where('textile_collection_requests.department_id', $resolved->id);

        if (is_string($month) && ctype_digit($month)) {
            $monthInt = max(1, min(12, (int) $month));
            $start = Carbon::createFromDate($year, $monthInt, 1)->startOfMonth();
            $end = $start->copy()->endOfMonth();
        } else {
            $start = Carbon::createFromDate($year, 1, 1)->startOfYear();
            $end = Carbon::createFromDate($year, 12, 31)->endOfYear();
        }

        $base->whereBetween('textile_collection_requests.created_at', [$start, $end]);

        $requestersServed = $base->clone()
            ->distinct('contact_email')
            ->count('contact_email');

        $totalVolumeKg = $base->clone()->sum('actual_weight_kg');
        $totalVolumeKgEstimate = $base->clone()->sum('estimated_weight_kg');

        $totalBagsCollected = $base->clone()->sum('actual_bags');
        $totalBagsEstimate = $base->clone()->sum('estimated_bags');

        $tripCount = TextileCollectionBatch::query()
            ->whereHas('requests', fn ($q) => $q->where('department_id', $resolved->id))
            ->whereBetween('collection_date', [$start->toDateString(), $end->toDateString()])
            ->count();

        $statusBreakdown = $base->clone()
            ->select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status')
            ->all();

        $zoneBreakdown = $base->clone()
            ->join('textile_service_zones', 'textile_collection_requests.service_zone_id', '=', 'textile_service_zones.id')
            ->select('textile_service_zones.name as zone_name', DB::raw('count(*) as count'))
            ->groupBy('textile_service_zones.name')
            ->pluck('count', 'zone_name')
            ->all();

        $categoryBreakdown = $base->clone()
            ->select('category', DB::raw('count(*) as count'))
            ->groupBy('category')
            ->pluck('count', 'category')
            ->all();

        return $this->respond([
            'period' => [
                'year' => $year,
                'month' => $month !== null && ctype_digit((string) $month) ? (int) $month : null,
                'start' => $start->toDateString(),
                'end' => $end->toDateString(),
            ],
            'requesters_served' => $requestersServed,
            'total_volume_kg' => (float) $totalVolumeKg,
            'estimated_volume_kg' => (float) $totalVolumeKgEstimate,
            'total_bags_collected' => (int) $totalBagsCollected,
            'estimated_bags' => (int) $totalBagsEstimate,
            'collection_trips' => $tripCount,
            'status_breakdown' => $statusBreakdown,
            'zone_breakdown' => $zoneBreakdown,
            'category_breakdown' => $categoryBreakdown,
        ]);
    }

    /**
     * Resolve the working department, verify it is a collection partner,
     * and optionally verify a request belongs to it.
     */
    private function assertBatchOwnership(TextileCollectionBatch $batch, string $departmentId): void
    {
        $batch->loadMissing('serviceZone');
        $zoneDept = $batch->serviceZone?->department_id;
        if ($zoneDept !== null && (string) $zoneDept !== $departmentId) {
            throw ApiException::forbidden('This trip belongs to another partner.');
        }
        // TODO D-05/D-06 OPEN: zone-ownership + capacity override rules pending decision.
    }

    private function assertCollectionPartner(Request $request, ?TextileCollectionRequest $collection = null): Department
    {
        $user = $this->authenticatedUser($request);
        $requested = $request->query('department_id');
        $department = $this->departments->resolve(
            $user,
            is_string($requested) && $requested !== '' ? $requested : null,
        );

        // Department must have at least one capability row.
        $isPartner = DB::table('textile_partner_capabilities')
            ->where('department_id', $department->id)
            ->exists();

        if (! $isPartner) {
            throw ApiException::forbidden('Not a collection partner.');
        }

        // If a specific collection request is given, verify ownership.
        if ($collection !== null && (string) $collection->department_id !== (string) $department->id) {
            throw ApiException::forbidden('This request belongs to another collection partner.');
        }

        return $department;
    }

    private function authenticatedUser(Request $request): User
    {
        $user = $request->user();

        if (! $user instanceof User) {
            throw ApiException::unauthorized('Authentication required.');
        }

        return $user;
    }

    /**
     * @param  array<mixed, mixed>  $data
     */
    private function stringValue(array $data, string $key): string
    {
        if (! array_key_exists($key, $data)) {
            return '';
        }

        $value = $data[$key];

        return is_string($value) ? $value : (is_scalar($value) ? (string) $value : '');
    }

    /**
     * @param  array<mixed, mixed>  $data
     */
    private function optionalString(array $data, string $key): ?string
    {
        $value = $data[$key] ?? null;

        return is_string($value) && $value !== '' ? $value : null;
    }

    /**
     * @param  array<mixed, mixed>  $data
     */
    private function optionalInt(array $data, string $key): ?int
    {
        $value = $data[$key] ?? null;

        return is_numeric($value) ? (int) $value : null;
    }

    /**
     * @param  array<mixed, mixed>  $data
     */
    private function optionalFloat(array $data, string $key): ?float
    {
        $value = $data[$key] ?? null;

        return is_numeric($value) ? (float) $value : null;
    }

    /**
     * @param  array<mixed, mixed>  $data
     * @return list<string>
     */
    private function stringList(array $data, string $key): array
    {
        $value = $data[$key] ?? [];

        if (! is_array($value)) {
            return [];
        }

        $out = [];

        foreach ($value as $item) {
            if (is_string($item)) {
                $out[] = $item;
            } elseif (is_numeric($item)) {
                $out[] = (string) $item;
            }
        }

        return $out;
    }

    /**
     * Update drop-off details for a service zone owned by the staff's partner.
     */
    public function updateZone(TextileServiceZone $zone, UpdateTextileZoneRequest $request): JsonResponse
    {
        $this->assertCollectionPartner($request, null);

        // Verify the zone belongs to the staff's working department.
        $resolved = $this->departments->resolve(
            $this->authenticatedUser($request),
            $request->query('department_id'),
        );

        if ($zone->department_id !== null && (string) $zone->department_id !== (string) $resolved->id) {
            throw ApiException::forbidden('This zone belongs to another partner.');
        }

        $data = $request->validated();

        $before = $zone->only(['dropoff_name','dropoff_address','centre_status','public_phone']);
        $updates = [];
        foreach (['dropoff_name','dropoff_address','operating_hours','public_phone','centre_status','centre_closed_note','receipt_requires_photo','receipt_requires_bags','receipt_requires_weight','max_open_dropoffs_per_citizen'] as $field) {
            if (array_key_exists($field, $data)) { $updates[$field] = $data[$field]; }
        }
        if ($updates !== []) { $zone->update($updates); }

        AuditLog::query()->create([
            'user_id' => (string) $this->authenticatedUser($request)->id,
            'entity' => 'textile_service_zone',
            'entity_id' => $zone->id,
            'action' => 'textile.update_zone',
            'before' => $before,
            'after' => [
                'dropoff_name' => $zone->fresh()->dropoff_name,
                'dropoff_address' => $zone->fresh()->dropoff_address,
            ],
            'ip' => $request->ip(),
            'device_fingerprint' => null,
            'request_id' => $request->attributes->get('trace_id'),
            'created_at' => now(),
        ]);

        return $this->respond(
            (new TextileServiceZoneResource($zone->fresh()))->toArray($request),
            'Drop-off details updated.',
        );
    }
}
