<?php

declare(strict_types=1);

namespace App\Modules\Media\Enums;

enum MediaQuarantineReason: string
{
    case AWAITING_SCAN = 'AWAITING_SCAN';
    case INFECTED = 'INFECTED';
    case SCANNER_ERROR = 'SCANNER_ERROR';
    case RELEASE_ERROR = 'RELEASE_ERROR';
    case INTEGRITY_MISMATCH = 'INTEGRITY_MISMATCH';
}
