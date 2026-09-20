# Budget-Web
React+Laravel web-based clone of an Android budgeting app, packaged as a NativePHP Android APK.

### alpha 0.2.5 — Performance, UI Polish & Graphing
- **Performance Optimizations**: Drastically reduced load times by muting NativePHP's JumpBridge off-device, lazy-loading savings ledgers via Inertia, memoising Budget aggregates, and optimizing BCV API caching.
- **Advanced Graphing**: Multi-metric "Flujo" graph tracking Available Budget, Expenses, and Savings.
- **Presupuesto Threshold**: Dotted threshold line on charts with dynamic green/red color coding based on affordability.
- **Planning Categories**: Reworked category logic where `is_presupuesto` flag enables planning without affecting real cash balance.
- **Category Accordion**: Modern accordion dialog for quick category switching, creation, and deletion.
- **Additive Transactions**: Re-implemented "Add to current" logic for Incomes and Debt payments.
- **Debt History**: Individual payment tracking with a full viewable/deletable history log.
- **Historical Rates**: Calendar-based historical BCV rate picker for budget configuration.
- **Dynamic Mockups**: Improved seeder to generate 4-month trends (3 up, 1 down) from any starting month.

## Planned phases

### alpha 0.3.0 —
