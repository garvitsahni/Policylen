import unittest
from unittest import mock

from . import main

def _ok(answer='{"insurer_name": "X"}'):
    return {"answer": answer, "grounded": False, "cited_clause_id": None, "raw_error": None}

def _err(message):
    return {"answer": None, "grounded": False, "cited_clause_id": None, "raw_error": message}


class ExtractionChainTests(unittest.TestCase):

    def test_gemini_is_primary_and_used_when_successful(self):
        with mock.patch.object(main, 'call_gemini', return_value=_ok()) as g, \
             mock.patch.object(main, 'call_openrouter', side_effect=AssertionError('openrouter should not be called')) as o, \
             mock.patch.object(main, 'call_nvidia', side_effect=AssertionError('nvidia should not be called')) as n, \
             mock.patch.object(main, 'call_groq', side_effect=AssertionError('groq should not be called')) as gr:
            result = main.call_llm('sys', 'user', extraction=True,
                                   max_tokens=8192, temperature=0.1,
                                   response_schema=main.EXTRACTION_SCHEMA, response_json=True)
        self.assertEqual(result['raw_error'], None)
        self.assertEqual(result['answer'], '{"insurer_name": "X"}')
        g.assert_called_once()
        self.assertFalse(o.called)
        self.assertFalse(n.called)
        self.assertFalse(gr.called)

    def test_openrouter_is_fallback_when_gemini_fails(self):
        with mock.patch.object(main, 'call_gemini', return_value=_err('Gemini quota exhausted')) as g, \
             mock.patch.object(main, 'call_openrouter', return_value=_ok()) as o:
            result = main.call_llm('sys', 'user', extraction=True, max_tokens=8192, temperature=0.1,
                                   response_schema=main.EXTRACTION_SCHEMA, response_json=True)
        self.assertEqual(result['raw_error'], None)
        self.assertEqual(result['answer'], '{"insurer_name": "X"}')
        g.assert_called_once()
        o.assert_called_once()

    def test_all_providers_failed_surfaces_combined_error(self):
        with mock.patch.object(main, 'call_gemini', return_value=_err('gemini down')), \
             mock.patch.object(main, 'call_openrouter', return_value=_err('or down')), \
             mock.patch.object(main, 'call_nvidia', return_value=_err('nv down')), \
             mock.patch.object(main, 'groq_extract_chunked', return_value=_err('groq down')):
            result = main.call_llm('sys', 'user', extraction=True, max_tokens=8192, temperature=0.1,
                                   response_schema=main.EXTRACTION_SCHEMA, response_json=True)
        self.assertIsNone(result['answer'])
        self.assertIn('gemini', result['raw_error'])
        self.assertIn('groq', result['raw_error'])


class GeminiAuthFailFastTests(unittest.TestCase):

    def _make_client(self, exc):
        client = mock.Mock()
        client.models.generate_content.side_effect = exc
        return client

    def test_auth_error_returns_immediately_without_retry(self):
        client = self._make_client(RuntimeError('API key not valid. Please pass a valid API key. (401)'))
        with mock.patch.object(main, '_get_gemini_client', return_value=client), \
             mock.patch.object(main.time, 'sleep') as sleep:
            result = main.call_gemini('sys', 'user')
        self.assertIsNone(result['answer'])
        self.assertIn('API key not valid', result['raw_error'])
        self.assertEqual(client.models.generate_content.call_count, 1)
        sleep.assert_not_called()

    def test_permission_denied_returns_immediately_without_retry(self):
        client = self._make_client(RuntimeError('403 PERMISSION_DENIED'))
        with mock.patch.object(main, '_get_gemini_client', return_value=client), \
             mock.patch.object(main.time, 'sleep') as sleep:
            result = main.call_gemini('sys', 'user')
        self.assertIsNone(result['answer'])
        self.assertEqual(client.models.generate_content.call_count, 1)
        sleep.assert_not_called()

    def test_quota_error_still_returns_immediately(self):
        client = self._make_client(RuntimeError('429 RESOURCE_EXHAUSTED'))
        with mock.patch.object(main, '_get_gemini_client', return_value=client), \
             mock.patch.object(main.time, 'sleep') as sleep:
            result = main.call_gemini('sys', 'user')
        self.assertIsNone(result['answer'])
        self.assertIn('quota exhausted', result['raw_error'])
        self.assertEqual(client.models.generate_content.call_count, 1)
        sleep.assert_not_called()

    def test_transient_error_still_retries(self):
        client = self._make_client(RuntimeError('503 Service Unavailable'))
        with mock.patch.object(main, '_get_gemini_client', return_value=client), \
             mock.patch.object(main.time, 'sleep') as sleep:
            result = main.call_gemini('sys', 'user')
        self.assertIsNone(result['answer'])
        self.assertEqual(client.models.generate_content.call_count, main.MAX_RETRIES)
        sleep.assert_called()


if __name__ == '__main__':
    unittest.main()
