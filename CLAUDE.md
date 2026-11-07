# CLAUDE.md — FAMILY FINANCE PROJECT INSTRUCTIONS

## 1. PROJECT IDENTITY

Project name: Family Finance Management System

Project type: Personal / Family Financial Management Web Application.

Primary users:
- Cục Thịt — Husband.
- Cục Cá — Wife.

Primary development environment: Claude Desktop / Claude Code.

Primary communication language: Vietnamese.

Code language: English for identifiers, comments where appropriate, and technical documentation. User-facing interface: Vietnamese.

Project objective:

Build a reliable, secure, maintainable and extensible family financial management system with minimal operating cost.

This file contains persistent project-wide instructions. These rules apply to all project tasks, including discovery, planning, database design, implementation, testing, deployment and maintenance.

---

## 2. NON-NEGOTIABLE PRINCIPLES

### 2.1. Do not assume business requirements

Never invent financial rules.

Never silently decide:
- Budget allocation rules.
- Wallet ownership.
- Transaction classification.
- Income and expense calculation.
- Asset valuation.
- Loan repayment classification.
- Balance adjustment treatment.
- Shared versus personal expense rules.

If a business rule is unclear:
1. Identify the ambiguity.
2. Explain its impact.
3. Present reasonable alternatives.
4. Recommend an option.
5. Ask the user for confirmation.

### 2.2. Preserve confirmed decisions

Once the user confirms a business rule:
- Record it in the appropriate documentation.
- Use it consistently.
- Do not change it without approval.
- Update related documentation and tests if it changes.

### 2.3. Documentation before implementation

Do not start major development without an approved Implementation Plan.

Do not modify database architecture without documenting the impact.

Every major feature must have:
- Requirements.
- Business rules.
- Data model.
- UI/UX behavior.
- Acceptance criteria.
- Test cases.

### 2.4. Incremental development

Never attempt to build the entire application in one uncontrolled coding session.

Work in small, verifiable stages.

After each stage:
1. Summarize completed work.
2. List modified files.
3. Explain technical decisions.
4. Run appropriate tests.
5. Report known issues.
6. Identify the next step.

Do not claim that a feature is complete if it has not been tested.

---

## 3. USER AND FINANCIAL DOMAIN RULES

### 3.1. Family members

Preserve the exact display names:

- Cục Thịt.
- Cục Cá.

Do not automatically translate or replace these names with Husband, Wife, User 1 or User 2 in the application interface.

Internal identifiers must be independent of display names.

For example:
- member_id: UUID.
- display_name: Cục Thịt.
- display_name: Cục Cá.

Never use display names as database primary keys.

### 3.2. Financial ownership

The system supports:
- Shared family finances.
- Individual finances.
- Shared wallets.
- Individual wallets.
- Shared expenses.
- Individual expenses.

Always distinguish:

1. Transaction creator.
2. Person who paid.
3. Wallet owner.
4. Beneficiary.
5. Financial ownership or responsibility.
6. Budget category.

These fields have different meanings and must not be merged into one field.

### 3.3. Wallet management

Wallets must be dynamically configurable.

Examples:
- Vietin - Anh.
- Vietin - Em.
- BIDV - Anh.
- BIDV - Em.
- Tiền mặt - Anh.
- Tiền mặt - Em.
- Tiền mặt gia đình.

Required design:
- Unique WalletID.
- Wallet name.
- Wallet type.
- Bank or provider.
- Owner.
- Currency.
- Opening balance.
- Opening date.
- Active status.

Use stable identifiers for all database relationships.

Never use wallet names as foreign keys.

### 3.4. Transaction management

Support at least these transaction types:

- Income.
- Expense.
- Transfer.
- Refund.
- Balance adjustment.

The final transaction model must be validated against the approved business requirements.

Transactions should support:
- Transaction ID.
- Date and time.
- Amount.
- Type.
- Source wallet.
- Destination wallet where applicable.
- Category.
- Budget jar.
- Paid by.
- Beneficiary.
- Shared/personal classification.
- Description.
- Notes.
- Attachments if approved.
- Created by.
- Created at.
- Updated at.
- Status.

