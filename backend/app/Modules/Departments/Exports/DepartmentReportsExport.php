<?php

declare(strict_types=1);

namespace App\Modules\Departments\Exports;

use App\Modules\Reports\Models\Report;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * T-M11-010 — Department reports export.
 *
 * Per `docs/08` §25 and the M11 task brief. The endpoint
 * supports three formats:
 *
 *  - `csv`   — RFC 4180 CSV via a `StreamedResponse` so
 *    we never materialise the full report set in memory
 *  - `xlsx`  — Minimal Office Open XML SpreadsheetML
 *    2003 (`.xls`-readable) generated without external
 *    packages. Excel reads this without any extra setup.
 *    Once `maatwebsite/excel` is added to composer, the
 *    implementation can swap to `Excel::download` with
 *    a FromQuery exporter without changing the wire
 *    contract.
 *  - `pdf`   — Minimal PDF 1.4 body, again with no
 *    external dependency. Once `barryvdh/dompdf` is
 *    available, the implementation can swap to a
 *    `PDF::loadView` call without changing the wire
 *    contract.
 *
 * The wire contract is `?format=csv|xlsx|pdf` and the
 * filters come from the same query string the list
 * endpoint accepts (status, priority, category, ward_id,
 * date_from, date_to, search). All filters are applied
 * by the caller-supplied query; the export just walks
 * the result set and writes rows.
 */
class DepartmentReportsExport
{
    public const FORMAT_CSV = 'csv';
    public const FORMAT_XLSX = 'xlsx';
    public const FORMAT_PDF = 'pdf';

    public const ALLOWED_FORMATS = [
        self::FORMAT_CSV,
        self::FORMAT_XLSX,
        self::FORMAT_PDF,
    ];

    public const COLUMNS = [
        'tracking_number',
        'title',
        'status',
        'priority',
        'report_type',
        'submitted_at',
        'closed_at',
    ];

    /**
     * @return list<string>
     */
    public static function columns(): array
    {
        return self::COLUMNS;
    }

    /**
     * @return array<string, string>
     */
    public static function row(Report $r): array
    {
        return [
            'tracking_number' => (string) $r->tracking_number,
            'title' => (string) $r->title,
            'status' => (string) ($r->status?->code ?? ''),
            'priority' => (string) ($r->priority?->code ?? ''),
            'report_type' => (string) ($r->reportType?->code ?? ''),
            'submitted_at' => $r->submitted_at?->toIso8601String() ?? '',
            'closed_at' => $r->closed_at?->toIso8601String() ?? '',
        ];
    }

    /**
     * Build the HTTP response for the given format.
     *
     * @param  \Illuminate\Database\Eloquent\Builder<Report>|\Illuminate\Support\Collection<int, Report>|iterable<int, Report>  $rows
     */
    public static function build(string $format, iterable $rows, string $filenameBase): Response
    {
        $format = strtolower($format);
        if (! in_array($format, self::ALLOWED_FORMATS, true)) {
            return new Response(
                json_encode([
                    'success' => false,
                    'message' => "Unsupported export format '{$format}'.",
                    'code' => 'EXPORT_FORMAT_UNSUPPORTED',
                ], JSON_THROW_ON_ERROR),
                400,
                ['Content-Type' => 'application/json'],
            );
        }

        $filename = $filenameBase . '.' . $format;

        return match ($format) {
            self::FORMAT_CSV => self::csv($rows, $filename),
            self::FORMAT_XLSX => self::xlsx($rows, $filename),
            self::FORMAT_PDF => self::pdf($rows, $filename),
        };
    }

    /**
     * @param  iterable<Report>  $rows
     */
    private static function csv(iterable $rows, string $filename): StreamedResponse
    {
        $callback = static function () use ($rows): void {
            $out = fopen('php://output', 'w');
            // BOM for Excel-compatibility
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, self::COLUMNS);
            foreach ($rows as $r) {
                /** @var Report $r */
                fputcsv($out, array_values(self::row($r)));
            }
            fclose($out);
        };

