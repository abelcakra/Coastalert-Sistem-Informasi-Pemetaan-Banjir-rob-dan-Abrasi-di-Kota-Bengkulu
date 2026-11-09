#!/usr/bin/env python3
"""
process_gea.py - Olah raster InaRISK BNPB GEA untuk CoastAlert.

Dependensi (hanya untuk pengolahan offline, bukan dependensi runtime aplikasi):
    python -m pip install numpy rasterio shapely pyproj geopandas matplotlib pillow

Contoh:
    python scripts/process_gea.py ^
        --raster "C:\\path\\inarisk_gea_kota_bengkulu_clip_utm48s.tif" ^
        --batas "C:\\path\\batas_kota_bengkulu.geojson"

Keluaran:
    data/gea/sumber/                         salinan berkas sumber
    data/gea/gea_klasifikasi_utm48s.tif      1=Rendah, 2=Sedang, 3=Tinggi, 0=NoData
    data/gea/gea-stats.json                  statistik untuk API/dashboard
    data/gea/gea-visualisasi.png             visualisasi peta
    public/img/gea/gea-kota-bengkulu.png     overlay transparan untuk Leaflet

Nilai 0 pada raster sumber diperlakukan sebagai piksel VALID (kelas Rendah),
bukan NoData. Hanya nilai -9999 yang dianggap NoData.
"""
from __future__ import annotations

import argparse
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

import geopandas as gpd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import rasterio
from matplotlib.patches import Patch
from PIL import Image
from rasterio.features import geometry_mask
from rasterio.warp import transform_bounds
from shapely.geometry import mapping


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data" / "gea"
SOURCE_DIR = OUT_DIR / "sumber"
WEB_DIR = ROOT / "public" / "img" / "gea"

DEFAULT_RASTER = Path(r"C:\Users\M. NURDIN\Downloads\inarisk_gea_kota_bengkulu_clip_utm48s.tif")
DEFAULT_BATAS = Path(r"C:\Users\M. NURDIN\Downloads\batas_kota_bengkulu.geojson")

