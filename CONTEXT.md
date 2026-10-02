# SimpleInvoice

SimpleInvoice lets signed-in Users issue Invoices to Customers and track what each Invoice is owed. This file fixes the meaning of the words used in code, UI, API docs and conversation.

## Language

### Parties

**User**:
A person who signs in to SimpleInvoice and creates Invoices.
_Avoid_: account, member, operator

**Customer**:
The person or organisation an Invoice is issued to, recorded as a snapshot on that Invoice.
_Avoid_: client, buyer, account

### Invoices

**Invoice**:
A request for payment issued to one Customer for one or more Invoice Items.
_Avoid_: bill, order

**Invoice Number**:
The User-provided, unique, human-readable identifier of an Invoice (e.g. `IV1780488206995`).
_Avoid_: invoice ID (the system UUID), reference

**Invoice Reference**:
An optional external reference recorded on an Invoice, such as a purchase-order number (e.g. `#5721662`).
_Avoid_: Invoice Number

**Invoice Item**:
One priced entry on an Invoice: a name, a whole-number quantity and a Rate.
_Avoid_: line, line item, product

**Rate**:
The price of one unit of an Invoice Item, in the Invoice's Currency.
_Avoid_: price, unit cost

**Invoice Date**:
The calendar date on which an Invoice is issued.
_Avoid_: issue date, created date

**Due Date**:
The last calendar date on which an Invoice can be paid without being Overdue; never before the Invoice Date.
_Avoid_: deadline, expiry

### Status

**Stored Status**:
The lifecycle state saved with an Invoice — always Draft, Pending or Paid.
_Avoid_: DB status, raw status

**Status**:
The state the system reports for an Invoice — its Stored Status, or Overdue when the Overdue rule applies.
_Avoid_: derived status, display status

**Draft**:
The Stored Status of every newly created Invoice.

**Pending**:
The Stored Status of an issued Invoice that is not yet paid in full.

**Paid**:
The Stored Status of an Invoice whose Total Amount has been paid in full.

**Overdue**:
The Status of an Invoice that is not Paid and whose Due Date is before today; computed when read, never stored.
_Avoid_: late, past due

### Money

**Currency**:
The ISO 4217 code (e.g. `AUD`) in which every amount on an Invoice is expressed, shown with its Currency Symbol (e.g. `AU$`).

**Sub-total**:
The sum of quantity × Rate over an Invoice's Invoice Items, before tax and Discount.
_Avoid_: gross total, net amount

**Tax Rate**:
The percentage of the Sub-total charged as tax on an Invoice (10 % unless the User sets another).
_Avoid_: tax (on its own)

**Tax Amount**:
The money charged as tax: Sub-total × Tax Rate ÷ 100.
_Avoid_: tax (on its own)

**Discount**:
A fixed amount, in the Invoice's Currency, deducted from an Invoice.
_Avoid_: discount rate, discount percentage

**Total Amount**:
The amount the Customer must pay: Sub-total + Tax Amount − Discount.
_Avoid_: grand total, amount due

**Total Paid**:
The part of the Total Amount the Customer has paid so far.
_Avoid_: payments, amount received

**Balance**:
The part of the Total Amount still owed: Total Amount − Total Paid.
_Avoid_: outstanding amount, amount due

## Relationships

- A **User** creates many **Invoices**; each **Invoice** records exactly one creating **User**.
- An **Invoice** is issued to exactly one **Customer**, whose details are frozen on the **Invoice** when it is created.
- An **Invoice** has one or more **Invoice Items** (exactly one in the current release).
- An **Invoice**'s **Status** is its **Stored Status**, unless it is not **Paid** and its **Due Date** is before today — then its **Status** is **Overdue**.
- **Total Amount** = **Sub-total** + **Tax Amount** − **Discount**; **Balance** = **Total Amount** − **Total Paid**.

## Example dialogue

> **Dev:** "A **User** creates an **Invoice** whose **Due Date** was yesterday. What **Status** does it get?"
> **Domain expert:** "Its **Stored Status** is **Draft** — every new **Invoice** starts as **Draft** — but its **Status** reads **Overdue**, because it is not **Paid** and the **Due Date** has passed."
> **Dev:** "So a **Draft** can be **Overdue**?"
> **Domain expert:** "Yes. Only **Paid** is exempt. Once the **Customer** pays in full, the **Stored Status** becomes **Paid** and the **Invoice** is never **Overdue** again, whatever its **Due Date**."
> **Dev:** "And the **Discount** — is that 10 % off?"
> **Domain expert:** "No. The **Tax Rate** is a percentage; the **Discount** is always a fixed amount in the **Invoice**'s **Currency**."

## Flagged ambiguities

- **"Overdue" as a stored value** — the spec's status filter and the Appendix A mock both show `Overdue`, as if it were saved. Resolved: **Overdue** is only ever a **Status**; the **Stored Status** is Draft, Pending or Paid. The mock's Overdue invoice is stored as **Pending** (it is part-paid, so it was issued).
- **Draft past its Due Date** — the spec rule `status != "Paid" AND dueDate < today → Overdue` does not exempt **Draft**. Resolved: follow the rule literally; a **Draft** past its **Due Date** reads **Overdue**.
- **"today"** — resolved: the current calendar date in the business time zone (configurable; UTC by default), evaluated on the server.
- **"Outstanding balance"** (spec 2.1.3) and `balanceAmount` (spec 2.3.2) — resolved: the same concept, canonical term **Balance**.
- **"line items"** (spec 2.1.3) and **"Invoice Item"** (spec 3.3) — resolved: the same concept, canonical term **Invoice Item**.
- **"Discount"** on the create form and `totalDiscount` in the data model — resolved: the same value. It is an amount, not a percentage (Appendix A: 2000 + 200 − 20 = 2180).
- **"Tax (%)"** on the create form and `totalTax` in the data model — resolved: two concepts, **Tax Rate** (a percentage) and **Tax Amount** (money).
- **`invoiceGrossTotal`** in the Appendix A mock — resolved: equals the **Sub-total**; not a separate concept.
- **"account"** — could mean **User** or **Customer**. Resolved: distinct concepts; a **User** signs in, a **Customer** receives **Invoices**.
- **Invoice ID vs Invoice Number** — resolved: the Invoice ID is the system UUID used in URLs and API paths; the **Invoice Number** is what people read, type and search.
