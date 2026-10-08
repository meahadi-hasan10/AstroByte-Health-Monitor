# Feature Test Summary

**Project:** AstroByte Health Monitor  
**Team:** Team AstroByte

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

**Note:** Health indicators are simulated, and risk assessments are illustrative rather than clinically validated.