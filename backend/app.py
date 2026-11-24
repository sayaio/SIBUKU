from __future__ import annotations
import json
import os
import tempfile
import threading
from datetime import date, timedelta
from pathlib import Path
from flask import Flask, jsonify, request
from flask_cors import CORS

BASE = Path(__file__).resolve().parent
DATA = Path(os.environ.get("SIBUKU_DATA_DIR", BASE / "data")).resolve()
LOCK = threading.RLock()
SEED = {
    'books': [
        {'id':'B001','title':'Algoritma dan Pemrograman','author':'Rinaldi Munir','publisher':'Informatika','category':'Informatika','isbn':'9786028758481','year':2016,'total_stock':5,'available_stock':4},
        {'id':'B002','title':'Basis Data','author':'Abdul Kadir','publisher':'Andi','category':'Informatika','isbn':'9789792954593','year':2018,'total_stock':4,'available_stock':4},
        {'id':'B003','title':'Jaringan Komputer','author':'Andrew S. Tanenbaum','publisher':'Pearson','category':'Jaringan','isbn':'9780132126953','year':2012,'total_stock':3,'available_stock':2},
        {'id':'B004','title':'Rekayasa Perangkat Lunak','author':'Roger S. Pressman','publisher':'McGraw-Hill','category':'Informatika','isbn':'9780078022128','year':2015,'total_stock':4,'available_stock':4},
        {'id':'B005','title':'Kalkulus','author':'Edwin J. Purcell','publisher':'Erlangga','category':'Matematika','isbn':'9789797812455','year':2010,'total_stock':5,'available_stock':5},
        {'id':'B006','title':'Sistem Operasi','author':'Abraham Silberschatz','publisher':'Wiley','category':'Informatika','isbn':'9781118063330','year':2013,'total_stock':4,'available_stock':4}],
    'members': [
        {'id':'M001','name':'Andi Pratama','student_id':'1302220001','email':'andi@example.test','phone':'081200000001','major':'Informatika','status':'active'},
        {'id':'M002','name':'Siti Rahma','student_id':'1302220002','email':'siti@example.test','phone':'081200000002','major':'Sistem Informasi','status':'active'},
        {'id':'M003','name':'Budi Santoso','student_id':'1302220003','email':'budi@example.test','phone':'081200000003','major':'Teknik Komputer','status':'active'},
        {'id':'M004','name':'Dewi Lestari','student_id':'1302220004','email':'dewi@example.test','phone':'081200000004','major':'Informatika','status':'inactive'}],
    'borrowings': [
        {'id':'L001','book_id':'B001','member_id':'M001','borrow_date':'2026-11-18','due_date':'2026-11-25','return_date':None,'status':'borrowed'},
        {'id':'L002','book_id':'B003','member_id':'M002','borrow_date':'2026-11-12','due_date':'2026-11-19','return_date':None,'status':'borrowed'},
        {'id':'L003','book_id':'B002','member_id':'M003','borrow_date':'2026-11-01','due_date':'2026-11-08','return_date':'2026-11-07','status':'returned'}]}

FILES = {name: DATA / f"{name}.json" for name in SEED}

app = Flask(__name__, static_folder="../frontend", static_url_path="")
CORS(app)

def load_all():
    DATA.mkdir(parents=True, exist_ok=True)
    result = {}
    missing = False
    for key, path in FILES.items():
        if not path.exists():
            result[key] = json.loads(json.dumps(SEED[key]))
            missing = True
            continue
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(value, list) or any(
                not isinstance(item, dict) or not item.get("id") for item in value
            ):
                raise ValueError("format data tidak valid")
            result[key] = value
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            raise RuntimeError(
                f"Berkas {path.name} tidak dapat dibaca atau formatnya tidak valid: {exc}"
            ) from exc
    if missing:
        persist(result)
    return result


