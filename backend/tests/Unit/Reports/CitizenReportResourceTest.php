<?php

declare(strict_types=1);

namespace Tests\Unit\Reports;

use App\Modules\Departments\Models\Department;
use App\Modules\Media\Models\Media;
use App\Modules\Reports\Http\Resources\CitizenReportResource;
use App\Modules\Reports\Models\Location;
use App\Modules\Reports\Models\Report;
use App\Modules\Reports\Models\ReportPriority;
use App\Modules\Reports\Models\ReportStatus;
use App\Modules\Reports\Models\ReportType;
use Illuminate\Http\Request;
use Tests\TestCase;

/**
 * Non-DB unit test of the citizen detail contract. Builds the model
 * graph in memory (relations set explicitly, `media` eager-loaded) so
 * the contract can be asserted without a SQLite driver.
 */
class CitizenReportResourceTest extends TestCase
{
    private function makeReport(?Department $department = null): Report
    {
        $location = new Location;
        $location->latitude = 12.9716;
        $location->longitude = 77.5946;
        $location->address = 'MG Road';

        $type = new ReportType;
        $type->code = 'pothole';
        $type->name = 'Pothole';
        $type->icon = 'icon-pothole';

        $status = new ReportStatus;
        $status->code = 'submitted';
        $status->name = 'Submitted';
        $status->is_terminal = false;

        $priority = new ReportPriority;
        $priority->code = 'medium';
        $priority->name = 'Medium';

        $report = new Report;
        $report->id = 'rep-1';
        $report->tracking_number = 'CIV-2026-000001';
        $report->workflow_version = 7;
        $report->title = 'Pothole';
        $report->description = 'Deep pothole';
        $report->ai_label = 'pothole';
        $report->ai_confidence = 90;
        $report->fraud_score = 10;
        $report->created_at = null;
        $report->updated_at = null;
        $report->verification_deadline_at = '2026-08-15 12:00:00';

        $report->setRelation('location', $location);
        $report->setRelation('reportType', $type);
        $report->setRelation('status', $status);
        $report->setRelation('priority', $priority);
        $report->setRelation('mergeDisputes', collect([]));

        if ($department !== null) {
            $report->setRelation('department', $department);
        }

        $media = new Media;
        $media->is_replaced = false;
        $replaced = new Media;
        $replaced->is_replaced = true;
        $report->setRelation('media', collect([$media, $replaced]));

        return $report;
    }

    private function department(): Department
    {
        $dept = new Department;
        $dept->id = 'dept-1';
        $dept->name = 'Roads';
        $dept->code = 'roads';

        return $dept;
    }

    public function test_contract_matches_frontend_report_detail(): void
    {
        $report = $this->makeReport($this->department());
        $data = (new CitizenReportResource($report))->toArray(Request::create('/'));

        $this->assertSame('rep-1', $data['id']);
        $this->assertSame('CIV-2026-000001', $data['tracking_number']);
        $this->assertSame(7, $data['workflow_version']);
        $this->assertSame(['code' => 'submitted', 'name' => 'Submitted', 'is_terminal' => false], $data['status']);

        // `type` (not `report_type`) with icon.
        $this->assertSame(['code' => 'pothole', 'name' => 'Pothole', 'icon' => 'icon-pothole'], $data['type']);

        // priority trimmed to code+name.
        $this->assertSame(['code' => 'medium', 'name' => 'Medium'], $data['priority']);

        // assigned + real department.
        $this->assertSame(['id' => 'dept-1', 'code' => 'roads', 'name' => 'Roads'], $data['assigned_department']);
        $this->assertSame(['id' => 'dept-1', 'code' => 'roads', 'name' => 'Roads'], $data['department']);

        // location trimmed.
        $this->assertSame(['latitude' => 12.9716, 'longitude' => 77.5946, 'address' => 'MG Road'], $data['location']);

        // media_count excludes replaced.
        $this->assertSame(1, $data['media_count']);
        $this->assertSame('2026-08-15T12:00:00+00:00', $data['verification_deadline_at']);
        $this->assertSame([], $data['proof_photos']);

        // ai_summary shape.
        $this->assertNotNull($data['ai_summary']);
        $this->assertSame([['name' => 'pothole', 'confidence' => 0.9]], $data['ai_summary']['labels']);
        $this->assertSame(0.1, $data['ai_summary']['fraud_score']);
        $this->assertNull($data['ai_summary']['duplicate_of']);
        $this->assertSame(['name' => 'Roads', 'code' => 'roads'], $data['ai_summary']['recommended_department']);

        // No internal fields leaked.
        foreach ([
            'report_type', 'is_anonymous', 'is_verified', 'ai_confidence',
            'fraud_score', 'duplicate_score', 'mock_gps_score', 'citizen_id',
        ] as $leaked) {
            $this->assertArrayNotHasKey($leaked, $data);
        }
    }

    public function test_ai_summary_null_without_label_and_nullable_fraud_score(): void
    {
        $report = $this->makeReport($this->department());
        $report->ai_label = null;
        $report->fraud_score = null;

        $data = (new CitizenReportResource($report))->toArray(Request::create('/'));

        $this->assertNull($data['ai_summary']);
    }

    public function test_missing_relations_are_nullable(): void
    {
        $report = new Report;
        $report->id = 'rep-2';
        $report->tracking_number = 'CIV-2026-000002';
        $report->title = 'No relations';
        $report->ai_label = null;
        $report->created_at = null;
        $report->updated_at = null;
        $report->setRelation('media', collect([]));
        $report->setRelation('location', null);
        $report->setRelation('reportType', null);
        $report->setRelation('status', null);
        $report->setRelation('priority', null);
        $report->setRelation('department', null);
        $report->setRelation('canonicalReport', null);
        $report->setRelation('mergeDisputes', collect([]));

        $data = (new CitizenReportResource($report))->toArray(Request::create('/'));

        $this->assertNull($data['status']);
        $this->assertNull($data['type']);
        $this->assertNull($data['priority']);
        $this->assertNull($data['assigned_department']);
        $this->assertNull($data['department']);
        $this->assertNull($data['location']);
        $this->assertSame(0, $data['media_count']);
    }

    public function test_recommended_department_null_without_department(): void
    {
        $report = $this->makeReport();
        $report->setRelation('department', null);

        $data = (new CitizenReportResource($report))->toArray(Request::create('/'));

        $this->assertNotNull($data['ai_summary']);
        $this->assertNull($data['ai_summary']['recommended_department']);
    }
}
