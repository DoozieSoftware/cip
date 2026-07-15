<?php
/**
 * Realistic AI routing test: submit 6 reports with real civic issue
 * images and authentic Bangalore-style titles/descriptions.
 *
 *   Category    Image 1          Image 2          Expected
 *   ─────────────────────────────────────────────────────────
 *   pothole     real_pothole.jpg real_pothole2.jpg  >90 -> auto-route
 *   garbage     real_garbage.jpg real_garbage2.jpg  75-90 -> moderator
 *   streetlight real_streetlight.jpg                 <75 -> manual class
 *                           real_streetlight2.jpg
 *
 * Run: cd backend && php artisan tinker --execute="require '/home/doozie11/dev/cip/scripts/test-ai-routing.php';"
 */

declare(strict_types=1);

$base = 'http://localhost:8000/api/v1';
$fixtures = '/home/doozie11/dev/cip/test-fixtures/evidence';

function http(string $method, string $url, array $opts): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 60,
        CURLOPT_HTTPHEADER => $opts['headers'] ?? [],
    ]);
    if (isset($opts['fields'])) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $opts['fields']);
    }
    if (isset($opts['file'])) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $opts['file']);
    }
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    return ['code' => $code, 'body' => json_decode((string) $body, true) ?? []];
}

// 1. Create a fresh Sanctum token (avoids login rate-limit)
$user = DB::table('users')->where('mobile', '9999900001')->first();
$token = App\Modules\Users\Models\User::find($user->id)->createToken('test-e2e-routing')->plainTextToken;
echo "citizen token OK\n";
$auth = ['Authorization: Bearer ' . $token, 'Accept: application/json'];

// 2. Report types
$types = http('GET', "$base/report-types", ['headers' => $auth])['body']['data'] ?? [];
$typeByCode = [];
foreach ($types as $t) {
    $typeByCode[$t['code']] = $t['id'];
}

// 3. Realistic Bangalore civic reports
$cases = [
    [
        'label' => 'A_pothole_1',
        'file' => "$fixtures/real_pothole.jpg",
        'type' => 'pothole',
        'title' => 'Deep pothole near Jayanagar 4th Block signal',
        'description' => 'Large pothole approximately 2 feet wide on the road near Jayanagar 4th Block signal. Multiple two-wheelers have nearly fallen here. Water collects during rain making it invisible to drivers.',
        'lat' => 12.9260,
        'lng' => 77.5830,
    ],
    [
        'label' => 'A_pothole_2',
        'file' => "$fixtures/real_pothole2.jpg",
        'type' => 'pothole',
        'title' => 'Broken road near Koramangala Silk Board junction',
        'description' => 'The road surface has completely broken down near Silk Board junction on the Koramangala side. Cars are scraping their undercarriage. This has been reported multiple times but no repair has been done.',
        'lat' => 12.9170,
        'lng' => 77.6229,
    ],
    [
        'label' => 'B_garbage_1',
        'file' => "$fixtures/real_garbage.jpg",
        'type' => 'garbage',
        'title' => 'Overflowing garbage bins near Majestic bus stand',
        'description' => 'Garbage bins near Majestic bus stand have not been collected for 3 days. Waste is spread across the footpath and the smell is unbearable. Stray animals are scattering the garbage further.',
        'lat' => 12.9766,
        'lng' => 77.5753,
    ],
    [
        'label' => 'B_garbage_2',
        'file' => "$fixtures/real_garbage2.jpg",
        'type' => 'garbage',
        'title' => 'Illegal dumping of construction waste in HSR Layout',
        'description' => 'Construction debris and cement bags have been dumped on the side of the road in HSR Layout Sector 2. The pile has been growing for over a week and is blocking pedestrian movement.',
        'lat' => 12.9116,
        'lng' => 77.6389,
    ],
    [
        'label' => 'C_streetlight_1',
        'file' => "$fixtures/real_streetlight.jpg",
        'type' => 'streetlight',
        'title' => 'Streetlight not working on MG Road near Brigade Road',
        'description' => 'Three streetlights between MG Road metro station and Brigade Road junction have been off for the past two weeks. The stretch is completely dark after 7 PM making it unsafe for pedestrians.',
        'lat' => 12.9758,
        'lng' => 77.6083,
    ],
    [
        'label' => 'C_streetlight_2',
        'file' => "$fixtures/real_streetlight2.jpg",
        'type' => 'streetlight',
        'title' => 'Broken streetlight pole near Whitefield IT Park road',
        'description' => 'A streetlight pole near Whitefield IT Park main road has tilted and is about to fall. The light fixture is hanging by wires. This is a safety hazard especially during rain.',
        'lat' => 12.9698,
        'lng' => 77.7500,
    ],
];

