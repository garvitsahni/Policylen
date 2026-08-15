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


if __name__ == '__main__':
    unittest.main()