Use appropriate validation and database constraints.

### 3.5. Transfers

Transfers between wallets must not be counted as income or expense.

A transfer must:
- Decrease the source wallet.
- Increase the destination wallet.
- Maintain the same total family cash balance.
- Be recorded atomically.
- Prevent duplicate processing.

### 3.6. Balance adjustment

Implement a dedicated wallet reconciliation and balance adjustment workflow.

Rules:
- Negative adjustment decreases balance.
- Positive adjustment increases balance.
- Preserve all previous transactions.
- Record adjustment reason.
- Record responsible member.
- Record timestamp.
- Record previous balance and resulting balance.
- Maintain an immutable audit trail.

Do not automatically classify adjustment entries as normal household expenses or income.

The treatment of adjustments in reports must follow approved BUSINESS_RULES.md.

### 3.7. Budget management

Budget management is based on fixed amounts assigned to configurable budget jars.

Requirements:
- Monthly budget periods.
- Default budget copied from the previous month.
- User can edit each jar independently.
- Historical budgets remain unchanged.
- Budget changes are traceable.
- Support budget utilization and remaining balance.
- Support over-budget alerts.

Never confuse:
- Budget allocation.
- Wallet balance.
- Actual spending.
- Savings transfers.
- Financial assets.

Do not assume that the standard six-jar categories or percentages are mandatory. Use the user's approved configuration.

---

## 4. TECHNOLOGY PRINCIPLES

The preferred technology stack is:

| Layer | Preferred technology |
|---|---|
| Frontend | Next.js |
| Language | TypeScript |
| Styling | Tailwind CSS |
| UI components | shadcn/ui |
| Database | PostgreSQL |
| Backend | Supabase |
| Authentication | Supabase Auth |
| Authorization | PostgreSQL RLS |
| Hosting | Vercel |
| Source control | GitHub |
| Charts | Recharts |
| Mobile experience | Responsive Web / PWA |

This is the preferred direction, not permission to use every technology without evaluation.

If another free SQL solution provides better reliability or lower operational risk, present the alternative before changing the architecture.

### 4.1. Zero-cost requirement

Operating cost must be minimized, with a target of zero recurring cost.

Before selecting any service:
- Verify current free-tier limits.
- Verify inactivity and suspension policies.
- Verify database storage limits.
- Verify bandwidth limits.
- Verify email quotas.
- Verify push notification limitations.
- Verify scheduled-job limits.
- Verify backup availability.
- Verify commercial/personal usage restrictions.

Do not assume that a service advertised as free will remain free indefinitely.

Clearly distinguish:
- Free to develop.
- Free to deploy.
- Free within usage limits.
- Free but requiring manual maintenance.
- Paid features.

Do not introduce paid services without user approval.

### 4.2. Database portability

Use standard PostgreSQL wherever practical.

Required:
- SQL migration files.
- Version-controlled schema.
- Standard SQL queries.
- Documented database relationships.
- Exportable data.
- Importable data.
- Database backup and restore documentation.

Avoid unnecessary vendor-specific dependencies.

Keep business logic separate from database-provider-specific code.

If Supabase-specific functionality is required, document the dependency and migration implications.

The application should be designed to allow migration to another PostgreSQL provider with minimal changes.

### 4.3. Environment variables

Never hardcode:
- Database credentials.
- API keys.
- Service role keys.
- SMTP credentials.
- Private tokens.
- Authentication secrets.

Use environment variables.

Maintain:
- `.env.example`
- Environment configuration documentation.
- Clear distinction between public and server-only variables.

Never expose Supabase service role keys in browser code.

---

## 5. DATABASE DESIGN STANDARDS

### 5.1. General rules

