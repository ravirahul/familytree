FROM php:8.3-apache
RUN apt-get update && apt-get install -y --no-install-recommends libpng-dev libjpeg-dev libwebp-dev libfreetype6-dev libzip-dev libcurl4-openssl-dev \
 && docker-php-ext-configure gd --with-jpeg --with-webp --with-freetype \
 && docker-php-ext-install -j"$(nproc)" pdo_mysql pdo_sqlite gd curl mbstring zip \
 && a2enmod rewrite headers \
 && rm -rf /var/lib/apt/lists/*
COPY public_html/ /var/www/html/
RUN mkdir -p /var/www/html/admin/uploads /var/www/html/storage \
 && chown -R www-data:www-data /var/www/html
# the installer writes .env next to index; keep it on a volume so it survives rebuilds
RUN ln -sf /var/www/html/env/.env /var/www/html/.env
EXPOSE 80
