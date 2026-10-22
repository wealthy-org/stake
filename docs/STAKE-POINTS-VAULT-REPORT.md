# Stake — Points + Reward Vault: Laporan Implementasi & Panduan Testing

Status: pilot sudah jalan di **Robinhood Chain Testnet (chain ID 46630)**, bukan simulasi database.

---

## 0. REVISI MILENIA — Reward Poin Untuk Pemain Yang Kalah (Baca Ini Dulu)

Keputusan produk sudah dikunci dan **berlaku surut menggantikan pola vault lama** di bagian 3.3:

> **1 poin = $1 anggaran pembelian STAKE.** Rasio poin → STAKE dikunci per batch berdasarkan hasil
> pembelian treasury. Poin **habis** saat dikonversi. Pemain mengklaim jumlah STAKE yang **sudah dialokasikan**.

### 0.1 Mekanisme

1. **Penerbitan poin.** Market selesai + final → kontrak hitung kerugian bersih per wallet → rugi bersih $10 = 10 poin. Tanpa rugi bersih = tanpa poin. Poin dicatat sekali per hasil yang memenuhi syarat; satuan dan desimal konsisten dengan aset taruhan.
2. **Sumber dana.** Dana reward **terpisah** (pendapatan protokol / creator fee yang masuk treasury / alokasi khusus). Dana pembayaran pemenang **tidak boleh** dihitung ulang sebagai dana reward. 1.000 poin diterbitkan = kewajiban pembelian $1.000. Belum ada dana → poin berstatus **"menunggu pembelian"**, bukan "siap diklaim".
3. **Konversi (batch).** Sekali sehari (atau serupa): ambil daftar poin yang belum dikonversi → treasury sediakan dana senilai total poin → **beli STAKE di tempat token diperdagangkan** (bonding curve Pons V2 sebelum graduation, pool **Uniswap v4** sesudahnya) → pakai **jumlah token yang benar-benar diterima** (setelah fee + dampak harga) sebagai dasar pembagian. Harga UI/market cap bukan harga final konversi.
4. **Alokasi & konsumsi poin.** Contoh: batch 100 poin, treasury belanja $100 → dapat 2.000 STAKE → 100 poin di batch itu **ditandai terpakai (habis)** dan **tidak pernah** ikut batch lain; 2.000 STAKE dicatat sebagai jatah pemain dan **tidak boleh** dipakai batch lain. Pembelian gagal / dana kurang → poin tetap menunggu; **jangan menghapus poin** atau diam-diam mengubah nilai $1/poin.
5. **Klaim.** Tombol Claim **hanya mengirimkan STAKE yang sudah dialokasikan** — tidak ada pembelian baru saat tombol ditekan. Jatah terkunci di jumlah konversi; naik/turun harga sesudahnya tidak mengubah jumlah token (hanya nilai pasar).
6. **Tampilan produk — tiga angka wajib terpisah:**
   - **Poin menunggu pembelian** (mis. 10 poin, anggaran $10)
   - **STAKE siap diklaim** (mis. 200 STAKE, hasil alokasi batch)
   - **STAKE sudah diklaim** (sudah dikirim ke wallet)
   - Dilarang kalimat "10 poin = 10 STAKE" atau menjanjikan jumlah token sebelum pembelian. Riwayat batch menampilkan: dana dibelanjakan, token diterima, rasio konversi, waktu, tx hash.
7. **Pengujian do: satu alur utuh** bet → final → rugi bersih → poin → pendanaan → pembelian → alokasi → klaim; plus klaim ganda, batch gagal, dana kurang, harga bergerak saat transaksi, poin baru setelah batch dimulai, dan perpindahan bonding curve → pool.

### 0.2 Peta perubahan vs pola vault lama

| Aspek | Pola lama (laporan §3.3) | Revisi ini |
|---|---|---|
| Arti 1 poin | Bagian **proporsional** dari setiap setoran vault | **Anggaran pembelian $1** |
| Treasury beli STAKE | Beli → setor → dibagi ke semua pemegang poin | Beli untuk **memenuhi poin batch tertentu** |
| Hitung token | Setoran × poin ÷ total poin saat setor | **Hasil pembelian nyata**: $10 → 200 STAKE → 10 poin = 200 STAKE |
| Pengaruh harga STAKE | Mengubah porsi, $1/poin implisit | **Menentukan jumlah token per poin**: makin mahal, makin sedikit |
| Nasib poin pasca-klaim | `accRewardPerPoint` terus berlaku → poin lama bisa ikut setoran berikutnya | **Poin habis saat dikonversi** — tidak dapat reward berulang |
| Tombol Claim | Ambil bagian dari akumulasi vault | Ambil **jatah STAKE yang sudah ditetapkan** |
| Treasury belum beli | Klaim = 0 | Poin **menunggu pembelian**, belum berubah jadi token |

