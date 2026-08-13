<?php

declare(strict_types=1);

namespace App\Modules\Media\Enums;

enum MediaQuarantineStatus: string
{
    case PENDING_RESCAN = 'PENDING_RESCAN';
    case RESCANNING = 'RESCANNING';
    case CONFIRMED_INFECTED = 'CONFIRMED_INFECTED';
    case INTEGRITY_FAILED = 'INTEGRITY_FAILED';
    case RELEASED = 'RELEASED';
}
