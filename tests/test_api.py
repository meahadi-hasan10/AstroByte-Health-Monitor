import importlib.util
import io
import json
import os
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch, MagicMock

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('astrobyte_app',ROOT/'app.py')
server=importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)

BASE={'hr':72,'spo2':98,'temp':36.6,'sleep':7.1,'fatigue':28,'radiation':1.4}

class BackendTests(TestCase):
    def setUp(self):
        self.client=server.app.test_client()

    def test_home_assets_and_health(self):
        self.assertEqual(self.client.get('/').status_code,200)
        for src in ('index.html','app.js','engine.js','styles.css','assets/astrobyte-logo.png'):
            self.assertEqual(self.client.get('/'+src).status_code,200,src)
        self.assertEqual(self.client.get('/api/health').json['ok'],True)
        self.assertEqual(self.client.get('/not-found.html').status_code,404)

    def test_local_summary_no_key(self):
        with patch.dict(os.environ,{'OPENAI_API_KEY':''}):
            res=self.client.post('/api/ai-summary',json=BASE)
        self.assertEqual(res.status_code,200)
        self.assertEqual(res.json['mode'],'local')
        self.assertIn('risk index 11/100',res.json['summary'])

    def test_alert_and_validation(self):
        values={'hr':116,'spo2':91,'temp':38.1,'sleep':4.1,'fatigue':83,'radiation':6.3}
        with patch.dict(os.environ,{'OPENAI_API_KEY':''}):
            res=self.client.post('/api/ai-summary',json=values)
        self.assertEqual(res.status_code,200)
        self.assertIn('Elevated',res.json['summary'])
        self.assertEqual(self.client.post('/api/ai-summary',json={}).status_code,400)
        self.assertEqual(self.client.post('/api/ai-summary',json={**BASE,'spo2':200}).status_code,400)

    @patch.object(server.requests,'get')
    def test_nasa_success_is_historical(self,get):
        mock=MagicMock()
        mock.json.return_value=[
            {'timestamp':'2022-04-01T23:00','absorbed_dose_rate':2.2,'instrument_id':'DosTel1'},
            {'timestamp':'2022-04-01T23:05','absorbed_dose_rate':2.7,'instrument_id':'DosTel1'}]
        get.return_value=mock
        res=self.client.get('/api/nasa/radiation')
        self.assertEqual(res.status_code,200)
        self.assertTrue(res.json['ok'])
        self.assertFalse(res.json['real_time'])
        self.assertEqual(len(res.json['radiation_series']),2)
        self.assertEqual(res.json['record_count'],2)
        self.assertIn('timestamp%3E',get.call_args.args[0])

    @patch.object(server.requests,'get')
    def test_nasa_failure_no_fake_reading(self,get):
        get.side_effect=server.requests.exceptions.ConnectionError('offline')
        res=self.client.get('/api/nasa/radiation')
        self.assertEqual(res.status_code,503)
        self.assertFalse(res.json['ok'])
        self.assertNotIn('sample',res.json)

if __name__=='__main__':
    import unittest
    unittest.main()
