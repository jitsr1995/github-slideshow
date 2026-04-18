"""
Ledgerly Accounting Software - Backend API Tests
Tests: Auth, Contacts, Items, Invoices, Bills, Expenses, Accounts, Journal Entries, Banking, Dashboard, Reports
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://account-sync-50.preview.emergentagent.com"

# Test credentials
ADMIN_EMAIL = "admin@ledgerly.app"
ADMIN_PASSWORD = "admin123"


class TestHealthAndRoot:
    """Basic health check tests"""
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert data["app"] == "Ledgerly"
        assert data["status"] == "ok"
        print("✓ API root endpoint working")


class TestAuth:
    """Authentication endpoint tests"""
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "user" in data
        assert "access_token" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "admin"
        assert len(data["access_token"]) > 0
        print(f"✓ Login successful for {ADMIN_EMAIL}")
        return data["access_token"]
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        print("✓ Invalid credentials correctly rejected")
    
    def test_auth_me(self):
        """Test /auth/me endpoint with valid token"""
        # First login
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_resp.json()["access_token"]
        
        # Then get me
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert "user" in data
        assert "organization" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["organization"]["currency"] == "USD"
        print("✓ /auth/me returns user and organization")
    
    def test_auth_me_without_token(self):
        """Test /auth/me without token returns 401"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        print("✓ /auth/me correctly rejects unauthenticated requests")
    
    def test_register_new_user(self):
        """Test user registration"""
        unique_email = f"test_{uuid.uuid4().hex[:8]}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "name": "Test User",
            "email": unique_email,
            "password": "testpass123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "user" in data
        assert "access_token" in data
        assert data["user"]["email"] == unique_email
        print(f"✓ User registration successful for {unique_email}")
    
    def test_register_duplicate_email(self):
        """Test registration with existing email fails"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "name": "Duplicate",
            "email": ADMIN_EMAIL,
            "password": "testpass123"
        })
        assert response.status_code == 400
        print("✓ Duplicate email registration correctly rejected")


@pytest.fixture
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json()["access_token"]
    pytest.skip("Authentication failed")


@pytest.fixture
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestContacts:
    """Contacts (Customers/Vendors) CRUD tests"""
    
    def test_create_customer(self, auth_headers):
        """Test creating a customer"""
        response = requests.post(f"{BASE_URL}/api/contacts", json={
            "type": "customer",
            "name": "TEST_Acme Corp",
            "email": "ap@acme.com",
            "phone": "555-1234"
        }, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "customer"
        assert data["name"] == "TEST_Acme Corp"
        assert data["email"] == "ap@acme.com"
        assert "id" in data
        print(f"✓ Customer created: {data['id']}")
        return data
    
    def test_create_vendor(self, auth_headers):
        """Test creating a vendor"""
        response = requests.post(f"{BASE_URL}/api/contacts", json={
            "type": "vendor",
            "name": "TEST_Office Supplies Inc",
            "email": "vendor@supplies.com"
        }, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "vendor"
        assert data["name"] == "TEST_Office Supplies Inc"
        print(f"✓ Vendor created: {data['id']}")
        return data
    
    def test_list_customers(self, auth_headers):
        """Test listing customers"""
        response = requests.get(f"{BASE_URL}/api/contacts", params={"type": "customer"}, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} customers")
    
    def test_list_vendors(self, auth_headers):
        """Test listing vendors"""
        response = requests.get(f"{BASE_URL}/api/contacts", params={"type": "vendor"}, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} vendors")
    
    def test_update_contact(self, auth_headers):
        """Test updating a contact"""
        # Create first
        create_resp = requests.post(f"{BASE_URL}/api/contacts", json={
            "type": "customer",
            "name": "TEST_Update Me",
            "email": "update@test.com"
        }, headers=auth_headers)
        contact_id = create_resp.json()["id"]
        
        # Update
        response = requests.put(f"{BASE_URL}/api/contacts/{contact_id}", json={
            "type": "customer",
            "name": "TEST_Updated Name",
            "email": "updated@test.com"
        }, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "TEST_Updated Name"
        
        # Verify with GET
        get_resp = requests.get(f"{BASE_URL}/api/contacts/{contact_id}", headers=auth_headers)
        assert get_resp.json()["name"] == "TEST_Updated Name"
        print("✓ Contact updated and verified")
    
    def test_delete_contact(self, auth_headers):
        """Test deleting a contact"""
        # Create first
        create_resp = requests.post(f"{BASE_URL}/api/contacts", json={
            "type": "customer",
            "name": "TEST_Delete Me",
            "email": "delete@test.com"
        }, headers=auth_headers)
        contact_id = create_resp.json()["id"]
        
        # Delete
        response = requests.delete(f"{BASE_URL}/api/contacts/{contact_id}", headers=auth_headers)
        assert response.status_code == 200
        
        # Verify deleted
        get_resp = requests.get(f"{BASE_URL}/api/contacts/{contact_id}", headers=auth_headers)
        assert get_resp.status_code == 404
        print("✓ Contact deleted and verified")


class TestItems:
    """Items CRUD tests"""
    
    def test_create_item(self, auth_headers):
        """Test creating an item"""
        response = requests.post(f"{BASE_URL}/api/items", json={
            "name": "TEST_Consulting Service",
            "description": "Hourly consulting",
            "type": "service",
            "sale_price": 100,
            "tax_rate": 10
        }, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "TEST_Consulting Service"
        assert data["sale_price"] == 100
        assert data["tax_rate"] == 10
        print(f"✓ Item created: {data['id']}")
        return data
    
    def test_list_items(self, auth_headers):
        """Test listing items"""
        response = requests.get(f"{BASE_URL}/api/items", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} items")
    
    def test_update_item(self, auth_headers):
        """Test updating an item"""
        # Create first
        create_resp = requests.post(f"{BASE_URL}/api/items", json={
            "name": "TEST_Update Item",
            "sale_price": 50
        }, headers=auth_headers)
        item_id = create_resp.json()["id"]
        
        # Update
        response = requests.put(f"{BASE_URL}/api/items/{item_id}", json={
            "name": "TEST_Updated Item",
            "sale_price": 75
        }, headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["sale_price"] == 75
        print("✓ Item updated")
    
    def test_delete_item(self, auth_headers):
        """Test deleting an item"""
        # Create first
        create_resp = requests.post(f"{BASE_URL}/api/items", json={
            "name": "TEST_Delete Item",
            "sale_price": 25
        }, headers=auth_headers)
        item_id = create_resp.json()["id"]
        
        # Delete
        response = requests.delete(f"{BASE_URL}/api/items/{item_id}", headers=auth_headers)
        assert response.status_code == 200
        print("✓ Item deleted")


class TestInvoices:
    """Invoice CRUD and workflow tests"""
    
    def test_create_invoice_with_calculations(self, auth_headers):
        """Test creating invoice with auto-calculations"""
        # First create a customer
        cust_resp = requests.post(f"{BASE_URL}/api/contacts", json={
            "type": "customer",
            "name": "TEST_Invoice Customer",
            "email": "invoice@test.com"
        }, headers=auth_headers)
        customer_id = cust_resp.json()["id"]
        
        # Create invoice
        response = requests.post(f"{BASE_URL}/api/invoices", json={
            "customer_id": customer_id,
            "issue_date": "2026-01-15",
            "due_date": "2026-02-15",
            "line_items": [
                {"description": "Service A", "quantity": 2, "rate": 100, "tax_rate": 10}
            ]
        }, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify auto-generated invoice number
        assert data["invoice_number"].startswith("INV-")
        
        # Verify calculations: subtotal=200, tax=20, total=220
        assert data["subtotal"] == 200
        assert data["tax_total"] == 20
        assert data["total"] == 220
        assert data["balance_due"] == 220
        assert data["status"] == "draft"
        print(f"✓ Invoice created: {data['invoice_number']} with correct calculations")
        return data
    
    def test_create_invoice_invalid_customer(self, auth_headers):
        """Test creating invoice with invalid customer returns 400"""
        response = requests.post(f"{BASE_URL}/api/invoices", json={
            "customer_id": "invalid-uuid-12345",
            "issue_date": "2026-01-15",
            "due_date": "2026-02-15",
            "line_items": [
                {"description": "Test", "quantity": 1, "rate": 100, "tax_rate": 0}
            ]
        }, headers=auth_headers)
        assert response.status_code == 400
        print("✓ Invalid customer ID correctly rejected with 400")
    
    def test_list_invoices(self, auth_headers):
        """Test listing invoices"""
        response = requests.get(f"{BASE_URL}/api/invoices", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} invoices")
    
    def test_get_invoice_by_id(self, auth_headers):
        """Test getting invoice by ID"""
        # Create customer and invoice first
        cust_resp = requests.post(f"{BASE_URL}/api/contacts", json={
            "type": "customer",
            "name": "TEST_Get Invoice Customer"
        }, headers=auth_headers)
        customer_id = cust_resp.json()["id"]
        
        inv_resp = requests.post(f"{BASE_URL}/api/invoices", json={
            "customer_id": customer_id,
            "issue_date": "2026-01-15",
            "due_date": "2026-02-15",
            "line_items": [{"description": "Test", "quantity": 1, "rate": 50, "tax_rate": 0}]
        }, headers=auth_headers)
        invoice_id = inv_resp.json()["id"]
        
        # Get by ID
        response = requests.get(f"{BASE_URL}/api/invoices/{invoice_id}", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["id"] == invoice_id
        print("✓ Invoice retrieved by ID")
    
    def test_mark_invoice_sent(self, auth_headers):
        """Test marking invoice as sent"""
        # Create customer and invoice
        cust_resp = requests.post(f"{BASE_URL}/api/contacts", json={
            "type": "customer",
            "name": "TEST_Send Invoice Customer"
        }, headers=auth_headers)
        customer_id = cust_resp.json()["id"]
        
        inv_resp = requests.post(f"{BASE_URL}/api/invoices", json={
            "customer_id": customer_id,
            "issue_date": "2026-01-15",
            "due_date": "2026-02-15",
            "line_items": [{"description": "Test", "quantity": 1, "rate": 100, "tax_rate": 0}]
        }, headers=auth_headers)
        invoice_id = inv_resp.json()["id"]
        
        # Mark as sent
        response = requests.post(f"{BASE_URL}/api/invoices/{invoice_id}/send", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["status"] == "sent"
        print("✓ Invoice marked as sent")
    
    def test_record_invoice_payment(self, auth_headers):
        """Test recording payment and auto bank transaction"""
        # Create customer and invoice
        cust_resp = requests.post(f"{BASE_URL}/api/contacts", json={
            "type": "customer",
            "name": "TEST_Pay Invoice Customer"
        }, headers=auth_headers)
        customer_id = cust_resp.json()["id"]
        
        inv_resp = requests.post(f"{BASE_URL}/api/invoices", json={
            "customer_id": customer_id,
            "issue_date": "2026-01-15",
            "due_date": "2026-02-15",
            "line_items": [{"description": "Test", "quantity": 2, "rate": 100, "tax_rate": 10}]
        }, headers=auth_headers)
        invoice = inv_resp.json()
        invoice_id = invoice["id"]
        total = invoice["total"]  # Should be 220
        
        # Record full payment
        response = requests.post(f"{BASE_URL}/api/invoices/{invoice_id}/pay", 
                                params={"amount": total}, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "paid"
        assert data["balance_due"] == 0
        assert data["amount_paid"] == total
        
        # Verify bank transaction was created
        bank_resp = requests.get(f"{BASE_URL}/api/banking/transactions", headers=auth_headers)
        bank_txns = bank_resp.json()
        payment_txn = next((t for t in bank_txns if invoice["invoice_number"] in t.get("reference", "")), None)
        assert payment_txn is not None
        assert payment_txn["amount"] == total
        print("✓ Invoice payment recorded and bank transaction created")


class TestBills:
    """Bills CRUD and payment tests"""
    
    def test_create_bill(self, auth_headers):
        """Test creating a bill"""
        # Create vendor first
        vendor_resp = requests.post(f"{BASE_URL}/api/contacts", json={
            "type": "vendor",
            "name": "TEST_Bill Vendor"
        }, headers=auth_headers)
        vendor_id = vendor_resp.json()["id"]
        
        # Create bill
        response = requests.post(f"{BASE_URL}/api/bills", json={
            "vendor_id": vendor_id,
            "issue_date": "2026-01-15",
            "due_date": "2026-02-15",
            "line_items": [
                {"description": "Office Supplies", "quantity": 5, "rate": 20, "tax_rate": 5}
            ]
        }, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["bill_number"].startswith("BILL-")
        assert data["subtotal"] == 100
        assert data["tax_total"] == 5
        assert data["total"] == 105
        print(f"✓ Bill created: {data['bill_number']}")
        return data
    
    def test_create_bill_invalid_vendor(self, auth_headers):
        """Test creating bill with invalid vendor returns 400"""
        response = requests.post(f"{BASE_URL}/api/bills", json={
            "vendor_id": "invalid-vendor-id",
            "issue_date": "2026-01-15",
            "due_date": "2026-02-15",
            "line_items": [{"description": "Test", "quantity": 1, "rate": 50, "tax_rate": 0}]
        }, headers=auth_headers)
        assert response.status_code == 400
        print("✓ Invalid vendor ID correctly rejected with 400")
    
    def test_pay_bill(self, auth_headers):
        """Test paying a bill creates negative bank transaction"""
        # Create vendor and bill
        vendor_resp = requests.post(f"{BASE_URL}/api/contacts", json={
            "type": "vendor",
            "name": "TEST_Pay Bill Vendor"
        }, headers=auth_headers)
        vendor_id = vendor_resp.json()["id"]
        
        bill_resp = requests.post(f"{BASE_URL}/api/bills", json={
            "vendor_id": vendor_id,
            "issue_date": "2026-01-15",
            "due_date": "2026-02-15",
            "line_items": [{"description": "Test", "quantity": 1, "rate": 100, "tax_rate": 0}]
        }, headers=auth_headers)
        bill = bill_resp.json()
        bill_id = bill["id"]
        
        # Pay bill
        response = requests.post(f"{BASE_URL}/api/bills/{bill_id}/pay", 
                                params={"amount": 100}, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "paid"
        assert data["balance_due"] == 0
        
        # Verify negative bank transaction
        bank_resp = requests.get(f"{BASE_URL}/api/banking/transactions", headers=auth_headers)
        bank_txns = bank_resp.json()
        payment_txn = next((t for t in bank_txns if bill["bill_number"] in t.get("reference", "")), None)
        assert payment_txn is not None
        assert payment_txn["amount"] == -100  # Negative for outflow
        print("✓ Bill payment recorded with negative bank transaction")


class TestExpenses:
    """Expenses tests"""
    
    def test_create_expense_with_bank_txn(self, auth_headers):
        """Test creating expense creates bank transaction"""
        # Create vendor (optional)
        vendor_resp = requests.post(f"{BASE_URL}/api/contacts", json={
            "type": "vendor",
            "name": "TEST_Expense Vendor"
        }, headers=auth_headers)
        vendor_id = vendor_resp.json()["id"]
        
        # Create expense
        response = requests.post(f"{BASE_URL}/api/expenses", json={
            "date": "2026-01-15",
            "category": "Office Supplies",
            "amount": 75.50,
            "vendor_id": vendor_id,
            "payment_method": "bank",
            "notes": "Test expense"
        }, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["amount"] == 75.50
        assert data["category"] == "Office Supplies"
        assert data["vendor_name"] == "TEST_Expense Vendor"
        
        # Verify bank transaction (negative)
        bank_resp = requests.get(f"{BASE_URL}/api/banking/transactions", headers=auth_headers)
        bank_txns = bank_resp.json()
        expense_txn = next((t for t in bank_txns if "Office Supplies" in t.get("category", "")), None)
        assert expense_txn is not None
        assert expense_txn["amount"] < 0  # Negative for expense
        print("✓ Expense created with negative bank transaction")
    
    def test_list_expenses(self, auth_headers):
        """Test listing expenses"""
        response = requests.get(f"{BASE_URL}/api/expenses", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print(f"✓ Listed {len(response.json())} expenses")


class TestChartOfAccounts:
    """Chart of Accounts tests"""
    
    def test_default_accounts_seeded(self, auth_headers):
        """Test that default accounts are seeded (>= 18)"""
        response = requests.get(f"{BASE_URL}/api/accounts", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 18
        
        # Verify some expected accounts exist
        account_names = [a["name"] for a in data]
        assert "Cash" in account_names
        assert "Bank Account" in account_names
        assert "Accounts Receivable" in account_names
        assert "Accounts Payable" in account_names
        print(f"✓ {len(data)} accounts found (including default seeded accounts)")
    
    def test_create_account(self, auth_headers):
        """Test creating a new account"""
        response = requests.post(f"{BASE_URL}/api/accounts", json={
            "code": "9999",
            "name": "TEST_Custom Account",
            "type": "expense",
            "description": "Test account"
        }, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == "9999"
        assert data["name"] == "TEST_Custom Account"
        print("✓ Custom account created")
    
    def test_update_account(self, auth_headers):
        """Test updating an account"""
        # Create first
        create_resp = requests.post(f"{BASE_URL}/api/accounts", json={
            "code": "9998",
            "name": "TEST_Update Account",
            "type": "asset"
        }, headers=auth_headers)
        account_id = create_resp.json()["id"]
        
        # Update
        response = requests.put(f"{BASE_URL}/api/accounts/{account_id}", json={
            "code": "9998",
            "name": "TEST_Updated Account",
            "type": "asset"
        }, headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["name"] == "TEST_Updated Account"
        print("✓ Account updated")


class TestJournalEntries:
    """Journal Entries tests"""
    
    def test_create_balanced_journal_entry(self, auth_headers):
        """Test creating a balanced journal entry"""
        # Get account IDs
        accounts_resp = requests.get(f"{BASE_URL}/api/accounts", headers=auth_headers)
        accounts = accounts_resp.json()
        cash_account = next((a for a in accounts if a["name"] == "Cash"), None)
        revenue_account = next((a for a in accounts if a["name"] == "Sales Revenue"), None)
        
        if not cash_account or not revenue_account:
            pytest.skip("Required accounts not found")
        
        # Create balanced entry
        response = requests.post(f"{BASE_URL}/api/journal-entries", json={
            "date": "2026-01-15",
            "reference": "TEST-JE-001",
            "narration": "Test journal entry",
            "lines": [
                {"account_id": cash_account["id"], "debit": 1000, "credit": 0},
                {"account_id": revenue_account["id"], "debit": 0, "credit": 1000}
            ]
        }, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1000
        print("✓ Balanced journal entry created")
    
    def test_create_unbalanced_journal_entry_fails(self, auth_headers):
        """Test that unbalanced journal entry returns 400"""
        accounts_resp = requests.get(f"{BASE_URL}/api/accounts", headers=auth_headers)
        accounts = accounts_resp.json()
        cash_account = next((a for a in accounts if a["name"] == "Cash"), None)
        
        if not cash_account:
            pytest.skip("Cash account not found")
        
        # Try to create unbalanced entry
        response = requests.post(f"{BASE_URL}/api/journal-entries", json={
            "date": "2026-01-15",
            "reference": "TEST-JE-FAIL",
            "lines": [
                {"account_id": cash_account["id"], "debit": 1000, "credit": 0},
                {"account_id": cash_account["id"], "debit": 0, "credit": 500}  # Unbalanced!
            ]
        }, headers=auth_headers)
        assert response.status_code == 400
        print("✓ Unbalanced journal entry correctly rejected with 400")
    
    def test_list_journal_entries(self, auth_headers):
        """Test listing journal entries"""
        response = requests.get(f"{BASE_URL}/api/journal-entries", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print(f"✓ Listed {len(response.json())} journal entries")


class TestBanking:
    """Banking transactions tests"""
    
    def test_create_bank_transaction(self, auth_headers):
        """Test creating a bank transaction"""
        response = requests.post(f"{BASE_URL}/api/banking/transactions", json={
            "date": "2026-01-15",
            "description": "TEST_Manual deposit",
            "amount": 500,
            "category": "Deposit"
        }, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["amount"] == 500
        assert data["description"] == "TEST_Manual deposit"
        print("✓ Bank transaction created")
        return data
    
    def test_list_bank_transactions(self, auth_headers):
        """Test listing bank transactions"""
        response = requests.get(f"{BASE_URL}/api/banking/transactions", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print(f"✓ Listed {len(response.json())} bank transactions")
    
    def test_delete_bank_transaction(self, auth_headers):
        """Test deleting a bank transaction"""
        # Create first
        create_resp = requests.post(f"{BASE_URL}/api/banking/transactions", json={
            "date": "2026-01-15",
            "description": "TEST_Delete me",
            "amount": 100
        }, headers=auth_headers)
        txn_id = create_resp.json()["id"]
        
        # Delete
        response = requests.delete(f"{BASE_URL}/api/banking/transactions/{txn_id}", headers=auth_headers)
        assert response.status_code == 200
        print("✓ Bank transaction deleted")


class TestDashboard:
    """Dashboard summary tests"""
    
    def test_dashboard_summary(self, auth_headers):
        """Test dashboard summary returns all required fields"""
        response = requests.get(f"{BASE_URL}/api/dashboard/summary", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check KPIs
        assert "kpis" in data
        kpis = data["kpis"]
        assert "total_receivables" in kpis
        assert "total_payables" in kpis
        assert "cash_balance" in kpis
        assert "net_profit" in kpis
        
        # Check cash flow (6 months)
        assert "cash_flow" in data
        assert len(data["cash_flow"]) == 6
        
        # Check invoice status
        assert "invoice_status" in data
        
        # Check recent items
        assert "recent_invoices" in data
        assert "recent_expenses" in data
        
        print("✓ Dashboard summary returns all required fields")


class TestReports:
    """Reports tests"""
    
    def test_profit_loss_report(self, auth_headers):
        """Test profit/loss report"""
        response = requests.get(f"{BASE_URL}/api/reports/profit-loss", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "income" in data
        assert "expenses" in data
        assert "total_income" in data
        assert "total_expenses" in data
        assert "net_profit" in data
        
        # Verify calculation
        assert data["net_profit"] == round(data["total_income"] - data["total_expenses"], 2)
        print("✓ Profit/Loss report returns correct structure")
    
    def test_balance_sheet_report(self, auth_headers):
        """Test balance sheet report"""
        response = requests.get(f"{BASE_URL}/api/reports/balance-sheet", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "assets" in data
        assert "liabilities" in data
        assert "equity" in data
        assert "total_assets" in data
        assert "total_liabilities" in data
        assert "total_equity" in data
        assert "balanced" in data
        
        print("✓ Balance sheet report returns correct structure")
    
    def test_cash_flow_report(self, auth_headers):
        """Test cash flow report"""
        response = requests.get(f"{BASE_URL}/api/reports/cash-flow", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "transactions" in data
        assert "total_inflow" in data
        assert "total_outflow" in data
        assert "net_cash_flow" in data
        
        # Verify calculation
        assert data["net_cash_flow"] == round(data["total_inflow"] - data["total_outflow"], 2)
        print("✓ Cash flow report returns correct structure")


# Cleanup fixture to run after all tests
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_data():
    """Cleanup TEST_ prefixed data after all tests"""
    yield
    # Cleanup would go here if needed
    print("\n✓ Test session complete")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