- Use UUID or another appropriate stable primary key.
- Use foreign keys.
- Add indexes for frequently queried fields.
- Add unique constraints where necessary.
- Use timestamps consistently.
- Use explicit status fields where appropriate.
- Use database transactions for multi-record financial operations.
- Maintain auditability.

### 5.2. Monetary values

Never use floating-point numbers for financial calculations.

Use PostgreSQL NUMERIC with suitable precision or integer minor units, according to the approved design.

For Vietnamese đồng:
- Display amounts with Vietnamese number formatting.
- Preserve exact values in the database.
- Avoid floating-point rounding errors.

Currency conversion, if introduced, must store exchange-rate information and conversion history.

### 5.3. Data integrity

Financial transactions must not silently disappear or become duplicated.

Implement:
- Referential integrity.
- Duplicate prevention.
- Transaction validation.
- Audit history.
- Soft deletion or reversal where appropriate.
- Reconciliation mechanisms.

For posted financial transactions, prefer reversal or correction entries over destructive edits.

Do not delete financial history merely to correct an incorrect balance.

### 5.4. Database changes

All schema modifications must be version-controlled.

Never directly modify production schema without a migration.

Each migration must:
1. Have a clear purpose.
2. Be tested.
3. Preserve existing data.
4. Include rollback or recovery considerations.
5. Update DATABASE_SCHEMA.md.

---

## 6. SECURITY AND PRIVACY

Financial information is sensitive.

Security is a core requirement, not an optional enhancement.

### 6.1. Authentication

- Use individual Google accounts for Cục Thịt and Cục Cá.
- No shared login credentials.
- Validate authenticated users on the server.
- Do not trust user IDs sent directly from the browser.

### 6.2. Authorization

Implement PostgreSQL Row Level Security where Supabase is used.

The family is a logical financial group.

Only authorized family members can access family records.

Individual and shared data must follow approved ownership rules.

Do not expose data through public APIs or unrestricted database policies.

### 6.3. Security rules

- Never commit secrets to GitHub.
- Never expose service role credentials.
- Validate all user inputs.
- Prevent SQL injection.
- Prevent unauthorized access.
- Protect API endpoints.
- Use secure session handling.
- Audit important financial operations.

### 6.4. Data backup

Implement an independent backup strategy.

The system should support:
- Database backup.
- CSV export.
- Excel export.
- Restore procedures.
- Backup integrity verification.

Google Drive or another free storage provider may be evaluated, but the solution must be verified for privacy, quotas and reliability.

Never place actual family financial data in a public GitHub repository.

---

## 7. UI/UX DESIGN PRINCIPLES

### 7.1. Overall design

The interface must be:
- Modern.
- Clean.
- Minimal.
- Professional.
- Easy to understand.
- Mobile-first.
- Responsive.

Avoid unnecessarily complicated financial dashboards.

### 7.2. Mobile experience

Most daily transactions will be entered through mobile devices.

Therefore:
- Prioritize mobile form layouts.
- Minimize typing.
- Use searchable dropdowns.
- Remember frequently used categories.
- Support quick transaction entry.
- Make the amount field prominent.
- Minimize the number of required steps.
- Use clear confirmation and error messages.

The application should be installable as a PWA where technically feasible.

### 7.3. Transaction entry

A typical expense entry should be quick.

Recommended fields:
- Amount.
- Transaction type.
- Category.
- Wallet.
- Paid by.
- Beneficiary.
- Date.
- Note.

Use sensible defaults but never infer financial ownership incorrectly.

### 7.4. Dashboard

Dashboard must provide a clear financial overview.

Potential indicators:
- Total income.
- Total expenses.
- Net cash flow.
- Budget usage.
- Remaining budget.
- Wallet balances.
- Total assets.
- Total liabilities.
- Net worth.
- Savings rate.

Only display indicators whose calculation rules have been approved.

### 7.5. Accessibility and usability

- Use readable typography.
- Maintain adequate contrast.
- Avoid tiny controls.
- Provide clear empty states.
- Provide loading and error states.
- Avoid unnecessary animations.
- Ensure important financial values are easy to scan.

