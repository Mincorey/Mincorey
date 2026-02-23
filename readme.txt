
# Airport Fuel & Lubricants Service App Development Log

This file tracks the history of requests and developments for the application.

... [Previous entries] ...

## Thirty-Fifth Request (Unclosed Shift Check)
- Added 'Status' column to the SMENA sheet to track if a shift is 'Открыта' (Open) or 'Закрыта' (Closed).
- Implemented findUnclosedShift utility to scan the log for any unclosed records on application startup.
- Added a bounce-animated warning UI on the login screen if an unclosed shift is detected.
- Updated handleEndShift to correctly mark the session as 'Закрыта' in the Excel database.
- Improved handleEmployeeSelect to prevent new shift openings if an active unclosed shift belongs to another person.

## Thirty-Sixth Request (TZA Issue Logic Update)
- Removed automatic fuel volume/mass subtraction from the 'Zamer' sheet after a TZA issue.
- Rationale: Staff performs a physical measurement (zamer) after the operation, and manual entry of the new level via the measurement tool is the authoritative source of truth.