def persist(data):
    DATA.mkdir(parents=True, exist_ok=True)
    old = {path: path.read_bytes() if path.exists() else None for path in FILES.values()}
    staged = {}
    try:
        for key, path in FILES.items():
            fd, name = tempfile.mkstemp(prefix=path.name, suffix=".tmp", dir=DATA)
            with os.fdopen(fd, "w", encoding="utf-8") as file:
                json.dump(data[key], file, ensure_ascii=False, indent=2)
                file.flush()
                os.fsync(file.fileno())
            staged[path] = Path(name)
        for path, temporary_path in staged.items():
            os.replace(temporary_path, path)
    except Exception:
        for path, content in old.items():
            if content is None:
                path.unlink(missing_ok=True)
            else:
                with path.open("wb") as file:
                    file.write(content)
        raise
    finally:
        for temporary_path in staged.values():
            temporary_path.unlink(missing_ok=True)


def error(message, status=400):
    return jsonify({"error": message}), status

def find(items, ident):
    return next((item for item in items if item["id"] == ident), None)

def next_id(prefix, rows):
    numbers = [
        int(item["id"][1:])
        for item in rows
        if item["id"].startswith(prefix) and item["id"][1:].isdigit()
    ]
    return f"{prefix}{max(numbers or [0]) + 1:03d}"

def active(item):
    return item["status"] == "borrowed"

def public_borrowing(row, data):
    result = dict(row)
    result["status"] = (
        "overdue"
        if active(row) and row["due_date"] < date.today().isoformat()
        else row["status"]
    )
    result["member"] = find(data["members"], row["member_id"])
    result["book"] = find(data["books"], row["book_id"])
    return result

@app.errorhandler(RuntimeError)
def file_error(exc):
    return error(
        "Terjadi masalah saat membaca atau menyimpan berkas data. "
        "Periksa berkas JSON dan izin akses.",
        500,
    )

@app.get("/")
def home():
    return app.send_static_file("index.html")