### 0.3 Status kode terhadap revisi ini

- `contracts/src/RewardVault.sol` **sudah ditulis ulang** ke model batch: `pendingPoints`, `allocatedStake`, `BatchRecord` (budget terpakai, `conversionRatio`, timestamp, tx hash), metrik `totalPointsBurned`/`totalPointsConverted`, dan masih menyediakan entry **IEmissionController-compatible** supaya `PaperBetMarket` bisa menunjuk ke sana.
- Pola `accRewardPerPoint` (bagian 3.3) sudah **tidak dipakai lagi** — anggap bagian itu sebagai catatan sejarah.
- Sisa pekerjaan lihat bagian **8 (Backlog Revisi)**.

### 0.4 Kalau ada perubahan lagi, bisa di-update di smart contract? — Bisa, tapi begini

**Yang bebas diganti (belum terpasang):** skrip deploy, parameter factory, dan kode `RewardVault.sol` itu sendiri. Upgrade logika = deploy vault baru + tunjuk factory untuk market berikutnya ke vault itu — biaya nyata hampir nol di testnet.

**Yang terkunci di market pilot:** `PaperBetMarket.emissionController` adalah **state variable biasa yang dipasang sekali di constructor dan tidak punya setter** (`src/PaperBetMarket.sol:34`, diisi di baris 111; satu-satunya setter manajemen cuma `setProtocolPause`). Artinya:
1. Market pilot yang sudah terdeploy **tidak bisa dipindah** dan pasar baru saja.
2. Jalurnya **deploy ulang penuh alur pilot** (murah di testnet, cuma 1 market): deploy `RewardVault` baru → deploy `PaperBetFactory` baru yang menunjuk vault baru → buat 1 market pilot dari factory itu. Poin yang sudah tercatat di vault lama **diimpor**: backend membaca `pendingPoints` per wallet dari v1, admin memasukkannya ke vault baru lewat fungsi seeding supaya pemain tidak kehilangan poin.
3. Untuk mainnet, pertimbangkan **upgradeable proxy** atau setter `setEmissionController` dengan role + timelock supaya revisi berikutnya tidak memaksa deploy ulang market.

---

## 1. Ringkasan buat yang pusing/belum ngerti

Ada **3 istilah** yang sering bikin bingung — ini dulu baru lanjut:

| Istilah | Artinya |
|---|---|
| **mUSDG** | "Mock USDG" — token tiruan buat testnet, dipakai sebagai uang taruhan. Siapa aja bisa bikin sendiri lewat tombol faucet, nggak perlu nunggu admin. |
| **Points (poin)** | Catatan internal "kamu rugi bersih sekian dollar". **Bukan token**, nggak bisa dijual — setiap poin itu **anggaran belanja $1** yang dipakai treasury buat membeli STAKE di pasar. |
| **STAKE (reward token)** | Token beneran yang bisa dijual. Dapat dari **batch pembelian treasury**: token yang benar-benar dibeli dialokasikan ke pemilik poin sesuai rasio konversi batch itu. |

Alurnya: **Bet pakai mUSDG → kalah net-rugi → dapat Poin → batch pembelian treasury di pasar → KLAIM jatah STAKE yang sudah dialokasikan.**

> **Catatan:** panduan testing di bagian 6 masih memakai vault pilot lama (pola akumulator) yang memang sudah terpasang di testnet. Vault revisi (model batch, bagian 0) sudah ditulis tapi belum dideploy ulang — lihat bagian 0.4 dan 9.

---

## 2. Kenapa Arsitekturnya Berubah

Desain awal (brief lama): tiap ada yang kalah, sistem **langsung cetak (mint)** token baru. Simpel, tapi nggak bisa dipakai kalau token-nya nanti diluncurkan lewat **Pons V2** — karena Pons men-generate **supply tetap di awal** (fixed 1 miliar token, langsung abis ke bonding curve), dan **tidak ada hak cetak token baru lagi sesudahnya**.

Jadi mekanismenya diganti jadi 2 langkah terpisah:

```
DULU:   kalah → MINT token baru langsung
SEKARANG: kalah → dapat POIN  →  (nanti, kalau treasury udah isi vault) → KLAIM token dari vault
```