---

## 8. FINANCIAL CALCULATION RULES

Every financial metric must have an explicit formula.

Maintain a calculation reference in BUSINESS_RULES.md.

Do not calculate dashboard indicators using inconsistent definitions.

For example:

Net Cash Flow:

Total recognized income minus total recognized expenses.

Wallet Balance:

Opening balance plus all applicable income, minus expenses, plus incoming transfers, minus outgoing transfers, plus/minus adjustments.

Net Worth:

Total assets minus total liabilities.

Budget Remaining:

Approved budget amount minus recognized spending assigned to that budget.

These are initial conceptual formulas. Their final treatment must follow approved business rules, especially for savings, investments, loan principal, refunds and adjustments.

Use a single trusted calculation layer where possible.

Avoid implementing the same financial calculation differently in multiple screens.

---

## 9. EXCEL DATA MIGRATION

The original workbook is:

`Appsheet_Finance.xlsx`

Do not modify the original workbook.

Migration must be repeatable and verifiable.

Required process:

1. Inspect workbook structure.
2. Identify all sheets.
3. Inspect columns and data types.
4. Identify relationships.
5. Identify duplicates.
6. Identify missing or invalid values.
7. Create source-to-target mapping.
8. Prepare staging data.
9. Import in a controlled process.
10. Verify record counts.
11. Reconcile financial totals.
12. Report exceptions.
13. Obtain user approval before considering migration complete.

Preserve the original source values where practical.

Never silently discard historical data.

Special attention:
- finance.
- report.
- setting.
- change.
- event.
- saving.
- gold.
- wedding.
- cheppy_newborn.

Do not assume every record in these sheets is a financial transaction.

Distinguish:
- Actual financial transaction.
- Asset.
- Liability.
- Event record.
- Reference data.
- Shopping list.
- Historical information.

Prevent double counting between related sheets.

---

## 10. NOTIFICATIONS

Potential notification channels:
- In-app notifications.
- Push notifications.
- Email fallback.

Required reminder types:
- Recurring bills.
- Tuition.
- Loans.
- Credit cards.
- Upcoming payments.
- Overdue payments.
- Budget threshold alerts.
- Data-entry reminders.

Notification design must include:
- Reminder configuration.
- Recipient.
- Schedule.
- Delivery status.
- Retry or failure handling.
- Duplicate prevention.
- User preferences.

Do not assume push notification will work on every browser or device.

Provide email fallback if push is unavailable.

Do not introduce paid email or notification services without approval.

---

## 11. DEVELOPMENT WORKFLOW

Follow these steps for every feature.

### Step 1 — Understand

Read:
- CLAUDE.md.
- Relevant documentation.
- Existing source code.
- Approved requirements.

Identify dependencies.

### Step 2 — Plan

Explain:
- What will be implemented.
- Which files will change.
- Database changes.
- Risks.
- Tests.

For small changes, a concise plan is sufficient.

For major changes, request approval when the change affects business rules, data architecture, security or cost.

### Step 3 — Implement

- Follow existing conventions.
- Write maintainable code.
- Avoid unnecessary dependencies.
- Reuse existing components.
- Keep components focused.
- Handle errors explicitly.
- Avoid overengineering.

### Step 4 — Verify

Run:
- Type checking.
- Linting.
- Unit tests.
- Integration tests where relevant.
- Build validation.

For financial operations, include tests for edge cases and exact balance calculations.

### Step 5 — Report

Summarize:
- Completed functionality.
- Files changed.
- Tests performed.
- Test results.
- Known limitations.
- Next steps.

Never report an unverified test as passed.

---

## 12. TESTING REQUIREMENTS

Financial calculations require special attention.

At minimum, test:

### Transactions
- Income increases the correct wallet.
- Expense decreases the correct wallet.
- Refund follows approved rules.
- Invalid transactions are rejected.

