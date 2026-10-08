import json
import math
import os
from pathlib import Path
from flask import Flask, jsonify, request, send_from_directory
import requests

ROOT=Path(__file__).resolve().parent
app=Flask(__name__,static_folder=None)
STATIC_FILES={'index.html','styles.css','app.js','engine.js'}
RADLAB_URL=('https://visualization.osdr.nasa.gov/radlab/api/'
            '?spacecraft=ISS&instrument=DosTel'
            '&timestamp%3E=2022-04-01T23%3A00'
            '&timestamp%3C2022-04-02T01%3A05'
            '&absorbed_dose_rate&flux&latitude&longitude&altitude&format=json')
LIMITS={'hr':(45,140),'spo2':(85,100),'temp':(34,40),'sleep':(2,10),
        'fatigue':(0,100),'radiation':(0,12)}

@app.get('/')
def index():
    return send_from_directory(ROOT,'index.html')

@app.get('/<path:path>')
def serve_static(path):
    if path not in STATIC_FILES and not (path.startswith('assets/') and '..' not in path):
        return jsonify(error='File not found'),404
    return send_from_directory(ROOT,path)

@app.get('/api/health')
def health():
    return jsonify(ok=True,mode='prototype',nasa_data='on-demand historical query')

def validated_telemetry(data):
    if not isinstance(data,dict):
        raise ValueError('Provide a JSON telemetry object')
    clean={}
    for key,(low,high) in LIMITS.items():
        raw=data.get(key)
        if isinstance(raw,bool): raise ValueError(f'Invalid {key}')
        try: value=float(raw)
        except (TypeError,ValueError): raise ValueError(f'Missing or invalid {key}') from None
        if not math.isfinite(value) or not low<=value<=high:
            raise ValueError(f'{key} must be {low}–{high}')
        clean[key]=value
    return clean

def local_summary(values):
    v=validated_telemetry(values)
    scored={
        'hr':95 if v['hr']<42 or v['hr']>125 else 58 if v['hr']<50 or v['hr']>105 else 12,
        'spo2':96 if v['spo2']<90 else 62 if v['spo2']<94 else 8,
        'temp':90 if v['temp']<34.8 or v['temp']>38.6 else 55 if v['temp']<35.4 or v['temp']>37.7 else 10,
        'sleep':80 if v['sleep']<4.5 else 48 if v['sleep']<6 else 12,
        'fatigue':88 if v['fatigue']>78 else 54 if v['fatigue']>55 else max(5,min(45,v['fatigue']*.55)),
        'radiation':90 if v['radiation']>8 else 58 if v['radiation']>4 else max(4,min(38,v['radiation']*7))
    }
    risk=round(min(100,scored['hr']*.20+scored['spo2']*.22+scored['temp']*.14+
                       scored['sleep']*.12+scored['fatigue']*.16+scored['radiation']*.16+
                       (9 if v['sleep']<5.5 and v['fatigue']>60 else 0)+
                       (10 if v['spo2']<94 and v['hr']>105 else 0)+
                       (6 if v['radiation']>4 and v['fatigue']>55 else 0)))
    status='Stable' if risk<35 else 'Watch' if risk<65 else 'Elevated'
    findings=[];checks=[]
    if v['spo2']<94: findings.append(f"SpO2 {v['spo2']:.0f}%");checks.append('verify sensor fit and repeat reading')
    if v['hr']<50 or v['hr']>105: findings.append(f"heart rate {v['hr']:.0f} bpm");checks.append('compare with workload and baseline')
    if v['temp']<35.4 or v['temp']>37.7: findings.append(f"temperature {v['temp']:.1f} C");checks.append('repeat measurement and review symptoms')
    if v['sleep']<6: findings.append(f"sleep {v['sleep']:.1f} h");checks.append('review rest and recovery')
    if v['fatigue']>55: findings.append(f"fatigue index {v['fatigue']:.0f}");checks.append('monitor workload')
    if v['radiation']>4: findings.append(f"illustrative radiation {v['radiation']:.1f} uGy/h");checks.append('consult approved mission radiation guidance')
    if not findings:
        return (f'Prototype status: {status} (illustrative risk index {risk}/100). All synthetic readings are within the configured demo reference bands. '
                'Keep monitoring trends and verify measurements. Not medical advice.')
    return (f'Prototype status: {status} (illustrative risk index {risk}/100). Flagged: '+', '.join(findings)+'. '
            'Suggested next checks: '+'; '.join(checks)+'. Verify measurements and follow qualified mission medical procedures. Not a diagnosis.')