Treasury isi vault-nya dengan cara **beli token dari pasar** (pool Pons/Uniswap), bukan nyetak — jadi cocok sama cara kerja token fixed-supply.

---

## 3. Kenapa Cuma 1 Market yang On-Chain (Sisanya Masih Database)

Mayoritas market yang kelihatan di app (GOOGL, AAPL, ETH/BTC, dll) itu **masih auto-generate dan jalan di database biasa**, bukan di blockchain — persis kayak sebelum ada kerjaan on-chain ini. Bot yang bikin market-market itu (`lib/engine/autoMarket.ts`, jalan otomatis tiap tick) nulis ke database, bukan deploy kontrak baru tiap kali.

**Ini disengaja, bukan belum sempat dikerjain.** Alasannya:

- **Tiap market on-chain = 1 transaksi deploy + butuh gas fee** (walau di testnet, tetep makan "bensin" testnet yang jumlahnya terbatas). Kalau bot generate market baru tiap beberapa jam, dan SEMUANYA dibikin on-chain, saldo gas testnet admin bisa **abis cepet banget** cuma buat deploy market yang kebanyakan juga nggak dipakai orang.
- Bot auto-generate itu desainnya emang buat "jaga papan market biar nggak kosong" — volumenya tinggi, banyak yang dibikin terus dibiarin aja. Kalau ini di-on-chain-in semua, boros banget buat sesuatu yang levelnya cuma "biar board nggak sepi".
- **1 market pilot** sengaja dipilih manual dan di-deploy sekali aja, khusus buat **membuktikan mekanismenya jalan** (bet → resolve → klaim poin → vault → klaim token). Itu cukup buat testing, nggak perlu semua market ikutan on-chain.

**Jadi sekarang statusnya:**

| Jenis market | Jalan di mana | Butuh gas? |
|---|---|---|
| Auto-generate dari bot (GOOGL, ETH, BTC, dll — mayoritas) | Database | Tidak |
| "On-chain pilot" (1 market doang) | Blockchain beneran | Ya |

Kalau nanti mau beneran pindah SEMUA market ke on-chain (bukan cuma pilot), itu keputusan terpisah — dan perlu dipikirin ulang soal budget gas-nya (atau pola "generate on-chain tapi lebih jarang", bukan tiap bot jalan).

## 4. Arsitektur Teknis

### 3.1 Komponen

| Komponen | File | Fungsi |
|---|---|---|
| `PaperBetMarket.sol` | sudah ada sebelumnya | Tempat bet, resolve, klaim payout menang. **Tidak diubah sama sekali.** |
| `RewardVault.sol` | **baru** | Pengganti `EmissionController` lama. Nyatet poin, nerima setoran treasury, bagi proporsional pas diklaim. |
| `FixedSupplyToken.sol` | baru (testnet only) | Tiruan token hasil Pons — supply tetap, tidak bisa dicetak lagi setelah deploy. |
| `MockCollateral.sol` | sudah ada | mUSDG — bisa di-mint siapa aja (`mint(address, amount)`, tanpa izin). |

### 3.2 Kenapa `PaperBetMarket.sol` Tidak Perlu Diubah

`PaperBetMarket` manggil `emissionController.claimLossReward(marketId, user, realizedLoss)` — dia nggak peduli siapa yang ada di balik alamat itu. `RewardVault.sol` dibikin supaya **bisa dipasang di slot yang sama persis**, tinggal isi `realizedLoss` jadi poin (1:1, $1 rugi = 1 poin) alih-alih mencetak token.

> **Status bagian ini pasca-revisi:** kompatibilitas slot **masih berlaku** untuk market baru, tapi kalimat "tidak ada redeploy yang dibutuhkan" **kedaluwarsa** — market pilot yang sudah terpasang tidak bisa dipindah ke vault baru (tidak ada setter), jadi pilot perlu di-deploy ulang dengan vault revisi. Lihat bagian **0.4**.

### 3.3 Cara Kerja Pembagian Vault (Accumulator Pattern) — **POLA LAMA, SUDAH DIGANTI**

> Revisi (bagian 0) mengganti pola ini dengan **batch konversi**: poin = anggaran $1, masuk satu batch, habis saat terkonversi; poin lama **tidak** menerima bagian dari setoran berikutnya. Catatan di bawah dipertahankan sebagai sejarah desain.

Pola standar DeFi (dipakai di SushiBar, MasterChef, Synthetix) — supaya adil tanpa perlu hitung manual tiap orang:

