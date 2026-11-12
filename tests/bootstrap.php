<?php

declare(strict_types=1);

require __DIR__.'/../vendor/autoload.php';

$name = $_ENV['DB_DATABASE'] ?? $_SERVER['DB_DATABASE'] ?? getenv('DB_DATABASE');
if (! is_string($name) || $name === '') {
    $name = 'coastalert_test';
}

if ($name === 'coastalert' || ! str_ends_with($name, '_test') || preg_match('/^[A-Za-z0-9_]+$/', $name) !== 1) {
    fwrite(STDERR, "Refusing to create an unsafe test database.\n");
    exit(1);
}

$host = $_ENV['DB_HOST'] ?? $_SERVER['DB_HOST'] ?? getenv('DB_HOST');
$port = $_ENV['DB_PORT'] ?? $_SERVER['DB_PORT'] ?? getenv('DB_PORT');
$user = $_ENV['DB_USERNAME'] ?? $_SERVER['DB_USERNAME'] ?? getenv('DB_USERNAME');
$password = $_ENV['DB_PASSWORD'] ?? $_SERVER['DB_PASSWORD'] ?? getenv('DB_PASSWORD');

$host = is_string($host) && $host !== '' ? $host : '127.0.0.1';
$port = is_string($port) && $port !== '' ? $port : '3306';
$user = is_string($user) && $user !== '' ? $user : 'root';
$password = is_string($password) ? $password : '';

$pdo = new PDO(
    sprintf('mysql:host=%s;port=%s;charset=utf8mb4', $host, $port),
    $user,
    $password,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION],
);

$pdo->exec(sprintf('CREATE DATABASE IF NOT EXISTS `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci', $name));

register_shutdown_function(static function () use ($pdo, $name): void {
    try {
        $pdo->exec(sprintf('DROP DATABASE IF EXISTS `%s`', $name));
    } catch (Throwable $e) {
        fwrite(STDERR, "Test database cleanup failed; the isolated test database may remain.\n");
    }
});
