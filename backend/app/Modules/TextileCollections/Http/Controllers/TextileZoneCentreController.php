<?php

declare(strict_types=1);

namespace App\Modules\TextileCollections\Http\Controllers;

use App\Modules\Departments\Models\Department;
use App\Modules\Departments\Services\OperationDepartmentResolver;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Http\Controllers\BaseController;
use App\Modules\TextileCollections\Http\Requests\StoreTextileDropoffCentreRequest;
use App\Modules\TextileCollections\Http\Requests\StoreTextileZoneRequest;
use App\Modules\TextileCollections\Http\Requests\UpdateTextileDropoffCentreRequest;
use App\Modules\TextileCollections\Http\Resources\TextileDropoffCentreResource;
use App\Modules\TextileCollections\Http\Resources\TextileServiceZoneResource;
use App\Modules\TextileCollections\Models\TextileDropoffCentre;
use App\Modules\TextileCollections\Models\TextileServiceZone;
use App\Modules\TextileCollections\Services\TextileDropoffCentreService;
use App\Modules\Users\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Partner-scoped management of service zones and drop-off centres (issue #11).
 *
 * Controllers coordinate only: validation lives in Form Requests,
 * authorization in the textile.manage_centre gate plus per-zone ownership
 * checks, business logic and audit logging in TextileDropoffCentreService.
 */
final class TextileZoneCentreController extends BaseController
{
    public function __construct(
        private readonly OperationDepartmentResolver $departments,
        private readonly TextileDropoffCentreService $centres,
    ) {}

    /**
     * Partner-scoped zone list with centres for the Dr Linen desk.
     */
    public function staffZones(Request $request): JsonResponse
    {
        $resolved = $this->assertCollectionPartner($request);
        $zones = $this->centres->listZones($resolved->id);

        return $this->respond(TextileServiceZoneResource::collection($zones)->resolve($request));
    }

    public function storeZone(StoreTextileZoneRequest $request): JsonResponse
    {
        $resolved = $this->assertCollectionPartner($request);
        $zone = $this->centres->createZone($resolved->id, $request->validated(), $this->authenticatedUser($request));

        return $this->respond(
            (new TextileServiceZoneResource($zone))->toArray($request),
            'Service zone created.',
            201,
        );
    }

    /**
     * Centres of one partner-owned zone for the Dr Linen desk.
     */
    public function staffCentres(TextileServiceZone $zone, Request $request): JsonResponse
    {
        $resolved = $this->assertCollectionPartner($request);
        $items = $this->centres->listCentres($resolved->id, $zone->id);

        return $this->respond(TextileDropoffCentreResource::collection($items)->resolve($request));
    }

    public function storeCentre(TextileServiceZone $zone, StoreTextileDropoffCentreRequest $request): JsonResponse
    {
        $resolved = $this->assertCollectionPartner($request);
        $centre = $this->centres->createCentre($resolved->id, $zone->id, $request->validated(), $this->authenticatedUser($request));

        return $this->respond(
            (new TextileDropoffCentreResource($centre))->toArray($request),
            'Drop-off centre created.',
            201,
        );
    }

    public function updateCentre(TextileDropoffCentre $centre, UpdateTextileDropoffCentreRequest $request): JsonResponse
    {
        $resolved = $this->assertCollectionPartner($request);
        $updated = $this->centres->updateCentre($centre, $resolved->id, $request->validated(), $this->authenticatedUser($request));

        return $this->respond(
            (new TextileDropoffCentreResource($updated))->toArray($request),
            'Drop-off centre updated.',
        );
    }

    /**
     * Resolve the working department and verify it is a collection partner.
     */
    private function assertCollectionPartner(Request $request): Department
    {
        $user = $this->authenticatedUser($request);
        $requested = $request->query('department_id');
        $department = $this->departments->resolve(
            $user,
            is_string($requested) && $requested !== '' ? $requested : null,
        );

        $isPartner = DB::table('textile_partner_capabilities')
            ->where('department_id', $department->id)
            ->exists();

        if (! $isPartner) {
            throw ApiException::forbidden('Not a collection partner.');
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
}
