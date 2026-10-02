---
status: accepted
---

# Customer details are a snapshot on the Invoice

The spec allows the Customer to be either embedded in the Invoice or kept in a separate `customers` table. We embed it: the `invoices` table carries `customer_fullname`, `customer_email`, `customer_mobile_number` and `customer_address`. An Invoice is a financial record, so it must show the Customer as they were when it was issued; later changes must not rewrite old Invoices. Also, nothing in scope manages Customers on their own (there is no customer list, edit screen or autocomplete).

## Considered Options

- **Separate `customers` table with a foreign key** — rejected. Shared rows would let one edit silently change every past Invoice, unless we also kept snapshot columns or versioned rows. It would also force deduplication rules (is the same email with a different name the same Customer?) that no feature needs, and add a join to every list and search query.

## Consequences

- The same real-world Customer appears as repeated values across Invoices. This is intended: each copy is what that Invoice was issued to.
- Customer-name search is a single-table, case-insensitive partial match, served by a trigram index on `customer_fullname`.
- A future customer directory would add a `customers` table, keep these columns as the snapshot, and possibly add an optional `customer_id` reference.
