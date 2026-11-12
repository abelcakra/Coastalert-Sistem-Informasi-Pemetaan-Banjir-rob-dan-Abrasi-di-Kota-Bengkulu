<?php

namespace App\Exceptions;

use RuntimeException;

class ImportValidationException extends RuntimeException
{
    public bool $validasi = true;
}