$results = [];

foreach ($cases as $c) {
    $label = $c['label'];
    echo "\n=== $label ({$c['type']}) ===\n";

    // Create draft
    $store = http('POST', "$base/reports", [
        'headers' => array_merge($auth, ['Content-Type: application/json']),
        'fields' => json_encode([
            'report_type_id' => $typeByCode[$c['type']],
            'latitude' => $c['lat'],
            'longitude' => $c['lng'],
            'accuracy' => 10,
            'title' => $c['title'],
            'description' => $c['description'],
        ]),
    ]);
    $reportId = $store['body']['data']['id'] ?? null;
    if (! $reportId) {
        echo "STORE FAILED: " . ($store['body']['message'] ?? 'unknown') . "\n";
        echo json_encode($store['body']['errors'] ?? []) . "\n";
        continue;
    }
    echo "created $reportId\n";

    // Upload photo
    $photo = http('POST', "$base/reports/$reportId/photos", [
        'headers' => $auth,
        'file' => ['photos[0]' => new CURLFile($c['file'], 'image/jpeg', basename($c['file']))],
    ]);
    if ($photo['code'] !== 201) {
        echo "photo upload failed ({$photo['code']}): " . ($photo['body']['message'] ?? '') . "\n";
        continue;
    }
    echo "photo uploaded\n";

    // NOTE: store() transitions report directly to ai_processing — no submit() call needed

    $results[] = ['id' => $reportId, 'label' => $label, 'type' => $c['type']];
}

echo "\n\n=== Waiting 20s for AI pipeline to complete ===\n";
sleep(20);

// Fetch final results
echo "\n=== FINAL RESULTS ===\n";
echo str_pad('CASE', 20) . str_pad('TYPE', 14) . str_pad('AI_CONF', 10) . str_pad('QUALITY', 10) . str_pad('FRAUD', 8) . str_pad('DUP', 6) . str_pad('STATUS', 22) . "DEPT\n";
echo str_repeat('─', 95) . "\n";

foreach ($results as $r) {
    $rid = $r['id'];
    $rep = DB::table('reports')
        ->join('report_statuses', 'reports.current_status_id', '=', 'report_statuses.id')
        ->where('reports.id', $rid)
        ->first(['report_statuses.code as status_code', 'reports.ai_confidence', 'reports.department_id', 'reports.fraud_score', 'reports.duplicate_score']);
    $ai = DB::table('ai_results')
        ->join('ai_jobs', 'ai_results.job_id', '=', 'ai_jobs.id')
        ->where('ai_jobs.report_id', $rid)
        ->orderByDesc('ai_results.created_at')
        ->first(['ai_results.predicted_type', 'ai_results.quality_score', 'ai_results.fraud_score', 'ai_results.confidence']);

    if (! $rep || ! $ai) {
        echo str_pad($r['label'], 20) . "NO DATA\n";
        continue;
    }

    $statusLabel = match (true) {
        $rep->department_id !== null && $rep->status_code === 'assigned' => 'AUTO-ROUTED ✅',
        $rep->status_code === 'pending_moderator' => 'MODERATOR REVIEW',
        $rep->status_code === 'ai_processing' => 'STILL PROCESSING',
        default => $rep->status_code,
    };

    echo str_pad($r['label'], 20)
        . str_pad($r['type'], 14)
        . str_pad(sprintf('%.0f%%', $rep->ai_confidence ?? 0), 10)
        . str_pad($ai->quality_score . '%', 10)
        . str_pad($rep->fraud_score ?? '?', 8)
        . str_pad($rep->duplicate_score ?? '?', 6)
        . str_pad($rep->status_code, 22)
        . ($rep->department_id ? 'YES' : 'no') . "\n";

    echo str_pad('', 20)
        . str_pad('', 14)
        . str_pad('AI: ' . $ai->predicted_type, 10)
        . "\n";
}