        return new StreamedResponse($callback, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            'Cache-Control' => 'no-store, no-cache, must-revalidate',
        ]);
    }

    /**
     * @param  iterable<Report>  $rows
     */
    private static function xlsx(iterable $rows, string $filename): Response
    {
        // SpreadsheetML 2003 — a single XML file Excel reads
        // as a workbook. Minimal schema, no styles, no
        // formulas. Sufficient for the dashboard export.
        $rowsArr = [];
        foreach ($rows as $r) {
            /** @var Report $r */
            $rowsArr[] = self::row($r);
        }

        $ns = 'urn:schemas-microsoft-com:office:spreadsheet';
        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        $xml .= '<?mso-application progid="Excel.Sheet"?>' . "\n";
        $xml .= '<Workbook xmlns="' . $ns . '" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';
        $xml .= '<Worksheet ss:Name="Reports"><Table>';

        $xml .= '<Row>';
        foreach (self::COLUMNS as $col) {
            $xml .= '<Cell><Data ss:Type="String">' . self::escapeXml($col) . '</Data></Cell>';
        }
        $xml .= '</Row>';

        foreach ($rowsArr as $row) {
            $xml .= '<Row>';
            foreach (self::COLUMNS as $col) {
                $val = (string) ($row[$col] ?? '');
                $xml .= '<Cell><Data ss:Type="String">' . self::escapeXml($val) . '</Data></Cell>';
            }
            $xml .= '</Row>';
        }
        $xml .= '</Table></Worksheet></Workbook>';

        return new Response($xml, 200, [
            'Content-Type' => 'application/vnd.ms-excel; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            'Cache-Control' => 'no-store, no-cache, must-revalidate',
        ]);
    }

    /**
     * @param  iterable<Report>  $rows
     */
    private static function pdf(iterable $rows, string $filename): Response
    {
        $rowsArr = [];
        foreach ($rows as $r) {
            /** @var Report $r */
            $rowsArr[] = self::row($r);
        }

        $lines = [];
        $lines[] = 'Department Reports Export';
        $lines[] = 'Generated: ' . now()->toIso8601String();
        $lines[] = '';
        $lines[] = implode(' | ', self::COLUMNS);
        $lines[] = str_repeat('-', 100);
        foreach ($rowsArr as $row) {
            $lines[] = implode(' | ', array_map(static fn ($v): string => (string) $v, array_values($row)));
        }

        $body = self::buildSinglePagePdf($lines);
        return new Response($body, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            'Cache-Control' => 'no-store, no-cache, must-revalidate',
        ]);
    }

    /**
     * Build a minimal but valid single-page PDF 1.4 body.
     * Uses the built-in Helvetica font and a single A4
     * page. Lines beyond the page bottom are clipped
     * (acceptable for the dashboard export; richer layout
     * will move to barryvdh/dompdf).
     *
     * @param  list<string>  $lines
     */
    private static function buildSinglePagePdf(array $lines): string
    {
        $lineHeight = 12;
        $top = 800;
        $left = 40;
        $pageWidth = 595;
        $pageHeight = 842;
        $rowsPerPage = max(1, (int) floor(($pageHeight - 60) / $lineHeight));
        $lines = array_slice($lines, 0, $rowsPerPage);

        $contentStream = "BT\n/F1 9 Tf\n{$lineHeight} TL\n1 0 0 1 {$left} {$top} Tm\n";
        foreach (array_values($lines) as $idx => $line) {
            if ($idx > 0) {
                $contentStream .= "0 -{$lineHeight} Td\n";
            }
            $contentStream .= '(' . self::escapePdfString($line) . ") Tj\n";
        }
        $contentStream .= "ET\n";

        // Object layout (in order):
        //  1: Catalog
        //  2: Pages
        //  3: Page
        //  4: Font
        //  5: Content stream
        $contentLength = strlen($contentStream);

        $objects = [
            1 => "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
            2 => "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
            3 => "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {$pageWidth} {$pageHeight}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
            4 => "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
            5 => "5 0 obj\n<< /Length {$contentLength} >>\nstream\n{$contentStream}endstream\nendobj\n",
        ];

        $body = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"; // binary marker to mark file as binary
        $offsets = [];
        foreach ($objects as $id => $objectBody) {
            $offsets[$id] = strlen($body);
            $body .= $objectBody;
        }
        $xrefStart = strlen($body);
        $body .= "xref\n0 " . (count($objects) + 1) . "\n";
        $body .= "0000000000 65535 f \n";
        for ($id = 1; $id <= count($objects); $id++) {
            $body .= str_pad((string) ($offsets[$id] ?? 0), 10, '0', STR_PAD_LEFT) . " 00000 n \n";
        }
        $body .= "trailer\n<< /Size " . (count($objects) + 1) . " /Root 1 0 R >>\n";
        $body .= "startxref\n{$xrefStart}\n%%EOF\n";

        return $body;
    }

    private static function escapeXml(string $s): string
    {
        return htmlspecialchars($s, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    }

    private static function escapePdfString(string $s): string
    {
        return str_replace(
            ['\\', '(', ')'],
            ['\\\\', '\\(', '\\)'],
            $s,
        );
    }
}
