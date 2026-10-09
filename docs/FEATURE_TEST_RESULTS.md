# Feature Test Summary

**Project:** AstroByte Health Monitor  
**Team:** Team AstroByte  

## Verified Features

- **Website Deployment:** Successfully deployed on Vercel; frontend functionality manually verified.
- **Flask Backend:** AI Summary API working successfully with rule-based responses (`mode: local`).
- **NASA RadLab API:** Successfully retrieved 180 historical radiation records and visualized 45 sampled measurements.
- **Code Testing:** JavaScript engine tests (15+ checks) and Python syntax checks passed on the earlier Final UI v3 source.

## Test Commands

```bash
node --check app.js
node --check engine.js
node tests/engine.test.js
python -m py_compile app.py tests/test_api.py
```

After installing dependencies (`pip install -r requirements.txt`), run:

```bash
python -m unittest discover -s tests -p 'test_*.py' -v
```


**Note:** Health indicators are simulated, and risk assessments are illustrative rather than clinically validated. NASA radiation measurements are historical and displayed separately.
