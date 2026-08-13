<?php

declare(strict_types=1);

namespace App\Modules\Media\Enums;

enum MediaScanStatus: string
{
    case PENDING = 'PENDING';
    case CLEAN = 'CLEAN';
    case INFECTED = 'INFECTED';
    case UNKNOWN = 'UNKNOWN';
}