def collection(name, prefix, required):
    keymap = {
        "books": {"total": "total_stock", "stock": "available_stock"},
        "members": {"nim": "student_id", "major": "major"},
        "borrowings": {
            "bookId": "book_id",
            "memberId": "member_id",
            "borrowDate": "borrow_date",
            "dueDate": "due_date",
            "returnDate": "return_date",
        },
    }

    @app.get(f"/api/{name}", endpoint=f"{name}_get_all")
    def get_all():
        with LOCK:
            data = load_all()
            rows = data[name]
            if name == "borrowings":
                return jsonify([public_borrowing(row, data) for row in rows])
            return jsonify(rows)

    @app.get(f"/api/{name}/<ident>", endpoint=f"{name}_get_one")
    def get_one(ident):
        data = load_all()
        row = find(data[name], ident)
        if not row:
            return error("Data tidak ditemukan", 404)
        if name == "borrowings":
            return jsonify(public_borrowing(row, data))
        return jsonify(row)

    @app.post(f"/api/{name}", endpoint=f"{name}_create")
    def create():
        if name == "borrowings":
            return borrow()

        payload = request.get_json(silent=True) or {}
        with LOCK:
            data = load_all()
            raw = {keymap[name].get(key, key): value for key, value in payload.items()}
            ident = raw.get("id") or next_id(prefix, data[name])
            if find(data[name], ident):
                return error("ID sudah digunakan", 409)
            raw["id"] = ident

            if name == "books":
                try:
                    total = int(raw.get("total_stock", 0))
                except (ValueError, TypeError):
                    return error("Total stok harus berupa bilangan bulat")
                if total < 0:
                    return error("Stok tidak boleh negatif")
                raw.update(total_stock=total, available_stock=total)

            if name == "members":
                raw["status"] = str(raw.get("status", "active")).lower()
                if raw["status"] not in ("active", "inactive"):
                    return error("Status anggota harus aktif atau nonaktif")
                if any(
                    member.get("student_id") == raw.get("student_id")
                    for member in data["members"]
                ):
                    return error("Nomor induk mahasiswa sudah terdaftar", 409)

            missing = [key for key in required if not raw.get(key)]
            labels = {
                "title": "judul",
                "author": "penulis",
                "category": "kategori",
                "total_stock": "total stok",
                "name": "nama",
                "student_id": "nomor induk mahasiswa",
                "book_id": "buku",
                "member_id": "anggota",
                "borrow_date": "tanggal pinjam",
                "due_date": "tanggal jatuh tempo",
            }
            if missing:
                missing_labels = ", ".join(labels.get(key, key) for key in missing)
                return error("Kolom wajib diisi: " + missing_labels)

            data[name].append(raw)
            persist(data)
            return jsonify(raw), 201

    @app.put(f"/api/{name}/<ident>", endpoint=f"{name}_update")
    def update(ident):
        payload = request.get_json(silent=True) or {}
        with LOCK:
            data = load_all()
            row = find(data[name], ident)
            if not row:
                return error("Data tidak ditemukan", 404)

            raw = {keymap[name].get(key, key): value for key, value in payload.items()}
            raw.pop("id", None)

            if name == "borrowings":
                if not active(row):
                    return error("Transaksi yang sudah dikembalikan tidak dapat diubah")
                if "due_date" in raw:
                    try:
                        if date.fromisoformat(raw["due_date"]) <= date.fromisoformat(
                            row["due_date"]
                        ):
                            raise ValueError()
                    except (ValueError, TypeError):
                        return error("Tanggal jatuh tempo harus berformat YYYY-MM-DD")
                row.update({key: value for key, value in raw.items() if key == "due_date"})
                persist(data)
                return jsonify(public_borrowing(row, data))

            if name == "books" and "total_stock" in raw:
                try:
                    total = int(raw["total_stock"])
                except (ValueError, TypeError):
                    return error("Total stok harus berupa bilangan bulat")
                borrowed = row["total_stock"] - row["available_stock"]
                if total < borrowed:
                    return error(
                        "Total stok tidak boleh kurang dari jumlah buku yang sedang dipinjam"
                    )
                row["total_stock"] = total
                row["available_stock"] = total - borrowed
                raw.pop("total_stock")

            if name == "books" and "year" in raw:
                year = raw["year"]
                if not str(year).isdigit() or int(year) < 1:
                    return error("Tahun terbit harus berupa bilangan bulat positif")

            if name == "members":
                raw["status"] = str(raw.get("status", row["status"])).lower()
                if raw["status"] not in ("active", "inactive"):
                    return error("Status anggota harus aktif atau nonaktif")
                has_active_borrowing = any(
                    active(transaction) and transaction["member_id"] == ident
                    for transaction in data["borrowings"]
                )
                if raw["status"] == "inactive" and row["status"] != "inactive" and has_active_borrowing:
                    return error("Anggota masih memiliki peminjaman aktif")
                if "student_id" in raw and any(
                    member["id"] != ident
                    and member.get("student_id") == raw["student_id"]
                    for member in data["members"]
                ):
                    return error("Nomor induk mahasiswa sudah terdaftar", 409)

            row.update(raw)
            persist(data)
            return jsonify(row)

    @app.delete(f"/api/{name}/<ident>", endpoint=f"{name}_delete")
    def delete(ident):
        with LOCK:
            data = load_all()
            row = find(data[name], ident)
            if not row:
                return error("Data tidak ditemukan", 404)

            if name == "books" and any(
                active(transaction) and transaction["book_id"] == ident
                for transaction in data["borrowings"]
            ):
                return error("Buku masih memiliki peminjaman aktif")
            if name == "members" and any(
                active(transaction) and transaction["member_id"] == ident
                for transaction in data["borrowings"]
            ):
                return error("Anggota masih memiliki peminjaman aktif")

            if name == "borrowings" and active(row):
                book = find(data["books"], row["book_id"])
                if book:
                    book["available_stock"] += 1

            data[name].remove(row)
            persist(data)
            return "", 204

collection("books", "B", ["title", "author", "category", "total_stock"])
collection("members", "M", ["name", "student_id"])
collection("borrowings", "L", ["book_id", "member_id", "borrow_date", "due_date"])

