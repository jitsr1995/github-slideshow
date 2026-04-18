from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import io
import uuid
import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Query
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

# ---------- DB + App ----------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Ledgerly API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s - %(message)s")
logger = logging.getLogger("ledgerly")

JWT_ALGO = "HS256"
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-me")
ORG_NAME = os.environ.get("ORG_NAME", "My Company")


# ---------- Helpers ----------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.isoformat()


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(user_id: str, email: str, ttype: str, expires: timedelta) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "type": ttype,
        "exp": now_utc() + expires,
        "iat": now_utc(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def clean_doc(doc: dict) -> dict:
    if not doc:
        return doc
    doc = dict(doc)
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc


bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    token = None
    if creds and creds.credentials:
        token = creds.credentials
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# Role-based access control
ROLE_RANK = {"viewer": 0, "accountant": 1, "admin": 2}


def require_role(min_role: str):
    async def _dep(user: dict = Depends(get_current_user)) -> dict:
        current = ROLE_RANK.get(user.get("role", "viewer"), 0)
        required = ROLE_RANK.get(min_role, 2)
        if current < required:
            raise HTTPException(status_code=403, detail=f"Requires {min_role} role")
        return user
    return _dep


require_accountant = require_role("accountant")
require_admin = require_role("admin")


# ---------- Models ----------
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Contact(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: Literal["customer", "vendor"]
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    address: Optional[str] = None
    gstin: Optional[str] = None
    notes: Optional[str] = None
    created_at: str = Field(default_factory=lambda: iso(now_utc()))


class ContactCreate(BaseModel):
    type: Literal["customer", "vendor"]
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    address: Optional[str] = None
    gstin: Optional[str] = None
    notes: Optional[str] = None


class Item(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    type: Literal["goods", "service"] = "service"
    sku: Optional[str] = None
    unit: Optional[str] = "unit"
    sale_price: float = 0
    purchase_price: float = 0
    tax_rate: float = 0
    created_at: str = Field(default_factory=lambda: iso(now_utc()))


class ItemCreate(BaseModel):
    name: str
    description: Optional[str] = None
    type: Literal["goods", "service"] = "service"
    sku: Optional[str] = None
    unit: Optional[str] = "unit"
    sale_price: float = 0
    purchase_price: float = 0
    tax_rate: float = 0


class LineItem(BaseModel):
    item_id: Optional[str] = None
    description: str
    quantity: float = 1
    rate: float = 0
    tax_rate: float = 0

    def subtotal(self) -> float:
        return round(self.quantity * self.rate, 2)

    def tax_amount(self) -> float:
        return round(self.subtotal() * self.tax_rate / 100.0, 2)

    def total(self) -> float:
        return round(self.subtotal() + self.tax_amount(), 2)


class InvoiceCreate(BaseModel):
    customer_id: str
    invoice_number: Optional[str] = None
    issue_date: str  # ISO date
    due_date: str
    notes: Optional[str] = None
    terms: Optional[str] = None
    line_items: List[LineItem]
    status: Literal["draft", "sent", "paid", "overdue"] = "draft"


class BillCreate(BaseModel):
    vendor_id: str
    bill_number: Optional[str] = None
    issue_date: str
    due_date: str
    notes: Optional[str] = None
    line_items: List[LineItem]
    status: Literal["draft", "open", "paid", "overdue"] = "open"


class ExpenseCreate(BaseModel):
    date: str
    category: str
    amount: float
    vendor_id: Optional[str] = None
    account_id: Optional[str] = None
    payment_method: Literal["cash", "bank", "card", "other"] = "bank"
    notes: Optional[str] = None
    reference: Optional[str] = None


class AccountCreate(BaseModel):
    code: str
    name: str
    type: Literal["asset", "liability", "equity", "income", "expense"]
    parent_id: Optional[str] = None
    description: Optional[str] = None


class JournalLine(BaseModel):
    account_id: str
    debit: float = 0
    credit: float = 0
    description: Optional[str] = None


class JournalEntryCreate(BaseModel):
    date: str
    reference: Optional[str] = None
    narration: Optional[str] = None
    lines: List[JournalLine]


class BankTxnCreate(BaseModel):
    date: str
    description: str
    amount: float  # positive = deposit, negative = withdrawal
    account_id: Optional[str] = None
    reference: Optional[str] = None
    category: Optional[str] = None


# ---------- Auth Endpoints ----------
@api.post("/auth/register")
async def register(payload: UserCreate, response: Response):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    user = {
        "id": str(uuid.uuid4()),
        "name": payload.name,
        "email": email,
        "password_hash": hash_password(payload.password),
        "role": "accountant",
        "created_at": iso(now_utc()),
    }
    await db.users.insert_one(user)
    access = create_token(user["id"], email, "access", timedelta(hours=12))
    refresh = create_token(user["id"], email, "refresh", timedelta(days=7))
    response.set_cookie("access_token", access, httponly=True, samesite="lax", max_age=43200, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, samesite="lax", max_age=604800, path="/")
    return {"user": clean_doc(user), "access_token": access, "refresh_token": refresh}


@api.post("/auth/login")
async def login(payload: UserLogin, response: Response):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    access = create_token(user["id"], email, "access", timedelta(hours=12))
    refresh = create_token(user["id"], email, "refresh", timedelta(days=7))
    response.set_cookie("access_token", access, httponly=True, samesite="lax", max_age=43200, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, samesite="lax", max_age=604800, path="/")
    return {"user": clean_doc(user), "access_token": access, "refresh_token": refresh}


@api.post("/auth/logout")
async def logout(response: Response, _user: dict = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"user": user, "organization": {"name": ORG_NAME, "currency": "USD"}}


# ---------- Contacts ----------
@api.get("/contacts")
async def list_contacts(
    type: Optional[Literal["customer", "vendor"]] = None,
    q: Optional[str] = None,
    _user: dict = Depends(get_current_user),
):
    qry: dict = {}
    if type:
        qry["type"] = type
    if q:
        qry["name"] = {"$regex": q, "$options": "i"}
    docs = await db.contacts.find(qry, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return docs


@api.post("/contacts")
async def create_contact(payload: ContactCreate, _user: dict = Depends(get_current_user)):
    obj = Contact(**payload.model_dump())
    await db.contacts.insert_one(obj.model_dump())
    return obj


@api.get("/contacts/{contact_id}")
async def get_contact(contact_id: str, _user: dict = Depends(get_current_user)):
    doc = await db.contacts.find_one({"id": contact_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Contact not found")
    return doc


@api.put("/contacts/{contact_id}")
async def update_contact(contact_id: str, payload: ContactCreate, _user: dict = Depends(get_current_user)):
    res = await db.contacts.update_one({"id": contact_id}, {"$set": payload.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(404, "Contact not found")
    return await db.contacts.find_one({"id": contact_id}, {"_id": 0})


@api.delete("/contacts/{contact_id}")
async def delete_contact(contact_id: str, _user: dict = Depends(get_current_user)):
    await db.contacts.delete_one({"id": contact_id})
    return {"ok": True}


# ---------- Items ----------
@api.get("/items")
async def list_items(_user: dict = Depends(get_current_user)):
    return await db.items.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api.post("/items")
async def create_item(payload: ItemCreate, _user: dict = Depends(get_current_user)):
    obj = Item(**payload.model_dump())
    await db.items.insert_one(obj.model_dump())
    return obj


@api.put("/items/{item_id}")
async def update_item(item_id: str, payload: ItemCreate, _user: dict = Depends(get_current_user)):
    res = await db.items.update_one({"id": item_id}, {"$set": payload.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(404, "Item not found")
    return await db.items.find_one({"id": item_id}, {"_id": 0})


@api.delete("/items/{item_id}")
async def delete_item(item_id: str, _user: dict = Depends(get_current_user)):
    await db.items.delete_one({"id": item_id})
    return {"ok": True}


# ---------- Invoices ----------
async def next_number(counter_key: str, prefix: str) -> str:
    res = await db.counters.find_one_and_update(
        {"_id": counter_key},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    n = (res or {}).get("seq", 1)
    return f"{prefix}-{n:05d}"


def compute_totals(line_items: List[dict]) -> dict:
    subtotal = 0.0
    tax_total = 0.0
    for li in line_items:
        s = round(li["quantity"] * li["rate"], 2)
        t = round(s * li.get("tax_rate", 0) / 100.0, 2)
        subtotal += s
        tax_total += t
    total = round(subtotal + tax_total, 2)
    return {"subtotal": round(subtotal, 2), "tax_total": round(tax_total, 2), "total": total}


@api.get("/invoices")
async def list_invoices(status: Optional[str] = None, _user: dict = Depends(get_current_user)):
    qry = {}
    if status:
        qry["status"] = status
    docs = await db.invoices.find(qry, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return docs


@api.post("/invoices")
async def create_invoice(payload: InvoiceCreate, _user: dict = Depends(get_current_user)):
    customer = await db.contacts.find_one({"id": payload.customer_id}, {"_id": 0})
    if not customer or customer.get("type") != "customer":
        raise HTTPException(400, "Invalid customer")
    number = payload.invoice_number or await next_number("invoice", "INV")
    li = [li.model_dump() for li in payload.line_items]
    totals = compute_totals(li)
    doc = {
        "id": str(uuid.uuid4()),
        "invoice_number": number,
        "customer_id": payload.customer_id,
        "customer_name": customer["name"],
        "issue_date": payload.issue_date,
        "due_date": payload.due_date,
        "notes": payload.notes,
        "terms": payload.terms,
        "line_items": li,
        "status": payload.status,
        **totals,
        "amount_paid": 0.0,
        "balance_due": totals["total"],
        "created_at": iso(now_utc()),
    }
    await db.invoices.insert_one(doc)
    return clean_doc(doc)


@api.get("/invoices/{inv_id}")
async def get_invoice(inv_id: str, _user: dict = Depends(get_current_user)):
    doc = await db.invoices.find_one({"id": inv_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Invoice not found")
    return doc


@api.post("/invoices/{inv_id}/send")
async def mark_invoice_sent(inv_id: str, _user: dict = Depends(get_current_user)):
    await db.invoices.update_one({"id": inv_id}, {"$set": {"status": "sent"}})
    return await db.invoices.find_one({"id": inv_id}, {"_id": 0})


@api.post("/invoices/{inv_id}/pay")
async def record_invoice_payment(
    inv_id: str,
    amount: float = Query(..., gt=0),
    _user: dict = Depends(get_current_user),
):
    doc = await db.invoices.find_one({"id": inv_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Invoice not found")
    paid = round(doc.get("amount_paid", 0) + amount, 2)
    balance = round(doc["total"] - paid, 2)
    status = "paid" if balance <= 0 else doc.get("status", "sent")
    await db.invoices.update_one(
        {"id": inv_id},
        {"$set": {"amount_paid": paid, "balance_due": max(balance, 0), "status": status}},
    )
    # Also log as bank deposit
    await db.bank_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "date": iso(now_utc()),
        "description": f"Payment received - {doc['invoice_number']}",
        "amount": amount,
        "reference": doc["invoice_number"],
        "category": "Invoice Payment",
        "created_at": iso(now_utc()),
    })
    return await db.invoices.find_one({"id": inv_id}, {"_id": 0})


@api.delete("/invoices/{inv_id}")
async def delete_invoice(inv_id: str, _user: dict = Depends(get_current_user)):
    await db.invoices.delete_one({"id": inv_id})
    return {"ok": True}


# ---------- Bills ----------
@api.get("/bills")
async def list_bills(_user: dict = Depends(get_current_user)):
    return await db.bills.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api.post("/bills")
async def create_bill(payload: BillCreate, _user: dict = Depends(get_current_user)):
    vendor = await db.contacts.find_one({"id": payload.vendor_id}, {"_id": 0})
    if not vendor or vendor.get("type") != "vendor":
        raise HTTPException(400, "Invalid vendor")
    number = payload.bill_number or await next_number("bill", "BILL")
    li = [li.model_dump() for li in payload.line_items]
    totals = compute_totals(li)
    doc = {
        "id": str(uuid.uuid4()),
        "bill_number": number,
        "vendor_id": payload.vendor_id,
        "vendor_name": vendor["name"],
        "issue_date": payload.issue_date,
        "due_date": payload.due_date,
        "notes": payload.notes,
        "line_items": li,
        "status": payload.status,
        **totals,
        "amount_paid": 0.0,
        "balance_due": totals["total"],
        "created_at": iso(now_utc()),
    }
    await db.bills.insert_one(doc)
    return clean_doc(doc)


@api.post("/bills/{bill_id}/pay")
async def pay_bill(bill_id: str, amount: float = Query(..., gt=0), _user: dict = Depends(get_current_user)):
    doc = await db.bills.find_one({"id": bill_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Bill not found")
    paid = round(doc.get("amount_paid", 0) + amount, 2)
    balance = round(doc["total"] - paid, 2)
    status = "paid" if balance <= 0 else doc.get("status", "open")
    await db.bills.update_one(
        {"id": bill_id},
        {"$set": {"amount_paid": paid, "balance_due": max(balance, 0), "status": status}},
    )
    await db.bank_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "date": iso(now_utc()),
        "description": f"Bill payment - {doc['bill_number']}",
        "amount": -amount,
        "reference": doc["bill_number"],
        "category": "Bill Payment",
        "created_at": iso(now_utc()),
    })
    return await db.bills.find_one({"id": bill_id}, {"_id": 0})


@api.delete("/bills/{bill_id}")
async def delete_bill(bill_id: str, _user: dict = Depends(get_current_user)):
    await db.bills.delete_one({"id": bill_id})
    return {"ok": True}


# ---------- Expenses ----------
@api.get("/expenses")
async def list_expenses(_user: dict = Depends(get_current_user)):
    return await db.expenses.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api.post("/expenses")
async def create_expense(payload: ExpenseCreate, _user: dict = Depends(get_current_user)):
    vendor_name = None
    if payload.vendor_id:
        v = await db.contacts.find_one({"id": payload.vendor_id}, {"_id": 0})
        if v:
            vendor_name = v["name"]
    doc = {
        "id": str(uuid.uuid4()),
        **payload.model_dump(),
        "vendor_name": vendor_name,
        "created_at": iso(now_utc()),
    }
    await db.expenses.insert_one(doc)
    # log as bank withdrawal for cash flow
    if payload.payment_method in ("bank", "card", "cash"):
        await db.bank_transactions.insert_one({
            "id": str(uuid.uuid4()),
            "date": payload.date,
            "description": f"Expense - {payload.category}",
            "amount": -abs(payload.amount),
            "reference": payload.reference,
            "category": payload.category,
            "created_at": iso(now_utc()),
        })
    return clean_doc(doc)


@api.delete("/expenses/{eid}")
async def delete_expense(eid: str, _user: dict = Depends(get_current_user)):
    await db.expenses.delete_one({"id": eid})
    return {"ok": True}


# ---------- Chart of Accounts ----------
@api.get("/accounts")
async def list_accounts(_user: dict = Depends(get_current_user)):
    return await db.accounts.find({}, {"_id": 0}).sort("code", 1).to_list(1000)


@api.post("/accounts")
async def create_account(payload: AccountCreate, _user: dict = Depends(get_current_user)):
    doc = {"id": str(uuid.uuid4()), **payload.model_dump(), "created_at": iso(now_utc())}
    await db.accounts.insert_one(doc)
    return clean_doc(doc)


@api.put("/accounts/{aid}")
async def update_account(aid: str, payload: AccountCreate, _user: dict = Depends(get_current_user)):
    await db.accounts.update_one({"id": aid}, {"$set": payload.model_dump()})
    return await db.accounts.find_one({"id": aid}, {"_id": 0})


@api.delete("/accounts/{aid}")
async def delete_account(aid: str, _user: dict = Depends(get_current_user)):
    await db.accounts.delete_one({"id": aid})
    return {"ok": True}


# ---------- Journal Entries ----------
@api.get("/journal-entries")
async def list_journal_entries(_user: dict = Depends(get_current_user)):
    return await db.journal_entries.find({}, {"_id": 0}).sort("date", -1).to_list(1000)


@api.post("/journal-entries")
async def create_journal_entry(payload: JournalEntryCreate, _user: dict = Depends(get_current_user)):
    total_debit = sum(ln.debit for ln in payload.lines)
    total_credit = sum(ln.credit for ln in payload.lines)
    if round(total_debit, 2) != round(total_credit, 2):
        raise HTTPException(400, f"Debits ({total_debit}) must equal credits ({total_credit})")
    doc = {
        "id": str(uuid.uuid4()),
        "date": payload.date,
        "reference": payload.reference,
        "narration": payload.narration,
        "lines": [ln.model_dump() for ln in payload.lines],
        "total": round(total_debit, 2),
        "created_at": iso(now_utc()),
    }
    await db.journal_entries.insert_one(doc)
    return clean_doc(doc)


@api.delete("/journal-entries/{jid}")
async def delete_journal_entry(jid: str, _user: dict = Depends(get_current_user)):
    await db.journal_entries.delete_one({"id": jid})
    return {"ok": True}


# ---------- Banking ----------
@api.get("/banking/transactions")
async def list_bank_txns(_user: dict = Depends(get_current_user)):
    return await db.bank_transactions.find({}, {"_id": 0}).sort("date", -1).to_list(1000)


@api.post("/banking/transactions")
async def create_bank_txn(payload: BankTxnCreate, _user: dict = Depends(get_current_user)):
    doc = {"id": str(uuid.uuid4()), **payload.model_dump(), "created_at": iso(now_utc())}
    await db.bank_transactions.insert_one(doc)
    return clean_doc(doc)


@api.delete("/banking/transactions/{tid}")
async def delete_bank_txn(tid: str, _user: dict = Depends(get_current_user)):
    await db.bank_transactions.delete_one({"id": tid})
    return {"ok": True}


# ---------- Dashboard + Reports ----------
@api.get("/dashboard/summary")
async def dashboard_summary(_user: dict = Depends(get_current_user)):
    invoices = await db.invoices.find({}, {"_id": 0}).to_list(5000)
    bills = await db.bills.find({}, {"_id": 0}).to_list(5000)
    expenses = await db.expenses.find({}, {"_id": 0}).to_list(5000)
    bank_txns = await db.bank_transactions.find({}, {"_id": 0}).to_list(5000)

    total_receivables = round(sum(i.get("balance_due", 0) for i in invoices), 2)
    total_payables = round(sum(b.get("balance_due", 0) for b in bills), 2)
    total_income = round(sum(i.get("total", 0) for i in invoices if i.get("status") == "paid"), 2)
    total_expenses = round(
        sum(e.get("amount", 0) for e in expenses)
        + sum(b.get("amount_paid", 0) for b in bills),
        2,
    )
    cash_balance = round(sum(t.get("amount", 0) for t in bank_txns), 2)
    net_profit = round(total_income - total_expenses, 2)

    # Cash flow over last 6 months (by month)
    months: dict = {}
    today = now_utc()
    for i in range(5, -1, -1):
        y = today.year
        m = today.month - i
        while m <= 0:
            m += 12
            y -= 1
        key = f"{y}-{m:02d}"
        months[key] = {"month": key, "income": 0.0, "expense": 0.0}

    for t in bank_txns:
        d = (t.get("date") or "")[:7]
        if d in months:
            amt = t.get("amount", 0)
            if amt >= 0:
                months[d]["income"] += amt
            else:
                months[d]["expense"] += abs(amt)

    cash_flow = [months[k] for k in sorted(months.keys())]
    for c in cash_flow:
        c["income"] = round(c["income"], 2)
        c["expense"] = round(c["expense"], 2)
        c["net"] = round(c["income"] - c["expense"], 2)

    # Status breakdown
    status_counts = {"draft": 0, "sent": 0, "paid": 0, "overdue": 0}
    for i in invoices:
        s = i.get("status", "draft")
        status_counts[s] = status_counts.get(s, 0) + 1

    recent_invoices = sorted(invoices, key=lambda x: x.get("created_at", ""), reverse=True)[:5]
    recent_expenses = sorted(expenses, key=lambda x: x.get("created_at", ""), reverse=True)[:5]

    return {
        "kpis": {
            "total_receivables": total_receivables,
            "total_payables": total_payables,
            "total_income": total_income,
            "total_expenses": total_expenses,
            "cash_balance": cash_balance,
            "net_profit": net_profit,
        },
        "cash_flow": cash_flow,
        "invoice_status": status_counts,
        "recent_invoices": recent_invoices,
        "recent_expenses": recent_expenses,
    }


@api.get("/reports/profit-loss")
async def profit_loss(_user: dict = Depends(get_current_user)):
    invoices = await db.invoices.find({}, {"_id": 0}).to_list(5000)
    expenses = await db.expenses.find({}, {"_id": 0}).to_list(5000)
    bills = await db.bills.find({}, {"_id": 0}).to_list(5000)

    income_by_cat: dict = {"Sales Revenue": 0.0}
    for i in invoices:
        if i.get("status") == "paid":
            income_by_cat["Sales Revenue"] += i.get("total", 0)

    expense_by_cat: dict = {}
    for e in expenses:
        cat = e.get("category", "Uncategorized")
        expense_by_cat[cat] = expense_by_cat.get(cat, 0) + e.get("amount", 0)
    for b in bills:
        cat = "Vendor Bills"
        expense_by_cat[cat] = expense_by_cat.get(cat, 0) + b.get("amount_paid", 0)

    total_income = round(sum(income_by_cat.values()), 2)
    total_expenses = round(sum(expense_by_cat.values()), 2)
    return {
        "income": [{"category": k, "amount": round(v, 2)} for k, v in income_by_cat.items()],
        "expenses": [{"category": k, "amount": round(v, 2)} for k, v in expense_by_cat.items()],
        "total_income": total_income,
        "total_expenses": total_expenses,
        "net_profit": round(total_income - total_expenses, 2),
    }


@api.get("/reports/balance-sheet")
async def balance_sheet(_user: dict = Depends(get_current_user)):
    invoices = await db.invoices.find({}, {"_id": 0}).to_list(5000)
    bills = await db.bills.find({}, {"_id": 0}).to_list(5000)
    bank_txns = await db.bank_transactions.find({}, {"_id": 0}).to_list(5000)
    expenses = await db.expenses.find({}, {"_id": 0}).to_list(5000)

    cash = round(sum(t.get("amount", 0) for t in bank_txns), 2)
    accounts_receivable = round(sum(i.get("balance_due", 0) for i in invoices), 2)
    accounts_payable = round(sum(b.get("balance_due", 0) for b in bills), 2)

    total_assets = round(cash + accounts_receivable, 2)
    total_liabilities = round(accounts_payable, 2)
    income = sum(i.get("total", 0) for i in invoices if i.get("status") == "paid")
    exp = sum(e.get("amount", 0) for e in expenses) + sum(b.get("amount_paid", 0) for b in bills)
    retained_earnings = round(income - exp, 2)
    total_equity = retained_earnings
    return {
        "assets": [
            {"name": "Cash & Bank", "amount": cash},
            {"name": "Accounts Receivable", "amount": accounts_receivable},
        ],
        "liabilities": [
            {"name": "Accounts Payable", "amount": accounts_payable},
        ],
        "equity": [
            {"name": "Retained Earnings", "amount": retained_earnings},
        ],
        "total_assets": total_assets,
        "total_liabilities": total_liabilities,
        "total_equity": total_equity,
        "balanced": round(total_assets, 2) == round(total_liabilities + total_equity, 2),
    }


@api.get("/reports/cash-flow")
async def cash_flow_report(_user: dict = Depends(get_current_user)):
    txns = await db.bank_transactions.find({}, {"_id": 0}).sort("date", 1).to_list(5000)
    inflow = round(sum(t["amount"] for t in txns if t["amount"] >= 0), 2)
    outflow = round(sum(abs(t["amount"]) for t in txns if t["amount"] < 0), 2)
    return {
        "transactions": txns,
        "total_inflow": inflow,
        "total_outflow": outflow,
        "net_cash_flow": round(inflow - outflow, 2),
    }


# ---------- Root ----------
@api.get("/")
async def root():
    return {"app": "Ledgerly", "status": "ok"}


# ---------- Team Management (admin only) ----------
class TeamMemberCreate(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    role: Literal["admin", "accountant", "viewer"] = "accountant"


class TeamRoleUpdate(BaseModel):
    role: Literal["admin", "accountant", "viewer"]


@api.get("/team")
async def list_team(_admin: dict = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", 1).to_list(1000)
    return users


@api.post("/team")
async def create_team_member(payload: TeamMemberCreate, _admin: dict = Depends(require_admin)):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already in use")
    user = {
        "id": str(uuid.uuid4()),
        "name": payload.name,
        "email": email,
        "password_hash": hash_password(payload.password),
        "role": payload.role,
        "created_at": iso(now_utc()),
    }
    await db.users.insert_one(user)
    user.pop("password_hash", None)
    user.pop("_id", None)
    return user


@api.put("/team/{user_id}/role")
async def update_team_role(user_id: str, payload: TeamRoleUpdate, admin: dict = Depends(require_admin)):
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(404, "User not found")
    # Prevent demoting the last admin
    if target.get("role") == "admin" and payload.role != "admin":
        admins = await db.users.count_documents({"role": "admin"})
        if admins <= 1:
            raise HTTPException(400, "Cannot demote the last admin")
    await db.users.update_one({"id": user_id}, {"$set": {"role": payload.role}})
    return await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})


@api.delete("/team/{user_id}")
async def delete_team_member(user_id: str, admin: dict = Depends(require_admin)):
    if user_id == admin["id"]:
        raise HTTPException(400, "You cannot delete your own account")
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(404, "User not found")
    if target.get("role") == "admin":
        admins = await db.users.count_documents({"role": "admin"})
        if admins <= 1:
            raise HTTPException(400, "Cannot delete the last admin")
    await db.users.delete_one({"id": user_id})
    return {"ok": True}


# ---------- Invoice PDF + Share Link + Email Stub ----------
def _build_invoice_pdf(inv: dict, customer: dict) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter, rightMargin=0.6 * inch, leftMargin=0.6 * inch, topMargin=0.6 * inch, bottomMargin=0.6 * inch)
    styles = getSampleStyleSheet()

    # Custom styles — earthy palette from design tokens
    brand = colors.HexColor("#1f4a3a")  # primary forest green
    muted = colors.HexColor("#6b7a6b")

    h2 = ParagraphStyle("h2", parent=styles["Heading2"], textColor=brand, fontSize=12, leading=14, spaceAfter=6)
    small = ParagraphStyle("small", parent=styles["BodyText"], textColor=muted, fontSize=9, leading=12)
    body = ParagraphStyle("body", parent=styles["BodyText"], fontSize=10, leading=13)

    story = []
    # Header band: company + INVOICE title
    header_tbl = Table(
        [[
            Paragraph(f"<b>{ORG_NAME}</b><br/><font color='#6b7a6b' size=9>Ledgerly · Accounting</font>", body),
            Paragraph("<para align=right><font color='#1f4a3a' size=28><b>INVOICE</b></font></para>", body),
        ]],
        colWidths=[3.6 * inch, 3.6 * inch],
    )
    header_tbl.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("BOTTOMPADDING", (0, 0), (-1, -1), 12)]))
    story.append(header_tbl)

    # Meta
    meta_tbl = Table(
        [
            [Paragraph("<b>BILL TO</b>", small), Paragraph("<b>INVOICE #</b>", small), Paragraph("<b>ISSUE DATE</b>", small), Paragraph("<b>DUE DATE</b>", small)],
            [
                Paragraph(f"<b>{customer.get('name', '')}</b><br/>{customer.get('company') or ''}<br/>{customer.get('email') or ''}<br/>{(customer.get('address') or '').replace(chr(10), '<br/>')}", body),
                Paragraph(f"<font size=13><b>{inv['invoice_number']}</b></font>", body),
                Paragraph(inv.get("issue_date", ""), body),
                Paragraph(inv.get("due_date", ""), body),
            ],
        ],
        colWidths=[3.2 * inch, 1.4 * inch, 1.3 * inch, 1.3 * inch],
    )
    meta_tbl.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, muted),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(Spacer(1, 14))
    story.append(meta_tbl)
    story.append(Spacer(1, 18))

    # Line items
    rows = [[
        Paragraph("<b>DESCRIPTION</b>", small),
        Paragraph("<para align=right><b>QTY</b></para>", small),
        Paragraph("<para align=right><b>RATE</b></para>", small),
        Paragraph("<para align=right><b>TAX</b></para>", small),
        Paragraph("<para align=right><b>AMOUNT</b></para>", small),
    ]]
    for li in inv.get("line_items", []):
        sub = (li.get("quantity") or 0) * (li.get("rate") or 0)
        tax = sub * (li.get("tax_rate") or 0) / 100.0
        amt = sub + tax
        rows.append([
            Paragraph(li.get("description", ""), body),
            Paragraph(f"<para align=right>{li.get('quantity', 0):g}</para>", body),
            Paragraph(f"<para align=right>${li.get('rate', 0):,.2f}</para>", body),
            Paragraph(f"<para align=right>{li.get('tax_rate', 0):g}%</para>", body),
            Paragraph(f"<para align=right>${amt:,.2f}</para>", body),
        ])
    items_tbl = Table(rows, colWidths=[3.3 * inch, 0.7 * inch, 1.0 * inch, 0.8 * inch, 1.4 * inch])
    items_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f3efe8")),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, muted),
        ("LINEBELOW", (0, -1), (-1, -1), 0.5, muted),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(items_tbl)
    story.append(Spacer(1, 12))

    # Totals
    totals_rows = [
        ["", Paragraph("Subtotal", body), Paragraph(f"<para align=right>${inv.get('subtotal', 0):,.2f}</para>", body)],
        ["", Paragraph("Tax", body), Paragraph(f"<para align=right>${inv.get('tax_total', 0):,.2f}</para>", body)],
        ["", Paragraph("<b>Total</b>", h2), Paragraph(f"<para align=right><font color='#1f4a3a' size=14><b>${inv.get('total', 0):,.2f}</b></font></para>", body)],
    ]
    if inv.get("amount_paid", 0) > 0:
        totals_rows.append(["", Paragraph("Paid", body), Paragraph(f"<para align=right>-${inv.get('amount_paid', 0):,.2f}</para>", body)])
        totals_rows.append(["", Paragraph("<b>Balance Due</b>", body), Paragraph(f"<para align=right><font color='#d97757' size=12><b>${inv.get('balance_due', 0):,.2f}</b></font></para>", body)])
    totals_tbl = Table(totals_rows, colWidths=[3.8 * inch, 2.0 * inch, 1.4 * inch])
    totals_tbl.setStyle(TableStyle([
        ("LINEABOVE", (1, 2), (-1, 2), 0.5, brand),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(totals_tbl)

    if inv.get("notes"):
        story.append(Spacer(1, 18))
        story.append(Paragraph("<b>NOTES</b>", small))
        story.append(Paragraph(inv["notes"], body))

    if inv.get("terms"):
        story.append(Spacer(1, 10))
        story.append(Paragraph("<b>TERMS</b>", small))
        story.append(Paragraph(inv["terms"], body))

    story.append(Spacer(1, 30))
    story.append(Paragraph(f"<para align=center><font color='#6b7a6b' size=9>Thank you for your business · {ORG_NAME}</font></para>", body))

    doc.build(story)
    buf.seek(0)
    return buf.read()


async def _load_invoice_and_customer(inv_id: str):
    inv = await db.invoices.find_one({"id": inv_id}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice not found")
    customer = await db.contacts.find_one({"id": inv["customer_id"]}, {"_id": 0}) or {"name": inv.get("customer_name", "")}
    return inv, customer


@api.get("/invoices/{inv_id}/pdf")
async def invoice_pdf(inv_id: str, _user: dict = Depends(get_current_user)):
    inv, customer = await _load_invoice_and_customer(inv_id)
    pdf = _build_invoice_pdf(inv, customer)
    return StreamingResponse(
        io.BytesIO(pdf),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{inv["invoice_number"]}.pdf"'},
    )


@api.post("/invoices/{inv_id}/share")
async def create_invoice_share_link(inv_id: str, _user: dict = Depends(get_current_user)):
    inv = await db.invoices.find_one({"id": inv_id}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice not found")
    token = inv.get("share_token")
    if not token:
        token = secrets.token_urlsafe(16)
        await db.invoices.update_one({"id": inv_id}, {"$set": {"share_token": token}})
    return {"share_token": token}


@api.delete("/invoices/{inv_id}/share")
async def revoke_invoice_share_link(inv_id: str, _user: dict = Depends(get_current_user)):
    await db.invoices.update_one({"id": inv_id}, {"$unset": {"share_token": ""}})
    return {"ok": True}


@api.post("/invoices/{inv_id}/email")
async def send_invoice_email(inv_id: str, _user: dict = Depends(get_current_user)):
    # Email sending is intentionally not configured (user deferred Resend setup).
    # Return a clear, actionable response so the frontend can show guidance.
    inv = await db.invoices.find_one({"id": inv_id}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice not found")
    if not os.environ.get("RESEND_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="Email sending isn't configured yet. Add RESEND_API_KEY and SENDER_EMAIL to the backend .env to enable this feature.",
        )
    # If key present, future: send email here.
    return {"ok": True, "message": "Email configured but sender not wired up yet."}


# ---------- PUBLIC (no-auth) endpoints ----------
public = APIRouter(prefix="/api/public")


@public.get("/invoices/{share_token}")
async def public_invoice(share_token: str):
    inv = await db.invoices.find_one({"share_token": share_token}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice not found")
    customer = await db.contacts.find_one({"id": inv["customer_id"]}, {"_id": 0}) or {"name": inv.get("customer_name", "")}
    return {
        "organization": {"name": ORG_NAME, "currency": "USD"},
        "invoice": inv,
        "customer": {
            "name": customer.get("name"),
            "company": customer.get("company"),
            "email": customer.get("email"),
        },
    }


@public.get("/invoices/{share_token}/pdf")
async def public_invoice_pdf(share_token: str):
    inv = await db.invoices.find_one({"share_token": share_token}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice not found")
    customer = await db.contacts.find_one({"id": inv["customer_id"]}, {"_id": 0}) or {"name": inv.get("customer_name", "")}
    pdf = _build_invoice_pdf(inv, customer)
    return StreamingResponse(
        io.BytesIO(pdf),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{inv["invoice_number"]}.pdf"'},
    )


# Include router
app.include_router(api)
app.include_router(public)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Startup: seed ----------
DEFAULT_ACCOUNTS = [
    ("1000", "Cash", "asset"),
    ("1100", "Bank Account", "asset"),
    ("1200", "Accounts Receivable", "asset"),
    ("1500", "Equipment", "asset"),
    ("2000", "Accounts Payable", "liability"),
    ("2100", "Credit Card", "liability"),
    ("3000", "Owner's Equity", "equity"),
    ("3100", "Retained Earnings", "equity"),
    ("4000", "Sales Revenue", "income"),
    ("4100", "Service Revenue", "income"),
    ("5000", "Cost of Goods Sold", "expense"),
    ("6000", "Rent Expense", "expense"),
    ("6100", "Utilities", "expense"),
    ("6200", "Salaries & Wages", "expense"),
    ("6300", "Office Supplies", "expense"),
    ("6400", "Travel", "expense"),
    ("6500", "Marketing", "expense"),
    ("6900", "Miscellaneous", "expense"),
]


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.contacts.create_index("id", unique=True)
    await db.items.create_index("id", unique=True)
    await db.invoices.create_index("id", unique=True)
    await db.bills.create_index("id", unique=True)
    await db.expenses.create_index("id", unique=True)
    await db.accounts.create_index("id", unique=True)
    await db.journal_entries.create_index("id", unique=True)
    await db.bank_transactions.create_index("id", unique=True)

    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@ledgerly.app")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "role": "admin",
            "created_at": iso(now_utc()),
        })
        logger.info("Admin user seeded: %s", admin_email)
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}},
        )

    # Seed default chart of accounts
    count = await db.accounts.count_documents({})
    if count == 0:
        for code, name, typ in DEFAULT_ACCOUNTS:
            await db.accounts.insert_one({
                "id": str(uuid.uuid4()),
                "code": code,
                "name": name,
                "type": typ,
                "parent_id": None,
                "description": None,
                "created_at": iso(now_utc()),
            })
        logger.info("Default chart of accounts seeded")


@app.on_event("shutdown")
async def shutdown():
    client.close()
