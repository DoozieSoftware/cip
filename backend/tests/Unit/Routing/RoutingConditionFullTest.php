<?php

declare(strict_types=1);

use App\Modules\Departments\Models\City;
use App\Modules\Departments\Models\Country;
use App\Modules\Departments\Models\District;
use App\Modules\Departments\Models\State;
use App\Modules\Departments\Models\Ward;
use App\Modules\Reports\Models\Location;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportPriority;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Reports\Models\ReportType;
use App\Modules\Routing\Services\RoutingCondition;
use Database\Seeders\ReportPrioritiesSeeder;
use Database\Seeders\ReportStatusesSeeder;
use Database\Seeders\ReportTypesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    (new ReportStatusesSeeder)->run();
    (new ReportTypesSeeder)->run();
    (new ReportPrioritiesSeeder)->run();

    $this->country = Country::query()->create([
        'id' => (string) Str::uuid(),
        'name' => 'India',
        'iso2' => 'IN',
        'iso3' => 'IND',
        'active' => true,
    ]);
    $this->state = State::query()->create([
        'id' => (string) Str::uuid(),
        'country_id' => $this->country->id,
        'name' => 'Karnataka',
        'code' => 'KA',
        'active' => true,
    ]);
    $this->district = District::query()->create([
        'id' => (string) Str::uuid(),
        'state_id' => $this->state->id,
        'name' => 'Bengaluru Urban',
        'code' => 'KA_BLR',
        'active' => true,
    ]);
    $this->city = City::query()->create([
        'id' => (string) Str::uuid(),
        'district_id' => $this->district->id,
        'name' => 'Bengaluru',
        'code' => 'BLR',
        'active' => true,
    ]);
    $this->ward = Ward::query()->create([
        'id' => (string) Str::uuid(),
        'city_id' => $this->city->id,
        'zone_id' => null,
        'ward_number' => 112,
        'name' => 'Ward 112',
        'municipality' => 'BBMP',
        'active' => true,
    ]);

    $this->garbage = ReportType::query()->where('code', 'garbage')->firstOrFail();
    $this->pothole = ReportType::query()->where('code', 'pothole')->firstOrFail();
    $this->high = ReportPriority::query()->where('code', 'high')->firstOrFail();
    $this->medium = ReportPriority::query()->where('code', 'medium')->firstOrFail();

    $this->location = Location::query()->create([
        'id' => (string) Str::uuid(),
        'ward_id' => $this->ward->id,
        'district_id' => $this->district->id,
        'latitude' => 12.97,
        'longitude' => 77.59,
        'accuracy_m' => 10.0,
    ]);

    $this->report = Report::query()->create([
        'id' => (string) Str::uuid(),
        'citizen_id' => null,
        'report_type_id' => $this->garbage->id,
        'current_status_id' => ReportStatus::query()->where('code', 'ai_processing')->firstOrFail()->id,
        'priority_id' => $this->high->id,
        'location_id' => $this->location->id,
        'workflow_id' => null,
        'title' => 'Overflowing bin on 5th Main',
        'description' => 'Garbage has been piling up for 3 days. The smell is unbearable.',
        'submitted_at' => Carbon::create(2026, 6, 27, 10, 30),
    ]);

    $this->engine = new RoutingCondition;
});

it('returns true for an empty rule (catch-all)', function (): void {
    expect($this->engine->evaluate([], $this->report))->toBeTrue();
});

it('matches category_in when the report type code is in the list', function (): void {
    expect($this->engine->evaluate(['category_in' => ['garbage', 'pothole']], $this->report))->toBeTrue();
});

it('rejects category_in when the report type code is not in the list', function (): void {
    expect($this->engine->evaluate(['category_in' => ['pothole']], $this->report))->toBeFalse();
});

it('rejects category_in when the report has no type', function (): void {
    $this->report->setRelation('reportType', null);
    expect($this->engine->evaluate(['category_in' => ['garbage']], $this->report))->toBeFalse();
});

it('matches ward_in when the location.ward_id is in the list', function (): void {
    expect($this->engine->evaluate(['ward_in' => [$this->ward->id, 'other-ward']], $this->report))->toBeTrue();
});

it('rejects ward_in when the ward id is not in the list', function (): void {
    expect($this->engine->evaluate(['ward_in' => ['unrelated-ward']], $this->report))->toBeFalse();
});

it('rejects ward_in when the location has no ward', function (): void {
    $this->report->setRelation('location', null);
    expect($this->engine->evaluate(['ward_in' => [$this->ward->id]], $this->report))->toBeFalse();
});

it('matches district_in when the location.district_id is in the list', function (): void {
    expect($this->engine->evaluate(['district_in' => [$this->district->id]], $this->report))->toBeTrue();
});

it('rejects district_in when the district id is not in the list', function (): void {
    expect($this->engine->evaluate(['district_in' => ['unrelated-district']], $this->report))->toBeFalse();
});

it('matches severity_in when the priority code is in the list', function (): void {
    expect($this->engine->evaluate(['severity_in' => ['high', 'critical']], $this->report))->toBeTrue();
});

it('rejects severity_in when the priority code is not in the list', function (): void {
    expect($this->engine->evaluate(['severity_in' => ['low']], $this->report))->toBeFalse();
});

it('matches keyword_match case-insensitively in title or description', function (): void {
    expect($this->engine->evaluate(['keyword_match' => ['overflowing']], $this->report))->toBeTrue()
        ->and($this->engine->evaluate(['keyword_match' => ['UNBEARABLE']], $this->report))->toBeTrue()
        ->and($this->engine->evaluate(['keyword_match' => ['pothole']], $this->report))->toBeFalse();
});

