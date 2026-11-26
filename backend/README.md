# SURAKSHA-DRISHTI — Backend (Group 3)

## Setup (Windows 11 PowerShell)
```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload