<?php

declare(strict_types=1);

namespace App\Http;

use OpenApi\Attributes as OA;

#[OA\Info(
    version: '1.0.0',
    title: 'Civic Intelligence Platform API',
    description: 'REST API for the Civic Intelligence Platform (M1 bootstrap).',
    contact: new OA\Contact(name: 'Civic Platform Engineering', email: 'eng@cip.local'),
    license: new OA\License(name: 'Proprietary'),
)]
#[OA\Server(
    url: 'http://localhost:8080',
    description: 'Local docker-compose stack',
)]
#[OA\Server(
    url: '{scheme}://{host}',
    description: 'Configurable host',
    variables: [
        new OA\ServerVariable(
            serverVariable: 'scheme',
            default: 'https',
            enum: ['http', 'https'],
        ),
        new OA\ServerVariable(
            serverVariable: 'host',
            default: 'api.cip.local',
        ),
    ],
)]
#[OA\SecurityScheme(
    securityScheme: 'sanctum',
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'Sanctum PAT',
    description: 'Laravel Sanctum personal access token (M2).',
)]
#[OA\Tag(name: 'Health', description: 'Liveness and readiness probes.')]
final class OpenApi {}
