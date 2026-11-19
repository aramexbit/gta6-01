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

## Heat misi 2 — pengecualian yang dijelaskan (diperbaiki v3.6)

Misi 1 (STEAL THE SCARLET ARROW) dulu memaksa `setWanted(3)` begitu
pemain masuk mobil — itu penyebab keluhan pertama. v3.5 memindahkan heat
ke "saat misi 1 selesai di beacon", TAPI beacon misi 1 terletak persis di
posisi mobil (-104, -24, r=7), jadi heat tetap menyala di detik yang sama
dengan masuk mobil — reproduksi v3.6 (probe Playwright, saksi dibiarkan
hidup) mengonfirmasi: wanted 2 di saat yang sama mode menjadi 'car', dan
`crimeWitnessed()` di samping mobil bernilai true, jadi masuk mobil saja
bisa memberi +1 juga. Keluhan lanjutan pengguna 19 Nov 09:33 WIB: "baru
masuk mobil langsung bintang 2".

v3.6: masuk Arrow = misi 1 selesai dengan **0 bintang** (dialog Kira saat
itu: "Nice. The Arrow is yours now."). Heat misi 2 adalah beat terpisah
yang baru menyala bila **salah satu** terpenuhi: pemain sudah mengemudi
**60 m dari titik ambil mobil**, ATAU **12 detik** sudah lewat sejak
mencuri. Saat heat menyala, Kira berkata pemilik baru saja melaporkan
pencurian, wanted menjadi **2**, dan semua mobil polisi yang terlihat
dipanggil ulang ke cincin **28–42 m** dari pemain (bukan menempel di
samping mobil). Mengambil Arrow pertama kali tidak lagi memberi bintang
meski disaksikan — itu mobil misi yang disuruh Kira ambil; aturan saksi
tetap berlaku untuk mobil traffic lain.

## HUD

Panel POLICE RESPONSE jujur terhadap mode: status OBSERVING saat
mengemudi tertulis "PATROL UNITS WATCHING" (bukan "FOOT UNIT CLOSING
IN" — unit jalan kaki tidak bisa mengejar mobil). "HELI FIRE!" hanya
muncul saat heli benar-benar menembak setelah spotlight lock 3 detik.
