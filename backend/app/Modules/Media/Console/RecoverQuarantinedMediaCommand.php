<?php

declare(strict_types=1);

namespace App\Modules\Media\Console;

use App\Modules\Media\Jobs\RecoverQuarantinedMediaJob;
use App\Modules\Media\Repositories\MediaQuarantineRepository;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

final class RecoverQuarantinedMediaCommand extends Command
{
    protected $signature = 'media:recover-quarantine
        {--limit= : Maximum quarantine records to dispatch}
        {--media-id= : Recover one quarantined media UUID}
        {--sync : Run scans in this process instead of the media queue}';

    protected $description = 'Dispatch safe re-scans for uploads retained after malware-scanner failures';

    public function handle(MediaQuarantineRepository $quarantines): int
    {
        $configuredLimit = (int) config('cip.media.quarantine.recovery_batch_size', 100);
        $limitOption = $this->option('limit');
        $limit = $limitOption === null || $limitOption === '' ? $configuredLimit : (int) $limitOption;

        if ($limit < 1 || $limit > 1000) {
            $this->error('--limit must be between 1 and 1000.');

            return self::INVALID;
        }

        $mediaIdOption = $this->option('media-id');
        $mediaId = is_string($mediaIdOption) && $mediaIdOption !== '' ? $mediaIdOption : null;

        if ($mediaId !== null && ! Str::isUuid($mediaId)) {
            $this->error('--media-id must be a UUID.');

            return self::INVALID;
        }

        $staleSeconds = (int) config('cip.media.quarantine.rescan_stale_seconds', 900);
        $ids = $quarantines->eligibleIds($limit, $staleSeconds, $mediaId);

        foreach ($ids as $id) {
            if ((bool) $this->option('sync')) {
                RecoverQuarantinedMediaJob::dispatchSync($id);
            } else {
                RecoverQuarantinedMediaJob::dispatch($id);
            }
        }

        $mode = (bool) $this->option('sync') ? 'processed' : 'queued';
        $this->info(sprintf('%d quarantine recovery job(s) %s.', count($ids), $mode));

        return self::SUCCESS;
    }
}
