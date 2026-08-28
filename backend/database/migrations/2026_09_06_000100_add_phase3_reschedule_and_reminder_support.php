<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        // ── 1. Unavailable slots per zone/day/window ──────────────────
        Schema::create('textile_zone_unavailabilities', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('service_zone_id');
            $table->date('unavailable_date');
            $table->time('window_start')->nullable();
            $table->time('window_end')->nullable();
            $table->string('reason', 500)->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestamps();

            $table->foreign('service_zone_id')->references('id')->on('textile_service_zones')->cascadeOnDelete();
            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
            $table->index(['service_zone_id', 'unavailable_date'], 'tzu_zone_date_idx');
            $table->unique(['service_zone_id', 'unavailable_date', 'window_start', 'window_end'], 'unq_zone_date_window');
        });

        // ── 2. Reschedule & reminder tracking on requests ──────────────
        Schema::table('textile_collection_requests', function (Blueprint $table): void {
            $table->timestamp('rescheduled_at')->nullable()->after('scheduled_window_end');
            $table->timestamp('reminder_sent_at')->nullable()->after('rescheduled_at');
            $table->unsignedSmallInteger('reschedule_count')->default(0)->after('reminder_sent_at');
            // Previous schedule snapshot — kept for quick UI/history without parsing audit_logs.
            // TODO D-05 OPEN: cutoff window, successor-record vs in-place decision.
            $table->date('previous_scheduled_date')->nullable()->after('reschedule_count');
            $table->time('previous_window_start')->nullable()->after('previous_scheduled_date');
            $table->time('previous_window_end')->nullable()->after('previous_window_start');
            $table->uuid('previous_batch_id')->nullable()->after('previous_window_end');
            // Permit citizen to update contact/readiness without touching protected evidence.
            $table->index(['status', 'scheduled_date']);
        });

        // ── 3. Reminder / on-the-way tracking on batches ───────────────
        Schema::table('textile_collection_batches', function (Blueprint $table): void {
            $table->timestamp('reminder_sent_at')->nullable()->after('completed_at');
            $table->timestamp('on_the_way_sent_at')->nullable()->after('reminder_sent_at');
            // TODO D-06 OPEN: approved channels + timing per partner (sms vs push vs email).
        });

        // ── 4. Seed Phase-3 notification templates (idempotent) ─────────
        $now = now();
        $templates = [
            [
                'code' => 'textile.pickup_reminder',
                'name' => 'Textile Pickup Reminder',
                'channel' => 'sms',
                'subject' => null,
                'body' => 'Hi {name}, reminder: your {partner} textile pickup is scheduled for {date} ({window}). Tracking: {tracking_number}. Please keep bags ready.',
                'variables' => json_encode(['name', 'date', 'window', 'tracking_number', 'partner']),
            ],
            [
                'code' => 'textile.on_the_way',
                'name' => 'Textile Pickup On The Way',
                'channel' => 'sms',
                'subject' => null,
                'body' => 'Hi {name}, your {partner} driver is on the way for pickup {tracking_number} scheduled {date} ({window}).',
                'variables' => json_encode(['name', 'date', 'window', 'tracking_number', 'partner']),
            ],
            [
                'code' => 'textile.rescheduled',
                'name' => 'Textile Pickup Rescheduled',
                'channel' => 'sms',
                'subject' => null,
                'body' => 'Hi {name}, your {partner} pickup {tracking_number} has been rescheduled to {date} ({window}).',
                'variables' => json_encode(['name', 'date', 'window', 'tracking_number', 'partner']),
            ],
        ];

        foreach ($templates as $row) {
            $exists = DB::table('notification_templates')
                ->where('code', $row['code'])
                ->where('channel', $row['channel'])
                ->where('locale', 'en')
                ->where('version', 1)
                ->exists();

            if ($exists) {
                continue;
            }

            DB::table('notification_templates')->insert([
                'id' => (string) Str::uuid(),
                'code' => $row['code'],
                'name' => $row['name'],
                'channel' => $row['channel'],
                'locale' => 'en',
                'version' => 1,
                'subject' => $row['subject'],
                'body' => $row['body'],
                'variables' => $row['variables'],
                'active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('textile_collection_batches', function (Blueprint $table): void {
            $table->dropColumn(['reminder_sent_at', 'on_the_way_sent_at']);
        });
        Schema::table('textile_collection_requests', function (Blueprint $table): void {
            $table->dropColumn(['rescheduled_at', 'reminder_sent_at', 'reschedule_count', 'previous_scheduled_date', 'previous_window_start', 'previous_window_end', 'previous_batch_id']);
        });
        Schema::dropIfExists('textile_zone_unavailabilities');
        DB::table('notification_templates')->whereIn('code', ['textile.pickup_reminder', 'textile.on_the_way', 'textile.rescheduled'])->delete();
    }
};
