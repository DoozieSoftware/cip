<?php

declare(strict_types=1);

use App\Modules\Reports\Http\Requests\SubmitReportRequest;
use App\Modules\Reports\Models\ReportType;
use App\Modules\Users\Models\User;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Validator;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new RolesAndPermissionsSeeder)->run();
    (new ReportStatusesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();
    (new ReportTypesSeeder)->run();
});

function buildPayload(?ReportType $type = null, array $overrides = []): array
{
    /** @var ReportType $type */
    $type ??= ReportType::query()->firstOrFail();

    return array_merge([
        'report_type_id' => $type->id,
        'title' => 'Pothole on 5th Avenue',
        'description' => 'A large pothole outside the school gate.',
        'is_anonymous' => false,
        'latitude' => 12.9716,
        'longitude' => 77.5946,
        'accuracy' => 10.0,
    ], $overrides);
}

it('accepts a valid submit payload', function (): void {
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    $request = SubmitReportRequest::create('/api/v1/reports', 'POST', buildPayload());
    $request->setContainer(app());
    $request->setRedirector(app('redirect'));

    $validator = Validator::make($request->all(), $request->rules(), $request->messages());

    expect($validator->fails())->toBeFalse();
});

it('rejects out-of-range latitude and longitude', function (): void {
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    $request = SubmitReportRequest::create('/api/v1/reports', 'POST', buildPayload(null, [
        'latitude' => 95.0,
    ]));
    $request->setContainer(app());
    $request->setRedirector(app('redirect'));

    $validator = Validator::make($request->all(), $request->rules(), $request->messages());
    expect($validator->fails())->toBeTrue()
        ->and($validator->errors()->has('latitude'))->toBeTrue();

    $request2 = SubmitReportRequest::create('/api/v1/reports', 'POST', buildPayload(null, [
        'longitude' => 200.0,
    ]));
    $validator2 = Validator::make($request2->all(), $request2->rules(), $request2->messages());
    expect($validator2->fails())->toBeTrue()
        ->and($validator2->errors()->has('longitude'))->toBeTrue();
});

it('rejects GPS accuracy above 100m', function (): void {
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    $request = SubmitReportRequest::create('/api/v1/reports', 'POST', buildPayload(null, [
        'accuracy' => 250.0,
    ]));
    $request->setContainer(app());
    $request->setRedirector(app('redirect'));

    $validator = Validator::make($request->all(), $request->rules(), $request->messages());
    expect($validator->fails())->toBeTrue()
        ->and($validator->errors()->has('accuracy'))->toBeTrue();
});

it('rejects unknown report_type_id', function (): void {
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    $request = SubmitReportRequest::create('/api/v1/reports', 'POST', buildPayload(null, [
        'report_type_id' => '00000000-0000-0000-0000-000000000000',
    ]));
    $request->setContainer(app());
    $request->setRedirector(app('redirect'));

    $validator = Validator::make($request->all(), $request->rules(), $request->messages());
    expect($validator->fails())->toBeTrue()
        ->and($validator->errors()->has('report_type_id'))->toBeTrue();
});

it('rejects short title and description', function (): void {
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    $request = SubmitReportRequest::create('/api/v1/reports', 'POST', buildPayload(null, [
        'title' => 'a',
        'description' => 'b',
    ]));
    $request->setContainer(app());
    $request->setRedirector(app('redirect'));

    $validator = Validator::make($request->all(), $request->rules(), $request->messages());
    expect($validator->fails())->toBeTrue()
        ->and($validator->errors()->has('title'))->toBeTrue()
        ->and($validator->errors()->has('description'))->toBeTrue();
});

it('rejects the request when the user is not authenticated', function (): void {
    $request = SubmitReportRequest::create('/api/v1/reports', 'POST', buildPayload());
    $request->setContainer(app());
    $request->setRedirector(app('redirect'));
    $request->setUserResolver(static fn () => null);

    expect($request->authorize())->toBeFalse();
});
