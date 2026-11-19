# Wanted — witness rule (v3.5)

Aturan wanted PIER HEAT sejak v3.5, atas keluhan pengguna (19 Nov 2026):
"baru naik mobil langsung bintang 3 — harusnya tanpa bintang, baru ada
bintang kalau melakukan kejahatan".

## Aturan

- **Mulai game + naik mobil biasa = 0 bintang.** Masuk mobil bukan
  kejahatan. `finishEnterCar()` (`main.js`) tidak lagi menaikkan wanted
  sendiri.
- **Wanted naik HANYA bila ada saksi** — `crimeWitnessed()` (`core.js`):
  polisi jalan kaki / mobil polisi yang terlihat, atau pejalan kaki yang
  masih berjalan, dalam jarak 30 m dari pemain. Tanpa saksi = tanpa
  bintang. Jarak saja — build ini tidak punya tes garis pandang /
  oklusi, jadi saksi di balik gedung tetap terhitung; itu perkiraan
  yang didokumentasikan, bukan aturan tersembunyi.
- Kejahatan yang menaikkan wanted:
  - Mencuri mobil yang DILIHAT saksi: +1 (`main.js finishEnterCar`).
  - Menembak dan meleset tapi disaksikan: naik ke 1 (`main.js shoot`).
    Tembakan yang tidak disaksikan = suara saja, tanpa bintang.
    Unsur acak lama (50% dapat bintang saat meleset) DIHAPUS.
  - Menabrak / melukai pejalan kaki dengan mobil pemain, disaksikan: +1
    (`sim.js updatePeds`). Tanpa saksi: toast "NO WITNESS", tanpa bintang.
  - Menabrak mobil polisi patroli (status PATROL, tabrakan keras, cooldown
    5 detik): naik ke minimal 1 (`sim.js updateTraffic`). Mobil polisi
    yang sedang mengejar / menabrak pemain TIDAK dihitung — itu aksi
    polisi, bukan kejahatan baru pemain.
  - Menyerang polisi (tembak polisi / mobil polisi sampai rusak):
    langsung minimal 2 — korban adalah polisi, jadi disaksikan menurut
    definisi (`main.js shoot`, tidak diubah v3.5).
- **0 bintang:** polisi hanya patroli, tidak mengejar / menabrak /
  menembak. **1 bintang:** polisi jalan kaki menangkap saja (hanya saat
  pemain jalan kaki), tidak menabrak mobil. **2+:** mobil polisi
  mengejar + roadblock; ram hanya 3+ (hanya unit terdepan, burst 2 detik);
  heli 3+, heli kedua 5.
- **Decay (tidak diubah):** tidak ada polisi dalam 40 m selama 22 detik
  → wanted turun 1; di 0: "You lost the cops."

## Heat misi 2 — pengecualian yang dijelaskan

Misi 1 (STEAL THE SCARLET ARROW) dulu memaksa `setWanted(3)` begitu
pemain masuk mobil — itu penyebab keluhan. v3.5: masuk mobil = 0 bintang.
Heat untuk misi 2 (ESCAPE TO THE PIER SAFEHOUSE) adalah beat cerita
yang terpisah dan dijelaskan di dalam game: begitu misi 1 selesai di
beacon, Kira berkata pemilik mobil baru saja melaporkannya dicuri dan
polisi dikerahkan — wanted menjadi **2** (cukup untuk mobil polisi
mengejar + roadblock; heli butuh 3). Jadi pemain sempat mengemudi
tanpa bintang sebelum laporan itu masuk.

## HUD

Panel POLICE RESPONSE jujur terhadap mode: status OBSERVING saat
mengemudi tertulis "PATROL UNITS WATCHING" (bukan "FOOT UNIT CLOSING
IN" — unit jalan kaki tidak bisa mengejar mobil). "HELI FIRE!" hanya
muncul saat heli benar-benar menembak setelah spotlight lock 3 detik.
