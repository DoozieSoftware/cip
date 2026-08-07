<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | Default Queue Connection Name
    |--------------------------------------------------------------------------
    |
    | Laravel's queue supports a variety of backends via a single unified
    | API, giving you convenient access to each backend using identical
    | syntax for each. The default queue connection is defined below.
    |
    */

    'default' => env('QUEUE_CONNECTION', 'database'),

    /*
    |--------------------------------------------------------------------------
    | Queue Connections
    |--------------------------------------------------------------------------
    |
    | Here you may configure the connection options for every queue backend
    | used by your application. An example configuration is provided for
    | each backend supported by Laravel. You're also free to add more.
    |
    | Drivers: "sync", "database", "beanstalkd", "sqs", "redis",
    |          "deferred", "background", "failover", "null"
    |
    */

    /*
    |--------------------------------------------------------------------------
    | Production Worker Topology (cPanel)
    |--------------------------------------------------------------------------
    |
    | The platform uses four named queues. Each queue MUST have a dedicated
    | worker (or be listed in a multi-queue worker's --queue argument) or
    | jobs dispatched to it will never be processed.
    |
    |   queue          | jobs routed here
    |   ---------------+-------------------------------------------------------
    |   media          | ComputeHashesJob, GenerateThumbnailJob,
    |                  | ExtractVideoMetadataJob
    |   ai             | AiPipelineOrchestrator
    |   notifications  | SendNotificationJob
    |   default        | CheckSlaBreaches (scheduled), any job that does not
    |                  | call onQueue()
    |
    | cPanel cron (every minute) — one worker per queue, --stop-when-empty
    | so the process exits cleanly and the next cron tick picks up new work:
    |
    |   * * * * * cd ~/cip && php artisan queue:work --queue=media --stop-when-empty --tries=1 --timeout=180
    |   * * * * * cd ~/cip && php artisan queue:work --queue=ai --stop-when-empty --tries=1 --timeout=300
    |   * * * * * cd ~/cip && php artisan queue:work --queue=notifications --stop-when-empty --tries=1 --timeout=60
    |   * * * * * cd ~/cip && php artisan queue:work --queue=default --stop-when-empty --tries=1 --timeout=120
    |
    | Alternatively, a single multi-queue worker (priority left-to-right):
    |
    |   * * * * * cd ~/cip && php artisan queue:work --queue=media,ai,notifications,default --stop-when-empty --tries=1 --timeout=300
    |
            | IMPORTANT: retry_after MUST exceed the longest --timeout across all
            | workers. If retry_after < timeout, the worker marks the job as
            | timed-out and re-dispatches it while the original is still running,
            | causing duplicate execution. The database default below (360s) covers
            | the AI worker's 300s timeout with 60s of margin.
    |
    | The scheduler (schedule:run) MUST also be installed as a cron —
    | without it, CheckSlaBreaches and PurgeRetentionCommand never fire.
    | See docs/production-setup.md for the full cron table.
    */

    'connections' => [

        'sync' => [
            'driver' => 'sync',
        ],

        'database' => [
            'driver' => 'database',
            'connection' => env('DB_QUEUE_CONNECTION'),
            'table' => env('DB_QUEUE_TABLE', 'jobs'),
            'queue' => env('DB_QUEUE', 'default'),
            'retry_after' => (int) env('DB_QUEUE_RETRY_AFTER', 360),
            'after_commit' => false,
        ],

        'beanstalkd' => [
            'driver' => 'beanstalkd',
            'host' => env('BEANSTALKD_QUEUE_HOST', 'localhost'),
            'queue' => env('BEANSTALKD_QUEUE', 'default'),
            'retry_after' => (int) env('BEANSTALKD_QUEUE_RETRY_AFTER', 90),
            'block_for' => 0,
            'after_commit' => false,
        ],

        'sqs' => [
            'driver' => 'sqs',
            'key' => env('AWS_ACCESS_KEY_ID'),
            'secret' => env('AWS_SECRET_ACCESS_KEY'),
            'prefix' => env('SQS_PREFIX', 'https://sqs.us-east-1.amazonaws.com/your-account-id'),
            'queue' => env('SQS_QUEUE', 'default'),
            'suffix' => env('SQS_SUFFIX'),
            'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
            'after_commit' => false,
        ],

        'redis' => [
            'driver' => 'redis',
            'connection' => env('REDIS_QUEUE_CONNECTION', 'default'),
            'queue' => env('REDIS_QUEUE', 'default'),
            'retry_after' => (int) env('REDIS_QUEUE_RETRY_AFTER', 90),
            'block_for' => null,
            'after_commit' => false,
        ],

        'deferred' => [
            'driver' => 'deferred',
        ],

        'background' => [
            'driver' => 'background',
        ],

        'failover' => [
            'driver' => 'failover',
            'connections' => [
                'database',
                'deferred',
            ],
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Job Batching
    |--------------------------------------------------------------------------
    |
    | The following options configure the database and table that store job
    | batching information. These options can be updated to any database
    | connection and table which has been defined by your application.
    |
    */

    'batching' => [
        'database' => env('DB_CONNECTION', 'sqlite'),
        'table' => 'job_batches',
    ],

    /*
    |--------------------------------------------------------------------------
    | Failed Queue Jobs
    |--------------------------------------------------------------------------
    |
    | These options configure the behavior of failed queue job logging so you
    | can control how and where failed jobs are stored. Laravel ships with
    | support for storing failed jobs in a simple file or in a database.
    |
    | Supported drivers: "database-uuids", "dynamodb", "file", "null"
    |
    */

    'failed' => [
        'driver' => env('QUEUE_FAILED_DRIVER', 'database-uuids'),
        'database' => env('DB_CONNECTION', 'sqlite'),
        'table' => 'failed_jobs',
    ],

];
