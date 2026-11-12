<?php

namespace App\Http\Requests;

use App\Support\Legacy;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SpotRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'nama' => ['required', 'string', 'max:150'],
            'kecamatan' => ['nullable', 'string', 'max:100'],
            'jenis' => ['required', Rule::in(Legacy::JENIS)],
            'jenisAncaman' => ['nullable', 'string', 'max:100'],
            'kategori' => ['nullable'],
            'statusKoordinat' => ['nullable'],
            'lat' => ['required', 'numeric', 'between:-90,90'],
            'lng' => ['required', 'numeric', 'between:-180,180'],
            'tinggiRob' => ['nullable', 'numeric'],
            'lajuAbrasi' => ['nullable', 'numeric'],
            'luasTerdampakHa' => ['nullable', 'numeric'],
            'kkTerdampak' => ['nullable', 'numeric'],
            'tahun' => ['nullable', 'numeric'],
            'tanggal' => ['nullable', 'regex:'.Legacy::POLA_TANGGAL],
            'deskripsi' => ['nullable', 'string'],
            'sumber' => ['nullable', 'string', 'max:200'],
            'terverifikasi' => ['nullable'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'nama.required' => 'Nama titik wajib diisi.',
            'nama.max' => 'Nama titik maksimal 150 karakter.',
            'jenis.required' => 'Jenis harus "rob" atau "abrasi".',
            'jenis.in' => 'Jenis harus "rob" atau "abrasi".',
            'jenisAncaman.max' => 'Jenis ancaman maksimal 100 karakter.',
            'lat.required' => 'Latitude tidak valid.',
            'lat.numeric' => 'Latitude tidak valid.',
            'lat.between' => 'Latitude tidak valid.',
            'lng.required' => 'Longitude tidak valid.',
            'lng.numeric' => 'Longitude tidak valid.',
            'lng.between' => 'Longitude tidak valid.',
            'tanggal.regex' => 'Tanggal harus YYYY-MM-DD atau "YYYY-MM-DD s.d. YYYY-MM-DD".',
            'sumber.max' => 'Sumber maksimal 200 karakter.',
        ];
    }
}