1. Tiap treasury setor token baru → 1 angka global (`accRewardPerPoint`) naik, sebanding sama jumlah token dibagi total poin yang ada **saat itu**.
2. Tiap wallet nyimpen "berapa accRewardPerPoint terakhir kali dia nge-update poin/klaim".
3. Jumlah yang bisa diklaim = `(accRewardPerPoint sekarang − punya dia terakhir) × poin dia`.

**Sifat penting yang sudah ditest (9 skenario, semua lolos):**
- Poin yang baru muncul **setelah** ada setoran, **tidak bisa** ikut narik bagian dari setoran yang udah lewat.
- Klaim **tidak pernah** melebihi saldo token yang beneran ada di vault — nggak ada "janji kosong".

### 3.4 Pembuktian Pakai Pool Asli (Bukan Simulasi Mint)

Biar nggak cuma teori, treasury-nya beneran **swap** di pool **Uniswap v4** — exchange yang sama persis dipakai Pons V2 pas token "graduate" dari bonding curve. Ketemu fakta penting: PoolManager Uniswap v4 (`0x8366a39CC670B4001A1121B8F6A443A643e40951`) ternyata **sudah live juga di testnet**, alamatnya sama persis kayak mainnet. Jadi simulasi ini pakai infrastruktur **beneran**, bukan buatan sendiri.

---

## 5. Alamat Kontrak (Testnet, Chain ID 46630)

| Kontrak | Alamat |
|---|---|
| Market pilot ("On-chain pilot: Will ETH be above $5,000?") | `0xC360a6fA7c02d09d66d65d53637157DA21BB6cfB` |
| `RewardVault` (pilot) | `0xa5c4dD985AC3f627FA697683537d2ca02476dafb` |
| mUSDG (`MockCollateral`) | `0x9084a6Fb1740a6Ad63c564e9213A885Ff035ea43` |
| Token simulasi Pons (`FixedSupplyToken`) | `0xAFCC99dBA2a0F1ce21D9da79A30FE75907118630` |
| Uniswap v4 PoolManager (asli, bukan buatan sendiri) | `0x8366a39CC670B4001A1121B8F6A443A643e40951` |

---

## 6. Panduan Testing — Langkah demi Langkah

### Step 0 — Setup wallet
1. Buka MetaMask (atau Phantom versi EVM).
2. Tambahin network **Robinhood Chain Testnet**:
   - RPC URL: `https://rpc.testnet.chain.robinhood.com`
   - Chain ID: `46630`
   - Currency Symbol: `ETH`
3. Connect wallet itu ke app (tombol "Connect wallet", pilih **"Browser EVM Wallet"** — JANGAN pilih "Ephemeral Test Key", itu nggak bisa sign transaksi beneran).

### Step 1 — Isi saldo mUSDG (ganti nama dari "mockusdg")
1. Buka market **"On-chain pilot: Will ETH be above $5,000?"** di menu Markets.
2. Di panel bet slip, klik tombol **"Get on-chain test funds (1,000 mUSDG)"**.
3. Konfirmasi di wallet (1x transaksi, gratis — cuma butuh sedikit gas testnet).
4. Tunggu sampai sukses — saldo mUSDG kamu nambah 1.000.

> Kalau wallet butuh gas testnet (ETH buat bayar network fee) dan nggak punya sama sekali, minta ke siapapun yang pegang wallet admin buat kirim sedikit — ini bukan mUSDG, ini "bensin" jaringan, beda hal.

### Step 2 — Pasang taruhan on-chain
1. Masih di market yang sama, pilih YES atau NO, isi jumlah (misal $10).
2. Klik **"Place bet"**.
3. Wallet bakal minta **2 konfirmasi**: pertama **approve** (izin kontrak pakai mUSDG kamu), kedua **bet** beneran. Kalau cuma 1 popup lalu diem, cek lagi — mungkin approve-nya kecancel.
4. Toast bakal bilang **"On-chain bet sent"** kalau sukses (beda sama bet di market biasa yang bilang "Bet placed" doang).

### Step 3 — Nunggu market resolve
Market ini auto-tutup setelah waktu betting-nya abis, terus resolve otomatis berdasarkan harga ETH asli dari Binance. **Nggak perlu ngapa-ngapain**, tinggal nunggu.

### Step 4 — Kalau kalah: klaim Poin (BUKAN langsung token!)
1. Buka slip hasil di market itu (halaman detail market, setelah resolve).
2. Kalau kamu net-rugi, bakal ada tombol klaim "STAKE" — klik itu.
3. **Ini cuma mencatat poin kamu di `RewardVault`, BUKAN ngasih token langsung.** Toast-nya bakal bilang "STAKE points accrued — claim the token itself from the STAKE page once the reward vault is funded".