### Transfers
- Source wallet decreases.
- Destination wallet increases.
- Family total remains unchanged.
- Duplicate transfers are prevented.
- Partial failures do not corrupt balances.

### Balance adjustments
- Negative adjustment decreases balance.
- Positive adjustment increases balance.
- Reason is recorded.
- Audit history is preserved.

### Budgets
- Previous month budget is copied correctly.
- Editing a new month does not change historical budgets.
- Spending is assigned correctly.
- Over-budget calculation is accurate.

### Authentication and security
- Cục Thịt can log in independently.
- Cục Cá can log in independently.
- Unauthorized users cannot access family data.
- RLS policies prevent unauthorized database operations.

### Migration
- Source and target record counts are reconciled.
- Financial totals are checked.
- Duplicate import is prevented.
- Exceptional records are reported.

---

## 13. DOCUMENTATION MANAGEMENT

Maintain these documents:

- `CLAUDE.md`
- `docs/REQUIREMENTS_SPECIFICATION.md`
- `docs/SYSTEM_DESIGN.md`
- `docs/BUSINESS_RULES.md`
- `docs/DATABASE_SCHEMA.md`
- `docs/UI_UX_GUIDELINES.md`
- `docs/DATA_MIGRATION.md`
- `docs/SECURITY.md`
- `docs/DEPLOYMENT_GUIDE.md`
- `docs/TESTING_STRATEGY.md`
- `docs/CHANGELOG.md`

Not all documents must exist during initial discovery.

Create them progressively.

Whenever an approved requirement changes:
1. Update the specification.
2. Update related business rules.
3. Update database documentation if needed.
4. Update tests.
5. Record the change.

---

## 14. COMMUNICATION RULES

The user is comfortable with business and operational concepts but may not be experienced with advanced software engineering.

Therefore:

- Explain technical decisions in clear Vietnamese.
- Avoid unexplained technical jargon.
- Provide practical examples.
- Explain trade-offs.
- Do not overwhelm the user with unnecessary implementation details.
- Clearly distinguish confirmed decisions from recommendations.
- Ask focused questions when clarification is required.
- Do not repeatedly ask for information already provided.

When presenting technical options, use:

1. Recommended solution.
2. Why it is recommended.
3. Advantages.
4. Disadvantages.
5. Cost and operational implications.
6. Migration implications.

Do not ask the user to make technical decisions that can be safely handled by an experienced architect, unless those decisions materially affect cost, privacy, business requirements or future maintenance.

---

## 15. CRITICAL RESTRICTIONS

Never:

- Start coding before requirements and implementation planning are approved.
- Silently change confirmed financial rules.
- Delete historical financial records to correct balances.
- Count transfers as income or expenses.
- Use floating-point arithmetic for money.
- Hardcode wallet names or categories.
- Hardcode family member display names as database identifiers.
- Expose secrets or private keys.
- Store sensitive family data in public repositories.
- Introduce paid services without approval.
- Claim that an untested feature works.
- Import historical data without reconciliation.
- Modify the source Excel workbook.
- Build unnecessary features outside the approved scope.

---

## 16. DEFINITION OF DONE

A feature is complete only when:

- Requirements are satisfied.
- Business rules are implemented.
- Database integrity is maintained.
- Security is considered.
- UI/UX is usable.
- Relevant tests pass.
- Documentation is updated.
- Known limitations are reported.

A deployment is complete only when:
- Production environment is configured.
- Authentication works.
- Database policies are verified.
- Core financial operations work.
- Backup strategy is tested.
- Mobile experience is checked.
- No critical errors remain.

---

## 17. FINAL PROJECT PRINCIPLE

The primary purpose of this system is not to create the most sophisticated financial application.

It is to create a tool that Cục Thịt and Cục Cá can use every day with minimal effort and trust its financial data.

Prioritize in this order:

1. Data accuracy.
2. Financial integrity.
3. Security and privacy.
4. Ease of daily use.
5. Reliability.
6. Clear reporting.
7. Maintainability.
8. Extensibility.
9. Visual sophistication.