it('time_of_day_between returns true when the report time falls inside the window', function (): void {
    $this->report->submitted_at = Carbon::create(2026, 6, 27, 14, 0);
    expect($this->engine->evaluate(['time_of_day_between' => ['09:00', '17:00']], $this->report))->toBeTrue();
});

it('time_of_day_between returns false when the report time is outside the window', function (): void {
    $this->report->submitted_at = Carbon::create(2026, 6, 27, 8, 0);
    expect($this->engine->evaluate(['time_of_day_between' => ['09:00', '17:00']], $this->report))->toBeFalse();
});

it('time_of_day_between wraps midnight (22:00 - 06:00)', function (): void {
    $this->report->submitted_at = Carbon::create(2026, 6, 27, 23, 30);
    expect($this->engine->evaluate(['time_of_day_between' => ['22:00', '06:00']], $this->report))->toBeTrue();

    $this->report->submitted_at = Carbon::create(2026, 6, 27, 3, 0);
    expect($this->engine->evaluate(['time_of_day_between' => ['22:00', '06:00']], $this->report))->toBeTrue();

    $this->report->submitted_at = Carbon::create(2026, 6, 27, 12, 0);
    expect($this->engine->evaluate(['time_of_day_between' => ['22:00', '06:00']], $this->report))->toBeFalse();
});

it('time_of_day_between falls back to now() when submitted_at is null', function (): void {
    $this->report->submitted_at = null;
    Carbon::setTestNow(Carbon::create(2026, 6, 27, 14, 0));

    expect($this->engine->evaluate(['time_of_day_between' => ['09:00', '17:00']], $this->report))->toBeTrue();

    Carbon::setTestNow();
});

it('time_of_day_between rejects a malformed range with InvalidArgumentException', function (): void {
    $this->engine->evaluate(['time_of_day_between' => ['not-a-time', '17:00']], $this->report);
})->throws(InvalidArgumentException::class);

it('matches ai_label_in when the ai_label column is in the list', function (): void {
    $this->report->ai_label = 'overflowing_garbage';
    expect($this->engine->evaluate(['ai_label_in' => ['overflowing_garbage', 'stagnant_water']], $this->report))->toBeTrue();
});

it('rejects ai_label_in when the ai_label column is null', function (): void {
    $this->report->ai_label = null;
    expect($this->engine->evaluate(['ai_label_in' => ['overflowing_garbage']], $this->report))->toBeFalse();
});

it('AND-joins multiple top-level operators (all must match)', function (): void {
    $conds = [
        'category_in' => ['garbage'],
        'severity_in' => ['high'],
        'ward_in' => [$this->ward->id],
    ];

    expect($this->engine->evaluate($conds, $this->report))->toBeTrue();
});

it('AND-join fails when any single operator fails', function (): void {
    $conds = [
        'category_in' => ['garbage'],
        'severity_in' => ['low'],
    ];

    expect($this->engine->evaluate($conds, $this->report))->toBeFalse();
});

it('OR-join matches if any sub-group matches (top-level AND still required)', function (): void {
    $conds = [
        'category_in' => ['garbage'],
        'or' => [
            ['severity_in' => ['critical']],
            ['severity_in' => ['high']],
        ],
    ];

    expect($this->engine->evaluate($conds, $this->report))->toBeTrue();
});

it('OR-join fails when no sub-group matches (top-level AND required)', function (): void {
    $conds = [
        'category_in' => ['garbage'],
        'or' => [
            ['severity_in' => ['low']],
            ['severity_in' => ['medium']],
        ],
    ];

    expect($this->engine->evaluate($conds, $this->report))->toBeFalse();
});

it('OR-join is skipped when the top-level AND already failed', function (): void {
    $conds = [
        'category_in' => ['pothole'],
        'or' => [
            ['severity_in' => ['high']],
        ],
    ];

    expect($this->engine->evaluate($conds, $this->report))->toBeFalse();
});

it('nested OR groups support their own OR inside', function (): void {
    $conds = [
        'category_in' => ['garbage'],
        'or' => [
            [
                'or' => [
                    ['severity_in' => ['low']],
                    ['severity_in' => ['high']],
                ],
            ],
        ],
    ];

    expect($this->engine->evaluate($conds, $this->report))->toBeTrue();
});

it('a missing condition (operator key absent) is treated as pass for that operator', function (): void {
    // Only category_in is set; severity / ward / district are
    // not present in the rule, so they default to pass.
    expect($this->engine->evaluate(['category_in' => ['garbage']], $this->report))->toBeTrue();
});

it('unknown operators throw InvalidArgumentException', function (): void {
    $this->engine->evaluate(['foobar_in' => ['x']], $this->report);
})->throws(InvalidArgumentException::class);

it('category_in rejects a non-list value', function (): void {
    $this->engine->evaluate(['category_in' => 'garbage'], $this->report);
})->throws(InvalidArgumentException::class);

it('non-string condition keys throw InvalidArgumentException', function (): void {
    $this->engine->evaluate([42 => 'x'], $this->report);
})->throws(InvalidArgumentException::class);

it('or with non-array entries throws InvalidArgumentException', function (): void {
    $this->engine->evaluate(['or' => ['not an array']], $this->report);
})->throws(InvalidArgumentException::class);

it('and-joins all 7 operators in a single rule', function (): void {
    $this->report->ai_label = 'overflowing_garbage';
    $conds = [
        'category_in' => ['garbage'],
        'ward_in' => [$this->ward->id],
        'district_in' => [$this->district->id],
        'severity_in' => ['high'],
        'keyword_match' => ['overflowing'],
        'time_of_day_between' => ['00:00', '23:59'],
        'ai_label_in' => ['overflowing_garbage'],
    ];

    expect($this->engine->evaluate($conds, $this->report))->toBeTrue();
});
