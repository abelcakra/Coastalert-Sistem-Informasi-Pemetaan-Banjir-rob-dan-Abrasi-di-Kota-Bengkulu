<?php

namespace App\Http\Controllers;

use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;

class PageController extends Controller
{
    public function index(): View
    {
        return view('public.index');
    }

    public function peta(): View
    {
        return view('public.peta');
    }

    public function dashboard(): View
    {
        return view('public.dashboard');
    }

    public function laporan(): View
    {
        return view('public.laporan');
    }

    public function status(): View
    {
        return view('public.status');
    }

    public function adminLogin(): View
    {
        return view('admin.login');
    }

    public function adminDashboard(): View
    {
        return view('admin.index');
    }

    public function adminPeta(): View
    {
        return view('admin.peta');
    }

    public function adminDataLaporan(): View
    {
        return view('admin.data-laporan');
    }

    public function adminVerifikasi(): View
    {
        return view('admin.verifikasi');
    }

    public function adminTitik(): View
    {
        return view('admin.titik');
    }

    public function adminRedirect(): RedirectResponse
    {
        return redirect()->route('admin.dashboard');
    }
}