**A simple, accurate and consistently used financial system is better than a complex system that is difficult to maintain or produces unreliable numbers.**

Always optimize for long-term family use, not just a successful initial demonstration.

---

## 18. GHI CHÚ VỀ LỊCH SỬ DỰ ÁN (bổ sung 07/11/2026)

Dự án này đã trải qua các giai đoạn:

1. **Khảo sát & đặc tả** (`docs/REQUIREMENTS_SPECIFICATION.md` v1.0, duyệt 05/11/2026): kiến trúc ban đầu là PostgreSQL/Supabase/Next.js/Vercel đúng theo mục 4 ở trên.
2. **Chuyển hướng tạm thời sang Google Sheets + Apps Script** (REQUIREMENTS_SPECIFICATION.md v1.1, 06/11/2026): để có bản dùng được ngay với 0 chi phí, 0 hạ tầng cần dựng, trong lúc chưa có thời gian làm bản đầy đủ. **Toàn bộ nghiệp vụ không đổi** — chỉ đổi công nghệ lưu trữ/chạy.
3. **Xây dựng đầy đủ trên Apps Script** (repo `family-finance`, nhánh `apps-script-build`): đã hoàn thành Ví, Giao dịch, Ngân sách 6 lọ, Tài sản/Nợ vay (kèm lãi suất theo thời gian), Vàng, Sổ cưới, Sự kiện, quy trình thẻ tín dụng — tất cả đã có 53 test case tự động, đã nhập xong dữ liệu lịch sử từ `Appsheet_Finance.xlsx`. **`docs/BUSINESS_RULES.md` và `docs/DATABASE_SCHEMA.md` trong repo này là bản MỚI NHẤT và ĐẦY ĐỦ NHẤT** — đầy đủ hơn `REQUIREMENTS_SPECIFICATION.md` và các tài liệu nháp cũ trong `02_Project_Documents`, vì có thêm toàn bộ quy tắc được xác nhận trong quá trình xây dựng thực tế.
4. **Quay lại kiến trúc Supabase + Vercel** (07/11/2026): vì tốc độ Apps Script chậm dần theo số lượng giao dịch (không có cache giữa các lần gọi, không có index khi đọc Google Sheets). Xem `docs/MIGRATION_PLAN.md` (v0.2) cho kế hoạch viết lại.

**Khi đọc lại dự án từ đầu trên một project/máy mới, thứ tự đọc tài liệu nên là:**
1. File này (`CLAUDE.md`) — nguyên tắc chủ đạo, không đổi dù công nghệ đổi.
2. `docs/REQUIREMENTS_SPECIFICATION.md` — bối cảnh và các REQ-ID gốc.
3. `docs/BUSINESS_RULES.md` — quy tắc nghiệp vụ mới nhất, chi tiết nhất, có hiệu lực cao nhất khi có mâu thuẫn với tài liệu khác.
4. `docs/DATABASE_SCHEMA.md` — cấu trúc dữ liệu hiện tại (Google Sheets), dùng làm cơ sở thiết kế bảng Postgres.
5. `docs/UI_UX_GUIDELINES.md` — đặc tả giao diện/trải nghiệm chi tiết (màu, typography, bố cục, từng màn hình) cho bản Supabase/Next.js — dùng khi code Giai đoạn 7.
6. `docs/MIGRATION_PLAN.md` — kế hoạch triển khai Supabase + Vercel, các giai đoạn, tiêu chí hoàn thành.
7. `docs/DATA_MIGRATION.md` — lịch sử nhập dữ liệu Excel → Sheets, để tham khảo quy trình đối soát khi nhập Sheets → Postgres.

Mã nguồn Apps Script hiện tại (`apps-script/`) **không cần mang qua** dự án Next.js/Supabase mới — không dùng lại được do khác ngôn ngữ/kiến trúc hoàn toàn. Giữ nguyên trong repo cũ làm lịch sử/tham khảo, không xoá.
