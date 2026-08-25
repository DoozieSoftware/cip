<?php

declare(strict_types=1);

namespace Tests\Unit\Reports;

use App\Modules\Reports\Http\Resources\ReportTypeResource;
use App\Modules\Reports\Models\ReportType;
use Illuminate\Http\Request;
use Tests\TestCase;

uses(TestCase::class);
class ReportTypeResourceTest extends TestCase
{
    public function test_resource_exposes_localization_alias_and_order_contract(): void
    {
        $type = new ReportType([
            'id' => 'type-1',
            'name' => 'Garbage & Dumping',
            'code' => 'garbage',
            'description' => 'Dumping and waste collection issues.',
            'icon' => 'trash',
            'color' => '#795548',
            'localizations' => ['kn-IN' => 'ಕಸ ಮತ್ತು ತ್ಯಾಜ್ಯ'],
            'aliases' => ['trash', 'dump'],
            'sort_order' => 4,
            'requires_video' => false,
            'requires_photo' => true,
            'min_photos' => 1,
            'max_photos' => 5,
            'active' => true,
        ]);

        $data = (new ReportTypeResource($type))->toArray(Request::create('/'));

        self::assertSame(['kn-IN' => 'ಕಸ ಮತ್ತು ತ್ಯಾಜ್ಯ'], $data['localizations']);
        self::assertSame(['trash', 'dump'], $data['aliases']);
        self::assertSame(4, $data['sort_order']);
        self::assertIsArray($type->localizations);
        self::assertIsArray($type->aliases);
        self::assertSame(4, $type->sort_order);
    }

    public function test_resource_preserves_null_localizations_and_aliases_for_legacy_rows(): void
    {
        $type = new ReportType([
            'name' => 'Other',
            'code' => 'other',
            'requires_video' => false,
            'requires_photo' => false,
            'min_photos' => 0,
            'max_photos' => 5,
            'active' => true,
        ]);

        $data = (new ReportTypeResource($type))->toArray(Request::create('/'));

        self::assertNull($data['localizations']);
        self::assertNull($data['aliases']);
        self::assertSame(0, $data['sort_order']);
    }
}