THRESHOLD = 1.0 / 3.0
KELAS = {
    "Rendah": {"kode": 1, "warna": (18, 130, 27, 255), "hex": "#12821B"},
    "Sedang": {"kode": 2, "warna": (245, 247, 40, 255), "hex": "#F5F728"},
    "Tinggi": {"kode": 3, "warna": (200, 62, 77, 255), "hex": "#C83E4D"},
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Olah raster GEA InaRISK BNPB.")
    parser.add_argument("--raster", type=Path, default=DEFAULT_RASTER)
    parser.add_argument("--batas", type=Path, default=DEFAULT_BATAS)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    raster_path: Path = args.raster
    batas_path: Path = args.batas

    if not raster_path.exists():
        raise SystemExit(f"Raster tidak ditemukan: {raster_path}")
    if not batas_path.exists():
        raise SystemExit(f"Batas administrasi tidak ditemukan: {batas_path}")

    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    WEB_DIR.mkdir(parents=True, exist_ok=True)

    # Salin sumber agar hasil olahan tetap dapat dilacak tanpa mengubah berkas asli.
    shutil.copy2(raster_path, SOURCE_DIR / raster_path.name)
    shutil.copy2(batas_path, SOURCE_DIR / batas_path.name)

    with rasterio.open(raster_path) as ds:
        data = ds.read(1)
        nodata = ds.nodata
        valid = np.isfinite(data)
        if nodata is not None:
            valid &= data != nodata

        # Pastikan raster sesuai batas administrasi Kota Bengkulu.
        batas = gpd.read_file(batas_path)
        if batas.crs is None:
            batas = batas.set_crs("EPSG:4326")
        batas_utm = batas.to_crs(ds.crs)
        geom = batas_utm.geometry.union_all()
        inside = geometry_mask(
            [mapping(geom)],
            out_shape=data.shape,
            transform=ds.transform,
            invert=True,
            all_touched=False,
        )
        valid_administrasi = valid & inside
        valid_di_luar = int((valid & ~inside).sum())
        if valid_di_luar:
            print(f"[peringatan] {valid_di_luar} piksel valid berada di luar batas administrasi; diabaikan.")

        # Klasifikasi memakai ambang, bukan pencocokan nilai diskret.
        kelas = np.zeros(data.shape, dtype=np.uint8)
        low = valid_administrasi & (data <= THRESHOLD)
        medium = valid_administrasi & (data > THRESHOLD) & (data <= 2.0 * THRESHOLD)
        high = valid_administrasi & (data > 2.0 * THRESHOLD) & (data <= 1.0)
        kelas[low] = KELAS["Rendah"]["kode"]
        kelas[medium] = KELAS["Sedang"]["kode"]
        kelas[high] = KELAS["Tinggi"]["kode"]

        pixel_area_ha = abs(ds.transform.a * ds.transform.e) / 10_000.0
        total_valid = int(valid_administrasi.sum())
        total_piksel = int(data.size)

        statistik = {}
        for nama, meta in KELAS.items():
            jumlah = int((kelas == meta["kode"]).sum())
            statistik[nama] = {
                "piksel": jumlah,
                "luasHa": round(jumlah * pixel_area_ha, 2),
                "persen": round((jumlah / total_valid * 100.0) if total_valid else 0.0, 4),
            }

        total_luas = round(total_valid * pixel_area_ha, 2)
        total_persen = round(sum(v["persen"] for v in statistik.values()), 4)

        # Raster klasifikasi: 0 = NoData, 1..3 = kelas.
        profile = ds.profile.copy()
        profile.update(
            dtype="uint8",
            nodata=0,
            count=1,
            compress="deflate",
            predictor=2,
            tiled=True,
            blockxsize=256,
            blockysize=256,
        )
        klasifikasi_path = OUT_DIR / "gea_klasifikasi_utm48s.tif"
        with rasterio.open(klasifikasi_path, "w", **profile) as dst:
            dst.write(kelas, 1)

        # Overlay RGBA transparan untuk Leaflet. Baris 0 = utara.
        rgba = np.zeros((data.shape[0], data.shape[1], 4), dtype=np.uint8)
        for nama, meta in KELAS.items():
            rgba[kelas == meta["kode"]] = meta["warna"]
        overlay_path = WEB_DIR / "gea-kota-bengkulu.png"
        Image.fromarray(rgba).save(overlay_path, optimize=True)

        bounds_utm = list(ds.bounds)
        bounds_wgs84 = list(
            transform_bounds(ds.crs, "EPSG:4326", *ds.bounds, densify_pts=21)
        )
        south, west = bounds_wgs84[1], bounds_wgs84[0]
        north, east = bounds_wgs84[3], bounds_wgs84[2]

        batas_bounds = list(batas.total_bounds)
        luas_atribut = None
        if "luas_ha" in batas.columns:
            try:
                luas_atribut = round(float(batas["luas_ha"].iloc[0]), 6)
            except (TypeError, ValueError):
                luas_atribut = None

        stats = {
            "id": "gea-kota-bengkulu",
            "jenis": "GEA",
            "judul": "Zona Bahaya GEA (Gelombang Ekstrem dan Abrasi)",
            "sumber": "InaRISK BNPB",
            "satuanLuas": "ha",
            "metode": (
                "Klasifikasi raster indeks bahaya GEA: Rendah <= 1/3; "
                "Sedang > 1/3 sampai <= 2/3; Tinggi > 2/3 sampai <= 1. "
                "Piksel bernilai 0 tetap valid dan masuk kelas Rendah; "
                "hanya nilai NoData -9999 yang dikeluarkan."
            ),
            "crs": str(ds.crs),
            "resolusiM": round(abs(ds.transform.a), 3),
            "pikselAreaHa": round(pixel_area_ha, 6),
            "nodata": nodata,
            "ambang": {
                "Rendah": "<= 1/3",
                "Sedang": "> 1/3 dan <= 2/3",
                "Tinggi": "> 2/3 dan <= 1",
            },
            "piksel": {
                "total": total_piksel,
                "valid": total_valid,
                "nodata": total_piksel - total_valid,
                "nolValid": int((valid_administrasi & (data == 0)).sum()),
                "validDiLuarBatas": valid_di_luar,
            },
            "kelas": statistik,
            "total": {
                "piksel": total_valid,
                "luasHa": total_luas,
                "persen": total_persen,
            },
            "batasAdministrasi": {
                "nama": "Kota Bengkulu",
                "crs": str(batas.crs),
                "boundsWgs84": [round(v, 8) for v in batas_bounds],
                "luasAtributHa": luas_atribut,
                "luasGeometriUtmHa": round(float(geom.area / 10_000.0), 6),
            },
            "raster": {
                "sumber": raster_path.name,
                "batas": batas_path.name,
                "boundsUtm": [round(v, 6) for v in bounds_utm],
                "boundsWgs84": [round(v, 8) for v in bounds_wgs84],
                "lebar": ds.width,
                "tinggi": ds.height,
                "nilaiMinValid": float(data[valid_administrasi].min()),
                "nilaiMaxValid": float(data[valid_administrasi].max()),
            },
            "web": {
                "gambar": "/img/gea/gea-kota-bengkulu.png",
                "boundsLeaflet": [
                    [round(south, 8), round(west, 8)],
                    [round(north, 8), round(east, 8)],
                ],
                "opasitas": 0.55,
            },
            "catatan": (
                "Estimasi luas zona bahaya GEA berdasarkan raster InaRISK BNPB. "
                "Bukan luas wilayah yang sudah terdampak secara nyata dan tidak "
                "dipakai untuk statistik Banjir Rob."
            ),
            "dibuat": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }

        stats_path = OUT_DIR / "gea-stats.json"
        stats_path.write_text(json.dumps(stats, ensure_ascii=False, indent=2), encoding="utf-8")

        buat_visualisasi(
            rgba=rgba,
            bounds=(ds.bounds.left, ds.bounds.right, ds.bounds.bottom, ds.bounds.top),
            batas_utm=batas_utm,
            output=OUT_DIR / "gea-visualisasi.png",
            stats=stats,
        )

        print("Raster :", ds.width, "x", ds.height, ds.crs, ds.dtypes, "resolusi", ds.res)
        print("NoData :", nodata, "| valid", total_valid, "| nol valid", stats["piksel"]["nolValid"])
        print("Kelas  :")
        for nama, nilai in statistik.items():
            print(f"  {nama:7s} {nilai['piksel']:7d} piksel  {nilai['luasHa']:10.2f} ha  {nilai['persen']:.4f}%")
        print(f"  Total   {total_valid:7d} piksel  {total_luas:10.2f} ha  100%")
        print("Output :", stats_path)
        print("Overlay:", overlay_path, f"({overlay_path.stat().st_size:,} byte)")
        print("Klasifikasi:", klasifikasi_path)
        print("Visualisasi:", OUT_DIR / "gea-visualisasi.png")


def buat_visualisasi(rgba, bounds, batas_utm, output: Path, stats: dict) -> None:
    """Buat peta statis ringkas untuk dokumentasi hasil olahan."""
    matplotlib.use("Agg")
    left, right, bottom, top = bounds
    fig, ax = plt.subplots(figsize=(8.4, 10.2))
    fig.patch.set_facecolor("#F4F7F7")
    ax.set_facecolor("#EEF3F3")

    ax.imshow(
        rgba,
        extent=(left, right, bottom, top),
        origin="upper",
        interpolation="nearest",
        zorder=1,
    )
    batas_utm.boundary.plot(ax=ax, color="#123F5A", linewidth=1.25, zorder=3)
    ax.set_xlim(left - 250, right + 250)
    ax.set_ylim(bottom - 250, top + 250)
    ax.set_aspect("equal")
    ax.set_xticks([])
    ax.set_yticks([])
    for spine in ax.spines.values():
        spine.set_visible(False)

    fig.text(
        0.5,
        0.966,
        "Zona Bahaya GEA - Kota Bengkulu",
        ha="center",
        va="top",
        fontsize=15,
        fontweight="bold",
        color="#123F5A",
    )
    fig.text(
        0.5,
        0.932,
        "Gelombang Ekstrem dan Abrasi | Raster InaRISK BNPB",
        ha="center",
        va="top",
        fontsize=8.5,
        color="#4E6873",
    )

    handles = [
        Patch(
            facecolor=meta["hex"],
            edgecolor="none",
            label=f"{nama} ({stats['kelas'][nama]['luasHa']:.2f} ha)".replace(".", ","),
        )
        for nama, meta in KELAS.items()
    ]
    ax.legend(
        handles=handles,
        title="Kelas zona bahaya",
        loc="lower left",
        frameon=True,
        facecolor="white",
        edgecolor="#D6E2E4",
        fontsize=8.5,
        title_fontsize=8.5,
    )

    # Skala sederhana 5 km di bagian bawah kanan.
    x0 = right - 5_000 - 350
    x1 = right - 350
    y0 = bottom + 300
    ax.plot([x0, x1], [y0, y0], color="#123F5A", linewidth=3, solid_capstyle="butt", zorder=4)
    ax.text(
        (x0 + x1) / 2,
        y0 + 100,
        "5 km",
        ha="center",
        va="bottom",
        fontsize=8,
        color="#123F5A",
        zorder=4,
    )

    fig.text(
        0.5,
        0.018,
        "Estimasi luas zona bahaya, bukan luas wilayah terdampak. "
        "Sumber: InaRISK BNPB; batas: Kota Bengkulu.",
        ha="center",
        va="bottom",
        fontsize=7.5,
        color="#627983",
    )
    fig.subplots_adjust(left=0.03, right=0.97, top=0.90, bottom=0.06)
    fig.savefig(output, dpi=160, facecolor=fig.get_facecolor())
    plt.close(fig)


if __name__ == "__main__":
    main()