@app.post("/api/borrowings")
def borrow():
    payload = request.get_json(silent=True) or {}
    with LOCK:
        data = load_all()
        book = find(data["books"], payload.get("book_id") or payload.get("bookId"))
        member = find(
            data["members"], payload.get("member_id") or payload.get("memberId")
        )

        if not book or not member:
            return error("Pilih buku dan anggota yang terdaftar")
        if member.get("status") != "active":
            return error("Hanya anggota aktif yang dapat meminjam buku")
        if book["available_stock"] < 1:
            return error("Stok buku habis")

        loans = [
            transaction
            for transaction in data["borrowings"]
            if active(transaction) and transaction["member_id"] == member["id"]
        ]
        if len(loans) >= 3:
            return error("Anggota sudah mencapai batas maksimal tiga buku pinjaman")
        if any(transaction["book_id"] == book["id"] for transaction in loans):
            return error("Anggota masih meminjam buku yang sama")

        try:
            borrow_date = date.fromisoformat(
                payload.get("borrow_date")
                or payload.get("borrowDate")
                or date.today().isoformat()
            )
            due_date = date.fromisoformat(
                payload.get("due_date")
                or payload.get("dueDate")
                or (borrow_date + timedelta(days=7)).isoformat()
            )
            if due_date < borrow_date:
                raise ValueError()
        except (ValueError, TypeError):
            return error(
                "Tanggal pinjam dan jatuh tempo tidak valid. "
                "Jatuh tempo harus setelah tanggal pinjam"
            )

        ident = payload.get("id") or next_id("L", data["borrowings"])
        if find(data["borrowings"], ident):
            return error("ID transaksi sudah digunakan", 409)

        row = {
            "id": ident,
            "book_id": book["id"],
            "member_id": member["id"],
            "borrow_date": borrow_date.isoformat(),
            "due_date": due_date.isoformat(),
            "return_date": None,
            "status": "borrowed",
        }
        book["available_stock"] -= 1
        data["borrowings"].append(row)
        persist(data)
        return jsonify(public_borrowing(row, data)), 201


@app.post("/api/borrowings/<ident>/return")
def return_book(ident):
    with LOCK:
        data = load_all()
        row = find(data["borrowings"], ident)
        if not row:
            return error("Data peminjaman tidak ditemukan", 404)
        if not active(row):
            return error("Transaksi ini sudah dikembalikan")

        book = find(data["books"], row["book_id"])
        if not book:
            return error("Data buku terkait tidak ditemukan", 409)
        if book["available_stock"] >= book["total_stock"]:
            return error("Stok buku sudah mencapai jumlah total", 409)

        row.update(status="returned", return_date=date.today().isoformat())
        book["available_stock"] += 1
        persist(data)
        return jsonify(public_borrowing(row, data))


@app.post("/api/borrowings/<ident>/extend")
def extend(ident):
    payload = request.get_json(silent=True) or {}
    with LOCK:
        data = load_all()
        row = find(data["borrowings"], ident)
        if not row:
            return error("Data peminjaman tidak ditemukan", 404)
        if not active(row):
            return error("Hanya peminjaman aktif yang dapat diperpanjang")

        value = payload.get("due_date") or payload.get("dueDate")
        try:
            new = date.fromisoformat(value)
            old = date.fromisoformat(row["due_date"])
            if new <= old:
                raise ValueError()
        except (ValueError, TypeError):
            return error(
                "Tanggal jatuh tempo baru harus valid dan lebih lambat "
                "dari tanggal saat ini"
            )

        row["due_date"] = new.isoformat()
        persist(data)
        return jsonify(public_borrowing(row, data))

@app.get("/api/dashboard")
def dashboard():
    with LOCK:
        data = load_all()
        loans = [public_borrowing(row, data) for row in data["borrowings"]]
        active_loans = [loan for loan in loans if active(loan)]

        return jsonify(
            {
                "total_books": len(data["books"]),
                "total_members": len(data["members"]),
                "active_borrowings": len(active_loans),
                "overdue_borrowings": sum(
                    loan["status"] == "overdue" for loan in loans
                ),
                "active_members": sum(
                    member["status"] == "active" for member in data["members"]
                ),
                "recent_borrowings": list(reversed(loans))[:5],
                "low_stock_books": [
                    book for book in data["books"] if book["available_stock"] <= 1
                ],
            }
        )

@app.post("/api/reset")
def reset():
    with LOCK:
        persist(json.loads(json.dumps(SEED)))
        return jsonify({"message": "Data berhasil dikembalikan ke data awal"})

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "5000")),
        debug=False,
    )