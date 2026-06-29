<?php

declare(strict_types=1);

namespace App\Modules\Shared\Services;

use App\Modules\Settings\Models\Setting;
use Illuminate\Console\Scheduling\Event;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

/**
 * T-M12-012 — Scheduler admin surface per `docs/09` §23.
 *
 * The platform's scheduled events are registered in
 * `routes/console.php`. This service reads them via
 * `Schedule::events()`, and persists pause / resume
 * state in a single canonical settings row
 * (`scheduler_paused_jobs`) holding a JSON array of
 * job names that are currently paused.
 *
 * The `run-now` action calls `Artisan::call($command)`
 * for jobs registered as Artisan commands; jobs that
 * are closure-based or job-class-based are dispatched
 * synchronously via `dispatch_sync()`.
 */
class SchedulerService
{
    public const PAUSED_KEY = 'scheduler_paused_jobs';

    /**
     * @return list<array<string, mixed>>
     */
    public function list(): array
    {
        $paused = $this->paused();
        $rows = [];

        foreach (Schedule::events() as $event) {
            $name = $this->nameFor($event);
            $rows[] = [
                'id' => $name,
                'command' => $this->commandFor($event),
                'expression' => (string) $event->expression,
                'next_due_at' => $event->nextRunDate()?->toIso8601String(),
                'timezone' => $event->timezone !== null ? (string) $event->timezone : null,
                'without_overlapping' => (bool) $event->withoutOverlapping,
                'paused' => in_array($name, $paused, true),
            ];
        }

        return $rows;
    }

    /**
     * @return list<string>
     */
    public function paused(): array
    {
        $row = Setting::query()->where('key', self::PAUSED_KEY)->first();
        if ($row === null) {
            return [];
        }
        $value = $row->value;
        if (! is_array($value)) {
            return [];
        }

        return array_values(array_filter(array_map(static fn ($v): string => is_string($v) ? $v : '', $value)));
    }

    public function pause(string $name): void
    {
        $current = $this->paused();
        if (in_array($name, $current, true)) {
            return;
        }
        $current[] = $name;
        Setting::set(self::PAUSED_KEY, array_values(array_unique($current)), 'array');
    }

    public function resume(string $name): void
    {
        $current = $this->paused();
        $next = array_values(array_filter($current, static fn (string $n): bool => $n !== $name));
        Setting::set(self::PAUSED_KEY, $next, 'array');
    }

    /**
     * Run a scheduled job synchronously.
     *
     *  - Closure-based events: re-dispatch via Artisan
     *  - Job-class events: `dispatch_sync` on the job class
     *  - Command-based events: `Artisan::call($command)`
     */
    public function runNow(string $name): string
    {
        foreach (Schedule::events() as $event) {
            if ($this->nameFor($event) !== $name) {
                continue;
            }

            $command = $this->commandFor($event);

            if ($command !== '' && Artisan::has($command)) {
                $exit = Artisan::call($command);

                return "Artisan::call({$command}) exit={$exit}";
            }

            // Job-class scheduled events expose the job instance.
            $job = $event->job ?? null;
            if (is_object($job)) {
                $jobClass = $job::class;
                $jobInstance = is_string($jobClass) && class_exists($jobClass)
                    ? new $jobClass()
                    : null;
                if ($jobInstance !== null) {
                    dispatch_sync($jobInstance);

                    return "dispatch_sync({$jobClass})";
                }
            }
        }

        return "no matching event for '{$name}'";
    }

    private function nameFor(Event $event): string
    {
        $description = (string) ($event->description ?? '');

        return $description !== '' ? $description : $event->command;
    }

    private function commandFor(Event $event): string
    {
        $command = (string) $event->command;
        if ($command === '' || $command === 'NULL') {
            $description = (string) ($event->description ?? '');
            if ($description !== '') {
                return $description;
            }
        }

        return $command;
    }
}
