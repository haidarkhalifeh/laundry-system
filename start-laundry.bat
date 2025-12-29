@echo off
REM Start the already built Next.js app
start cmd /k "npm start"
REM Open default browser at localhost:3000
start http://localhost:3000/invoices
exit