### Step 5 — Cek & klaim dari Vault (ini baru dapat TOKEN beneran)
1. Buka menu **STAKE** (halaman `/app/paper`).
2. Lihat section **"On-chain points + vault pilot"** di paling atas:
   - **Total points** — total poin semua orang.
   - **Total reward deposited** — berapa token yang udah disetor treasury ke vault. **Kalau ini masih 0, klaim kamu juga bakal 0** — wajar, bukan bug, tinggal nunggu treasury nyetor.
   - **Your pending claim** — jatah kamu sekarang, kalau ada.
3. Kalau "Your pending claim" > 0, klik **"Claim from vault"** → konfirmasi di wallet → token beneran masuk ke wallet kamu.

### Kalau ketemu error pas transaksi
Sekarang semua error wallet diterjemahin ke bahasa biasa:
- **"Transaction cancelled."** → kamu sendiri yang batalin pop-up wallet.
- **"Not enough token balance..."** → saldo mUSDG kurang, balik ke Step 1.
- **"RewardVault: nothing to claim"** → poin kamu udah pernah diklaim semua, nggak ada sisa (ini normal, bukan bug — nyegah klaim dobel).

---

## 7. Yang Masih Harus Diputuskan / Dikerjakan (Bukan Lagi Soal Kode)

| Item | Yang Tanggung Jawab |
|---|---|
| Launch token beneran di Pons V2 | Leader |
| Konfirmasi ke tim Pons: bisa `feeRedirects` otomatis ke treasury kita, atau harus klaim manual tiap kali? | Leader/tim, kontak `contact@ponsfamily.com` |
| Berapa % supply token disisihkan buat reward vault | Tim produk |
| Seberapa sering treasury beli & setor ke vault (harian/mingguan?) | Tim produk |
| Rate poin final & milestone genesis (sekarang masih angka testnet) | Tim produk |
| Audit keamanan sebelum mainnet | Belum dimulai |

---

## 8. Yang Sudah Pasti Beres (Bukti, Bukan Janji)

- 9 unit test `RewardVault` — semua lolos.
- 1 integration test penuh: bet → resolve → klaim poin → treasury setor → klaim token, pakai kontrak market yang sama persis (nggak diubah).
- 25 total test kontrak Solidity — semua lolos.
- Transaksi swap beneran di Uniswap v4 testnet (bukan simulasi) — ada tx hash-nya.
- Market pilot on-chain sudah bisa dites dari UI oleh siapa aja, nggak perlu command line.

---

## 9. Backlog Revisi — Urutan Kerja Berikutnya

Urutannya disusun supaya setiap langkah bisa dites terpisah (sesuai syarat pengujian di bagian 7):

1. **Deploy ulang alur pilot dengan vault revisi**: `RewardVault` (model batch) → `PaperBetFactory` baru → 1 market pilot baru. Market lama dibiarkan tetap sebagai registri sejarah.
2. **Import poin lama**: baca `pendingPoints` per wallet dari vault v1, seeding ke vault baru lewat fungsi admin — pemain tidak kehilangan poin.
3. **Executor batch harian** (backend/worker): kumpulkan poin yang belum dikonversi → sediakan dana treasury senilai $1/poin → panggil `executeBatch` vault → catat `conversionRatio` nyata dari hasil pembelian (jangan dari harga UI). Tx gagal = batch dibatalkan, poin tetap menunggu.
4. **Pemisahan dana reward** di treasury: saldo reward dipisah dari dana kemenangan; tambahkan pemeriksaan "1.000 poin = kewajiban $1.000 ada saldonya" sebelum batch jalan; kalau kurang → batch skip, poin tetap "menunggu pembelian".
5. **UI STAKE page** (`/app/paper`): pastikan tiga angka (poin menunggu pembelian / STAKE siap diklaim / STAKE sudah diklaim) terbaca jelas dan tidak ada copy yang menyamakan poin dengan jumlah token. Sertakan riwayat batch: dana dibelanjakan, token diterima, rasio, waktu, tx hash.
6. **Pengujian penuh** (satu alur + failure paths): klaim ganda, pembelian gagal, dana kurang, harga bergerak saat transaksi, poin muncul setelah batch dimulai, dan perpindahan bonding curve → pool Uniswap v4 pas graduation.
7. **Keamanan mainnet**: putuskan upgradeable proxy vs setter `setEmissionController` (role + timelock), lalu audit.
