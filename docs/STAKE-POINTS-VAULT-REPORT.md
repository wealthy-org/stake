# Stake — Points + Reward Vault: Laporan Implementasi & Panduan Testing

Status: pilot sudah jalan di **Robinhood Chain Testnet (chain ID 46630)**, bukan simulasi database.

---

## 1. Ringkasan buat yang pusing/belum ngerti

Ada **3 istilah** yang sering bikin bingung — ini dulu baru lanjut:

| Istilah | Artinya |
|---|---|
| **mUSDG** | "Mock USDG" — token tiruan buat testnet, dipakai sebagai uang taruhan. Siapa aja bisa bikin sendiri lewat tombol faucet, nggak perlu nunggu admin. |
| **Points (poin)** | Catatan internal "kamu rugi bersih sekian dollar". **Bukan token**, nggak bisa dijual, cuma tiket buat nuker token nanti. |
| **STAKE (reward token)** | Token beneran yang bisa dijual. Didapat dengan **nukerin poin** ke Reward Vault, dibatasi sama berapa banyak yang udah disetor ke vault itu. |

Alurnya: **Bet pakai mUSDG → kalah net-rugi → dapat Poin → tukerin Poin di Vault → dapat STAKE (kalau vault-nya udah keisi).**

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

`PaperBetMarket` manggil `emissionController.claimLossReward(marketId, user, realizedLoss)` — dia nggak peduli siapa yang ada di balik alamat itu. `RewardVault.sol` dibikin supaya **bisa dipasang di slot yang sama persis**, tinggal isi `realizedLoss` jadi poin (1:1, $1 rugi = 1 poin) alih-alih mencetak token. **Tidak ada migrasi/redeploy market yang dibutuhkan.**

### 3.3 Cara Kerja Pembagian Vault (Accumulator Pattern)

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
