<?php

namespace App\Http\Requests;

use App\Support\Legacy;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreReportRequest extends FormRequest
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
            'namaPelapor' => ['required', 'string', 'max:150'],
            'jenis' => ['required', Rule::in(Legacy::JENIS)],
            'deskripsi' => ['required', 'string'],
            'lat' => ['required', 'numeric', 'between:-90,90'],
            'lng' => ['required', 'numeric', 'between:-180,180'],
            'kontak' => ['nullable', 'string', 'max:100'],
            'alamat' => ['nullable', 'string', 'max:255'],
            'kecamatan' => ['nullable', 'string', 'max:100'],
            'tanggal' => ['nullable', 'date_format:Y-m-d'],
            'foto' => ['nullable', 'file', 'max:5120'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'namaPelapor.required' => 'Nama pelapor wajib diisi.',
            'namaPelapor.max' => 'Nama pelapor maksimal 150 karakter.',
            'jenis.required' => 'Jenis laporan harus "rob" atau "abrasi".',
            'jenis.in' => 'Jenis laporan harus "rob" atau "abrasi".',
            'deskripsi.required' => 'Deskripsi kejadian wajib diisi.',
            'lat.required' => 'Titik lokasi wajib dipilih di peta; latitude dan longitude tidak boleh kosong.',
            'lat.numeric' => 'Titik lokasi wajib dipilih di peta; latitude dan longitude tidak boleh kosong.',
            'lat.between' => 'Latitude harus berada pada rentang -90 sampai 90.',
            'lng.required' => 'Titik lokasi wajib dipilih di peta; latitude dan longitude tidak boleh kosong.',
            'lng.numeric' => 'Titik lokasi wajib dipilih di peta; latitude dan longitude tidak boleh kosong.',
            'lng.between' => 'Longitude harus berada pada rentang -180 sampai 180.',
            'tanggal.date_format' => 'Tanggal harus berformat YYYY-MM-DD.',
            'foto.file' => 'Berkas foto kosong atau tidak dapat dibaca.',
            'foto.max' => 'Ukuran foto maksimal 5 MB.',
        ];
    }
}
