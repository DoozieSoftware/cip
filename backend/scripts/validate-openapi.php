<?php

declare(strict_types=1);

/**
 * Structural OpenAPI contract validator.
 *
 * This intentionally validates the document shape that generic YAML parsing
 * cannot catch: operation/response maps, unique operation IDs, templated path
 * parameters, and broken local references. It is dependency-light so CI can
 * run it before the application test suite.
 */

require dirname(__DIR__).'/vendor/autoload.php';

use Symfony\Component\Yaml\Exception\ParseException;
use Symfony\Component\Yaml\Yaml;

$path = $argv[1] ?? dirname(__DIR__).'/storage/api-docs/openapi.yaml';

if (! is_file($path) || ! is_readable($path)) {
    fwrite(STDERR, "OpenAPI file is missing or unreadable: {$path}\n");
    exit(1);
}

try {
    $document = Yaml::parseFile($path);
} catch (ParseException $exception) {
    fwrite(STDERR, "OpenAPI YAML is invalid: {$exception->getMessage()}\n");
    exit(1);
}

$errors = [];
$error = static function (string $message) use (&$errors): void {
    $errors[] = $message;
};

if (! is_array($document)) {
    $error('The OpenAPI document must be a mapping.');
} else {
    if (! is_string($document['openapi'] ?? null) || ! str_starts_with($document['openapi'], '3.')) {
        $error('The openapi field must be an OpenAPI 3.x version string.');
    }

    foreach (['info', 'paths', 'components'] as $required) {
        if (! is_array($document[$required] ?? null)) {
            $error("The top-level {$required} field must be a mapping.");
        }
    }

    foreach (['title', 'version'] as $requiredInfo) {
        if (! is_string($document['info'][$requiredInfo] ?? null) || $document['info'][$requiredInfo] === '') {
            $error("info.{$requiredInfo} must be a non-empty string.");
        }
    }

    $resolvePointer = static function (string $reference) use ($document): mixed {
        if (! str_starts_with($reference, '#/')) {
            return true; // External references require a resolver, not this local check.
        }

        $value = $document;

        foreach (explode('/', substr($reference, 2)) as $segment) {
            $segment = str_replace(['~1', '~0'], ['/', '~'], $segment);

            if (! is_array($value) || ! array_key_exists($segment, $value)) {
                return false;
            }
            $value = $value[$segment];
        }

        return $value;
    };

    $paths = $document['paths'] ?? [];
    $operationIds = [];
    $operations = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

    if ($paths === []) {
        $error('paths must contain at least one path item.');
    }

    foreach ($paths as $pathTemplate => $pathItem) {
        if (! is_string($pathTemplate) || ! str_starts_with($pathTemplate, '/')) {
            $error('Every paths key must begin with /.');
            continue;
        }

        if (! is_array($pathItem)) {
            $error("Path {$pathTemplate} must be a mapping.");
            continue;
        }

        $pathParameters = is_array($pathItem['parameters'] ?? null) ? $pathItem['parameters'] : [];
        $pathOperations = 0;

        foreach ($operations as $method) {
            if (! array_key_exists($method, $pathItem)) {
                continue;
            }

            $pathOperations++;
            $operation = $pathItem[$method];

            if (! is_array($operation)) {
                $error("{$method} {$pathTemplate} must be a mapping.");
                continue;
            }

            $operationId = $operation['operationId'] ?? null;

            if (! is_string($operationId) || $operationId === '') {
                $error("{$method} {$pathTemplate} is missing operationId.");
            } elseif (isset($operationIds[$operationId])) {
                $error("operationId {$operationId} is duplicated ({$operationIds[$operationId]} and {$method} {$pathTemplate}).");
            } else {
                $operationIds[$operationId] = "{$method} {$pathTemplate}";
            }

            $responses = $operation['responses'] ?? null;

            if (! is_array($responses) || $responses === []) {
                $error("{$method} {$pathTemplate} must declare at least one response.");
            } else {
                foreach ($responses as $status => $response) {
                    $status = (string) $status;
                    $validStatus = $status === 'default'
                        || preg_match('/^[1-5][0-9]{2}$/', $status) === 1;

                    if (! $validStatus) {
                        $error("{$method} {$pathTemplate} has invalid response key {$status}.");
                    }

                    if (! is_array($response)) {
                        $error("{$method} {$pathTemplate} response {$status} must be a mapping.");
                    } elseif (! isset($response['$ref']) && ! is_string($response['description'] ?? null)) {
                        $error("{$method} {$pathTemplate} response {$status} needs description or $ref.");
                    }
                }
            }

            $parameters = array_merge($pathParameters, is_array($operation['parameters'] ?? null) ? $operation['parameters'] : []);

            foreach (preg_match_all('/\{([^}]+)\}/', $pathTemplate, $matches) ? $matches[1] : [] as $placeholder) {
                $found = false;

                foreach ($parameters as $parameter) {
                    if (is_array($parameter) && isset($parameter['$ref']) && is_string($parameter['$ref'])) {
                        $parameter = $resolvePointer($parameter['$ref']);
                    }

                    if (is_array($parameter)
                        && ($parameter['in'] ?? null) === 'path'
                        && ($parameter['name'] ?? null) === $placeholder
                        && ($parameter['required'] ?? false) === true) {
                        $found = true;
                        break;
                    }
                }

                if (! $found) {
                    $error("{$method} {$pathTemplate} must declare required path parameter {$placeholder}.");
                }
            }
        }

        if ($pathOperations === 0 && ! isset($pathItem['$ref'])) {
            $error("Path {$pathTemplate} has no HTTP operation.");
        }
    }

    $components = $document['components'] ?? [];

    foreach (['schemas', 'responses', 'parameters', 'securitySchemes'] as $componentType) {
        if (isset($components[$componentType]) && ! is_array($components[$componentType])) {
            $error("components.{$componentType} must be a mapping.");
        }
    }

    $walk = static function (mixed $value, string $location) use (&$walk, $resolvePointer, $error): void {
        if (is_array($value)) {
            if (isset($value['$ref']) && is_string($value['$ref']) && ! $resolvePointer($value['$ref'])) {
                $error("{$location} references missing target {$value['$ref']}.");
            }

            foreach ($value as $key => $child) {
                $walk($child, "{$location}/{$key}");
            }
        }
    };
    $walk($document, '#');
}

if ($errors !== []) {
    fwrite(STDERR, "OpenAPI structural validation failed:\n");

    foreach ($errors as $message) {
        fwrite(STDERR, " - {$message}\n");
    }
    exit(1);
}

fwrite(STDOUT, sprintf("OpenAPI structural validation passed (%d paths, %d operations).\n", count($document['paths']), count($operationIds)));