def output_text(payload):
    if isinstance(payload,dict):
        if isinstance(payload.get('output_text'),str) and payload['output_text'].strip():
            return payload['output_text'].strip()
        for item in payload.get('output',[]):
            if not isinstance(item,dict): continue
            for block in item.get('content',[]):
                if isinstance(block,dict) and isinstance(block.get('text'),str) and block['text'].strip():
                    return block['text'].strip()
    return None

@app.post('/api/ai-summary')
def ai_summary():
    if request.content_length and request.content_length>5000:
        return jsonify(error='Payload too large'),413
    try:
        values=validated_telemetry(request.get_json(silent=True))
    except ValueError as exc:
        return jsonify(error=str(exc)),400
    fallback=local_summary(values)
    api_key=os.getenv('OPENAI_API_KEY')
    if not api_key:
        return jsonify(mode='local',summary=fallback)
    try:
        prompt=("You are generating an accessible, short health telemetry explanation for an educational "
                "NASA Space Apps software prototype. These values are SYNTHETIC and heuristic thresholds are NOT medically validated. "
                "Summarize changes and questions a crew member should verify in 3 to 5 concise sentences. "
                "Do not diagnose or claim that the NASA RadLab readings are live; radiation in this input is simulated. "
                "Do not offer medical treatment. Encourage established mission medical procedures. "
                "Make your limitations explicit. Telemetry: "+json.dumps(values,sort_keys=True))
        response=requests.post('https://api.openai.com/v1/responses',
            headers={'Authorization':f'Bearer {api_key}','Content-Type':'application/json'},
            json={'model':os.getenv('OPENAI_MODEL','gpt-4.1-mini'),'input':prompt,'max_output_tokens':240},timeout=15)
        response.raise_for_status()
        result=output_text(response.json())
        if result:return jsonify(mode='llm',summary=result)
    except (requests.RequestException,ValueError,KeyError,TypeError):
        pass
    return jsonify(mode='local',summary=fallback)

def extract_records(payload):
    if isinstance(payload,list):return payload
    if isinstance(payload,dict):
        for key in ('data','records','results','readings'):
            if isinstance(payload.get(key),list):return payload[key]
    return []

@app.get('/api/nasa/radiation')
def nasa_radiation():
    """Historical ISS/DosTel window per the official NASA RadLab Data API example.

    The response intentionally sends just a count and one sample record, never
    asserts real-time crew telemetry or mixes this with simulated health input.
    """
    try:
        r=requests.get(RADLAB_URL,timeout=14,headers={'Accept':'application/json'})
        r.raise_for_status()
        payload=r.json()
        records=extract_records(payload)
        if not records:
            return jsonify(ok=False,error='NASA returned no parseable historical records for the example window.'),502
        sample=records[0]
        if isinstance(sample,dict): sample={str(k):v for k,v in list(sample.items())[:12]}
        elif isinstance(sample,list): sample=sample[:12]
        # Limited, separately-labelled historical series for NASA visualization.
        # Never use these readings as simulated astronaut patient measurements.
        series=[]
        stride=max(1,math.ceil(len(records)/48))
        for row in records[::stride]:
            if not isinstance(row,dict): continue
            dose=row.get('absorbed_dose_rate')
            try:
                value=float(dose)
                if math.isfinite(value) and value>=0:
                    series.append({'timestamp':str(row.get('timestamp',''))[:40],
                                   'dose_rate_uGy_h':round(value,5)})
            except (TypeError,ValueError):
                continue
        return jsonify(ok=True,source='NASA OSDR RadLab',source_url=RADLAB_URL,
                       period='2022-04-01T23:00 through 2022-04-02T01:05',
                       real_time=False,record_count=len(records),sample=sample,
                       radiation_series=series[:48])
    except (requests.RequestException,ValueError,TypeError,KeyError):
        return jsonify(ok=False,error='Historical NASA endpoint unavailable or returned an unsupported response; synthetic demo remains available.'),503

if __name__=='__main__':
    app.run(host='127.0.0.1',port=int(os.getenv('PORT','5000')),debug=False)
