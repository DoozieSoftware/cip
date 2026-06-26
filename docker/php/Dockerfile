# syntax=docker/dockerfile:1.7
#
# Civic Intelligence Platform — PHP-FPM image.
#
# Base: PHP 8.4 CLI/FPM. Required extensions cover Laravel 12 + media
# processing + spatial types (pdo_mysql, mysqlnd), image metadata (exif),
# maths (bcmath), i18n (intl), archiving (zip), and DOM/XML (already in
# the upstream image). Composer is installed for dependency management.
# The image runs as a non-root `app` user per docs/14 §27.

ARG PHP_VERSION=8.4

FROM php:${PHP_VERSION}-fpm-bookworm AS base

ENV COMPOSER_HOME=/tmp/composer \
    COMPOSER_ALLOW_SUPERUSER=1 \
    COMPOSER_NO_INTERACTION=1 \
    PHP_OPCACHE_VALIDATE_TIMESTAMPS=1

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        unzip \
        libzip-dev \
        libicu-dev \
        libonig-dev \
        libxml2-dev \
        libpng-dev \
        libjpeg62-turbo-dev \
        libfreetype6-dev \
        libexif-dev \
        libssl-dev \
        zlib1g-dev \
        autoconf \
        g++ \
        make \
        pkg-config \
        supervisor; \
    rm -rf /var/lib/apt/lists/*

# Install PHP extensions required by the platform.
RUN set -eux; \
    docker-php-ext-configure gd --with-freetype --with-jpeg; \
    docker-php-ext-install -j"$(nproc)" \
        bcmath \
        exif \
        gd \
        intl \
        mbstring \
        opcache \
        pcntl \
        pdo_mysql \
        zip; \
    pecl install redis; \
    docker-php-ext-enable redis; \
    pecl clear-cache

# Install Composer (multi-stage copy keeps the image small).
COPY --from=composer:2.7 /usr/bin/composer /usr/bin/composer

# Recommended production php.ini overrides.
RUN { \
        echo 'memory_limit=512M'; \
        echo 'upload_max_filesize=100M'; \
        echo 'post_max_size=120M'; \
        echo 'max_execution_time=120'; \
        echo 'opcache.enable=1'; \
        echo 'opcache.memory_consumption=192'; \
        echo 'opcache.max_accelerated_files=20000'; \
        echo 'opcache.validate_timestamps=1'; \
        echo 'opcache.revalidate_freq=2'; \
        echo 'date.timezone=Asia/Kolkata'; \
        echo 'expose_php=Off'; \
    } > /usr/local/etc/php/conf.d/zz-cip.ini

# Non-root user for runtime. UID 1000 matches typical host user.
RUN set -eux; \
    groupadd --system --gid 1000 app; \
    useradd --system --uid 1000 --gid app --create-home --shell /bin/bash app; \
    mkdir -p /var/www/html /var/www/html/storage /var/www/html/bootstrap/cache; \
    chown -R app:app /var/www/html

WORKDIR /var/www/html

USER app

# Default command: keep the FPM process in the foreground.
CMD ["php-fpm", "-F"]
